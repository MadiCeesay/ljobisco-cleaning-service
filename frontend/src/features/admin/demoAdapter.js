import { getRawBookings, getDemoCustomer, applyAdminBooking } from '../customer/demoAdapter.js';
import { workspace } from '../quotations/demoAdapter.js';
import { latestQuote } from '../quotations/rules.js';
import { paymentOverview, updateDemoOrder } from '../payments/demoAdapter.js';
import { catalogSnapshot, saveCatalog, saveSettings } from './demoCatalog.js';
import { informationSchema, scheduleSchema, validateBookingTransition, imageError, orderUpdateSchema, validateOrderTransition } from './rules.js';

import { adminRuntime } from './demoRuntime.js';
export { resetAdmin } from './demoRuntime.js';
const { urls, locks } = adminRuntime;
const pause = () => new Promise(resolve => setTimeout(resolve, 200));
export function assertAdministrator(actor) { if (actor?.role !== 'ADMIN' || actor.id !== 'demo-admin') throw new Error('An authorized administrator is required.'); }
export async function snapshot(actor) {
  assertAdministrator(actor);
  const session = adminRuntime.generation;
  const data = await workspace(actor, getRawBookings());
  if (session !== adminRuntime.generation) throw new Error('The demo session ended.');
  const commerce = paymentOverview();
  const catalogue = catalogSnapshot();
  const customer = getDemoCustomer();
  const payments = [...commerce.payments.map(payment => ({ ...payment, customerId: customer.id, method: 'Mock gateway — simulated' })), ...commerce.orders.map(order => ({ id: `${order.id}-payment`, orderId: order.id, customerId: order.customerId, amount: order.total, method: 'Mock gateway — simulated', status: order.paymentStatus, createdAt: order.createdAt, simulated: true }))];
  const balances = data.quotes.filter(quote => quote.status === 'Accepted' && latestQuote(data.quotes, quote.bookingId)?.id === quote.id).map(quote => ({ bookingId: quote.bookingId, customerId: quote.customerId, total: quote.total, paid: commerce.payments.filter(payment => payment.quotationId === quote.id && payment.status === 'Paid').reduce((sum, payment) => sum + payment.amount, 0) })).map(item => ({ ...item, outstanding: Math.max(0, Math.round((item.total - item.paid) * 100) / 100) }));
  return { ...data, ...catalogue, orders: commerce.orders, payments, balances, customers: [customer] };
}
export async function mutate(operation, payload, actor, files = []) {
  assertAdministrator(actor);
  const session = adminRuntime.generation;
  const key = `${operation.startsWith('booking-') ? 'booking' : operation}:${payload.kind || ''}:${payload.id || ''}`;
  if (locks.has(key)) throw new Error('A change to this record is already processing.');
  locks.add(key);
  try {
  await pause();
  if (session !== adminRuntime.generation) throw new Error('The demo session ended. No changes were saved.');
  if (operation === 'settings') return saveSettings(payload.values, payload.expectedRevision);
  if (operation === 'catalog') {
    if (!['services', 'products'].includes(payload.kind)) throw new Error('Unknown catalogue.');
    if (files.length > 4) throw new Error('Use no more than four images.');
    for (const file of files) { const error = imageError(file); if (error) throw new Error(error); }
    const catalogue = catalogSnapshot();
    const current = catalogue[payload.kind].find(item => item.id === payload.id);
    if (payload.images.some(image => !current?.images.includes(image))) throw new Error('An image reference is invalid.');
    const generated = files.map(file => URL.createObjectURL(file));
    try { const saved = saveCatalog(payload.kind, payload.id, payload.values, [...payload.images, ...generated], payload.expectedRevision); generated.forEach(url => urls.add(url)); return saved; }
    catch (error) { generated.forEach(url => URL.revokeObjectURL(url)); throw error; }
  }
  if (operation === 'booking-information' || operation === 'booking-schedule') {
    const data = await workspace(actor, getRawBookings());
    if (session !== adminRuntime.generation) throw new Error('The demo session ended.');
    const booking = data.bookings.find(item => item.id === payload.id);
    if (!booking || (booking.revision || 0) !== payload.expectedRevision) throw new Error('This booking changed. Refresh before updating.');
    if (operation === 'booking-information') {
      const values = informationSchema.parse(payload.values);
      if (['Completed', 'Cancelled', 'Scheduled', 'In Progress'].includes(booking.status)) throw new Error('This booking cannot receive an ordinary clarification request.');
      if (session !== adminRuntime.generation) throw new Error('The demo session ended.');
      return applyAdminBooking(booking.id, { clarification: values.message, status: 'Awaiting Information' }, `Additional information requested: ${values.message}`, payload.expectedRevision);
    }
    const values = scheduleSchema.parse(payload.values);
    const quote = latestQuote(data.quotes, booking.id);
    const paid = paymentOverview().payments.filter(item => item.quotationId === quote?.id && item.status === 'Paid').reduce((sum, item) => sum + item.amount, 0);
    validateBookingTransition(booking, values.status, quote?.status === 'Accepted', paid);
    if (values.status === 'Scheduled' && values.date < new Date().toISOString().slice(0, 10)) throw new Error('Choose today or a future scheduling date.');
    return applyAdminBooking(booking.id, { status: values.status, scheduledDate: values.date, scheduledTime: values.time }, values.note, payload.expectedRevision);
  }
  if (operation === 'order-status') {
    const values = orderUpdateSchema.parse(payload.values);
    const order = paymentOverview().orders.find(item => item.id === payload.id);
    if (!order) throw new Error('Order not found.');
    validateOrderTransition(order, values.status, catalogSnapshot().settings);
    return updateDemoOrder(order.id, values.status, values.note, payload.expectedRevision);
  }
  throw new Error('This administrator operation is unavailable.');
  } finally { if (session === adminRuntime.generation) locks.delete(key); }
}
