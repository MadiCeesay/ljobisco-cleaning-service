import { create } from 'zustand';
import { apiConfigured, apiRequest, clearApiSession, onSessionExpired } from '../../services/apiClient';
import { endpoints } from '../../services/endpoints';
import { demoAdapter } from './services';
import { loginAccount } from './authService';
import { sessionUser, profileUser } from './session';
import { useBookingDraft } from './draft';
import { useCustomerData } from './customerData';
import { useCart } from '../../store/cart';
import { requireDemo } from '../../services/demoMode';

let generation = 0;
function clearCustomerState() { useBookingDraft.getState().clear(); useCustomerData.getState().clear(); }
export const useAuth = create(set => ({
  user: null, demo: false, checking: apiConfigured,
  login: async (values, demo = false, requiredRole = 'CUSTOMER') => {
    if (demo) requireDemo();
    const request = ++generation;
    clearApiSession();
    set({ checking: false });
    if (demo && useAuth.getState().user && !useAuth.getState().demo) { await apiRequest(endpoints.auth.logout, { method: 'POST' }); clearApiSession(); }
    const user = await loginAccount(values, demo, requiredRole);
    if (request !== generation) throw new Error('The account session changed. Please try again.');
    clearCustomerState();
    useCart.getState().setMode(demo && import.meta.env.DEV);
    set({ user, demo: demo && import.meta.env.DEV, checking: false });
  },
  logout: async () => {
    const request = ++generation;
    const current = useAuth.getState();
    if (current.demo) (await demoAdapter()).resetDemo();
    else await apiRequest(endpoints.auth.logout, { method: 'POST' });
    if (request !== generation) return;
    clearApiSession();
    clearCustomerState();
    set({ user: null, demo: false, checking: false });
  },
  updateUser: user => set(state => ({ user: profileUser(user, state.user) })),
}));

onSessionExpired(() => {
  if (useAuth.getState().demo) return;
  generation++;
  clearCustomerState();
  useAuth.setState({ user: null, demo: false, checking: false });
});
if (apiConfigured) {
  const request = generation;
  apiRequest(endpoints.auth.session).then(response => {
    if (request === generation) useAuth.setState({ user: response.user ? sessionUser(response.user) : null, checking: false });
  }).catch(() => { if (request === generation) useAuth.setState({ user: null, checking: false }); });
}
