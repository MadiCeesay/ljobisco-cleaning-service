import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, csrf, post, baseEnvironment } from './helpers.js';
test('real registration, verification, cookie rotation, CSRF, profile isolation, reset revocation and logout', async () => {
  const context = await setup();
  try {
    const agent = context.agent(); const token = await csrf(agent);
    const values = { name: 'Test Customer', email: 'customer@example.test', phone: '+2201234567', password: 'Test123!' };
    await agent.post('/api/auth/register').send(values).expect(403);
    await post(agent, '/auth/register', token, { ...values, role: 'ADMIN' }).expect(422);
    await post(agent, '/auth/register', token, { ...values, password: 'Test123' }).expect(422);
    await post(agent, '/auth/register', token, values).expect(202);
    await post(agent, '/auth/login', token, { email: values.email, password: values.password }).expect(401);
    const verification = context.mail.at(-1).token;
    await post(agent, '/auth/verify-email', token, { token: verification }).expect(200);
    await post(agent, '/auth/verify-email', token, { token: verification }).expect(422);
    const login = await post(agent, '/auth/login', token, { email: values.email, password: values.password }).expect(200);
    assert.equal(login.body.user.role, 'CUSTOMER'); assert(!JSON.stringify(login.body).includes('password'));
    assert(login.headers['set-cookie'][0].includes('HttpOnly'));
    const current = await agent.get('/api/auth/session').expect(200); assert.equal(current.body.user.id, login.body.user.id);
    await agent.patch('/api/customer/profile').set('Origin', baseEnvironment.PUBLIC_APP_URL).set('X-CSRF-Token', token).send({ name: 'Updated Name', email: values.email, phone: values.phone }).expect(200);
    await post(agent, '/auth/forgot-password', token, { email: values.email }).expect(202);
    await post(agent, '/auth/reset-password', token, { token: context.mail.at(-1).token, password: 'Next123' }).expect(422);
    await post(agent, '/auth/reset-password', token, { token: context.mail.at(-1).token, password: 'Next123!' }).expect(200);
    assert.equal((await agent.get('/api/auth/session')).body.user, null);
    const renewed = await csrf(agent);
    await post(agent, '/auth/login', renewed, { email: values.email, password: 'Next123!' }).expect(200);
    await post(agent, '/auth/logout', renewed).expect(204);
    assert.equal((await agent.get('/api/auth/session')).body.user, null);
  } finally { await context.close(); }
});
