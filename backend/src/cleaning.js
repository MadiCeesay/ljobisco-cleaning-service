import { customerNotifications } from './notifications.js';
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Booking, Quotation, Upload, Service } from './models.js';
import { services as serviceDefaults } from './serviceDefaults.js';
import { attachmentIds, photoDtos } from './uploads.js';
import { transaction } from './database.js';
import { assert } from './errors.js';
import { text, revision, identifier, owned, ownFilter, audit, minor, decimal, bookingDto, quoteDto, settings } from './domain.js';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
export const bookingSchema = z.object({
  service: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100), propertyType: z.union([z.literal(''), z.enum(['House', 'Apartment', 'Office', 'Other'])]).default(''),
  size: z.string().max(30).refine(value => !value || (/^\d+(\.\d+)?$/.test(value) && Number(value) > 0 && Number(value) <= 1000000)),
  rooms: z.union([z.literal(''), z.string().regex(/^\d+$/).refine(value => Number(value) >= 1 && Number(value) <= 10000)]),
  contactPhone: z.string().trim().regex(/^[+\d ()-]{7,25}$/).optional(),
  requirements: text(), address: text(5, 500), town: text(2, 100), directions: text(0, 1000),
  date: z.union([z.literal(''), date.refine(value => value >= new Date().toISOString().slice(0, 10))]), time: z.enum(['Morning', 'Afternoon', 'Flexible']), description: text(10, 3000),
  requestId: z.string().uuid().optional(), photos: z.array(z.object({ attachmentId: z.string().regex(/^[a-f0-9]{24}$/) }).strict()).max(8).default([]),
}).strict();
export const quoteSchema = z.object({ bookingId: z.string(), expectedVersion: revision, notes: text(), expiresAt: z.string().refine(value => Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now()), items: z.array(z.object({ description: text(3, 300), quantity: decimal.refine(value => Number(value) > 0 && Number(value) <= 10000), unitPrice: decimal.refine(value => Number(value) <= 1000000) }).strict()).min(1).max(20) }).strict();
export async function quotationWorkspace(user) {
  return { bookings: await Promise.all((await Booking.find(ownFilter(user)).sort({ createdAt: -1 })).map(completeBookingDto)), quotes: (await Quotation.find(ownFilter(user)).sort({ version: 1 })).map(quoteDto), conversations: [] };
}
export async function completeBookingDto(booking) { return { ...bookingDto(booking), photos: await photoDtos(booking.photos) }; }
export function cleaningRoutes(auth, dependencies = {}) {
  const router = Router();
  router.use(['/bookings', '/customer', '/admin', '/quotations'], auth.requireUser);
  router.post('/bookings', async (request, response) => {
    assert(request.user.role === 'CUSTOMER', 403, 'CUSTOMER_REQUIRED', 'A customer account is required.');
    const values = bookingSchema.parse(request.body);
    const requestId = values.requestId || randomUUID();
    let booking;
    await transaction(async session => {
      booking = await Booking.findOne({ customerId: request.user._id, requestId }).session(session);
      if (booking) return;
      const contactPhone = values.contactPhone || request.user.phone;
      assert(typeof contactPhone === 'string' && /^[+\d ()-]{7,25}$/.test(contactPhone), 422, 'CONTACT_REQUIRED', 'Provide a valid contact phone number with your booking.');
      const service = await Service.findOne({ slug: values.service }).session(session);
      assert(service ? service.enabled : serviceDefaults.some(item => item.slug === values.service), 422, 'SERVICE_UNAVAILABLE', 'Choose an available cleaning service.');
      const photos = await attachmentIds(values.photos.map(item => item.attachmentId), request.user, 'booking-photo', session);
      assert(photos, 503, 'UPLOAD_UNAVAILABLE', 'Secure uploads are not configured.');
      [booking] = await Booking.create([{ ...values, contactPhone, photos, requestId, customerId: request.user._id, reference: `BKG-${randomUUID()}`, status: 'Submitted', history: [{ title: 'Cleaning request submitted', status: 'Submitted' }] }], { session });
      if (photos.length) await Upload.updateMany({ _id: { $in: photos } }, { $set: { attachedTo: booking._id, bookingId: booking._id } }, { session });
      await audit(request.user, 'booking.created', booking, session);
    });
    response.status(201).json(await completeBookingDto(booking));
  });
  router.get('/bookings/:id', async (request, response) => response.json(await completeBookingDto(await owned(Booking, request.params.id, request.user))));
  for (const path of ['/customer/quotations/workspace', '/admin/quotations/workspace']) router.get(path, ...(path.startsWith('/admin') ? [auth.requireAdmin] : []), async (request, response) => response.json(await quotationWorkspace(request.user)));
  for (const path of ['/customer/overview', '/customer/notifications']) router.get(path, async (request, response) => {
    const workspace = await quotationWorkspace(request.user);
    const commerce = await dependencies.commerce?.(request.user) || { payments: [], orders: [] };
    const data = { bookings: workspace.bookings, quotations: workspace.quotes, messages: [], ...commerce };
    const notifications = customerNotifications(data);
    response.json(path.endsWith('/notifications') ? { notifications } : { ...data, notifications });
  });
  router.post('/admin/quotations', auth.requireAdmin, async (request, response) => {
    const values = quoteSchema.parse(request.body);
    let quote;
    await transaction(async session => {
      const booking = await owned(Booking, values.bookingId, request.user, session);
      assert(!booking.acceptedQuoteId && !['Cancelled', 'Completed', 'Scheduled', 'In Progress'].includes(booking.status));
      assert(booking.currentVersion === values.expectedVersion);
      const items = values.items.map(item => { const quantityHundredths = minor(item.quantity); const unitMinor = minor(item.unitPrice); return { description: item.description, quantityHundredths, unitMinor, totalMinor: Math.round(quantityHundredths * unitMinor / 100) }; });
      const totalMinor = items.reduce((total, item) => total + item.totalMinor, 0);
      assert(Number.isSafeInteger(totalMinor) && totalMinor > 0 && totalMinor <= 1000000000000, 422, 'INVALID_TOTAL', 'The quotation must have a valid positive total.');
      await Quotation.updateMany({ bookingId: booking._id, status: 'Sent' }, { $set: { status: 'Superseded' } }, { session });
      [quote] = await Quotation.create([{ bookingId: booking._id, customerId: booking.customerId, version: booking.currentVersion + 1, status: 'Sent', items, totalMinor, notes: values.notes, issuedAt: new Date(), expiresAt: new Date(values.expiresAt) }], { session });
      booking.currentVersion++; booking.revision++; booking.status = 'Quoted'; booking.history.push({ title: `Official quotation version ${quote.version} issued`, status: 'Quoted' }); await booking.save({ session });
      await audit(request.user, 'quotation.issued', quote, session);
    });
    response.status(201).json(quoteDto(quote));
  });
  router.post('/quotations/:id/response', async (request, response) => {
    assert(request.user.role === 'CUSTOMER', 403, 'CUSTOMER_REQUIRED', 'Only the owning customer may respond.');
    const values = z.object({ action: z.enum(['accept', 'decline']), expectedVersion: revision }).strict().parse(request.body);
    let quote;
    await transaction(async session => {
      quote = await owned(Quotation, identifier(request.params.id), request.user, session);
      const booking = await owned(Booking, String(quote.bookingId), request.user, session);
      assert(quote.status === 'Sent' && quote.expiresAt > new Date() && quote.version === values.expectedVersion && booking.currentVersion === quote.version && !booking.acceptedQuoteId && !['Cancelled', 'Completed'].includes(booking.status));
      quote.status = values.action === 'accept' ? 'Accepted' : 'Declined';
      if (values.action === 'accept') { quote.acceptedAt = new Date(); booking.acceptedQuoteId = quote._id; booking.depositBasisPoints = minor((await settings(session)).values.depositPercentage); booking.status = 'Accepted'; }
      else booking.status = 'Under Review';
      booking.revision++; booking.history.push({ title: `Quotation version ${quote.version} ${quote.status.toLowerCase()}`, status: booking.status });
      await quote.save({ session }); await booking.save({ session }); await audit(request.user, `quotation.${quote.status.toLowerCase()}`, quote, session);
    });
    response.json(quoteDto(quote));
  });
  return router;
}
