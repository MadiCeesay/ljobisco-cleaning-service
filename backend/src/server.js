import http from 'node:http';
import mongoose from 'mongoose';
import { loadConfig } from './config.js';
import { connectDatabase } from './database.js';
import { createApp } from './app.js';
import { createRoutes } from './routes.js';
import { initializeModels } from './models.js';
import { expireReservations } from './commerce.js';

async function start() {
const config = loadConfig();
await connectDatabase(config.MONGODB_URI);
await initializeModels();
const { router } = createRoutes(config);
const server = http.createServer(createApp(config, { routes: router }));
const reservationSweep = setInterval(() => expireReservations().catch(() => console.error(JSON.stringify({ event: 'reservation-sweep-failed' }))), 60000); reservationSweep.unref();
server.listen(config.PORT, config.HOST, () => console.log(JSON.stringify({ event: 'listening', port: config.PORT })));
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(reservationSweep);
  const timeout = setTimeout(() => process.exit(1), 10000); timeout.unref();
  server.close(async () => { await mongoose.disconnect(); clearTimeout(timeout); process.exit(0); });
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
start().catch(() => { console.error(JSON.stringify({ event: 'startup-failed', message: 'Check validated environment settings, database connectivity and replica-set configuration. Sensitive diagnostic details are not logged.' })); process.exitCode = 1; });
