import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, post } from './helpers.js';
import { Quotation } from '../src/models.js';
import { login, bookingValues, quoteValues } from './actors.js';

test('simplified request persists optional rooms and preferred date without fabricated scheduling', async () => {
  const context = await setup();
  try {
    const customer = await login(context);
    const values = { ...bookingValues(), rooms: '', date: '' };
    delete values.propertyType;
    const booking = (await post(customer.agent, '/bookings', customer.token, values).expect(201)).body;
    assert.equal(booking.propertyType, '');
    assert.equal(booking.rooms, '');
    assert.equal(booking.date, '');
    assert.equal(booking.status, 'Submitted');
    const persisted = (await customer.agent.get(`/api/bookings/${booking.id}`).expect(200)).body;
    assert.equal(persisted.date, '');
    assert.equal(persisted.rooms, '');
  } finally { await context.close(); }
});
test('ownership, administrator issuance, immutable revisions, expiry and concurrent formal acceptance', async () => {
  const context = await setup();
  try {
    const customer = await login(context); const other = await login(context); const admin = await login(context, 'ADMIN');
    await post(customer.agent, '/bookings', customer.token, { ...bookingValues(), status: 'Completed' }).expect(422);
    const values = bookingValues(); const booking = (await post(customer.agent, '/bookings', customer.token, values).expect(201)).body;
    assert.equal(booking.status, 'Submitted');
    assert.equal((await post(customer.agent, '/bookings', customer.token, values)).body.id, booking.id);
    await other.agent.get(`/api/bookings/${booking.id}`).expect(404);
    await post(customer.agent, '/admin/quotations', customer.token, quoteValues(booking.id)).expect(403);
    const first = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id)).expect(201)).body;
    const second = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id, 1)).expect(201)).body;
    assert.equal(second.total, 5000);
    await post(customer.agent, `/quotations/${first.id}/response`, customer.token, { action: 'accept', expectedVersion: 1 }).expect(409);
    await post(other.agent, `/quotations/${second.id}/response`, other.token, { action: 'accept', expectedVersion: 2 }).expect(404);
    const results = await Promise.all([post(customer.agent, `/quotations/${second.id}/response`, customer.token, { action: 'accept', expectedVersion: 2 }), post(customer.agent, `/quotations/${second.id}/response`, customer.token, { action: 'accept', expectedVersion: 2 })]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
    await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id, 2)).expect(409);
    assert.equal((await Quotation.findById(first.id)).status, 'Superseded');
    const expiredBooking = (await post(customer.agent, '/bookings', customer.token, bookingValues())).body;
    const expired = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(expiredBooking.id))).body;
    await Quotation.collection.updateOne({ _id: (await Quotation.findById(expired.id))._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await post(customer.agent, `/quotations/${expired.id}/response`, customer.token, { action: 'accept', expectedVersion: 1 }).expect(409);
    const overview = (await other.agent.get('/api/customer/overview')).body; assert.equal(overview.bookings.length, 0); assert.equal(overview.quotations.length, 0);
  } finally { await context.close(); }
});
