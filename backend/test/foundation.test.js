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
