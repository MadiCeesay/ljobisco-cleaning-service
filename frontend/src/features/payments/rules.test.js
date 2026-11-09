import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentPreview, payableAmount, depositSetting, checkoutSchema, paymentStates } from './rules.js';
import { resetPayments, payCleaning, createOrder, getAccount } from './demoAdapter.js';
import { resetQuotations, respond } from '../quotations/demoAdapter.js';

test('deposit setting defaults safely and supports configured percentages', () => {
  for (const value of [undefined, '', 'invalid', 0, -5, 101]) assert.equal(depositSetting(value), 30);
  assert.equal(depositSetting('25'), 25);
});
test('deposit and full payment previews use minor units and outstanding amounts', () => {
  const summary = paymentPreview(5000);
  assert.equal(summary.deposit, 1500);
  assert.equal(summary.remaining, 3500);
  assert.equal(payableAmount(summary, 'deposit', false), 1500);
  assert.equal(payableAmount(summary, 'full', false), 5000);
  assert.equal(payableAmount(summary, 'balance', false), 0);
  assert.equal(payableAmount(summary, 'unknown', false), 0);
  assert.equal(paymentPreview(100.01).deposit, 30);
  assert.equal(paymentPreview(5000, 25).deposit, 1250);
  assert.throws(() => paymentPreview(NaN));
  assert.throws(() => paymentPreview(5000, 30, 5001));
});
test('balance stays locked before backend-confirmed completion', () => {
  const summary = paymentPreview(5000, 30, 1500);
  assert.equal(summary.outstanding, 3500);
  assert.equal(payableAmount(summary, 'balance', false), 0);
  assert.equal(payableAmount(summary, 'balance', true), 3500);
  assert.equal(payableAmount(paymentPreview(5000, 30, 5000), 'balance', true), 0);
});
test('delivery requires an address and pickup does not invent a location', () => {
  const details = { name: 'Test Customer', email: 'test@example.test', phone: '+220 1234567', fulfilment: 'delivery', address: '', town: '' };
  const invalid = checkoutSchema.safeParse(details);
  assert.equal(invalid.success, false);
  assert.deepEqual(invalid.error.issues.map(issue => issue.path[0]), ['address', 'town']);
  assert.equal(checkoutSchema.safeParse({ ...details, address: 'Sample street', town: 'Sample town' }).success, true);
  assert.equal(checkoutSchema.safeParse({ ...details, fulfilment: 'pickup' }).success, true);
  assert.equal(checkoutSchema.safeParse({ ...details, fulfilment: 'pickup', email: 'invalid' }).success, false);
});
test('all requested payment states are available for consistent rendering', () => {
  assert.deepEqual(paymentStates, ['Pending', 'Processing', 'Partially Paid', 'Paid', 'Failed', 'Refunded']);
});

test('mock gateway validates acceptance, confirms outcomes, prevents duplicates and locks balance', async () => {
  resetPayments(); resetQuotations();
  const actor = { id: 'demo-customer', role: 'CUSTOMER' };
  const payload = { quotationId: 'demo-quote-v2', choice: 'deposit', outcome: 'paid', requestId: 'attempt-1' };
  await assert.rejects(payCleaning(payload, actor, 30), /Accept/);
  await respond('demo-quote-v2', 'accept', 2, actor);
  const failed = await payCleaning({ ...payload, outcome: 'failed', requestId: 'attempt-failed' }, actor, 30);
  assert.equal(failed.status, 'Failed');
  const paid = await payCleaning(payload, actor, 30);
  assert.equal(paid.amount, 690);
  assert.equal(paid.simulated, true);
  assert.deepEqual(await payCleaning(payload, actor, 30), paid);
  await assert.rejects(payCleaning({ ...payload, requestId: 'balance' }, actor, 30), /completion/);
  assert.equal((await getAccount(actor)).payments.length, 2);
  await assert.rejects(getAccount({ id: 'other', role: 'CUSTOMER' }), /Customer/);
  resetPayments(); resetQuotations();
});
test('mock full upfront payment is paid only after the adapter confirms it', async () => {
  resetPayments(); resetQuotations();
  const actor = { id: 'demo-customer', role: 'CUSTOMER' };
  await respond('demo-quote-v2', 'accept', 2, actor);
  const record = await payCleaning({ quotationId: 'demo-quote-v2', choice: 'full', outcome: 'paid', requestId: 'full' }, actor, 30);
  assert.equal(record.amount, 2300);
  assert.equal(record.status, 'Paid');
  const pending = createOrder({ details: { name: 'Sample Customer', email: 'test@example.test', phone: '1234567', fulfilment: 'pickup', address: '', town: '' }, items: [{ id: 'demo-spray', quantity: 1 }], outcome: 'paid', requestId: 'logout', acknowledge: true }, actor);
  resetPayments();
  await assert.rejects(pending, /session ended/);
  assert.equal((await getAccount(actor)).orders.length, 0);
  resetQuotations();
});
test('mock checkout resolves canonical fixture amounts and validates order references', async () => {
  resetPayments();
  const actor = { id: 'demo-customer', role: 'CUSTOMER' };
  const payload = { details: { name: 'Demo Customer', email: 'test@example.test', phone: '1234567', fulfilment: 'pickup', address: '', town: '' }, items: [{ id: 'demo-spray', quantity: 2, price: 1 }], outcome: 'paid', requestId: 'order-1', acknowledge: true };
  const order = await createOrder(payload, actor);
  assert.equal(order.total, 240);
  assert.equal(order.status, 'Pending Configuration');
  assert.equal(order.paymentStatus, 'Paid');
  assert.equal(order.timeline.length, 2);
  assert.equal('details' in order, false);
  assert.deepEqual(await createOrder(payload, actor), order);
  await assert.rejects(createOrder({ ...payload, requestId: 'invalid', items: [{ id: 'demo-brush', quantity: 1 }] }, actor), /unavailable/);
  await assert.rejects(createOrder({ ...payload, requestId: 'invalid-2', acknowledge: false }, actor), /Confirm/);
  const failed = await createOrder({ ...payload, requestId: 'failed', outcome: 'failed' }, actor);
  assert.equal(failed.paymentStatus, 'Failed');
  resetPayments();
});
