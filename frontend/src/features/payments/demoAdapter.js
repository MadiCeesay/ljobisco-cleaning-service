import { canSelectPayment } from '../quotations/rules.js';
import { workspace } from '../quotations/demoAdapter.js';
import { getDemoProducts, catalogSnapshot } from '../admin/demoCatalog.js';
import { readDemoBookings } from '../customer/demoBookings.js';
import { checkoutSchema, paymentPreview, payableAmount } from './rules.js';

let records = [];
let orders = [];
const locks = new Set();
const requests = new Map();
let generation = 0;
const pause = () => new Promise(resolve => setTimeout(resolve, 450));
function customer(actor) { if (actor?.role !== 'CUSTOMER' || actor.id !== 'demo-customer') throw new Error('Customer access is required.'); }
export function resetPayments() { generation++; records = []; orders = []; locks.clear(); requests.clear(); }
export function paymentOverview() { return { payments: structuredClone(records), orders: structuredClone(orders) }; }
export async function getAccount(actor) { customer(actor); await pause(); const catalogue = catalogSnapshot(); return { ...paymentOverview(), depositPercentage: catalogue.settingsRevision ? Number(catalogue.settings.depositPercentage) : undefined }; }
export async function payCleaning({ quotationId, choice, outcome, requestId }, actor, percentage) {
  customer(actor);
  if (!['paid', 'failed'].includes(outcome) || !['deposit', 'full', 'balance'].includes(choice) || !requestId) throw new Error('Invalid simulated payment request.');
  if (requests.has(requestId)) return structuredClone(requests.get(requestId));
  if (locks.has(quotationId)) throw new Error('A payment is already processing.');
  locks.add(quotationId);
  const session = generation;
  try {
    await pause();
    const data = await workspace(actor, []);
    if (session !== generation) throw new Error('The demo session ended. No payment was recorded.');
    const quote = data.quotes.find(item => item.id === quotationId);
    if (!canSelectPayment(quote, data.quotes, actor)) throw new Error('Accept the latest official quotation first.');
    const booking = readDemoBookings().find(item => item.id === quote.bookingId);
    if (booking?.status === 'Cancelled') throw new Error('Payments are unavailable for a cancelled booking.');
    const paid = records.filter(item => item.quotationId === quotationId && item.status === 'Paid').reduce((sum, item) => sum + item.amount, 0);
    const configured = catalogSnapshot().settingsRevision ? Number(catalogSnapshot().settings.depositPercentage) : percentage;
    const summary = paymentPreview(quote.total, configured, paid);
    const amount = payableAmount(summary, choice, booking?.status === 'Completed');
    if (!amount) throw new Error('The balance requires backend-confirmed cleaning completion.');
    const record = { id: `demo-payment-${crypto.randomUUID()}`, quotationId, bookingId: quote.bookingId, amount, status: outcome === 'paid' ? 'Paid' : 'Failed', createdAt: new Date().toISOString(), simulated: true };
    records.push(record); requests.set(requestId, record);
    return structuredClone(record);
  } finally { if (session === generation) locks.delete(quotationId); }
}
export async function createOrder({ details, items, outcome, requestId, acknowledge }, actor) {
  customer(actor);
  checkoutSchema.parse(details);
  if (!acknowledge || !['paid', 'failed'].includes(outcome) || !requestId) throw new Error('Confirm the simulated checkout first.');
  if (requests.has(requestId)) return structuredClone(requests.get(requestId));
  if (locks.has(actor.id)) throw new Error('An order is already processing.');
  locks.add(actor.id);
  const session = generation;
  try {
    await pause();
    if (session !== generation) throw new Error('The demo session ended. No order was recorded.');
    if (!items.length || new Set(items.map(item => item.id)).size !== items.length) throw new Error('Review your cart.');
    const lines = items.map(item => {
      const product = getDemoProducts().find(product => product.id === item.id);
      if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > product.stock) throw new Error('A demo item is unavailable. Review your cart.');
      if (item.expectedRevision != null && item.expectedRevision !== product.revision) throw new Error('A demo product changed after it was added. Remove the affected item and add it again from the updated catalogue before reviewing checkout.');
      return { productId: product.id, name: product.name, quantity: item.quantity, unitPrice: product.price, total: Math.round(product.price * 100) * item.quantity / 100 };
    });
    const createdAt = new Date().toISOString();
    const order = { id: `demo-order-${crypto.randomUUID()}`, customerId: actor.id, items: lines, total: lines.reduce((sum, item) => sum + Math.round(item.total * 100), 0) / 100, fulfilment: details.fulfilment, paymentStatus: outcome === 'paid' ? 'Paid' : 'Failed', status: outcome === 'paid' ? 'Pending Configuration' : 'Payment Failed', createdAt, simulated: true, timeline: [{ title: 'Simulated order created', at: createdAt }, { title: outcome === 'paid' ? 'Mock payment confirmed — no money moved' : 'Mock payment failed — no money moved', at: createdAt }] };
    order.customer = { name: details.name, email: details.email, phone: details.phone };
    order.deliveryAddress = details.fulfilment === 'delivery' ? { address: details.address, town: details.town } : null;
    order.revision = 0;
    orders.unshift(order); requests.set(requestId, order);
    return structuredClone(order);
  } finally { if (session === generation) locks.delete(actor.id); }
}
export function updateDemoOrder(id, status, note, expectedRevision) {
  const order = orders.find(item => item.id === id);
  if (!order || (order.revision || 0) !== expectedRevision) throw new Error('This order changed. Refresh before updating.');
  order.status = status; order.revision = (order.revision || 0) + 1;
  order.timeline.push({ title: `Demo administrator: ${status} — ${note}`, at: new Date().toISOString() });
  return structuredClone(order);
}
