import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingActionStage, serviceSchema, productSchema, settingsSchema, scheduleSchema, imageError, filterRecords, safeImageUrl, validateBookingTransition, validateOrderTransition } from './rules.js';
import { assertAdministrator, snapshot, mutate } from './demoAdapter.js';
import { resetDemo, createDemoPhotoPreviews, createBooking, getRawBookings } from '../customer/demoAdapter.js';
import { respond } from '../quotations/demoAdapter.js';
import { payCleaning, createOrder } from '../payments/demoAdapter.js';
import { defaultSettings } from './demoCatalog.js';

const admin = { id: 'demo-admin', role: 'ADMIN' };
const customer = { id: 'demo-customer', role: 'CUSTOMER' };

test('booking review exposes only stage-appropriate actions without inferring payment eligibility', () => {
  const booking = { id: 'test-booking', status: 'Submitted' };
  assert.deepEqual(bookingActionStage(booking, [], []), { stage: 'review', canQuote: true, quote: undefined });
  const quote = { id: 'quote', bookingId: booking.id, version: 1, status: 'Accepted' };
  assert.equal(bookingActionStage({ ...booking, status: 'Accepted' }, [quote], [{ bookingId: booking.id, paid: 5000 }]).stage, 'payment');
  assert.equal(bookingActionStage({ ...booking, status: 'Accepted' }, [quote], [{ bookingId: booking.id, canSchedule: true }]).stage, 'schedule');
  assert.equal(bookingActionStage({ ...booking, status: 'Scheduled' }, [quote], []).stage, 'start');
  assert.equal(bookingActionStage({ ...booking, status: 'In Progress' }, [quote], []).stage, 'complete');
  for (const status of ['Completed', 'Cancelled']) {
    const action = bookingActionStage({ ...booking, status }, [quote], []);
    assert.equal(action.stage, 'closed');
    assert.equal(action.canQuote, false);
  }
});
test('catalogue validation covers slugs, money, stock and bounded image types', () => {
  assert.equal(serviceSchema.safeParse({ name: 'Test Service', slug: 'test-service', description: 'Sample service description', overview: '', enabled: true }).success, true);
  assert.equal(productSchema.safeParse({ name: 'Test Product', slug: 'test-product', description: 'Sample product description', category: 'Tools', price: '12.50', stock: '3', enabled: true }).success, true);
  for (const changes of [{ price: '-1' }, { price: '1.234' }, { stock: '1.5' }, { slug: '../bad' }]) assert.equal(productSchema.safeParse({ name: 'Product', slug: 'product', description: 'Sample description', category: 'Tools', price: '5', stock: '2', enabled: true, ...changes }).success, false);
  assert.match(imageError({ type: 'image/svg+xml', size: 100 }), /JPG/);
  assert.match(imageError({ type: 'image/jpeg', size: 6 * 1024 * 1024 }), /5 MB/);
  assert.equal(imageError({ type: 'image/webp', size: 50 }), '');
  assert.equal(safeImageUrl('javascript:alert(1)'), '');
  assert.equal(safeImageUrl('/images/../secret'), '');
});
test('settings require explicit approved fulfilment configuration and a valid deposit', () => {
  assert.equal(settingsSchema.safeParse(defaultSettings).success, true);
  for (const changes of [{ depositPercentage: '0' }, { depositPercentage: '101' }, { email: 'invalid' }, { deliveryEnabled: true }, { pickupEnabled: true }]) assert.equal(settingsSchema.safeParse({ ...defaultSettings, ...changes }).success, false);
  assert.equal(settingsSchema.safeParse({ ...defaultSettings, deliveryEnabled: true, deliveryAreas: 'Demo area', deliveryFee: '0', pickupEnabled: true, pickupLocation: 'Sample pickup location' }).success, true);
});
test('booking and order progress require validated transitions, payment and configuration', () => {
  assert.throws(() => validateBookingTransition({ status: 'Quoted' }, 'Scheduled', false, 0), /accepted quotation/);
  assert.throws(() => validateBookingTransition({ status: 'Scheduled' }, 'Completed', true, 500), /transition/);
  assert.throws(() => validateBookingTransition({ status: 'Completed' }, 'Cancelled', true, 500), /closed/);
  validateBookingTransition({ status: 'Scheduled' }, 'In Progress', true, 500);
  assert.equal(scheduleSchema.safeParse({ date: '2027-02-30', time: 'Morning', status: 'Scheduled', note: 'Sample note' }).success, false);
  const order = { status: 'Pending Configuration', paymentStatus: 'Paid', fulfilment: 'pickup' };
  assert.throws(() => validateOrderTransition(order, 'Processing', defaultSettings), /configuration/);
  validateOrderTransition(order, 'On Hold', defaultSettings);
  assert.throws(() => validateOrderTransition({ ...order, status: 'Processing' }, 'Out for Delivery', { ...defaultSettings, pickupEnabled: true, pickupLocation: 'Sample location' }), /fulfilment method/);
});
test('tables search and status filters return accurate empty states', () => {
  const rows = [{ id: 'one', name: 'Home Cleaning', status: 'Active' }, { id: 'two', name: 'Office Cleaning', status: 'Disabled' }];
  assert.equal(filterRecords(rows, 'HOME', 'All', ['name']).length, 1);
  assert.equal(filterRecords(rows, '', 'Disabled', ['name'])[0].id, 'two');
  assert.equal(filterRecords(rows, 'nothing', 'All', ['name']).length, 0);
});
test('admin repository rejects customers, hides credentials and guards revisions', async () => {
  resetDemo();
  assert.throws(() => assertAdministrator(customer), /administrator/);
  await assert.rejects(snapshot(customer), /administrator/);
  await assert.rejects(mutate('settings', { values: defaultSettings, expectedRevision: 0 }, customer), /administrator/);
  const data = await snapshot(admin);
  assert.deepEqual(Object.keys(data.customers[0]).sort(), ['email', 'id', 'name', 'phone', 'simulated', 'status']);
  assert.equal(data.orders.length, 0);
  const product = data.products[0];
  await mutate('catalog', { kind: 'products', id: product.id, values: { ...product, price: String(product.price), stock: '0', enabled: false }, images: product.images, expectedRevision: product.revision }, admin);
  await assert.rejects(mutate('catalog', { kind: 'products', id: product.id, values: { ...product, price: String(product.price), stock: '2' }, images: product.images, expectedRevision: product.revision }, admin), /changed/);
  await mutate('settings', { values: { ...defaultSettings, depositPercentage: '25' }, expectedRevision: 0 }, admin);
  await assert.rejects(mutate('settings', { values: defaultSettings, expectedRevision: 0 }, admin), /changed/);
  resetDemo();
});
test('admin clarification, schedule history and completion unlock only the confirmed balance', async () => {
  resetDemo();
  await mutate('booking-information', { id: 'demo-review', values: { message: 'Please share additional room photographs.' }, expectedRevision: 0 }, admin);
  let data = await snapshot(admin);
  assert.equal(data.bookings[0].status, 'Awaiting Information');
  assert.match(data.bookings[0].clarification, /photographs/);
  const values = { date: '2099-01-01', time: 'Morning', status: 'Scheduled', note: 'Sample confirmed schedule' };
  await assert.rejects(mutate('booking-schedule', { id: 'demo-review', values, expectedRevision: 1 }, admin), /accepted quotation/);
  await respond('demo-quote-v2', 'accept', 2, customer);
  await payCleaning({ quotationId: 'demo-quote-v2', choice: 'deposit', outcome: 'paid', requestId: 'deposit' }, customer, 30);
  await mutate('booking-schedule', { id: 'demo-review', values, expectedRevision: 1 }, admin);
  await mutate('booking-schedule', { id: 'demo-review', values: { ...values, status: 'In Progress' }, expectedRevision: 2 }, admin);
  await mutate('booking-schedule', { id: 'demo-review', values: { ...values, status: 'Completed' }, expectedRevision: 3 }, admin);
  data = await snapshot(admin);
  assert.equal(data.bookings[0].status, 'Completed');
  assert.equal(data.bookings[0].history.length, 4);
  const balance = await payCleaning({ quotationId: 'demo-quote-v2', choice: 'balance', outcome: 'paid', requestId: 'balance' }, customer, 30);
  assert.equal(balance.amount, 1610);
  resetDemo();
});
test('admin order fulfilment retains payment status and appends a checked timeline', async () => {
  resetDemo();
  const order = await createOrder({ details: { name: 'Demo Customer', email: 'preview@example.test', phone: '1234567', fulfilment: 'pickup', address: '', town: '' }, items: [{ id: 'demo-spray', quantity: 1 }], outcome: 'paid', requestId: 'test-order', acknowledge: true }, customer);
  await assert.rejects(mutate('order-status', { id: order.id, values: { status: 'Processing', note: 'Sample progress note' }, expectedRevision: 0 }, admin), /configuration/);
  await mutate('settings', { values: { ...defaultSettings, pickupEnabled: true, pickupLocation: 'Sample pickup location — demo only' }, expectedRevision: 0 }, admin);
  const updated = await mutate('order-status', { id: order.id, values: { status: 'Processing', note: 'Sample progress note' }, expectedRevision: 0 }, admin);
  assert.equal(updated.paymentStatus, 'Paid');
  assert.equal(updated.status, 'Processing');
  assert.equal(updated.timeline.length, 3);
  assert.equal(updated.customer.email, 'preview@example.test');
  resetDemo();
});
test('submitted demo photographs have local review previews without claiming upload', async () => {
  resetDemo();
  const photos = createDemoPhotoPreviews([new Blob(['sample image bytes'], { type: 'image/png' })]);
  assert.equal(photos[0].uploaded, false);
  assert.match(photos[0].previewUrl, /^blob:/);
  const booking = await createBooking({ service: 'home-cleaning', propertyType: 'House', rooms: '1', address: 'Sample property', town: 'Demo area', description: 'Demo cleaning requirements' }, photos);
  const data = await snapshot(admin);
  assert.equal(data.bookings.find(item => item.id === booking.id).photos[0].previewUrl, photos[0].previewUrl);
  await mutate('booking-information', { id: booking.id, values: { message: 'Please clarify the photographed cleaning area.' }, expectedRevision: 0 }, admin);
  const updated = await snapshot(admin);
  assert.match(updated.bookings.find(item => item.id === booking.id).clarification, /photographed/);
  assert.equal((await fetch(photos[0].previewUrl)).status, 200);
  resetDemo();
  await assert.rejects(fetch(photos[0].previewUrl));
});
test('logout cancels an in-flight admin clarification without leaking a clarification into a new session', async () => {
  resetDemo();
  const pending = mutate('booking-information', { id: 'demo-review', values: { message: 'Please share additional photographs.' }, expectedRevision: 0 }, admin);
  await new Promise(resolve => setTimeout(resolve, 20));
  resetDemo();
  await assert.rejects(pending, /session ended/);
  const data = await snapshot(admin);
  assert.deepEqual(data.conversations, []);
  assert.equal(data.bookings[0].history, undefined);
});
test('cancelled bookings cannot subsequently accept their formal quotation', async () => {
  resetDemo();
  await mutate('booking-schedule', { id: 'demo-review', values: { status: 'Cancelled', date: '2099-01-01', time: 'Not applicable', note: 'Demo administrator cancellation' }, expectedRevision: 0 }, admin);
  await assert.rejects(respond('demo-quote-v2', 'accept', 2, customer), /cancelled/);
  resetDemo();
});
test('reset cancels an in-flight customer request before it can reappear in a new demo session', async () => {
  resetDemo();
  const pending = createBooking({ service: 'home-cleaning', propertyType: 'House', rooms: '1' }, []);
  resetDemo();
  await assert.rejects(pending, /session ended/);
  assert.equal(getRawBookings().length, 2);
});
