import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiConfiguration } from './config.js';
import { createApiClient } from './httpClient.js';
import { endpoints } from './endpoints.js';
import { sessionUser, profileUser } from '../features/customer/session.js';
import { consumeSubmittedCart } from '../store/cartCheckout.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
test('email delivery failures show an actionable verification warning without leaking server details', async () => {
  const client = createApiClient({ base: '/api', fetcher: async () => json({ error: { code: 'EMAIL_DELIVERY_FAILED', message: 'Private SMTP credentials' } }, 503) });
  await assert.rejects(client.request('/auth/session'), error => error.status === 503 && /still needs verification/.test(error.message) && !error.message.includes('credentials'));
});
test('API configuration accepts explicit HTTPS/same-origin bases and rejects unsafe production destinations', () => {
  assert.equal(resolveApiConfiguration('').base, '');
  assert.equal(resolveApiConfiguration(' /api/ ', true).base, '/api');
  assert.equal(resolveApiConfiguration('https://api.example.test/v1/', true).base, 'https://api.example.test/v1');
  assert.equal(resolveApiConfiguration('http://127.0.0.1:3000/api', true).error, '');
  for (const value of ['javascript:alert(1)', '//evil.example/api', 'http://api.example.test', 'https://user:password@example.test', 'https://example.test?token=secret', '/api/../private', '/api/%2e%2e/private', '/api\\private']) assert.notEqual(resolveApiConfiguration(value, true).error, '');
});
test('unconfigured and invalid API calls fail before network access', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return json({}); };
  await assert.rejects(createApiClient({ fetcher }).request('/bookings'), /not connected/);
  await assert.rejects(createApiClient({ base: '/api', configurationError: 'Bad configuration', fetcher }).request('/bookings'), /Bad configuration/);
  for (const path of ['https://evil.example', '//evil.example', '/../private', '/bad\\path']) await assert.rejects(createApiClient({ base: '/api', fetcher }).request(path), /Invalid API/);
  assert.equal(calls, 0);
});
test('cookie/CSRF transport deduplicates token requests and does not expose bearer credentials', async () => {
  const calls = [];
  const client = createApiClient({ base: '/api', fetcher: async (url, options) => { calls.push({ url, options }); return json(url.endsWith('/csrf') ? { csrfToken: 'test-csrf' } : { id: 'confirmed' }); } });
  await Promise.all([client.request('/bookings', { method: 'POST', body: { service: 'home-cleaning' } }), client.request('/orders', { method: 'POST', body: { items: [] } })]);
  assert.equal(calls.filter(call => call.url.endsWith('/csrf')).length, 1);
  for (const { options } of calls.filter(call => call.options.method === 'POST')) {
    assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    assert.equal(options.headers['X-CSRF-Token'], 'test-csrf'); assert.equal('Authorization' in options.headers, false);
  }
});
test('unsafe or unconfirmed service responses never become successful mutations', async () => {
  const html = createApiClient({ base: '/api', fetcher: async () => new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } }) });
  await assert.rejects(html.request('/customer/overview'), /unexpected response/);
  const invalid = createApiClient({ base: '/api', fetcher: async () => new Response('{bad', { headers: { 'Content-Type': 'application/json' } }) });
  await assert.rejects(invalid.request('/customer/overview'), /invalid JSON/);
  const missing = createApiClient({ base: '/api', fetcher: async () => json({}) });
  await assert.rejects(missing.request('/bookings', { method: 'POST', body: {} }), /security token/);
  for (const status of [403, 409, 422, 429, 500]) {
    const client = createApiClient({ base: '/api', fetcher: async () => json({ secret: 'must-not-display' }, status) });
    await assert.rejects(client.request('/private'), error => error.status === status && !error.message.includes('must-not-display'));
  }
});
test('session changes cancel pending CSRF writes and protected 401 responses invalidate a live session', async () => {
  let release; let writes = 0;
  const client = createApiClient({ base: '/api', fetcher: async (url, options) => { if (options.method === 'POST') writes++; return url.endsWith('/csrf') ? new Promise(resolve => { release = resolve; }) : json({}); } });
  const pending = client.request('/bookings', { method: 'POST', body: {} });
  client.clear(); release(json({ csrfToken: 'old-csrf' }));
  await assert.rejects(pending, /session changed/i); assert.equal(writes, 0);
  let expired = 0;
  const unauthorized = createApiClient({ base: '/api', onUnauthorized: () => expired++, fetcher: async () => json({}, 401) });
  await assert.rejects(unauthorized.request('/customer/overview'), error => error.status === 401);
  assert.equal(expired, 1);
});
test('network requests time out with an explicit uncertain-outcome message and no automatic replay', async () => {
  let calls = 0;
  const client = createApiClient({ base: '/api', timeout: 15, fetcher: async (url, options) => { calls++; return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))); } });
  await assert.rejects(client.request('/customer/overview'), /timed out/);
  assert.equal(calls, 1);
});
test('session/profile responses strip secrets and cannot silently change identity or role', () => {
  const user = { id: 'test-customer', role: 'CUSTOMER', name: 'Test Customer', email: 'test@example.test', password: 'not-a-real-password', token: 'must-not-store' };
  const parsed = sessionUser(user, 'CUSTOMER');
  assert.equal('token' in parsed, false); assert.equal('password' in parsed, false);
  assert.throws(() => sessionUser({ ...user, role: 'SUPERADMIN' }));
  assert.throws(() => profileUser({ ...user, role: 'ADMIN' }, parsed));
  assert.throws(() => profileUser({ ...user, id: 'another-customer' }, parsed));
  assert.equal(profileUser({ ...user, name: 'Updated Name' }, parsed).name, 'Updated Name');
});
test('checkout clears only submitted quantities and preserves unrelated or newly added cart items', () => {
  const items = [{ product: { id: 'first' }, quantity: 5 }, { product: { id: 'second' }, quantity: 1 }];
  const remaining = consumeSubmittedCart(items, [{ id: 'first', quantity: 2 }]);
  assert.equal(remaining[0].quantity, 3); assert.equal(remaining[1].quantity, 1);
  assert.equal(consumeSubmittedCart(items, [{ id: 'first', quantity: 5 }]).length, 1);
});
test('endpoint contracts encode identifiers rather than interpolating untrusted paths', () => {
  assert.equal(endpoints.bookings.detail('booking/id'), '/bookings/booking%2Fid');
  assert.equal(endpoints.admin.catalog('products', 'product/id'), '/admin/products/product%2Fid');
});
