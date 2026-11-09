import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setup, post } from './helpers.js';
import { login, bookingValues, quoteValues } from './actors.js';
import { Booking, Product, Settings, Payment, Audit } from '../src/models.js';
import { defaultSettings } from '../src/domain.js';

test('HTTP mock failure, deposit, administrator completion and balance preserve the ledger and notification ownership', async () => {
  const context = await setup();
  try {
    const customer = await login(context); const other = await login(context); const admin = await login(context, 'ADMIN');
    let booking = (await post(customer.agent, '/bookings', customer.token, bookingValues()).expect(201)).body;
    const quote = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id)).expect(201)).body;
    const intent = { quotationId: quote.id, expectedVersion: 1, provider: 'mock', choice: 'deposit', requestId: randomUUID(), mockOutcome: 'failed' };
    await post(customer.agent, '/payments/cleaning/intents', customer.token, intent).expect(409);
    await post(customer.agent, `/quotations/${quote.id}/response`, customer.token, { action: 'accept', expectedVersion: 1 }).expect(200);
    assert.equal((await admin.agent.get('/api/admin/workspace').expect(200)).body.balances.find(item => item.bookingId === booking.id).canSchedule, false);
    const failed = (await post(customer.agent, '/payments/cleaning/intents', customer.token, intent).expect(201)).body;
    assert.equal(failed.status, 'Failed'); assert.equal((await Booking.findById(booking.id)).paidMinor, 0);
    const successfulIntent = { ...intent, requestId: randomUUID(), mockOutcome: 'paid' };
    const deposit = (await post(customer.agent, '/payments/cleaning/intents', customer.token, successfulIntent).expect(201)).body;
    assert.equal(deposit.amount, 1500); assert.equal(deposit.status, 'Paid'); assert.match(deposit.providerReference, /^SIMULATED-/);
    assert.equal((await admin.agent.get('/api/admin/workspace').expect(200)).body.balances.find(item => item.bookingId === booking.id).canSchedule, true);
    assert.equal((await post(customer.agent, '/payments/cleaning/intents', customer.token, successfulIntent)).body.id, deposit.id);
    assert.equal(await Payment.countDocuments({ quotationId: quote.id, status: 'Paid' }), 1);
    const balance = { ...successfulIntent, choice: 'balance', requestId: randomUUID() };
    await post(customer.agent, '/payments/cleaning/intents', customer.token, balance).expect(409);
    booking = (await admin.agent.get(`/api/bookings/${booking.id}`)).body;
    for (const status of ['Scheduled', 'In Progress', 'Completed']) booking = (await post(admin.agent, `/admin/bookings/${booking.id}/schedule`, admin.token, { id: booking.id, expectedRevision: booking.revision, values: { status, date: booking.date, time: 'Confirmed test window', note: `Administrator confirmed ${status}` } }).expect(200)).body.record;
    assert.equal((await admin.agent.get('/api/admin/workspace').expect(200)).body.balances.find(item => item.bookingId === booking.id).canSchedule, false);
    const failedBalance = (await post(customer.agent, '/payments/cleaning/intents', customer.token, { ...balance, mockOutcome: 'failed' }).expect(201)).body;
    assert.equal(failedBalance.status, 'Failed'); assert.equal((await Booking.findById(booking.id)).paidMinor, 150000);
    const paidBalance = (await post(customer.agent, '/payments/cleaning/intents', customer.token, { ...balance, requestId: randomUUID() }).expect(201)).body;
    assert.equal(paidBalance.amount, 3500); assert.equal((await Booking.findById(booking.id)).paidMinor, 500000);
    assert.equal((await customer.agent.get('/api/customer/payments-and-orders')).body.cleaningSummaries[0].outstanding, 0);
    assert.equal((await other.agent.get('/api/customer/notifications')).body.notifications.length, 0);
    const updates = (await customer.agent.get('/api/customer/notifications')).body.notifications;
    assert(updates.some(update => update.title.includes('Completed'))); assert(updates.some(update => update.simulated));
    assert.equal(await Audit.countDocuments({ action: 'booking.progress' }), 3);
  } finally { await context.close(); }
});

test('full upfront payment leaves zero balance and failed order payments can retry without deducting stock twice', async () => {
  const context = await setup();
  try {
    const customer = await login(context); const admin = await login(context, 'ADMIN');
    const booking = (await post(customer.agent, '/bookings', customer.token, bookingValues()).expect(201)).body;
    const quote = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id)).expect(201)).body;
    await post(customer.agent, `/quotations/${quote.id}/response`, customer.token, { action: 'accept', expectedVersion: 1 }).expect(200);
    const full = (await post(customer.agent, '/payments/cleaning/intents', customer.token, { quotationId: quote.id, expectedVersion: 1, provider: 'mock', choice: 'full', requestId: randomUUID(), mockOutcome: 'paid' }).expect(201)).body;
    assert.equal(full.amount, 5000);
    assert.equal((await customer.agent.get('/api/customer/payments-and-orders')).body.cleaningSummaries[0].outstanding, 0);
    await post(customer.agent, '/payments/cleaning/intents', customer.token, { quotationId: quote.id, expectedVersion: 1, provider: 'mock', choice: 'balance', requestId: randomUUID() }).expect(409);
    await Settings.create({ key: 'business', values: { ...defaultSettings, pickupEnabled: true, pickupLocation: 'ISOLATED TEST LOCATION ONLY' } });
    const product = await Product.create({ slug: 'isolated-retry-product', name: 'Isolated test product', description: 'Test inventory only', category: 'Tests', priceMinor: 10000, stock: 2, images: [], enabled: true });
    const input = { requestId: randomUUID(), details: { name: 'Test Customer', email: customer.user.email, phone: '+2201234567', fulfilment: 'pickup', address: '', town: '' }, items: [{ id: String(product._id), quantity: 1 }] };
    const order = (await post(customer.agent, '/orders', customer.token, input).expect(201)).body;
    assert.equal((await post(customer.agent, '/orders', customer.token, input)).body.id, order.id);
    const intent = { orderId: order.id, requestId: randomUUID(), provider: 'mock', mockOutcome: 'failed' };
    assert.equal((await post(customer.agent, '/payments/orders/intents', customer.token, intent).expect(201)).body.status, 'Failed');
    assert.equal((await Product.findById(product._id)).stock, 1);
    assert.equal((await post(customer.agent, '/payments/orders/intents', customer.token, { ...intent, requestId: randomUUID(), mockOutcome: 'paid' }).expect(201)).body.status, 'Paid');
    assert.equal((await Product.findById(product._id)).stock, 1);
    await post(customer.agent, '/payments/orders/intents', customer.token, { ...intent, requestId: randomUUID() }).expect(409);
  } finally { await context.close(); }
});
