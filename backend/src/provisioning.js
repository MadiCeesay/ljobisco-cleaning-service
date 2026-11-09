import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from './models.js';
import { assert } from './errors.js';
export const ADMIN_MIN_PASSWORD_LENGTH = 12;

export async function provisionAdministrator(input) {
  const values = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(ADMIN_MIN_PASSWORD_LENGTH).refine(value => Buffer.byteLength(value) <= 72) }).strict().parse(input);
  assert(!await User.exists({ email: values.email }), 409, 'ACCOUNT_EXISTS', 'Account already exists. Administrator provisioning never promotes or overwrites existing accounts.');
  return User.create({ name: values.name, email: values.email, passwordHash: await bcrypt.hash(values.password, 12), role: 'ADMIN', verified: true });
}
