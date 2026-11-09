import { canRespond, latestQuote, previewAmounts, quotationEditorSchema } from './rules.js';
import { readDemoBookings } from '../customer/demoBookings.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 200));
let state;
function initialState() {
  const now = Date.now();
  const issuedAt = new Date(now - 86400000).toISOString();
  const expiresAt = new Date(now + 7 * 86400000).toISOString();
  return {
    quotes: [
      { id: 'demo-quote-v1', bookingId: 'demo-review', customerId: 'demo-customer', version: 1, status: 'Superseded', issuedAt, expiresAt, currency: 'GMD', items: [{ description: 'Demo home cleaning labour', quantity: '1', unitPrice: '2500', total: 2500 }], total: 2500, notes: 'Development example — first official quotation.' },
      { id: 'demo-quote-v2', bookingId: 'demo-review', customerId: 'demo-customer', version: 2, status: 'Sent', issuedAt: new Date(now - 3600000).toISOString(), expiresAt, currency: 'GMD', items: [{ description: 'Demo home cleaning labour', quantity: '1', unitPrice: '2000', total: 2000 }, { description: 'Demo additional area', quantity: '1', unitPrice: '300', total: 300 }], total: 2300, notes: 'Development example — revised scope after discussion.' },
      { id: 'demo-quote-expired', bookingId: 'demo-information', customerId: 'demo-customer', version: 1, status: 'Expired', issuedAt: new Date(now - 4 * 86400000).toISOString(), expiresAt: new Date(now - 86400000).toISOString(), currency: 'GMD', items: [{ description: 'Demo office cleaning labour', quantity: '1', unitPrice: '3000', total: 3000 }], total: 3000, notes: 'Development example — expired quotation.' },
    ],
    conversations: [],
  };
}
function current() { if (!state) state = initialState(); return state; }
function assertActor(actor, customerId) { if (!actor || (actor.role !== 'ADMIN' && !(actor.role === 'CUSTOMER' && actor.id === customerId))) throw new Error('You do not have access to this booking.'); }
export function resetQuotations() { state = undefined; }

export function overview(bookings) {
  const ownQuotes = current().quotes.filter(quote => quote.customerId === 'demo-customer');
  return { bookings: bookings.map(booking => { const quote = latestQuote(ownQuotes, booking.id); return quote && !['Awaiting Information', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'].includes(booking.status) ? { ...booking, status: quote.status === 'Accepted' ? 'Awaiting Payment' : quote.status === 'Sent' ? 'Quoted' : booking.status } : booking; }), quotations: structuredClone(ownQuotes), messages: [] };
}

export async function workspace(actor, bookings) {
  await pause();
  assertActor(actor, 'demo-customer');
  const conversations = current().conversations.filter(entry => actor.role === 'ADMIN' || entry.customerId === actor.id);
  return structuredClone({ bookings: overview(bookings).bookings, quotes: current().quotes.filter(quote => actor.role === 'ADMIN' || quote.customerId === actor.id), conversations });
}

export async function respond(id, action, version, actor) {
  await pause();
  const quote = current().quotes.find(item => item.id === id);
  if (readDemoBookings().find(booking => booking.id === quote?.bookingId)?.status === 'Cancelled') throw new Error('This booking is cancelled. Its quotation is no longer available for response.');
  if (!['accept', 'decline'].includes(action) || !canRespond(quote, current().quotes, actor) || quote.version !== version) throw new Error('This quotation is no longer available for response. Refresh to review the latest version.');
  quote.status = action === 'accept' ? 'Accepted' : 'Declined';
  if (action === 'accept') quote.acceptedAt = new Date().toISOString();
  return structuredClone(quote);
}

export async function issue(values, expectedVersion, actor, bookings) {
  await pause();
  if (actor?.role !== 'ADMIN') throw new Error('Only an administrator can issue quotations.');
  const parsed = quotationEditorSchema.parse(values);
  const booking = bookings.find(item => item.id === parsed.bookingId);
  const latest = latestQuote(current().quotes, parsed.bookingId);
  if (!booking || !['Submitted', 'Under Review', 'Awaiting Information', 'Quoted'].includes(overview([booking]).bookings[0].status) || latest?.status === 'Accepted') throw new Error('This booking is not eligible for a new quotation.');
  if ((latest?.version || 0) !== expectedVersion) throw new Error('A newer revision is available. Refresh before issuing another version.');
  const amounts = previewAmounts(parsed.items);
  if (latest) current().quotes.filter(quote => quote.bookingId === booking.id).forEach(quote => { if (quote.status === 'Sent') quote.status = 'Superseded'; });
  const quote = { id: `demo-quote-${crypto.randomUUID()}`, bookingId: booking.id, customerId: 'demo-customer', version: expectedVersion + 1, status: 'Sent', issuedAt: new Date().toISOString(), expiresAt: new Date(parsed.expiresAt).toISOString(), currency: 'GMD', items: parsed.items.map((item, index) => ({ ...item, total: amounts.lines[index] })), total: amounts.total, notes: parsed.notes };
  current().quotes.push(quote);
  return structuredClone(quote);
}
