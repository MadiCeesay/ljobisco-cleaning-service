import mongoose from 'mongoose';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import supertest from 'supertest';
import { loadConfig } from '../src/config.js';
import { connectDatabase } from '../src/database.js';
import { initializeModels } from '../src/models.js';
import { createApp } from '../src/app.js';
import { createRoutes } from '../src/routes.js';
export const baseEnvironment = { NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/test', FRONTEND_ORIGINS: 'http://127.0.0.1:5173', PUBLIC_APP_URL: 'http://127.0.0.1:5173', MOCK_PAYMENTS_ENABLED: 'true', REQUIRE_EMAIL_VERIFICATION: 'true' };
export async function setup(dependencies = {}) {
  const systemBinary = process.env.MONGMS_SYSTEM_BINARY || (existsSync('.cache/mongod.exe') ? path.resolve('.cache/mongod.exe') : undefined);
  const replica = await MongoMemoryReplSet.create({ binary: systemBinary ? { systemBinary } : {}, replSet: { count: 1 }, instanceOpts: [{ storageEngine: 'wiredTiger', launchTimeout: 60000 }] });
  const config = loadConfig({ ...baseEnvironment, ...dependencies.environment, MONGODB_URI: replica.getUri() });
  await connectDatabase(config.MONGODB_URI); await initializeModels();
  const mail = [];
  const routes = createRoutes(config, { ...dependencies, email: dependencies.email || { available: true, async send(to, purpose, token) { mail.push({ to, purpose, token }); } } });
  const app = createApp(config, { routes: routes.router, logger: () => {} });
  return { config, app, ...routes, mail, agent: () => supertest.agent(app), async close() { await mongoose.disconnect(); await replica.stop(); } };
}
export async function csrf(agent) { const response = await agent.get('/api/auth/csrf').expect(200); return response.body.csrfToken; }
export function post(agent, path, token, body) { return agent.post(`/api${path}`).set('Origin', baseEnvironment.PUBLIC_APP_URL).set('X-CSRF-Token', token).send(body); }
