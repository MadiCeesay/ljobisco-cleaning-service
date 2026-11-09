import { z } from 'zod';
import { assert } from './errors.js';
import { Audit, Settings } from './models.js';
export const idSchema = z.string().regex(/^[a-f0-9]{24}$/);
export const identifier = value => idSchema.parse(value);
export const revision = z.number().int().min(0);
export const text = (minimum = 0, maximum = 2000) => z.string().trim().min(minimum).max(maximum);
export const decimal = z.string().regex(/^\d+(?:\.\d{1,2})?$/).refine(value => Number(value) <= 10000000);
export function minor(value) {
  const parsed = decimal.parse(String(value));
  const [whole, fractional = ''] = parsed.split('.');
  const result = Number(whole) * 100 + Number(fractional.padEnd(2, '0'));
  assert(Number.isSafeInteger(result), 422, 'INVALID_AMOUNT', 'Invalid amount.'); return result;
}
export function depositMinor(total, basisPoints) { return Math.max(1, Number((BigInt(total) * BigInt(basisPoints) + 5000n) / 10000n)); }
export const defaultSettings = Object.freeze({ companyName: 'Ijobisco Cleaning Services', tagline: 'Sparkles Starts Here.', email: '', phone: '', whatsappNumber: '', address: '', serviceAreas: '', depositPercentage: '30', deliveryEnabled: false, deliveryAreas: '', deliveryFee: '', pickupEnabled: false, pickupLocation: '', pickupInstructions: '' });
export async function settings(session) { const record = await Settings.findOne({ key: 'business' }).session(session || null); return { values: { ...defaultSettings, ...record?.values }, revision: record?.revision || 0 }; }
export async function audit(actor, action, resource, session) { await Audit.create([{ actorId: actor._id, action, resourceId: String(resource._id), revision: resource.revision || resource.version || 0 }], { session }); }
export function ownFilter(user) { return user.role === 'ADMIN' ? {} : { customerId: user._id }; }
export async function owned(Model, id, user, session) { const result = await Model.findOne({ _id: identifier(id), ...ownFilter(user) }).session(session || null); assert(result, 404, 'NOT_FOUND', 'Resource not found.'); return result; }
export const basic = entry => { const object = entry.toObject ? entry.toObject() : entry; const { _id, __v: _version, ...data } = object; return { ...data, id: String(_id) }; };
export const bookingDto = booking => {
  const { paidMinor: _paid, reservedMinor: _reserved, acceptedQuoteId: _accepted, depositBasisPoints: _deposit, currentVersion: _current, requestId: _request, ...data } = basic(booking);
  return { ...data, customerId: String(booking.customerId), photos: [] };
};
export const quoteDto = quote => ({ id: String(quote._id), bookingId: String(quote.bookingId), customerId: String(quote.customerId), version: quote.version, status: quote.status === 'Sent' && quote.expiresAt <= new Date() ? 'Expired' : quote.status, currency: 'GMD', items: quote.items.map(item => ({ description: item.description, quantity: item.quantityHundredths / 100, unitPrice: item.unitMinor / 100, total: item.totalMinor / 100 })), total: quote.totalMinor / 100, notes: quote.notes, issuedAt: quote.issuedAt, expiresAt: quote.expiresAt, acceptedAt: quote.acceptedAt });
