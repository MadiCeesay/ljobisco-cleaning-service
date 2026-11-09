import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { canRespond, canSelectPayment, displayStatus, latestQuote, previewAmounts, quotationEditorSchema } from './rules.js';
import { resetQuotations, workspace, respond, issue } from './demoAdapter.js';

const customer = { id: 'demo-customer', role: 'CUSTOMER' };
const admin = { id: 'demo-admin', role: 'ADMIN' };
const bookings = [{ id: 'demo-review', status: 'Under Review' }, { id: 'new-booking', status: 'Submitted' }];
beforeEach(() => resetQuotations());

test('only the latest unexpired issued customer-owned quotation can receive a response', () => {
  const now = Date.now();
  const first = { id: 'first', bookingId: 'booking', customerId: customer.id, version: 1, status: 'Sent', issuedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 1000).toISOString() };
  const revised = { ...first, id: 'second', version: 2 };
  assert.equal(latestQuote([first, revised], 'booking').id, 'second');
  assert.equal(canRespond(first, [first, revised], customer, now), false);
  assert.equal(canRespond(revised, [first, revised], customer, now), true);
  assert.equal(canRespond(revised, [first, revised], admin, now), false);
  assert.equal(canRespond(revised, [first, revised], { ...customer, id: 'another-customer' }, now), false);
  assert.equal(canRespond(revised, [first, revised], customer, now + 2000), false);
  assert.equal(displayStatus(revised, now + 2000), 'Expired');
  for (const status of ['Accepted', 'Declined', 'Expired', 'Superseded', 'Draft']) assert.equal(canRespond({ ...revised, status }, [first, { ...revised, status }], customer, now), false);
  assert.equal(canSelectPayment(revised, [revised], customer), false);
  const accepted = { ...revised, status: 'Accepted', acceptedAt: new Date(now).toISOString() };
  assert.equal(canSelectPayment(accepted, [accepted], customer), true);
  assert.equal(canSelectPayment(accepted, [accepted, { ...revised, id: 'third', version: 3 }], customer), false);
});

test('decimal preview uses rounded line amounts and validates editor input', () => {
  assert.deepEqual(previewAmounts([{ quantity: '1.5', unitPrice: '10.10' }, { quantity: '2', unitPrice: '0.10' }]), { lines: [15.15, .2], total: 15.35 });
  const values = { bookingId: 'new-booking', items: [{ description: 'Sample cleaning', quantity: '2', unitPrice: '12.50' }], notes: '', expiresAt: new Date(Date.now() + 86400000).toISOString() };
  assert.equal(quotationEditorSchema.safeParse(values).success, true);
  assert.equal(quotationEditorSchema.safeParse({ ...values, expiresAt: '2000-01-01' }).success, false);
  assert.equal(quotationEditorSchema.safeParse({ ...values, items: [] }).success, false);
  assert.equal(quotationEditorSchema.safeParse({ ...values, items: [{ ...values.items[0], unitPrice: '-1' }] }).success, false);
});

test('demo service rejects stale versions, and freezes accepted offers', async () => {
  const initial = await workspace(customer, bookings);
  assert.equal(initial.quotes.length, 3);
  await assert.rejects(respond('demo-quote-v1', 'accept', 1, customer));
  await assert.rejects(respond('demo-quote-expired', 'accept', 1, customer));
  assert.equal((await workspace(customer, bookings)).quotes.find(quote => quote.id === 'demo-quote-v2').status, 'Sent');
  const values = { bookingId: 'demo-review', items: [{ description: 'Revised demo scope', quantity: '2', unitPrice: '900' }], notes: 'Demo revision', expiresAt: new Date(Date.now() + 86400000).toISOString() };
  await assert.rejects(issue(values, 2, customer, bookings));
  await assert.rejects(issue(values, 1, admin, bookings));
  const revision = await issue(values, 2, admin, bookings);
  assert.equal(revision.version, 3);
  assert.equal(revision.total, 1800);
  await assert.rejects(respond('demo-quote-v2', 'accept', 2, customer));
  const accepted = await respond(revision.id, 'accept', 3, customer);
  assert.equal(accepted.status, 'Accepted');
  assert.equal(canSelectPayment(accepted, (await workspace(customer, bookings)).quotes, customer), true);
  await assert.rejects(respond(revision.id, 'accept', 3, customer));
  await assert.rejects(issue(values, 3, admin, bookings));
});

test('decline does not unlock payment', async () => {
  const declined = await respond('demo-quote-v2', 'decline', 2, customer);
  assert.equal(declined.status, 'Declined');
  assert.equal(canSelectPayment(declined, [declined], customer), false);
});
