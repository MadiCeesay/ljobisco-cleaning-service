import { z } from 'zod';
import { apiConfigured, apiRequest } from './apiClient';
import { requireDemo } from './demoMode';
const productSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/), slug: z.string(), name: z.string(), description: z.string(), category: z.string(), price: z.number().finite().nonnegative(), stock: z.number().int().nonnegative(), images: z.array(z.string().regex(/^\/api\/uploads\/[a-f0-9]{24}$/)).min(1), enabled: z.boolean(), revision: z.number().int() });
export async function getProducts(useDemo = false) {
  if (import.meta.env.DEV && useDemo) {
    requireDemo();
    const { getDemoProducts } = await import('../features/admin/demoCatalog');
    return (await getDemoProducts()).map(product => ({ ...product, demo: true }));
  }
  if (!apiConfigured) return [];
  const response = await apiRequest('/products');
  return z.array(productSchema).parse(response.products).map(product => ({ ...product, demo: false }));
}

export const formatPrice = amount => new Intl.NumberFormat('en-GM', { style: 'currency', currency: 'GMD' }).format(amount);
