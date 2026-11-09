import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { HttpError, errorHandler } from './errors.js';

export function createApp(config, { routes, logger = entry => console.log(JSON.stringify(entry)), ready = () => mongoose.connection.readyState === 1 } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    request.id = randomUUID(); response.set('X-Request-Id', request.id).set('Cache-Control', 'no-store');
    const started = Date.now();
    response.on('finish', () => logger({ time: new Date().toISOString(), requestId: request.id, method: request.method, status: response.statusCode, durationMs: Date.now() - started }));
    next();
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin(origin, callback) { callback(null, !origin || config.origins.includes(origin)); }, credentials: true, allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'], methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }));
  app.use(rateLimit({ windowMs: 60000, limit: config.NODE_ENV === 'test' ? 10000 : 300, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Please wait before trying again.' } } }));
  app.use(express.json({ limit: '128kb', strict: true }));
  app.use(cookieParser());
  app.get('/health', (_request, response) => response.json({ status: 'ok' }));
  app.get('/ready', async (_request, response) => {
    try { if (!ready()) throw new Error(); await mongoose.connection.db.command({ ping: 1 }); response.json({ status: 'ready' }); }
    catch { response.status(503).json({ status: 'not-ready' }); }
  });
  if (routes) app.use('/api', routes);
  app.use((_request, _response, next) => next(new HttpError(404, 'NOT_FOUND', 'Resource not found.')));
  app.use(errorHandler);
  return app;
}
