import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setup, post } from './helpers.js';
import { login, bookingValues, quoteValues } from './actors.js';
import { Booking, Product, Settings, Order } from '../src/models.js';
import { defaultSettings, minor } from '../src/domain.js';
import { expireReservations, paymentProviders, createPayment } from '../src/commerce.js';

test('accepted revised quotation is authoritative, deposit is 30%, duplicate payment is deduplicated and balance is completion-locked', async () => {
  const context = await setup();
  try {
    const customer = await login(context); const other = await login(context); const admin = await login(context, 'ADMIN');
    const booking = (await post(customer.agent, '/bookings', customer.token, bookingValues())).body;
    const first = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id))).body;
    const second = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id, 1))).body;
    await post(customer.agent, `/quotations/${second.id}/response`, customer.token, { action: 'accept', expectedVersion: 2 }).expect(200);
    const payload = { quotationId: second.id, expectedVersion: 2, choice: 'deposit', requestId: randomUUID(), provider: 'mock' };
    await post(customer.agent, '/payments/cleaning/intents', customer.token, { ...payload, quotationId: first.id, expectedVersion: 1 }).expect(409);
    await post(other.agent, '/payments/cleaning/intents', other.token, payload).expect(404);
    await post(customer.agent, '/payments/cleaning/intents', customer.token, { ...payload, amount: 1 }).expect(422);
    const payment = (await post(customer.agent, '/payments/cleaning/intents', customer.token, payload).expect(201)).body;
    assert.equal(payment.amount, 1500); assert.equal(payment.status, 'Paid'); assert.equal(payment.simulated, true);
    assert.equal((await post(customer.agent, '/payments/cleaning/intents', customer.token, payload)).body.id, payment.id);
    await post(customer.agent, '/payments/cleaning/intents', customer.token, { ...payload, requestId: randomUUID() }).expect(409);
    await post(customer.agent, '/payments/cleaning/intents', customer.token, { ...payload, choice: 'balance', requestId: randomUUID() }).expect(409);
    const canonical = await Booking.findById(booking.id); assert.equal(canonical.paidMinor, 150000); assert.equal(500000 - canonical.paidMinor, 350000);
    canonical.status = 'Completed'; await canonical.save();
    const balance = (await post(customer.agent, '/payments/cleaning/intents', customer.token, { ...payload, choice: 'balance', requestId: randomUUID() }).expect(201)).body;
    assert.equal(balance.amount, 3500);
    await post(customer.agent, '/payments/cleaning/intents', customer.token, { ...payload, provider: 'wave', requestId: randomUUID() }).expect(503);
    assert.equal(paymentProviders({ production: true, MOCK_PAYMENTS_ENABLED: true }).mock.enabled, false);
  } finally { await context.close(); }
});
test('checkout revalidates configuration/inventory and concurrent orders cannot oversell; reservations release once', async () => {
  const context = await setup();
  try {
    const customer = await login(context); const other = await login(context);
    const product = await Product.create({ slug: 'fixture-only-product', name: 'Test-only inventory', description: 'This is an isolated integration fixture.', category: 'Tests', priceMinor: 12500, stock: 1, images: [], enabled: true });
    const payload = { requestId: randomUUID(), details: { name: 'Test Customer', email: customer.user.email, phone: '+2201234567', fulfilment: 'pickup', address: '', town: '' }, items: [{ id: String(product._id), quantity: 1 }] };
    await post(customer.agent, '/orders', customer.token, payload).expect(422);
    await Settings.create({ key: 'business', values: { ...defaultSettings, pickupEnabled: true, pickupLocation: 'Integration test pickup location only' } });
    const results = await Promise.all([post(customer.agent, '/orders', customer.token, payload), post(other.agent, '/orders', other.token, { ...payload, requestId: randomUUID() })]);
    assert.deepEqual(results.map(result => result.status).sort(), [201, 409]); assert.equal((await Product.findById(product._id)).stock, 0);
    const order = results.find(result => result.status === 201).body; const actor = order.customerId === String(customer.user._id) ? customer : other;
    const paid = (await post(actor.agent, '/payments/orders/intents', actor.token, { orderId: order.id, requestId: randomUUID(), provider: 'mock' }).expect(201)).body;
    assert.equal(paid.amount, 125); assert.equal(paid.status, 'Paid');
    assert.equal((await actor.agent.get(`/api/orders/${order.id}`)).body.paymentStatus, 'Paid');
    await Product.updateOne({ _id: product._id }, { $set: { stock: 1 } });
    const unpaid = (await post(customer.agent, '/orders', customer.token, { ...payload, requestId: randomUUID() })).body;
    await Order.updateOne({ _id: unpaid.id }, { $set: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await expireReservations(); await expireReservations(); assert.equal((await Product.findById(product._id)).stock, 1);
    await post(customer.agent, '/payments/orders/intents', customer.token, { orderId: unpaid.id, requestId: randomUUID(), provider: 'mock' }).expect(409);
  } finally { await context.close(); }
});
test('integer minor-unit conversion and server mock failure release funds without marking paid', async () => {
  assert.equal(minor('0.01'), 1); assert.equal(minor('100.10'), 10010); assert.throws(() => minor('1.001'));
  const context = await setup();
  try {
    const customer = await login(context); const admin = await login(context, 'ADMIN');
    const booking = (await post(customer.agent, '/bookings', customer.token, bookingValues())).body;
    const quote = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id))).body;
    await post(customer.agent, `/quotations/${quote.id}/response`, customer.token, { action: 'accept', expectedVersion: 1 });
    const providers = { mock: { enabled: true, async settle() { return { status: 'Failed', reference: 'test-provider-failed', simulated: true }; } } };
    const payment = await createPayment({ quotationId: quote.id, expectedVersion: 1, choice: 'full', requestId: randomUUID(), provider: 'mock' }, customer.user, 'cleaning', providers);
    assert.equal(payment.status, 'Failed'); const canonical = await Booking.findById(booking.id); assert.equal(canonical.paidMinor, 0); assert.equal(canonical.reservedMinor, 0);
  } finally { await context.close(); }
});
