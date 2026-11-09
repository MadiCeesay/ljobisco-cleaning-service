import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { Upload } from './models.js';
import { assert, HttpError } from './errors.js';
import { identifier } from './domain.js';

export async function inspectImage(file) {
  assert(file && file.buffer?.length > 0 && file.buffer.length <= 5 * 1024 * 1024, 422, 'INVALID_IMAGE', 'Choose a non-empty image up to 5 MB.');
  try {
    const image = sharp(file.buffer, { limitInputPixels: 25000000, animated: false, failOn: 'warning' });
    const metadata = await image.metadata();
    const types = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    assert(types[metadata.format] && types[metadata.format] === file.mimetype && (!metadata.pages || metadata.pages === 1) && metadata.width <= 10000 && metadata.height <= 10000, 422, 'INVALID_IMAGE', 'Choose a valid non-animated JPG, PNG or WebP image.');
    return await image.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { assert(false, 422, 'INVALID_IMAGE', 'The image could not be safely decoded.'); }
}
export function cloudinaryMedia(config) {
  const enabled = Boolean(config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET);
  cloudinary.config({ cloud_name: config.CLOUDINARY_CLOUD_NAME, api_key: config.CLOUDINARY_API_KEY, api_secret: config.CLOUDINARY_API_SECRET, secure: true });
  return {
    available: enabled,
    async upload(buffer, privateAsset) {
      assert(enabled, 503, 'UPLOAD_UNAVAILABLE', 'Cloudinary configuration is required.');
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ resource_type: 'image', type: privateAsset ? 'authenticated' : 'upload', public_id: `ijobisco/${randomUUID()}`, overwrite: false, format: 'webp' }, (error, result) => error ? reject(error) : resolve({ publicId: result.public_id, format: result.format }));
        stream.end(buffer);
      });
    },
    async remove(entry) { if (enabled) await cloudinary.uploader.destroy(entry.publicId, { type: entry.private ? 'authenticated' : 'upload', resource_type: 'image', invalidate: true }); },
    url(entry) {
      assert(enabled, 503, 'UPLOAD_UNAVAILABLE', 'Cloudinary configuration is required.');
      return entry.private ? cloudinary.utils.private_download_url(entry.publicId, entry.format, { type: 'authenticated', resource_type: 'image', expires_at: Math.floor(Date.now() / 1000) + 60, attachment: false }) : cloudinary.url(entry.publicId, { secure: true, format: entry.format });
    },
  };
}
export async function attachmentIds(ids, user, purpose, session, bookingId) {
  const unique = [...new Set(ids.map(identifier))]; assert(unique.length === ids.length, 422, 'INVALID_ATTACHMENTS', 'Duplicate attachments are not allowed.');
  const entries = await Upload.find({ _id: { $in: unique }, ownerId: user._id, purpose }).session(session || null);
  assert(entries.length === ids.length && entries.every(entry => !entry.attachedTo && (!bookingId || String(entry.bookingId) === String(bookingId))), 422, 'INVALID_ATTACHMENTS', 'An attachment is unavailable or belongs to another record.');
  return entries.map(entry => entry._id);
}
export async function photoDtos(ids) {
  const entries = await Upload.find({ _id: { $in: ids || [] } });
  return entries.map(entry => ({ attachmentId: String(entry._id), name: entry.name, type: entry.type, size: entry.size, uploaded: true, url: `/api/uploads/${entry._id}` }));
}
export function uploadRoutes(auth, media) {
  const router = Router();
  const receive = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 2, parts: 3 } }).single('file');
  const limited = rateLimit({ windowMs: 60000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false });
  router.post('/uploads', auth.requireUser, limited, async (request, response, next) => {
    assert(media.available, 503, 'UPLOAD_UNAVAILABLE', 'Cloudinary configuration is required before uploading images.');
    receive(request, response, error => error ? next(Object.assign(error, { status: 422 })) : next());
  }, async (request, response) => {
    const values = z.object({ purpose: z.enum(['booking-photo', 'service-image', 'product-image']), bookingId: z.string().optional() }).strict().parse(request.body);
    const privateAsset = values.purpose === 'booking-photo';
    assert(privateAsset || request.user.role === 'ADMIN', 403, 'FORBIDDEN', 'Only administrators manage marketing images.');
    if (values.purpose === 'booking-photo') assert(request.user.role === 'CUSTOMER', 403, 'CUSTOMER_REQUIRED', 'A customer account is required.');
    const buffer = await inspectImage(request.file);
    let uploaded;
    try { uploaded = await media.upload(buffer, privateAsset); }
    catch { throw new HttpError(503, 'UPLOAD_UNAVAILABLE', 'Secure image storage did not confirm the upload. Please try again later.'); }
    const entry = { ownerId: request.user._id, purpose: values.purpose, ...(values.bookingId ? { bookingId: identifier(values.bookingId) } : {}), publicId: uploaded.publicId, format: uploaded.format, name: String(request.file.originalname || 'photograph').replace(/[^a-zA-Z0-9 ._-]/g, '').slice(0, 120) || 'photograph', type: 'image/webp', size: buffer.length, private: privateAsset };
    try { const record = await Upload.create(entry); response.status(201).json({ attachmentId: String(record._id), name: record.name, type: record.type, size: record.size, uploaded: true }); }
    catch (error) { await media.remove(entry).catch(() => {}); throw error; }
  });
  router.get('/uploads/:id', async (request, response) => {
    const entry = await Upload.findById(identifier(request.params.id)); assert(entry, 404, 'NOT_FOUND', 'Image not found.');
    if (entry.private) {
      assert(request.user, 401, 'AUTH_REQUIRED', 'Please log in.');
      assert(request.user.role === 'ADMIN' || String(entry.ownerId) === String(request.user._id), 404, 'NOT_FOUND', 'Image not found.');
    }
    response.set('Referrer-Policy', 'no-referrer').redirect(302, media.url(entry));
  });
  return router;
}
