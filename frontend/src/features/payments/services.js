import { apiRequest } from '../../services/apiClient';
import { endpoints } from '../../services/endpoints';
import { depositSetting } from './rules';
import { requireDemo } from '../../services/demoMode';

export const depositPercentage = depositSetting(import.meta.env.VITE_DEPOSIT_PERCENT);
async function adapter() {
  if (!import.meta.env.DEV) throw new Error('Simulated payments are unavailable in production.');
  requireDemo();
  return import('./demoAdapter');
}
export const getPaymentAccount = (demo, actor) => demo && import.meta.env.DEV ? adapter().then(module => module.getAccount(actor)) : apiRequest(endpoints.customer.commerce);
export const localMockPayments = import.meta.env.DEV && import.meta.env.VITE_LOCAL_MOCK_PAYMENTS === 'true';
export const getCheckoutConfiguration = () => apiRequest('/checkout/configuration');
export const previewOrder = payload => apiRequest('/checkout/preview', { method: 'POST', body: payload });
export async function payCleaning(payload, demo, actor) {
  if (demo && import.meta.env.DEV) return (await adapter()).payCleaning(payload, actor, depositPercentage);
  if (!localMockPayments) throw new Error('Live payment providers are unavailable. No payment was taken.');
  const { quotationId, expectedVersion, choice, requestId, outcome = 'paid' } = payload;
  return apiRequest(endpoints.payments.cleaningIntent, { method: 'POST', body: { quotationId, expectedVersion, choice, requestId, provider: 'mock', mockOutcome: outcome } });
}
export async function placeOrder(payload, demo, actor) {
  if (demo && import.meta.env.DEV) return (await adapter()).createOrder(payload, actor);
  const { details, items, requestId, outcome = 'paid' } = payload;
  let order = await apiRequest(endpoints.orders.create, { method: 'POST', body: { details, items, requestId } });
  if (localMockPayments) {
    await payOrder(order.id, requestId, outcome);
    order = await apiRequest(endpoints.orders.detail(order.id));
  }
  return order;
}

export function payOrder(orderId, requestId, outcome = 'paid') {
  if (!localMockPayments) throw new Error('Development mock payments are disabled. No payment was taken.');
  return apiRequest(endpoints.payments.orderIntent, { method: 'POST', body: { orderId, requestId, provider: 'mock', mockOutcome: outcome } });
}
