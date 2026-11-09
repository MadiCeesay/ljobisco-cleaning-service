import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setup, csrf, post } from './helpers.js';
import { login } from './actors.js';
import { User, Payment } from '../src/models.js';

test('unconfigured email, image storage and live providers fail closed without creating accounts or payments', async () => {
  const context = await setup({ email: { available: false } });
  try {
    const guest = context.agent(); const token = await csrf(guest);
    const response = await post(guest, '/auth/register', token, { name: 'Configuration Test', email: 'unavailable@example.test', phone: '+2201234567', password: 'Test123!' }).expect(503);
    assert.equal(response.body.error.code, 'EMAIL_UNAVAILABLE'); assert.equal(await User.countDocuments(), 0);
    await post(guest, '/auth/forgot-password', token, { email: 'unavailable@example.test' }).expect(503);
    const customer = await login(context);
    assert.equal((await post(customer.agent, '/uploads', customer.token, {}).expect(503)).body.error.code, 'UPLOAD_UNAVAILABLE');
    const unavailable = await post(customer.agent, '/payments/cleaning/intents', customer.token, { provider: 'wave', requestId: randomUUID(), quotationId: '000000000000000000000001', expectedVersion: 1, choice: 'deposit' }).expect(503);
    assert.equal(unavailable.body.error.code, 'PROVIDER_UNAVAILABLE'); assert.equal(await Payment.countDocuments(), 0);
  } finally { await context.close(); }
});
