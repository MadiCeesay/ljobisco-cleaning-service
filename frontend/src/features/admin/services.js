import { apiRequest } from '../../services/apiClient';
import { endpoints } from '../../services/endpoints';
import { uploadImages } from '../../services/uploads';
import { requireDemo } from '../../services/demoMode';

async function repository() {
  if (!import.meta.env.DEV) throw new Error('Administrator demos are disabled in production.');
  requireDemo();
  return import('./demoAdapter');
}
function authorize(actor) { if (actor?.role !== 'ADMIN') throw new Error('Administrator access is required.'); }
export async function getAdminWorkspace(demo, actor) {
  authorize(actor);
  return demo && import.meta.env.DEV ? (await repository()).snapshot(actor) : apiRequest(endpoints.admin.workspace);
}
const operations = {
  settings: () => endpoints.admin.settings,
  catalog: payload => endpoints.admin.catalog(payload.kind, payload.id),
  'booking-information': payload => endpoints.admin.information(payload.id),
  'booking-schedule': payload => endpoints.admin.schedule(payload.id),
  'order-status': payload => endpoints.admin.fulfilment(payload.id),
};
export async function adminOperation(operation, payload, files, demo, actor) {
  authorize(actor);
  if (!operations[operation] || (operation === 'catalog' && !['services', 'products'].includes(payload.kind))) throw new Error('Unknown administrator operation.');
  if (demo && import.meta.env.DEV) return (await repository()).mutate(operation, payload, actor, files);
  const images = files.length ? await uploadImages(files, payload.kind === 'products' ? 'product-image' : 'service-image') : [];
  const body = operation === 'catalog' ? { ...payload, images: [...payload.images, ...images.map(image => `/api/uploads/${image.attachmentId}`)] } : payload;
  const response = await apiRequest(operations[operation](payload), { method: 'POST', body });
  if (!response?.record || !Number.isInteger(response.record.revision)) throw new Error('The backend did not confirm this change. Refresh to check its current state before retrying.');
  return response.record;
}
