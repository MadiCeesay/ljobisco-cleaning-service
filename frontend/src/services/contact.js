import { apiConfigured, apiRequest } from './apiClient';
export async function submitContact(values) {
  if (apiConfigured) return apiRequest('/contact', { method: 'POST', body: values });
  await new Promise(resolve => setTimeout(resolve, 450));
  return { delivered: false, message: 'Submission is unavailable in this preview. Your message has not been sent or saved. Please try again when Ijobisco’s contact service is connected.' };
}
