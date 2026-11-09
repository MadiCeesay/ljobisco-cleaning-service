import { demoProducts } from '../../data/demoProducts.js';
import { services } from '../../data/services.js';
import { productSchema, serviceSchema, settingsSchema } from './rules.js';

let products;
let serviceEntries;
let settings;
let revision = 0;
export const defaultSettings = { companyName: 'Ijobisco Cleaning Services', tagline: 'Sparkles Starts Here.', email: '', phone: '', whatsappNumber: '', address: '', serviceAreas: '', depositPercentage: '30', deliveryEnabled: false, deliveryAreas: '', deliveryFee: '', pickupEnabled: false, pickupLocation: '', pickupInstructions: '' };
function currentProducts() { return products ||= demoProducts.map(product => ({ ...structuredClone(product), enabled: true, revision: 1 })); }
function currentServices() { return serviceEntries ||= services.map(service => ({ ...structuredClone(service), id: service.slug, images: [`/images/${service.image}.webp`], enabled: true, revision: 1 })); }
export function catalogSnapshot() { return structuredClone({ products: currentProducts(), services: currentServices(), settings: settings || defaultSettings, settingsRevision: revision }); }
export function getDemoProducts() { return structuredClone(currentProducts().filter(product => product.enabled)); }
export function saveCatalog(kind, id, values, images, expectedRevision) {
  const entries = kind === 'products' ? currentProducts() : currentServices();
  const data = (kind === 'products' ? productSchema : serviceSchema).parse(values);
  const entry = entries.find(item => item.id === id);
  if (id && !entry) throw new Error('This record is no longer available.');
  if (entry && entry.revision !== expectedRevision) throw new Error('This record changed. Refresh before saving.');
  if (entries.some(item => item.slug === data.slug && item.id !== id)) throw new Error('This URL slug is already in use.');
  if (!images.length || images.length > 4) throw new Error('Keep between one and four images.');
  const record = { ...entry, ...data, id: id || `demo-${kind}-${crypto.randomUUID()}`, images: [...images], revision: (entry?.revision || 0) + 1 };
  if (kind === 'products') { record.price = Number(data.price); record.stock = Number(data.stock); }
  if (entry) entries.splice(entries.indexOf(entry), 1, record); else entries.push(record);
  return structuredClone(record);
}
export function saveSettings(values, expectedRevision) {
  if (expectedRevision !== revision) throw new Error('Settings changed. Refresh before saving.');
  settings = settingsSchema.parse(values); revision++;
  return structuredClone(settings);
}
export function resetCatalog() { products = undefined; serviceEntries = undefined; settings = undefined; revision = 0; }
