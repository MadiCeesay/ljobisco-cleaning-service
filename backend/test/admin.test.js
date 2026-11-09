import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { setup, csrf, post, baseEnvironment } from './helpers.js';
import { login, bookingValues, quoteValues } from './actors.js';
import { defaultSettings } from '../src/domain.js';

test('registered customer-to-photo-to-revised-quotation-to-deposit workflow, admin guards and persistent settings', async () => {
  const media = { available: true, async upload() { return { publicId: 'test-image', format: 'webp' }; }, async remove() {}, url() { return 'https://example.test/signed-test-image'; } };
  const context = await setup({ media });
  try {
    const agent = context.agent(); const token = await csrf(agent); const email = 'end-to-end@example.test'; const password = 'A private integration password';
    await post(agent, '/auth/register', token, { name: 'End to End Customer', email, phone: '+2201234567', password }).expect(202);
    await post(agent, '/auth/verify-email', token, { token: context.mail.at(-1).token }).expect(200);
    const user = (await post(agent, '/auth/login', token, { email, password }).expect(200)).body.user;
    await agent.get('/api/admin/workspace').expect(403);
    const admin = await login(context, 'ADMIN');
    await post(admin.agent, '/admin/settings', admin.token, { values: { ...defaultSettings, depositPercentage: '30' }, expectedRevision: 0 }).expect(200);
    await post(admin.agent, '/admin/settings', admin.token, { values: { ...defaultSettings, pickupEnabled: true }, expectedRevision: 1 }).expect(422);
    const image = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const upload = await agent.post('/api/uploads').set('Origin', baseEnvironment.PUBLIC_APP_URL).set('X-CSRF-Token', token).field('purpose', 'booking-photo').attach('file', image, { filename: 'test-photo.png', contentType: 'image/png' }).expect(201);
    const booking = (await post(agent, '/bookings', token, { ...bookingValues(), photos: [{ attachmentId: upload.body.attachmentId }] }).expect(201)).body;
    const information = (await post(admin.agent, `/admin/bookings/${booking.id}/information-requests`, admin.token, { id: booking.id, expectedRevision: 0, values: { message: 'Please clarify the rooms requiring extra attention.' } }).expect(200)).body.record;
    assert.equal(information.status, 'Awaiting Information');
    const first = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id)).expect(201)).body;
    const revised = (await post(admin.agent, '/admin/quotations', admin.token, quoteValues(booking.id, 1)).expect(201)).body;
    await post(agent, `/quotations/${first.id}/response`, token, { action: 'accept', expectedVersion: 1 }).expect(409);
    await post(agent, `/quotations/${revised.id}/response`, token, { action: 'accept', expectedVersion: 2 }).expect(200);
    const payment = (await post(agent, '/payments/cleaning/intents', token, { quotationId: revised.id, expectedVersion: 2, choice: 'deposit', provider: 'mock', requestId: randomUUID() }).expect(201)).body;
    assert.equal(payment.amount, 1500);
    const account = (await agent.get('/api/customer/payments-and-orders')).body; assert.equal(account.cleaningSummaries[0].outstanding, 3500);
    let workspace = (await admin.agent.get('/api/admin/workspace').expect(200)).body;
    assert(!JSON.stringify(workspace.customers).match(/passwordHash|authVersion|tokenHash/));
    assert.equal(workspace.bookings[0].photos.length, 1); assert.equal(workspace.balances[0].outstanding, 3500);
    let current = workspace.bookings[0];
    for (const status of ['Scheduled', 'In Progress', 'Completed']) {
      current = (await post(admin.agent, `/admin/bookings/${booking.id}/schedule`, admin.token, { id: booking.id, expectedRevision: current.revision, values: { date: booking.date, time: 'Agreed test window', status, note: 'Integration test administrator-confirmed progress.' } }).expect(200)).body.record;
    }
    assert.equal((await agent.get('/api/customer/payments-and-orders')).body.cleaningSummaries[0].balanceUnlocked, true);
    workspace = (await admin.agent.get('/api/admin/workspace')).body;
    await post(admin.agent, `/admin/customers/${user.id}/status`, admin.token, { status: 'Disabled', expectedRevision: workspace.customers[0].revision }).expect(200);
    await agent.get('/api/customer/overview').expect(401);
  } finally { await context.close(); }
});
test('administrator catalogue CRUD, revision conflicts, order fulfilment and safe customer projections', async () => {
  const media = { available: true, async upload() { return { publicId: randomUUID(), format: 'webp' }; }, async remove() {}, url() { return 'https://example.test/test-image'; } };
  const context = await setup({ media });
  try {
    const admin = await login(context, 'ADMIN'); const customer = await login(context);
    const image = await sharp({ create: { width: 12, height: 12, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const uploaded = await admin.agent.post('/api/uploads').set('Origin', baseEnvironment.PUBLIC_APP_URL).set('X-CSRF-Token', admin.token).field('purpose', 'product-image').attach('file', image, { filename: 'product.png', contentType: 'image/png' }).expect(201);
    const payload = { kind: 'products', expectedRevision: 0, values: { name: 'Isolated test product', slug: 'isolated-test-product', description: 'Test inventory only, not a business offer.', category: 'Tests', price: '100', stock: '2', enabled: true }, images: [`/api/uploads/${uploaded.body.attachmentId}`] };
    await post(customer.agent, '/admin/products', customer.token, payload).expect(403);
    const product = (await post(admin.agent, '/admin/products', admin.token, payload).expect(200)).body.record;
    await post(admin.agent, `/admin/products/${product.id}`, admin.token, { ...payload, id: product.id }).expect(409);
    assert.equal((await context.agent().get('/api/products')).body.products[0].price, 100);
    await post(admin.agent, '/admin/settings', admin.token, { expectedRevision: 0, values: { ...defaultSettings, pickupEnabled: true, pickupLocation: 'Test-only approved pickup configuration' } }).expect(200);
    const order = (await post(customer.agent, '/orders', customer.token, { requestId: randomUUID(), details: { name: 'Test customer', email: customer.user.email, phone: '+2201234567', fulfilment: 'pickup', address: '', town: '' }, items: [{ id: product.id, quantity: 1, expectedRevision: product.revision }] }).expect(201)).body;
    await post(customer.agent, '/payments/orders/intents', customer.token, { orderId: order.id, requestId: randomUUID(), provider: 'mock' }).expect(201);
    let current = (await customer.agent.get(`/api/orders/${order.id}`)).body;
    for (const status of ['Ready for Pickup', 'Completed']) current = (await post(admin.agent, `/admin/orders/${order.id}/fulfilment`, admin.token, { id: order.id, expectedRevision: current.revision, values: { status, note: 'Integration test confirmed fulfilment update.' } }).expect(200)).body.record;
    assert.equal(current.status, 'Completed');
  } finally { await context.close(); }
});
