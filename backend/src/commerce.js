import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Booking, Quotation, Product, Service, Order, Payment } from './models.js';
import { hash } from './auth.js';
import { transaction } from './database.js';
import { assert } from './errors.js';
import { services as serviceDefaults } from './serviceDefaults.js';
import { identifier, text, revision, minor, settings, ownFilter, owned, audit, depositMinor } from './domain.js';

export const productDto = product => ({ id: String(product._id), slug: product.slug, name: product.name, description: product.description, category: product.category, price: product.priceMinor / 100, stock: product.stock, images: product.images.map(id => `/api/uploads/${id}`), enabled: product.enabled, revision: product.revision });
export const serviceDto = service => ({ id: String(service._id), slug: service.slug, name: service.name, description: service.description, overview: service.overview, images: service.images.map(id => `/api/uploads/${id}`), enabled: service.enabled, revision: service.revision });
export const orderDto = order => ({ id: String(order._id), reference: order.reference, customerId: String(order.customerId), items: order.items.map(item => ({ productId: String(item.productId), name: item.name, quantity: item.quantity, unitPrice: item.unitMinor / 100, total: item.totalMinor / 100 })), total: order.totalMinor / 100, subtotal: order.subtotalMinor / 100, deliveryFee: order.deliveryMinor / 100, fulfilment: order.fulfilment, paymentStatus: order.paymentStatus, status: order.status, createdAt: order.createdAt, revision: order.revision, simulated: order.simulated, customer: order.customer, deliveryAddress: order.deliveryAddress, pickupLocation: order.pickupLocation, timeline: order.timeline });
export const paymentDto = payment => ({ id: String(payment._id), reference: payment.reference, customerId: String(payment.customerId), bookingId: payment.bookingId ? String(payment.bookingId) : undefined, quotationId: payment.quotationId ? String(payment.quotationId) : undefined, orderId: payment.orderId ? String(payment.orderId) : undefined, amount: payment.amountMinor / 100, currency: 'GMD', method: payment.simulated ? 'Mock gateway — simulated' : payment.provider.toUpperCase(), provider: payment.provider, status: payment.status, providerReference: payment.providerReference, createdAt: payment.createdAt, simulated: payment.simulated });
export async function commerceAccount(user, config) {
  const cleaningSummaries = [];
  for (const booking of await Booking.find({ ...ownFilter(user), acceptedQuoteId: { $exists: true } })) {
    const quote = await Quotation.findById(booking.acceptedQuoteId);
    if (quote) cleaningSummaries.push({ bookingId: String(booking._id), quotationId: String(quote._id), depositPercentage: booking.depositBasisPoints / 100, total: quote.totalMinor / 100, paid: booking.paidMinor / 100, outstanding: (quote.totalMinor - booking.paidMinor) / 100, balanceUnlocked: booking.status === 'Completed' });
  }
  return { payments: (await Payment.find(ownFilter(user)).sort({ createdAt: 1 })).map(paymentDto), orders: (await Order.find(ownFilter(user)).sort({ createdAt: -1 })).map(orderDto), cleaningSummaries, depositPercentage: Number((await settings()).values.depositPercentage), mockEnabled: Boolean(config?.MOCK_PAYMENTS_ENABLED && !config.production) };
}
export const checkoutDetails = z.object({ name: text(2, 120), email: z.string().email().max(254), phone: z.string().regex(/^[+\d ()-]{7,25}$/), fulfilment: z.enum(['delivery', 'pickup']), address: text(0, 500).default(''), town: text(0, 120).default('') }).strict().superRefine((value, context) => { if (value.fulfilment === 'delivery' && (value.address.length < 5 || value.town.length < 2)) context.addIssue({ code: 'custom', message: 'Delivery address and town are required.' }); });
const orderSchema = z.object({ requestId: z.string().uuid(), details: checkoutDetails, items: z.array(z.object({ id: z.string().regex(/^[a-f0-9]{24}$/), quantity: z.number().int().min(1).max(1000000), expectedRevision: revision.optional() }).strict()).min(1).max(100) }).strict();
export async function checkoutPreview(values, session) {
  const { values: configuration } = await settings(session);
  let deliveryMinor = 0;
  if (values.details.fulfilment === 'pickup') assert(configuration.pickupEnabled && configuration.pickupLocation.length >= 5, 422, 'CONFIGURATION_REQUIRED', 'Pickup configuration is required.');
  else {
    assert(configuration.deliveryEnabled && configuration.deliveryFee !== '' && configuration.deliveryAreas.trim(), 422, 'CONFIGURATION_REQUIRED', 'Delivery configuration is required.');
    const areas = configuration.deliveryAreas.split(/[\n,]/).map(value => value.trim().toLowerCase()).filter(Boolean);
    assert(areas.includes(values.details.town.trim().toLowerCase()), 422, 'DELIVERY_UNAVAILABLE', 'This delivery area is not configured.'); deliveryMinor = minor(configuration.deliveryFee);
  }
  assert(new Set(values.items.map(item => item.id)).size === values.items.length, 422, 'DUPLICATE_ITEMS', 'Merge duplicate cart items.');
  const items = [];
  for (const item of values.items) {
    const product = await Product.findOne({ _id: identifier(item.id), enabled: true }).session(session || null);
    assert(product && product.stock >= item.quantity, 409, 'STOCK_UNAVAILABLE', 'A product is unavailable or no longer in stock.');
    assert(item.expectedRevision === undefined || item.expectedRevision === product.revision, 409, 'PRODUCT_CHANGED', 'A product changed. Review the updated catalogue.');
    items.push({ productId: product._id, name: product.name, quantity: item.quantity, unitMinor: product.priceMinor, totalMinor: product.priceMinor * item.quantity });
  }
  const subtotalMinor = items.reduce((total, item) => total + item.totalMinor, 0); const totalMinor = subtotalMinor + deliveryMinor;
  assert(Number.isSafeInteger(totalMinor) && totalMinor > 0 && totalMinor <= 1000000000000, 422, 'INVALID_TOTAL', 'Invalid order amount.');
  return { items, subtotalMinor, deliveryMinor, totalMinor, configuration };
}
export async function createOrder(input, user) {
  const values = orderSchema.parse(input); let order;
  const payloadHash = hash(JSON.stringify(values));
  await transaction(async session => {
    order = await Order.findOne({ customerId: user._id, requestId: values.requestId }).session(session);
    if (order) { assert(order.payloadHash === payloadHash); return; }
    const preview = await checkoutPreview(values, session);
    for (const item of preview.items) {
      const changed = await Product.updateOne({ _id: item.productId, enabled: true, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity, revision: 1 } }, { session }); assert(changed.modifiedCount === 1);
    }
    [order] = await Order.create([{ customerId: user._id, requestId: values.requestId, payloadHash, reference: `ORD-${randomUUID()}`, items: preview.items, subtotalMinor: preview.subtotalMinor, deliveryMinor: preview.deliveryMinor, totalMinor: preview.totalMinor, customer: { name: values.details.name, email: values.details.email, phone: values.details.phone }, fulfilment: values.details.fulfilment, ...(values.details.fulfilment === 'delivery' ? { deliveryAddress: { address: values.details.address, town: values.details.town } } : { pickupLocation: preview.configuration.pickupLocation }), reservationExpiresAt: new Date(Date.now() + 30 * 60000), timeline: [{ title: 'Order created; stock reserved pending payment' }] }], { session });
    await audit(user, 'order.created', order, session);
  });
  return order;
}
export async function releaseOrderStock(order, session) {
  assert(order.paidMinor === 0 && order.reservedMinor === 0, 409, 'PAYMENT_PENDING', 'An active or settled payment prevents cancellation.');
  if (!order.stockReleased) for (const item of order.items) await Product.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity, revision: 1 } }, { session });
  order.stockReleased = true; order.status = 'Cancelled'; order.revision++; order.timeline.push({ title: 'Unpaid reservation cancelled; stock released' }); await order.save({ session });
}
export async function expireReservations() {
  const entries = await Order.find({ reservationExpiresAt: { $lte: new Date() }, paidMinor: 0, reservedMinor: 0, stockReleased: false });
  for (const entry of entries) await transaction(async session => { const order = await Order.findById(entry._id).session(session); if (order && !order.stockReleased && order.paidMinor === 0 && order.reservedMinor === 0) await releaseOrderStock(order, session); });
}
export function paymentProviders(config) {
  return {
    mock: { enabled: config.MOCK_PAYMENTS_ENABLED && !config.production, async settle(payment, outcome = 'paid') { assert(config.MOCK_PAYMENTS_ENABLED && !config.production, 503, 'PROVIDER_UNAVAILABLE', 'Mock payments are disabled.'); return { status: outcome === 'failed' ? 'Failed' : 'Paid', reference: `SIMULATED-${payment._id}`, simulated: true }; } },
    wave: { enabled: false }, aps: { enabled: false },
  };
}
const intentSchema = z.object({ requestId: z.string().uuid(), provider: z.enum(['mock', 'wave', 'aps']), mockOutcome: z.enum(['paid', 'failed']).optional(), quotationId: z.string().optional(), expectedVersion: revision.optional(), choice: z.enum(['deposit', 'full', 'balance']).optional(), orderId: z.string().optional() }).strict();
export async function createPayment(input, user, kind, providers) {
  const values = intentSchema.parse(input);
  assert(values.provider === 'mock' || values.mockOutcome === undefined, 422, 'INVALID_PROVIDER_OPTIONS', 'Simulated outcomes are only available with the development mock gateway.');
  assert(providers[values.provider]?.enabled, 503, 'PROVIDER_UNAVAILABLE', 'This provider is not operational. No payment was taken.');
  assert(user.role === 'CUSTOMER', 403, 'CUSTOMER_REQUIRED', 'Customer access is required.');
  const payloadHash = hash(JSON.stringify({ ...values, kind })); let payment;
  await transaction(async session => {
    payment = await Payment.findOne({ customerId: user._id, requestId: values.requestId }).session(session);
    if (payment) { assert(payment.payloadHash === payloadHash); return; }
    let amountMinor; let relation;
    if (kind === 'cleaning') {
      const quote = await owned(Quotation, values.quotationId, user, session); const booking = await owned(Booking, String(quote.bookingId), user, session);
      assert(quote.status === 'Accepted' && String(booking.acceptedQuoteId) === String(quote._id) && booking.currentVersion === quote.version && quote.version === values.expectedVersion && booking.status !== 'Cancelled' && booking.reservedMinor === 0);
      if (booking.paidMinor === 0) { assert(['deposit', 'full'].includes(values.choice)); amountMinor = values.choice === 'deposit' ? depositMinor(quote.totalMinor, booking.depositBasisPoints) : quote.totalMinor; }
      else { assert(values.choice === 'balance' && booking.status === 'Completed'); amountMinor = quote.totalMinor - booking.paidMinor; }
      assert(amountMinor > 0 && amountMinor <= quote.totalMinor - booking.paidMinor);
      booking.reservedMinor = amountMinor; booking.revision++; await booking.save({ session }); relation = { bookingId: booking._id, quotationId: quote._id };
    } else {
      const order = await owned(Order, values.orderId, user, session);
      assert(!order.stockReleased && order.reservationExpiresAt > new Date() && order.status !== 'Cancelled' && order.paidMinor === 0 && order.reservedMinor === 0);
      amountMinor = order.totalMinor; order.reservedMinor = amountMinor; order.revision++; await order.save({ session }); relation = { orderId: order._id };
    }
    [payment] = await Payment.create([{ customerId: user._id, requestId: values.requestId, payloadHash, reference: `PAY-${randomUUID()}`, ...relation, choice: values.choice, amountMinor, provider: values.provider, status: 'Processing', simulated: values.provider === 'mock' }], { session });
    await audit(user, 'payment.intent-created', payment, session);
  });
  if (payment.status === 'Processing' && payment.provider === 'mock') {
    const confirmation = await providers.mock.settle(payment, values.mockOutcome || 'paid');
    assert(confirmation.simulated === true && ['Paid', 'Failed'].includes(confirmation.status), 503, 'UNCONFIRMED_PAYMENT', 'Payment confirmation is unavailable.');
    await transaction(async session => {
      payment = await Payment.findById(payment._id).session(session); if (payment.status !== 'Processing') return;
      const record = await (payment.bookingId ? Booking : Order).findById(payment.bookingId || payment.orderId).session(session);
      assert(record && record.reservedMinor === payment.amountMinor && record.status !== 'Cancelled');
      record.reservedMinor -= payment.amountMinor;
      if (confirmation.status === 'Paid') record.paidMinor += payment.amountMinor;
      if (payment.orderId) { record.paymentStatus = confirmation.status; record.simulated = true; record.timeline.push({ title: `Development mock payment ${confirmation.status.toLowerCase()}; no money transferred` }); }
      else if (confirmation.status === 'Paid' && record.status === 'Accepted') record.status = 'Awaiting Payment';
      if (payment.bookingId) record.history.push({ title: `Simulated payment ${confirmation.status.toLowerCase()}; no money transferred`, status: record.status });
      record.revision++; await record.save({ session }); payment.status = confirmation.status; payment.providerReference = confirmation.reference; await payment.save({ session }); await audit(user, 'payment.simulated-confirmation', payment, session);
    });
  }
  return payment;
}
export function commerceRoutes(auth, config, providers = paymentProviders(config)) {
  const router = Router();
  router.get('/products', async (request, response) => {
    const values = z.object({ search: text(0, 100).optional(), category: text(0, 80).optional(), sort: z.enum(['name', 'price-asc', 'price-desc']).default('name'), after: z.string().regex(/^[a-f0-9]{24}$/).optional(), limit: z.coerce.number().int().min(1).max(100).default(100) }).strict().parse(request.query);
    const filter = { enabled: true, ...(values.category ? { category: values.category } : {}), ...(values.search ? { name: { $regex: values.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {}) };
    const products = await Product.find(filter).sort(values.sort === 'name' ? { name: 1, _id: 1 } : { priceMinor: values.sort === 'price-asc' ? 1 : -1, _id: 1 }).limit(values.limit);
    response.json({ products: products.map(productDto), limited: products.length === values.limit });
  });
  router.get('/products/:slug', async (request, response) => { const product = await Product.findOne({ slug: text(1, 100).parse(request.params.slug), enabled: true }); assert(product, 404, 'NOT_FOUND', 'Product not found.'); response.json({ product: productDto(product) }); });
  router.get('/services', async (_request, response) => response.json({ services: await publishedServices() }));
  router.get('/services/:slug', async (request, response) => { const service = (await publishedServices()).find(item => item.slug === text(1, 100).parse(request.params.slug)); assert(service, 404, 'NOT_FOUND', 'Service not found.'); response.json({ service }); });
  router.get('/checkout/configuration', async (_request, response) => { const { values } = await settings(); response.json({ deliveryEnabled: values.deliveryEnabled, deliveryAreas: values.deliveryAreas, deliveryFee: values.deliveryFee === '' ? null : minor(values.deliveryFee) / 100, pickupEnabled: values.pickupEnabled, pickupLocation: values.pickupLocation, pickupInstructions: values.pickupInstructions, mockEnabled: providers.mock.enabled }); });
  router.post('/checkout/preview', auth.requireUser, async (request, response) => { const preview = await checkoutPreview(orderSchema.parse(request.body)); response.json({ subtotal: preview.subtotalMinor / 100, deliveryFee: preview.deliveryMinor / 100, total: preview.totalMinor / 100 }); });
  router.post('/orders', auth.requireUser, async (request, response) => { assert(request.user.role === 'CUSTOMER', 403, 'CUSTOMER_REQUIRED', 'Customer access required.'); response.status(201).json(orderDto(await createOrder(request.body, request.user))); });
  router.get('/orders/:id', auth.requireUser, async (request, response) => response.json(orderDto(await owned(Order, request.params.id, request.user))));
  router.get('/customer/payments-and-orders', auth.requireUser, async (request, response) => response.json(await commerceAccount(request.user, config)));
  for (const kind of ['cleaning', 'orders']) router.post(`/payments/${kind}/intents`, auth.requireUser, async (request, response) => response.status(201).json(paymentDto(await createPayment(request.body, request.user, kind === 'cleaning' ? 'cleaning' : 'order', providers))));
  router.get('/payments/:id', auth.requireUser, async (request, response) => response.json(paymentDto(await owned(Payment, request.params.id, request.user))));
  return router;
}
export async function publishedServices() {
  const records = await Service.find();
  return [...serviceDefaults.filter(item => !records.some(record => record.slug === item.slug)), ...records.filter(item => item.enabled).map(record => ({ ...serviceDefaults.find(item => item.slug === record.slug), ...serviceDto(record), requirements: serviceDefaults.find(item => item.slug === record.slug)?.requirements || ['Property type, approximate size and cleaning priorities', 'Photographs and preferred scheduling information'], information: serviceDefaults.find(item => item.slug === record.slug)?.information || 'An administrator reviews your requirements and confirms the official quotation and schedule.' }))];
}
