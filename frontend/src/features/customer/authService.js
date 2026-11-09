import { apiRequest } from '../../services/apiClient';
import { endpoints } from '../../services/endpoints';
import { demoAdapter } from './services';
import { authSchema, profileSchema } from './validation';
import { profileUser, sessionUser } from './session';

export async function loginAccount(values, demo, role) {
  if (demo && import.meta.env.DEV) return sessionUser(await (await demoAdapter()).authenticate(role), role);
  const response = await apiRequest(endpoints.auth.login, { method: 'POST', body: authSchema('login').parse(values) });
  return sessionUser(response.user, role);
}
export async function accountAction(mode, values, demo) {
  if (!['register', 'forgot-password', 'reset-password', 'verify-email'].includes(mode)) throw new Error('This account action is unavailable.');
  const payload = authSchema(mode).parse(values);
  delete payload.confirmPassword;
  if (demo && import.meta.env.DEV) { const adapter = await demoAdapter(); return mode === 'register' ? adapter.registerCustomer(payload) : adapter.accountAction(); }
  return apiRequest(endpoints.auth[mode], { method: 'POST', body: payload });
}
export async function updateProfile(values, demo, current) {
  const payload = profileSchema.parse(values);
  const user = demo && import.meta.env.DEV ? await (await demoAdapter()).updateProfile(payload) : (await apiRequest(endpoints.customer.profile, { method: 'PATCH', body: payload })).user;
  return profileUser(user, current);
}
