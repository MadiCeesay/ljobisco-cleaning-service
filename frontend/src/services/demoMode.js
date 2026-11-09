export const demoAvailable = import.meta.env.DEV && !String(import.meta.env.VITE_API_BASE_URL || '').trim();
export function requireDemo() {
  if (!demoAvailable) throw new Error('Demo adapters are disabled in the connected application. Use a separate disconnected development preview for fixtures.');
}
