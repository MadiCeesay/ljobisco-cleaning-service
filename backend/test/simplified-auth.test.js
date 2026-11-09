import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setup, csrf, post } from './helpers.js';
import { User, AccountToken } from '../src/models.js';
import { authentication } from '../src/auth.js';
import { HttpError } from '../src/errors.js';
import { bookingValues } from './actors.js';

const values = { name: 'Immediate Customer', email: 'immediate@example.test', password: 'Private customer phrase' };
test('registration without SMTP permits immediate customer login without marking email verified and preserves administrator verification', async () => {
  const context = await setup({ environment: { REQUIRE_EMAIL_VERIFICATION: 'false' }, email: { available: false, async send() { throw new Error('Email must not be called.'); } } });
  try {
    assert.deepEqual((await context.agent().get('/api/auth/configuration')).body, { requireEmailVerification: false });
    const agent = context.agent(); const token = await csrf(agent);
    await post(agent, '/auth/register', token, { ...values, role: 'ADMIN' }).expect(422);
    const registered = await post(agent, '/auth/register', token, { ...values, email: '  IMMEDIATE@example.test  ' }).expect(201);
    assert.equal(registered.body.verificationRequired, false);
    const user = await User.findOne({ email: values.email }).select('+passwordHash');
    assert.equal(user.verified, false); assert.equal(user.role, 'CUSTOMER');
    assert.notEqual(user.passwordHash, values.password); assert(await bcrypt.compare(values.password, user.passwordHash));
    assert.equal(await AccountToken.countDocuments(), 0);
    await post(agent, '/auth/register', token, values).expect(409);
    await post(agent, '/auth/login', token, { email: values.email, password: 'incorrect' }).expect(401);
    const response = await post(agent, '/auth/login', token, { email: values.email, password: values.password }).expect(200);
    assert.equal(response.body.user.emailVerified, false); assert(response.headers['set-cookie'][0].includes('HttpOnly'));
    const cookie = response.headers['set-cookie'][0].split(';')[0].split('=')[1];
    assert.equal(await authentication({ ...context.config, REQUIRE_EMAIL_VERIFICATION: true }).resolve(cookie), null);
    assert.equal((await agent.get('/api/auth/session')).body.user.id, String(user._id));
    await post(agent, '/bookings', token, bookingValues()).expect(422);
    const booking = (await post(agent, '/bookings', token, { ...bookingValues(), contactPhone: '+2201234567' }).expect(201)).body;
    assert.equal(booking.contactPhone, '+2201234567'); assert.equal(booking.status, 'Submitted');
    assert.equal(booking.customerId, String(user._id));
    const updates = (await agent.get('/api/customer/notifications').expect(200)).body.notifications;
    assert(updates.some(update => update.title.includes(booking.reference)));
    await User.create({ name: 'Unverified Administrator', email: 'unverified-admin@example.test', role: 'ADMIN', verified: false, passwordHash: user.passwordHash });
    await post(agent, '/auth/login', token, { email: 'unverified-admin@example.test', password: values.password }).expect(401);
    for (const email of [values.email, 'unknown@example.test']) assert.equal((await post(agent, '/auth/forgot-password', token, { email }).expect(503)).body.error.code, 'EMAIL_UNAVAILABLE');
    await post(agent, '/auth/logout', token).expect(204);
    await agent.get('/api/customer/overview').expect(401);
  } finally { await context.close(); }
});

test('configured but failing SMTP recovery remains neutral for known and unknown accounts', async () => {
  const context = await setup({ environment: { REQUIRE_EMAIL_VERIFICATION: 'false' }, email: { available: true, async send() { throw new HttpError(503, 'EMAIL_DELIVERY_FAILED', 'Private provider diagnostics'); } } });
  try {
    const agent = context.agent(); const token = await csrf(agent);
    await post(agent, '/auth/register', token, values).expect(201);
    const known = await post(agent, '/auth/forgot-password', token, { email: values.email }).expect(202);
    const unknown = await post(agent, '/auth/forgot-password', token, { email: 'unknown@example.test' }).expect(202);
    assert.deepEqual(known.body, unknown.body); assert(!JSON.stringify(known.body).includes('token'));
    assert.equal((await User.findOne({ email: values.email })).verified, false);
  } finally { await context.close(); }
});
