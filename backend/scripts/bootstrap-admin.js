import { createInterface } from 'node:readline/promises';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Writable } from 'node:stream';
import { loadConfig } from '../src/config.js';
import { connectDatabase } from '../src/database.js';
import { initializeModels } from '../src/models.js';
import { ADMIN_MIN_PASSWORD_LENGTH, provisionAdministrator } from '../src/provisioning.js';

const config = loadConfig();
if (!process.stdin.isTTY) throw new Error('Run administrator bootstrap interactively; credentials must not be command-line arguments.');
let hidden = false;
const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk, encoding); callback(); } });
const prompt = createInterface({ input: process.stdin, output, terminal: true });
try {
  const email = z.email().parse((await prompt.question('Administrator email: ')).trim().toLowerCase());
  const name = z.string().min(2).max(100).parse(await prompt.question('Administrator full name: '));
  process.stdout.write(`Temporary password (hidden, ${ADMIN_MIN_PASSWORD_LENGTH}+ characters): `); hidden = true;
  const password = await prompt.question(''); hidden = false; process.stdout.write('\n');
  z.string().min(ADMIN_MIN_PASSWORD_LENGTH).refine(value => Buffer.byteLength(value) <= 72).parse(password);
  if (await prompt.question('Type CREATE ADMIN to provision this verified administrator: ') !== 'CREATE ADMIN') throw new Error('Cancelled.');
  await connectDatabase(config.MONGODB_URI); await initializeModels();
  await provisionAdministrator({ name, email, password });
  console.log('Administrator provisioned. Use the password reset email workflow to rotate the temporary password.');
} finally { prompt.close(); await mongoose.disconnect(); }
