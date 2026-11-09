import { create } from 'zustand';
import { getProducts } from '../services/catalog';
import { readCart, writeCart, resolveCart } from './cartPersistence';
import { consumeSubmittedCart } from './cartCheckout';
import { apiConfigured } from '../services/apiClient';
import { demoAvailable } from '../services/demoMode';

const storageKey = demo => demo ? 'ijobisco:cart:demo:v1' : 'ijobisco:cart:live:v1';
const defaultDemo = demoAvailable && !apiConfigured;
let hydration = 0;
function getStorage() {
  try { return window.localStorage; } catch { return undefined; }
}

export const useCart = create((set) => ({
  items: [], demo: defaultDemo,
  hasHydrated: false,
  addItem: (product, quantity = 1) => set(state => {
    if (!state.hasHydrated || (product.demo ?? product.id.startsWith('demo-')) !== state.demo || (state.demo && (!import.meta.env.DEV || !product.id.startsWith('demo-'))) || (!state.demo && !/^[a-f0-9]{24}$/.test(product.id)) || product.stock < 1 || !Number.isInteger(quantity) || quantity < 1) return state;
    const existing = state.items.find(item => item.product.id === product.id);
    const nextQuantity = Math.min(product.stock, (existing?.quantity || 0) + quantity);
    return { items: existing ? state.items.map(item => item.product.id === product.id ? { ...item, product, quantity: nextQuantity } : item) : [...state.items, { product, quantity: nextQuantity }] };
  }),
  setQuantity: (id, quantity) => set(state => {
    if (!Number.isInteger(quantity) || quantity < 1) return state;
    return { items: state.items.map(item => item.product.id === id ? { ...item, quantity: Math.min(quantity, item.product.stock) } : item) };
  }),
  removeItem: id => set(state => ({ items: state.items.filter(item => item.product.id !== id) })),
  completeCheckout: submitted => set(state => ({ items: consumeSubmittedCart(state.items, submitted) })),
  setMode: demo => { if (demo && !demoAvailable) throw new Error('Demo carts are disabled in the connected application.'); if (Boolean(demo) !== useCart.getState().demo) return restoreCart(Boolean(demo)); },
}));

useCart.subscribe((state, previous) => {
  if (state.hasHydrated && (state.items !== previous.items || !previous.hasHydrated)) writeCart(getStorage(), storageKey(state.demo), state.items);
});

async function restoreCart(demo = defaultDemo) {
  const current = ++hydration;
  useCart.setState({ demo, items: [], hasHydrated: false });
  const references = readCart(getStorage(), storageKey(demo));
  if (!references.length) {
    useCart.setState({ hasHydrated: true });
    return;
  }
  try {
    const products = await getProducts(demo);
    if (current === hydration) useCart.setState({ items: resolveCart(references, products), hasHydrated: true });
  } catch {
    if (current === hydration) useCart.setState({ hasHydrated: true });
  }
}

restoreCart();
