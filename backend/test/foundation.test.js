import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
export const environment = { NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/ijobisco', FRONTEND_ORIGINS: 'http://127.0.0.1:5173', PUBLIC_APP_URL: 'http://127.0.0.1:5173' };
test('environment rejects unsafe production mocks and origin configuration without exposing values', () => {
  assert.throws(() => loadConfig({ ...environment, NODE_ENV: 'production', MOCK_PAYMENTS_ENABLED: 'true' }));
  assert.throws(() => loadConfig({ ...environment, FRONTEND_ORIGINS: '*' }));
  assert.throws(() => loadConfig({}), /Invalid environment fields/);
});

test('Render can start before Vercel without guessing or broadly allowing frontend origins', () => {
  const pending = { NODE_ENV: 'production', FRONTEND_PENDING: 'true', RENDER: 'true', RENDER_EXTERNAL_URL: 'https://isolated-api.onrender.com', PORT: '10000', MONGODB_URI: environment.MONGODB_URI, TRUST_PROXY_HOPS: '1' };
  const config = loadConfig(pending);
  assert.equal(config.HOST, '0.0.0.0');
  assert.equal(config.PORT, 10000);
  assert.equal(config.TRUST_PROXY_HOPS, 1);
  assert.equal(config.frontendPending, true);
  assert.deepEqual(config.origins, ['https://isolated-api.onrender.com']);
  assert.equal(config.PUBLIC_APP_URL, 'https://isolated-api.onrender.com');
  assert.throws(() => loadConfig({ ...pending, RENDER: 'false' }));
  assert.throws(() => loadConfig({ ...pending, RENDER_EXTERNAL_URL: 'http://localhost:4000' }));
  assert.throws(() => loadConfig({ ...pending, FRONTEND_ORIGINS: environment.FRONTEND_ORIGINS }));
  assert.throws(() => loadConfig({ ...pending, PUBLIC_APP_URL: environment.PUBLIC_APP_URL }));
  const connected = loadConfig({ ...pending, FRONTEND_PENDING: 'false', PUBLIC_APP_URL: 'https://isolated-frontend.vercel.app', FRONTEND_ORIGINS: 'https://isolated-frontend.vercel.app' });
  assert.equal(connected.frontendPending, false);
  assert.deepEqual(connected.origins, ['https://isolated-frontend.vercel.app']);
});

test('configured Render proxy trust is bounded and does not trust all supplied forwarding hops', async () => {
  assert.throws(() => loadConfig({ ...environment, TRUST_PROXY_HOPS: 'true' }));
  assert.throws(() => loadConfig({ ...environment, TRUST_PROXY_HOPS: '100' }));
  const app = createApp(loadConfig({ ...environment, TRUST_PROXY_HOPS: '1' }), { logger: () => {} });
  assert.equal(app.get('trust proxy'), 1);
  await request(app).get('/health').set('X-Forwarded-For', '192.0.2.10').expect(200);
});
test('health, readiness, CORS, headers, JSON validation and safe errors', async () => {
  const entries = [];
  const app = createApp(loadConfig(environment), { ready: () => false, logger: value => entries.push(value) });
  const health = await request(app).get('/health').set('Origin', environment.PUBLIC_APP_URL).expect(200);
  assert.equal(health.headers['access-control-allow-credentials'], 'true');
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['x-powered-by'], undefined);
  await request(app).get('/ready').expect(503);
  const untrusted = await request(app).get('/health').set('Origin', 'https://untrusted.invalid');
  assert.equal(untrusted.headers['access-control-allow-origin'], undefined);
  await request(app).post('/api/missing').set('Content-Type', 'application/json').send('{invalid').expect(400);
  await request(app).get('/not-found?token=sensitive').expect(404);
  assert(!JSON.stringify(entries).includes('sensitive'));
});
