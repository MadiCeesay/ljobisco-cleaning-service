import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import axios from 'axios';
import { createAxiosTransport } from './axiosTransport.js';
import { createApiClient } from './httpClient.js';

test('Axios forwards JSON, cancellation, CSRF headers and multipart without inventing credentials', async () => {
  const calls = [];
  const transport = createAxiosTransport(axios.create({ adapter: async config => { calls.push(config); return { status: 200, data: '{"confirmed":true}', headers: new axios.AxiosHeaders({ 'content-type': 'application/json' }), config }; }, transformResponse: [value => value] }));
  const signal = new AbortController().signal;
  const response = await transport('/api/bookings', { method: 'POST', body: '{"service":"home-cleaning"}', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'test-nonce' }, signal });
  assert.equal(response.ok, true); assert.deepEqual(await response.json(), { confirmed: true });
  assert.equal(calls[0].signal, signal); assert.equal(calls[0].headers.get('X-CSRF-Token'), 'test-nonce'); assert.equal(calls[0].headers.get('Authorization'), undefined);
  const form = new FormData(); form.append('purpose', 'booking-photo');
  await transport('/api/uploads', { method: 'POST', body: form, headers: {}, signal });
  assert.equal(calls[1].data, form);
});
test('real Axios fetch adapter preserves JSON validation, HTTP failures and redirect rejection', async () => {
  let successes = 0;
  const server = http.createServer((request, response) => {
    if (request.url === '/redirect') { response.writeHead(302, { location: '/success' }); response.end(); return; }
    if (request.url === '/html') { response.writeHead(200, { 'Content-Type': 'text/html' }); response.end('<html>not JSON</html>'); return; }
    const failed = request.url === '/unavailable';
    if (request.url === '/success') successes++;
    response.writeHead(failed ? 503 : 200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(failed ? { error: { code: 'EMAIL_UNAVAILABLE', message: 'must-not-display-server-details' } } : { connected: true }));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const client = createApiClient({ base: `http://127.0.0.1:${server.address().port}`, fetcher: createAxiosTransport() });
    assert.deepEqual(await client.request('/success'), { connected: true });
    await assert.rejects(client.request('/html'), /unexpected response/);
    await assert.rejects(client.request('/redirect'), error => [0, 302].includes(error.status));
    assert.equal(successes, 1);
    await assert.rejects(client.request('/unavailable'), error => error.status === 503 && error.code === 'EMAIL_UNAVAILABLE' && error.message.includes('SMTP') && !error.message.includes('must-not-display'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
