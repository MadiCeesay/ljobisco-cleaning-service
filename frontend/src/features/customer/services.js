import { apiRequest } from '../../services/apiClient';
import { endpoints } from '../../services/endpoints';
import { photoError, MAX_PHOTOS, bookingSchema } from './validation';
import { uploadImages } from '../../services/uploads';
import { useBookingDraft } from './draft';
import { requireDemo } from '../../services/demoMode';

export async function demoAdapter() {
  if (!import.meta.env.DEV) throw new Error('Demo access is unavailable in production.');
  requireDemo();
  return import('./demoAdapter');
}

export const uploadService = {
  async prepare(files, demo) {
    if (files.length > MAX_PHOTOS) throw new Error('Choose no more than eight photographs.');
    for (const file of files) { const error = photoError(file); if (error) throw new Error(error); }
    if (!files.length) return [];
    if (demo && import.meta.env.DEV) return (await demoAdapter()).createDemoPhotoPreviews(files);
    return (await uploadImages(files, 'booking-photo')).map(({ attachmentId }) => ({ attachmentId }));
  },
};

export async function getDashboard(demo) {
  return demo && import.meta.env.DEV ? (await demoAdapter()).getDashboard() : apiRequest(endpoints.customer.overview);
}

export async function submitBooking(values, files, demo) {
  const payload = bookingSchema.parse(values);
  const photos = await uploadService.prepare(files, demo);
  return demo && import.meta.env.DEV ? (await demoAdapter()).createBooking(payload, photos) : apiRequest(endpoints.bookings.create, { method: 'POST', body: { ...payload, photos, requestId: useBookingDraft.getState().requestId } });
}
