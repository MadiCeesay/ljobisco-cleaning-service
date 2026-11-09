import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, csrf, post } from './helpers.js';
import { login, bookingValues, quoteValues } from './actors.js';
import { Audit, Booking } from '../src/models.js';

test('request approval is administrator-only, revision-checked, audited and separate from acceptance or scheduling', async () => {
  const context = await setup();
  try {
    const customer = await login(context);
    const admin = await login(context, 'ADMIN');
    const booking = (await post(customer.agent, '/bookings', customer.token, bookingValues()).expect(201)).body;
    const path = `/admin/bookings/${booking.id}/approve`;
    const values = { id: booking.id, expectedRevision: booking.revision };
    const guest = context.agent();
    await post(guest, path, await csrf(guest), values).expect(401);
    await post(customer.agent, path, customer.token, values).expect(403);
    await admin.agent.post('/api' + path).send(values).expect(403);
    await post(admin.agent, path, admin.token, { ...values, status: 'Scheduled' }).expect(422);
    await post(admin.agent, path, admin.token, { ...values, expectedRevision: 99 }).expect(409);
    const approved = (await post(admin.agent, path, admin.token, values).expect(200)).body.record;
    assert.equal(approved.status, 'Under Review');
    assert(approved.requestApprovedAt);
    assert.equal(approved.revision, booking.revision + 1);
    await post(admin.agent, path, admin.token, values).expect(409);
    await post(admin.agent, path, admin.token, { ...values, expectedRevision: approved.revision }).expect(409);
    const persisted = await Booking.findById(booking.id);
    assert.equal(persisted.acceptedQuoteId, undefined);
    assert.equal(persisted.scheduledDate, undefined);
    assert.equal(persisted.paidMinor, 0);
    assert.equal(persisted.currentVersion, 0);
    assert.equal(await Audit.countDocuments({ action: 'booking.request-approved' }), 1);
    assert((await customer.agent.get(`/api/bookings/${booking.id}`)).body.requestApprovedAt);
    await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id)).expect(201);
    const quoted = (await admin.agent.get(`/api/bookings/${booking.id}`)).body;
    await post(admin.agent, path, admin.token, { ...values, expectedRevision: quoted.revision }).expect(409);
  } finally { await context.close(); }
});
