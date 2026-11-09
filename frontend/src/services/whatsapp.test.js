import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_WHATSAPP, internationalPhone, whatsappLink, customerContactAllowed } from './whatsapp.js';

test('approved Ijobisco contact opens WhatsApp with a safe cleaning enquiry', () => {
  const url = new URL(whatsappLink(BUSINESS_WHATSAPP, { bookingReference: 'BKG-TEST-123' }));
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/2205393273');
  assert.match(url.searchParams.get('text'), /BKG-TEST-123/);
});

test('international phone format is required without guessing a country code', () => {
  assert.equal(internationalPhone('+44 (7700) 900-123'), '+447700900123');
  for (const number of ['', '07700900123', '00447700900123', '+012345678', '+123', '+1234567890123456', '+44abc7700900123', 'https://example.test']) assert.equal(internationalPhone(number), '');
});

test('WhatsApp links use the official host, encoded fixed wording and only a safe booking reference/version', () => {
  const booking = { reference: 'BKG-test-reference', address: 'PRIVATE ADDRESS', photos: ['PRIVATE PHOTO'], token: 'SECRET', email: 'private@example.test' };
  const url = new URL(whatsappLink('+447700900123', { bookingReference: booking.reference, quotationVersion: 2, ...booking }));
  assert.equal(url.origin, 'https://wa.me');
  assert.equal(url.pathname, '/447700900123');
  assert.equal(url.searchParams.size, 1);
  assert.match(url.searchParams.get('text'), /BKG-test-reference, quotation version 2/);
  for (const privateValue of [booking.address, booking.photos[0], booking.token, booking.email]) assert(!url.href.includes(encodeURIComponent(privateValue)));
  assert.match(url.searchParams.get('text'), /acceptance and payments remain in the Ijobisco account/);
  assert.equal(whatsappLink('', {}), '');
  assert.equal(whatsappLink('+447700900123', { bookingReference: 'private address?token=secret' }), '');
  assert.equal(whatsappLink('+447700900123', { quotationVersion: -1 }), '');
});

test('administrator contact is restricted to an active customer and an open owned booking', () => {
  const customer = { id: 'customer', status: 'Active', phone: '+447700900123' };
  const booking = { customerId: customer.id, status: 'Quoted' };
  assert.equal(customerContactAllowed(customer, booking), true);
  for (const status of ['Completed', 'Cancelled', 'Unknown', undefined]) assert.equal(customerContactAllowed(customer, { ...booking, status }), false);
  assert.equal(customerContactAllowed({ ...customer, status: 'Disabled' }, booking), false);
  assert.equal(customerContactAllowed({ ...customer, phone: '07700900123' }, booking), false);
  assert.equal(customerContactAllowed(customer, { ...booking, customerId: 'other' }), false);
  assert.equal(customerContactAllowed({ ...customer, phone: '' }, { ...booking, contactPhone: '+447700900123' }), true);
});
