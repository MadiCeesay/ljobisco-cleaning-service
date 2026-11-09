const fixtures = [
  { id: 'demo-review', status: 'Under Review', service: 'home-cleaning', propertyType: 'House', rooms: '3', size: '', requirements: '', address: 'Sample property — demo only', town: 'Demo area', directions: '', date: '', time: 'Flexible', description: 'Sample request for a home refresh. This is development-only fixture information.', photos: [], createdAt: '2026-11-06T09:00:00Z' },
  { id: 'demo-information', status: 'Awaiting Information', service: 'office-cleaning', propertyType: 'Office', rooms: '2', size: '', requirements: '', address: 'Sample workspace — demo only', town: 'Demo area', directions: '', date: '', time: 'Flexible', description: 'Sample workspace cleaning request.', clarification: 'Demo administrator note: please clarify the floor area and share a photograph of the entrance.', photos: [], createdAt: '2026-11-06T10:00:00Z' },
];
let bookings = [...fixtures];
export function readDemoBookings() { return structuredClone(bookings); }
export function resetDemoBookings() { bookings = structuredClone(fixtures); }
export function applyAdminBooking(id, changes, note, expectedRevision) {
  const booking = bookings.find(item => item.id === id);
  if (!booking || (booking.revision || 0) !== expectedRevision) throw new Error('This booking changed. Refresh before updating.');
  const updated = { ...booking, ...changes, revision: (booking.revision || 0) + 1, history: [...(booking.history || []), { title: note, status: changes.status, at: new Date().toISOString() }] };
  bookings = bookings.map(item => item.id === id ? updated : item);
  return structuredClone(updated);
}
export function addDemoBooking(values, photos) { const booking = { ...values, photos, customerId: 'demo-customer', id: `demo-${crypto.randomUUID()}`, status: 'Submitted', createdAt: new Date().toISOString() }; bookings = [booking, ...bookings]; return structuredClone(booking); }
