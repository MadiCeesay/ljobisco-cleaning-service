import { overview, resetQuotations } from '../quotations/demoAdapter.js';
import { paymentOverview, resetPayments } from '../payments/demoAdapter.js';
import { resetCatalog } from '../admin/demoCatalog.js';
import { resetAdmin } from '../admin/demoRuntime.js';
import { readDemoBookings, resetDemoBookings, addDemoBooking } from './demoBookings.js';
export { applyAdminBooking } from './demoBookings.js';
import { photoError, MAX_PHOTOS } from './validation.js';
const photoUrls = new Set();
export function createDemoPhotoPreviews(files) {
  if (files.length > MAX_PHOTOS) throw new Error('Choose no more than eight photographs.');
  for (const file of files) { const error = photoError(file); if (error) throw new Error(error); }
  return files.map(file => { const previewUrl = URL.createObjectURL(file); photoUrls.add(previewUrl); return { name: file.name || 'Local photograph', type: file.type, size: file.size, previewUrl, uploaded: false }; });
}
function clearDemoPhotos() { photoUrls.forEach(url => URL.revokeObjectURL(url)); photoUrls.clear(); }
let generation = 0;
const pause = async () => { const request = generation; await new Promise(resolve => setTimeout(resolve, 300)); if (request !== generation) throw new Error('The demo session ended. No changes were saved.'); };
let customer = { id: 'demo-customer', role: 'CUSTOMER', name: 'Demo Customer', email: 'preview@example.test', phone: '0000000' };


export async function authenticate(role = 'CUSTOMER') { await pause(); return role === 'ADMIN' ? { id: 'demo-admin', role: 'ADMIN', name: 'Demo Administrator', email: 'admin@example.test' } : { ...customer }; }
export async function registerCustomer({ name, email, phone }) { await pause(); customer = { ...customer, name, email, phone }; return { message: 'Demo registration validated locally. No real account was created and no email was sent.' }; }
export async function accountAction() { await pause(); return { message: 'Demo action completed locally. No account credentials were changed and no email was sent.' }; }
export async function getDashboard() { await pause(); return { ...overview(readDemoBookings()), ...paymentOverview() }; }
export function getRawBookings() { return structuredClone(readDemoBookings().map(booking => ({ ...booking, customerId: customer.id }))); }
export function getDemoCustomer() { return { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, status: 'Active', simulated: true }; }

export async function createBooking(values, photos) { await pause(); return addDemoBooking(values, photos); }
export async function updateProfile({ name, email, phone }) { await pause(); customer = { ...customer, name, email, phone }; return { ...customer }; }
export function resetDemo() { generation++; customer = { id: 'demo-customer', role: 'CUSTOMER', name: 'Demo Customer', email: 'preview@example.test', phone: '0000000' }; resetDemoBookings(); resetQuotations(); resetPayments(); resetCatalog(); resetAdmin(); clearDemoPhotos(); }
