import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { User } from '../src/models.js';
import { csrf, post } from './helpers.js';
import { provisionAdministrator } from '../src/provisioning.js';
export async function login(context, role = 'CUSTOMER', suffix = randomUUID()) {
  const user = role === 'ADMIN' ? await provisionAdministrator({ name: 'Integration Administrator', email: `${suffix}@example.test`, password: 'Test password phrase 2026' }) : await User.create({ name: 'Integration Account', email: `${suffix}@example.test`, phone: '+2201234567', passwordHash: await bcrypt.hash('Test password phrase 2026', 4), role: 'CUSTOMER', verified: true });
  const agent = context.agent(); const token = await csrf(agent);
  const response = await post(agent, '/auth/login', token, { email: user.email, password: 'Test password phrase 2026' }).expect(200);
  return { agent, token, user, cookie: response.headers['set-cookie'].map(value => value.split(';')[0]).join('; ') };
}
export const bookingValues = () => ({ service: 'home-cleaning', propertyType: 'House', size: '', rooms: '2', requirements: '', address: 'Test property address', town: 'Test Area', directions: '', date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), time: 'Flexible', description: 'Cleaning requirements for an integration test.', photos: [], requestId: randomUUID() });
export const quoteValues = (bookingId, expectedVersion = 0) => ({ bookingId, expectedVersion, items: [{ description: 'Test cleaning scope', quantity: '1', unitPrice: '5000' }], notes: '', expiresAt: new Date(Date.now() + 86400000).toISOString() });
