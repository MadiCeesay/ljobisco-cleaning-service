import { apiRequest } from '../../services/apiClient';
import { endpoints } from '../../services/endpoints';
import { demoAdapter as customerAdapter } from '../customer/services';
import { requireDemo } from '../../services/demoMode';

async function demoRepository() { if (!import.meta.env.DEV) throw new Error('Quotation demos are disabled in production.'); requireDemo(); return import('./demoAdapter'); }
export async function getWorkspace(demo, actor) {
  if (demo && import.meta.env.DEV) {
    const customer = await customerAdapter();
    const data = await (await demoRepository()).workspace(actor, customer.getRawBookings());
    return { ...data, conversations: data.conversations.map(conversation => ({ ...conversation, customerName: customer.getDemoCustomer().name })) };
  }
  return apiRequest(actor.role === 'ADMIN' ? endpoints.admin.quotationWorkspace : endpoints.customer.quotations);
}
export async function respondQuotation(quote, action, demo, actor) {
  const result = demo && import.meta.env.DEV ? await (await demoRepository()).respond(quote.id, action, quote.version, actor) : await apiRequest(endpoints.quotations.respond(quote.id), { method: 'POST', body: { action, expectedVersion: quote.version } });
  if (result.id !== quote.id || result.version !== quote.version || result.status !== (action === 'accept' ? 'Accepted' : 'Declined')) throw new Error('The service did not confirm this quotation response. Refresh to check the latest status.');
  return result;
}
export async function issueQuotation(values, expectedVersion, demo, actor) {
  const result = demo && import.meta.env.DEV ? await (await demoRepository()).issue(values, expectedVersion, actor, (await customerAdapter()).getRawBookings()) : await apiRequest(endpoints.admin.quotations, { method: 'POST', body: { ...values, expectedVersion } });
  if (!result.id || result.bookingId !== values.bookingId || result.version !== expectedVersion + 1 || result.status !== 'Sent' || result.currency !== 'GMD' || !Number.isFinite(result.total)) throw new Error('The service did not return a valid issued quotation. Refresh before trying again.');
  return result;
}
