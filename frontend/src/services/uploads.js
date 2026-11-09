import { apiRequest } from './apiClient';

export async function uploadImages(files, purpose, bookingId) {
  const result = [];
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error('Choose JPG, PNG or WebP images up to 5 MB. PDF uploads are not enabled.');
    const body = new FormData(); body.append('purpose', purpose); if (bookingId) body.append('bookingId', bookingId); body.append('file', file);
    const uploaded = await apiRequest('/uploads', { method: 'POST', body });
    if (!/^[a-f0-9]{24}$/.test(uploaded.attachmentId)) throw new Error('The upload service did not confirm this image.');
    result.push(uploaded);
  }
  return result;
}
