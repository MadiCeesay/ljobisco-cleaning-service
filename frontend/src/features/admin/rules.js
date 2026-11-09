import { z } from 'zod';

const text = (minimum, maximum = 2000) => z.string().trim().min(minimum, `Enter at least ${minimum} characters.`).max(maximum);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words separated by hyphens.').max(100);
const decimal = z.string().regex(/^\d+(?:\.\d{1,2})?$/, 'Enter a non-negative amount with up to two decimal places.').refine(value => Number(value) <= 10000000, 'Amount is too large.');
export const serviceSchema = z.object({ name: text(2, 120), slug, description: text(10), overview: z.string().trim().max(4000), enabled: z.boolean() });
export const productSchema = z.object({ name: text(2, 120), slug, description: text(10), category: text(2, 80), price: decimal, stock: z.string().regex(/^\d+$/, 'Enter a whole stock quantity.').refine(value => Number(value) <= 1000000, 'Stock quantity is too large.'), enabled: z.boolean() });
export const informationSchema = z.object({ message: text(10, 2000) });
export function bookingActionStage(booking, quotes, balances) {
  const quote = quotes.filter(item => item.bookingId === booking.id).sort((first, second) => second.version - first.version)[0];
  const balance = balances.find(item => item.bookingId === booking.id);
  const canQuote = ['Submitted', 'Under Review', 'Awaiting Information', 'Quoted'].includes(booking.status) && quote?.status !== 'Accepted';
  let stage = 'review';
  if (['Completed', 'Cancelled'].includes(booking.status)) stage = 'closed';
  else if (booking.status === 'Scheduled') stage = 'start';
  else if (booking.status === 'In Progress') stage = 'complete';
  else if (quote?.status === 'Accepted') stage = balance?.canSchedule === true ? 'schedule' : 'payment';
  return { stage, canQuote, quote };
}
export const scheduleSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a scheduling date.').refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Choose a valid date.'), time: text(2, 120), status: z.enum(['Scheduled', 'In Progress', 'Completed', 'Cancelled']), note: text(5, 1000) });
export const settingsSchema = z.object({ companyName: text(2, 160), tagline: z.string().trim().max(160), email: z.union([z.literal(''), z.email()]), phone: z.string().trim().max(40).refine(value => !value || /^[+\d ()-]{7,40}$/.test(value), 'Enter a valid business phone number or leave blank.'), whatsappNumber: z.string().trim().max(40).transform(value => value.replace(/[ ()-]/g, '')).refine(value => !value || /^\+[1-9]\d{7,14}$/.test(value), 'Use + followed by country code and number, or leave blank.').default(''), address: z.string().trim().max(500), serviceAreas: z.string().trim().max(2000), depositPercentage: z.string().refine(value => /^\d+(?:\.\d{1,2})?$/.test(value) && Number(value) > 0 && Number(value) <= 100, 'Use a percentage above 0 and at most 100.'), deliveryEnabled: z.boolean(), deliveryAreas: z.string().trim().max(2000), deliveryFee: z.union([z.literal(''), decimal]), pickupEnabled: z.boolean(), pickupLocation: z.string().trim().max(500), pickupInstructions: z.string().trim().max(1000) }).superRefine((values, context) => {
  if (values.deliveryEnabled && values.deliveryAreas.length < 2) context.addIssue({ code: 'custom', path: ['deliveryAreas'], message: 'Specify the configured delivery areas.' });
  if (values.deliveryEnabled && values.deliveryFee === '') context.addIssue({ code: 'custom', path: ['deliveryFee'], message: 'Enter an explicit delivery fee, including 0 if approved.' });
  if (values.pickupEnabled && values.pickupLocation.length < 5) context.addIssue({ code: 'custom', path: ['pickupLocation'], message: 'Provide an approved pickup location.' });
});
export const orderStatuses = ['Pending Configuration', 'Processing', 'On Hold', 'Ready for Pickup', 'Out for Delivery', 'Completed', 'Cancelled', 'Payment Failed'];
export const orderUpdateSchema = z.object({ status: z.enum(orderStatuses), note: text(5, 1000) });
export function validateOrderTransition(order, next, settings) {
  if (next === order.status) throw new Error('Choose a different fulfilment status.');
  if (['Completed', 'Cancelled'].includes(order.status)) throw new Error('This order is closed.');
  if (['On Hold', 'Cancelled'].includes(next)) return;
  const transitions = { 'Pending Configuration': ['Processing'], 'On Hold': ['Processing'], Processing: ['Ready for Pickup', 'Out for Delivery'], 'Ready for Pickup': ['Completed'], 'Out for Delivery': ['Completed'] };
  if (!transitions[order.status]?.includes(next)) throw new Error('This fulfilment transition is not available.');
  if (order.paymentStatus !== 'Paid') throw new Error('Payment must be confirmed before fulfilment progresses.');
  if (order.fulfilment === 'delivery' && (!settings.deliveryEnabled || !settings.deliveryAreas || settings.deliveryFee === '')) throw new Error('Delivery configuration is pending.');
  if (order.fulfilment === 'pickup' && (!settings.pickupEnabled || !settings.pickupLocation)) throw new Error('Pickup configuration is pending.');
  if ((next === 'Ready for Pickup' && order.fulfilment !== 'pickup') || (next === 'Out for Delivery' && order.fulfilment !== 'delivery')) throw new Error('Choose the status for this fulfilment method.');
}
export function validateBookingTransition(booking, next, accepted, paid) {
  if (['Completed', 'Cancelled'].includes(booking.status)) throw new Error('This booking is closed.');
  if (next === 'Cancelled') return;
  const allowed = { Scheduled: ['In Progress'], 'In Progress': ['Completed'] };
  if (next === 'Scheduled' && !['In Progress', 'Scheduled'].includes(booking.status)) {
    if (!accepted || paid <= 0) throw new Error('Scheduling requires an accepted quotation and confirmed payment.');
    return;
  }
  if (next === 'Scheduled' && booking.status === 'Scheduled') return;
  if (!allowed[booking.status]?.includes(next)) throw new Error('This booking transition is not available.');
}
export function imageError(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose JPG, PNG or WebP images only.';
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) return 'Each image must be non-empty and at most 5 MB.';
  return '';
}
export function filterRecords(records, search, status, fields) {
  const query = search.trim().toLowerCase();
  return records.filter(record => (!status || status === 'All' || record.status === status) && (!query || fields.some(field => String(record[field] ?? '').toLowerCase().includes(query))));
}
export function safeImageUrl(value) {
  if (typeof value !== 'string') return '';
  if (/^\/api\/uploads\/[a-f0-9]{24}$/.test(value)) return value;
  if (value.startsWith('/images/')) {
    try { const url = new URL(value, 'https://image.local'); return url.origin === 'https://image.local' && url.pathname.startsWith('/images/') && !/\.\.|%2e|%2f|%5c|\\/i.test(value) ? value : ''; } catch { return ''; }
  }
  try { const url = new URL(value); return ['https:', 'blob:'].includes(url.protocol) && !url.username && !url.password ? value : ''; } catch { return ''; }
}
