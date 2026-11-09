import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, post } from './helpers.js';
import { login, bookingValues, quoteValues } from './actors.js';
import { defaultSettings } from '../src/domain.js';
import { Booking, Quotation, Message, Conversation, Audit, Settings } from '../src/models.js';

test('WhatsApp settings require administrator authorization, CSRF, canonical international format and revision checks', async () => {
  const context = await setup();
  try {
    const customer = await login(context); const admin = await login(context, 'ADMIN');
    assert.equal((await context.agent().get('/api/business').expect(200)).body.whatsappNumber, '+2205393273');
    await post(customer.agent, '/admin/settings', customer.token, { expectedRevision: 0, values: defaultSettings }).expect(403);
    await admin.agent.post('/api/admin/settings').send({ expectedRevision: 0, values: defaultSettings }).expect(403);
    for (const number of ['07700900123', '+012345678', '+44abc7700900123', '+1234567890123456', 'https://example.test']) await post(admin.agent, '/admin/settings', admin.token, { expectedRevision: 0, values: { ...defaultSettings, whatsappNumber: number } }).expect(422);
    const saved = await post(admin.agent, '/admin/settings', admin.token, { expectedRevision: 0, values: { ...defaultSettings, whatsappNumber: '+44 (7700) 900-123' } }).expect(200);
    assert.equal(saved.body.record.whatsappNumber, '+447700900123');
    assert.equal((await context.agent().get('/api/business')).body.whatsappNumber, '+447700900123');
    assert.equal((await Settings.findOne({ key: 'business' })).values.whatsappNumber, '+447700900123');
    await post(admin.agent, '/admin/settings', admin.token, { expectedRevision: 0, values: defaultSettings }).expect(409);
    await post(admin.agent, '/admin/settings', admin.token, { expectedRevision: 1, values: defaultSettings }).expect(200);
    assert.equal((await context.agent().get('/api/business')).body.whatsappNumber, '+2205393273');
    assert.equal(await Audit.countDocuments({ action: 'settings.updated' }), 2);
  } finally { await context.close(); }
});

test('retired chat cannot change formal offers; clarification and revision audit remain in the backend', async () => {
  const context = await setup();
  try {
    const customer = await login(context); const other = await login(context); const admin = await login(context, 'ADMIN');
    const booking = (await post(customer.agent, '/bookings', customer.token, bookingValues()).expect(201)).body;
    await post(admin.agent, `/admin/bookings/${booking.id}/information-requests`, admin.token, { id: booking.id, expectedRevision: 0, values: { message: 'Please clarify the rooms requiring cleaning.' } }).expect(200);
    const first = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id)).expect(201)).body;
    await customer.agent.get(`/api/conversations/${booking.id}/messages`).expect(410);
    await post(customer.agent, `/conversations/${booking.id}/messages`, customer.token, { text: 'I accept. Change the amount.' }).expect(410);
    await context.agent().get(`/api/conversations/${booking.id}/messages`).expect(401);
    assert.equal((await Quotation.findById(first.id)).status, 'Sent');
    assert.equal((await Booking.findById(booking.id)).acceptedQuoteId, undefined);
    const revised = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id, 1)).expect(201)).body;
    await post(customer.agent, `/quotations/${first.id}/response`, customer.token, { action: 'accept', expectedVersion: 1 }).expect(409);
    await post(other.agent, `/quotations/${revised.id}/response`, other.token, { action: 'accept', expectedVersion: 2 }).expect(404);
    await post(customer.agent, `/quotations/${revised.id}/response`, customer.token, { action: 'accept', expectedVersion: 2 }).expect(200);
    assert.equal(await Message.countDocuments(), 0); assert.equal(await Conversation.countDocuments(), 0);
    assert.equal(await Audit.countDocuments({ action: 'quotation.issued' }), 2);
    assert.equal(await Audit.countDocuments({ action: 'quotation.accepted' }), 1);
    const history = (await Booking.findById(booking.id)).history;
    assert.equal(history.length, 5);
    assert.match(history[1].title, /Please clarify the rooms requiring cleaning/);
    await context.agent().get('/socket.io/?EIO=4&transport=polling').expect(404);
  } finally { await context.close(); }
});
