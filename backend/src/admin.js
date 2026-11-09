import { Router } from 'express';
import { z } from 'zod';
import { Booking, Quotation, Product, Service, User, Order, Session, Settings, Upload, Payment } from './models.js';
import { transaction } from './database.js';
import { assert } from './errors.js';
import { text, decimal, revision, identifier, settings, audit, minor, depositMinor } from './domain.js';
import { quotationWorkspace, completeBookingDto } from './cleaning.js';
import { commerceAccount, productDto, serviceDto, orderDto, releaseOrderStock } from './commerce.js';

export const settingsSchema = z.object({ companyName: text(2, 160), tagline: text(0, 160), email: z.union([z.literal(''), z.string().email().max(254)]), phone: z.string().max(40).refine(value => !value || /^[+\d ()-]{7,40}$/.test(value)), whatsappNumber: z.string().trim().max(40).transform(value => value.replace(/[ ()-]/g, '')).refine(value => !value || /^\+[1-9]\d{7,14}$/.test(value), 'Use an international number beginning with + and country code.').default(''), address: text(0, 500), serviceAreas: text(), depositPercentage: decimal.refine(value => Number(value) > 0 && Number(value) <= 100), deliveryEnabled: z.boolean(), deliveryAreas: text(), deliveryFee: z.union([z.literal(''), decimal]), pickupEnabled: z.boolean(), pickupLocation: text(0, 500), pickupInstructions: text(0, 1000) }).strict().superRefine((value, context) => {
  if (value.deliveryEnabled && (!value.deliveryAreas.trim() || value.deliveryFee === '')) context.addIssue({ code: 'custom', message: 'Delivery areas and an explicit fee are required.' });
  if (value.pickupEnabled && value.pickupLocation.length < 5) context.addIssue({ code: 'custom', message: 'An approved pickup location is required.' });
});
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
const productSchema = z.object({ name: text(2, 120), slug, description: text(10), category: text(2, 80), price: decimal, stock: z.string().regex(/^\d+$/).refine(value => Number(value) <= 1000000), enabled: z.boolean() });
const serviceSchema = z.object({ name: text(2, 120), slug, description: text(10), overview: text(0, 4000), enabled: z.boolean() });
export async function adminWorkspace(user, config) {
  const workspace = await quotationWorkspace(user); const commerce = await commerceAccount(user, config); const configuration = await settings();
  const balances = [];
  for (const booking of await Booking.find({ acceptedQuoteId: { $exists: true } })) { const quote = await Quotation.findById(booking.acceptedQuoteId); if (quote) balances.push({ bookingId: String(booking._id), customerId: String(booking.customerId), total: quote.totalMinor / 100, paid: booking.paidMinor / 100, outstanding: Math.max(0, quote.totalMinor - booking.paidMinor) / 100 }); }
  return { ...workspace, ...commerce, services: (await Service.find()).map(serviceDto), products: (await Product.find()).map(productDto), customers: (await User.find({ role: 'CUSTOMER' })).map(user => ({ id: String(user._id), name: user.name, email: user.email, phone: user.phone, status: user.status, revision: user.authVersion })), balances, settings: configuration.values, settingsRevision: configuration.revision };
}
export function adminRoutes(auth, config) {
  const router = Router(); router.use('/admin', auth.requireUser, auth.requireAdmin);
  router.get('/admin/workspace', async (request, response) => response.json(await adminWorkspace(request.user, config)));
  router.get('/admin/statistics', async (request, response) => { const data = await adminWorkspace(request.user, config); response.json({ requests: data.bookings.length, pendingQuotations: data.quotes.filter(item => item.status === 'Sent').length, activeBookings: data.bookings.filter(item => ['Scheduled', 'In Progress'].includes(item.status)).length, awaitingInformation: data.bookings.filter(item => item.status === 'Awaiting Information').length, outstanding: data.balances.reduce((sum, item) => sum + item.outstanding, 0), orders: data.orders.length, lowStock: data.products.filter(item => item.enabled && item.stock <= 3).length }); });
  router.post('/admin/settings', async (request, response) => {
    const input = z.object({ values: settingsSchema, expectedRevision: revision }).strict().parse(request.body); let saved;
    await transaction(async session => {
      saved = await Settings.findOne({ key: 'business' }).session(session); assert((saved?.revision || 0) === input.expectedRevision);
      if (!saved) [saved] = await Settings.create([{ key: 'business', values: input.values, revision: 1 }], { session });
      else { saved.values = input.values; saved.revision++; await saved.save({ session }); }
      await audit(request.user, 'settings.updated', saved, session);
    });
    response.json({ record: { ...saved.values, revision: saved.revision } });
  });
  for (const kind of ['services', 'products']) for (const path of [`/admin/${kind}`, `/admin/${kind}/:id`]) router.post(path, async (request, response) => {
    const input = z.object({ kind: z.literal(kind), id: z.string().optional(), values: kind === 'products' ? productSchema : serviceSchema, images: z.array(z.string().regex(/^\/api\/uploads\/[a-f0-9]{24}$/)).min(1).max(4), expectedRevision: revision }).strict().parse(request.body);
    assert(input.id === request.params.id, 422, 'INVALID_ID', 'Route and record identifiers must match.'); const Model = kind === 'products' ? Product : Service; let record;
    await transaction(async session => {
      record = request.params.id ? await Model.findById(identifier(request.params.id)).session(session) : null;
      assert(!request.params.id || record, 404, 'NOT_FOUND', 'Record not found.'); assert((record?.revision || 0) === input.expectedRevision);
      const ids = input.images.map(value => value.split('/').at(-1)); assert(new Set(ids).size === ids.length, 422, 'INVALID_IMAGES', 'Duplicate images are not allowed.');
      const images = await Upload.find({ _id: { $in: ids }, private: false, purpose: kind === 'products' ? 'product-image' : 'service-image' }).session(session);
      assert(images.length === ids.length && images.every(image => record?.images.some(id => String(id) === String(image._id)) || (String(image.ownerId) === String(request.user._id) && !image.attachedTo)), 422, 'INVALID_IMAGES', 'An image reference is unavailable.');
      const values = { ...input.values, images: ids, ...(kind === 'products' ? { priceMinor: minor(input.values.price), stock: Number(input.values.stock) } : {}) }; delete values.price;
      if (!record) [record] = await Model.create([{ ...values, revision: 1 }], { session });
      else { Object.assign(record, values); record.revision++; await record.save({ session }); }
      await Upload.updateMany({ _id: { $in: ids } }, { $set: { attachedTo: record._id } }, { session }); await audit(request.user, `${kind}.saved`, record, session);
    });
    response.json({ record: kind === 'products' ? productDto(record) : serviceDto(record) });
  });
  router.post('/admin/bookings/:id/information-requests', async (request, response) => {
    const input = z.object({ id: z.string(), expectedRevision: revision, values: z.object({ message: text(10) }).strict() }).strict().parse(request.body); assert(input.id === request.params.id, 422, 'INVALID_ID', 'Record identifier mismatch.'); let booking;
    await transaction(async session => {
      booking = await Booking.findById(identifier(input.id)).session(session); assert(booking, 404, 'NOT_FOUND', 'Booking not found.'); assert(booking.revision === input.expectedRevision && ['Submitted', 'Under Review', 'Awaiting Information', 'Quoted'].includes(booking.status));
      booking.clarification = input.values.message; booking.status = 'Awaiting Information'; booking.revision++; booking.history.push({ title: `Administrator requested additional information: ${input.values.message}`, status: booking.status }); await booking.save({ session }); await audit(request.user, 'booking.clarification', booking, session);
    }); response.json({ record: await completeBookingDto(booking) });
  });
  router.post('/admin/bookings/:id/schedule', async (request, response) => {
    const input = z.object({ id: z.string(), expectedRevision: revision, values: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value), time: text(2, 120), status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled']), note: text(5, 1000) }).strict() }).strict().parse(request.body); assert(input.id === request.params.id, 422, 'INVALID_ID', 'Record identifier mismatch.'); let booking;
    await transaction(async session => {
      booking = await Booking.findById(identifier(input.id)).session(session); assert(booking, 404, 'NOT_FOUND', 'Booking not found.'); assert(booking.revision === input.expectedRevision && !['Cancelled', 'Completed'].includes(booking.status));
      const next = input.values.status;
      if (next === 'Cancelled') assert(booking.paidMinor === 0 && booking.reservedMinor === 0, 409, 'REFUND_REVIEW_REQUIRED', 'Paid or processing bookings require a separate refund/reconciliation workflow.');
      else if (next === 'Scheduled') {
        const quote = booking.acceptedQuoteId ? await Quotation.findById(booking.acceptedQuoteId).session(session) : null;
        assert(quote && quote.status === 'Accepted' && booking.paidMinor >= depositMinor(quote.totalMinor, booking.depositBasisPoints) && booking.status !== 'In Progress' && input.values.date >= new Date().toISOString().slice(0, 10));
      } else assert((booking.status === 'Scheduled' && next === 'In Progress') || (booking.status === 'In Progress' && next === 'Completed'));
      booking.status = next; booking.scheduledDate = input.values.date; booking.scheduledTime = input.values.time; booking.revision++; booking.history.push({ title: input.values.note, status: next }); await booking.save({ session }); await audit(request.user, 'booking.progress', booking, session);
    }); response.json({ record: await completeBookingDto(booking) });
  });
  router.post('/admin/orders/:id/fulfilment', async (request, response) => {
    const input = z.object({ id: z.string(), expectedRevision: revision, values: z.object({ status: z.enum(['Processing', 'On Hold', 'Ready for Pickup', 'Out for Delivery', 'Completed', 'Cancelled']), note: text(5, 1000) }).strict() }).strict().parse(request.body); assert(input.id === request.params.id, 422, 'INVALID_ID', 'Record identifier mismatch.'); let order;
    await transaction(async session => {
      order = await Order.findById(identifier(input.id)).session(session); assert(order, 404, 'NOT_FOUND', 'Order not found.'); assert(order.revision === input.expectedRevision && !['Completed', 'Cancelled'].includes(order.status));
      const next = input.values.status;
      if (next === 'Cancelled') await releaseOrderStock(order, session);
      else {
        const transitions = { Processing: ['Ready for Pickup', 'Out for Delivery', 'On Hold'], 'On Hold': ['Processing'], 'Ready for Pickup': ['Completed', 'On Hold'], 'Out for Delivery': ['Completed', 'On Hold'] };
        assert(transitions[order.status]?.includes(next));
        if (next !== 'On Hold') { assert(order.paymentStatus === 'Paid'); if (next === 'Ready for Pickup') assert(order.fulfilment === 'pickup'); if (next === 'Out for Delivery') assert(order.fulfilment === 'delivery'); }
        order.status = next; order.revision++; order.timeline.push({ title: input.values.note, status: next }); await order.save({ session });
      }
      await audit(request.user, 'order.fulfilment', order, session);
    }); response.json({ record: orderDto(order) });
  });
  router.post('/admin/customers/:id/status', async (request, response) => {
    const input = z.object({ status: z.enum(['Active', 'Disabled']), expectedRevision: revision }).strict().parse(request.body); let customer;
    await transaction(async session => { customer = await User.findOne({ _id: identifier(request.params.id), role: 'CUSTOMER' }).session(session); assert(customer, 404, 'NOT_FOUND', 'Customer not found.'); assert(customer.authVersion === input.expectedRevision); customer.status = input.status; customer.authVersion++; await customer.save({ session }); await Session.deleteMany({ userId: customer._id }, { session }); await audit(request.user, 'customer.status', customer, session); });
    response.json({ record: { id: String(customer._id), name: customer.name, email: customer.email, phone: customer.phone, status: customer.status, revision: customer.authVersion } });
  });
  router.get('/admin/payments', async (_request, response) => response.json({ payments: (await Payment.find()).map(payment => ({ id: String(payment._id), reference: payment.reference, amount: payment.amountMinor / 100, status: payment.status, simulated: payment.simulated })) }));
  return router;
}
