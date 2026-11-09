import test from 'node:test';
import assert from 'node:assert/strict';
import { authSchema, bookingSchema, localDate, safeDestination, photoError, MAX_PHOTO_BYTES, bookingStates } from './validation.js';

test('registration validates passwords and strips role injection', () => {
  const values = { name: 'Preview Customer', email: 'preview@example.test', phone: '0000000', password: 'sample-passphrase-123', confirmPassword: 'sample-passphrase-123', role: 'ADMIN' };
  const parsed = authSchema('register').parse(values);
  assert.equal('role' in parsed, false);
  assert.equal('phone' in parsed, false);
  assert.equal(authSchema('register').safeParse({ ...values, confirmPassword: 'mismatch' }).success, false);
  assert.equal(authSchema('register').safeParse({ ...values, password: 'short' }).success, false);
  assert.equal(authSchema('register').safeParse({ ...values, password: 'Test123!', confirmPassword: 'Test123!' }).success, true);
  assert.equal(authSchema('register').safeParse({ ...values, password: 'Test123', confirmPassword: 'Test123' }).success, false);
  assert.equal(authSchema('register').safeParse({ ...values, email: 'invalid' }).success, false);
});

test('login and recovery actions validate required credentials and tokens', () => {
  assert.equal(authSchema('login').safeParse({ email: 'preview@example.test', password: '' }).success, false);
  assert.equal(authSchema('forgot-password').safeParse({ email: 'invalid' }).success, false);
  assert.equal(authSchema('verify-email').safeParse({ token: '' }).success, false);
  assert.equal(authSchema('reset-password').safeParse({ token: '', password: 'sample-password-123', confirmPassword: 'sample-password-123' }).success, false);
  assert.equal(authSchema('reset-password').safeParse({ token: 'test-token', password: 'Next123!', confirmPassword: 'Next123!' }).success, true);
  assert.equal(authSchema('reset-password').safeParse({ token: 'test-token', password: 'Next123', confirmPassword: 'Next123' }).success, false);
});

test('authentication redirects remain within customer routes', () => {
  for (const value of ['https://example.com', '//example.com', '/\\example.com', '/login', '/dashboard/../../login', null]) assert.equal(safeDestination(value), '/dashboard');
  assert.equal(safeDestination('/bookings/new?service=home-cleaning'), '/bookings/new?service=home-cleaning');
  assert.equal(safeDestination('/dashboard/bookings/demo-review'), '/dashboard/bookings/demo-review');
});

const booking = { contactPhone: '+2201234567', service: 'home-cleaning', propertyType: 'House', size: '', rooms: '3', requirements: '', address: 'Sample property for preview', town: 'Demo area', directions: '', date: localDate(), time: 'Flexible', description: 'A sample cleaning request for testing.' };
test('booking data requires no price and strips submitted status or amounts', () => {
  const parsed = bookingSchema.parse({ ...booking, price: 100, status: 'Scheduled' });
  assert.equal('price' in parsed, false);
  assert.equal('status' in parsed, false);
  assert.equal(bookingSchema.safeParse({ ...booking, rooms: '0' }).success, false);
  assert.equal(bookingSchema.safeParse({ ...booking, date: '2000-01-01' }).success, false);
  assert.equal(bookingSchema.safeParse({ ...booking, date: '2027-02-31' }).success, false);
  assert.equal(bookingSchema.safeParse({ ...booking, service: '' }).success, false);
  assert.equal(bookingSchema.safeParse({ ...booking, size: '-1' }).success, false);
  assert.equal(bookingSchema.safeParse({ ...booking, contactPhone: '' }).success, false);
});

test('photo validation allows only bounded raster images', () => {
  assert.equal(photoError({ type: 'image/png', size: MAX_PHOTO_BYTES }), '');
  assert.ok(photoError({ type: 'image/png', size: MAX_PHOTO_BYTES + 1 }));
  assert.ok(photoError({ type: 'image/svg+xml', size: 100 }));
  assert.ok(photoError({ type: 'text/plain', size: 100 }));
  assert.ok(photoError({ type: 'image/jpeg', size: 0 }));
  assert.equal(bookingStates.length, 10);
});

test('simplified cleaning request permits unknown rooms and date without inventing values', () => {
  const parsed = bookingSchema.parse({ ...booking, propertyType: undefined, rooms: '', date: '', contactPhone: '5393273' });
  assert.equal(parsed.propertyType, '');
  assert.equal(parsed.rooms, '');
  assert.equal(parsed.date, '');
  assert.equal(parsed.contactPhone, '+2205393273');
  assert.equal(bookingSchema.safeParse({ ...booking, description: '' }).success, false);
});
