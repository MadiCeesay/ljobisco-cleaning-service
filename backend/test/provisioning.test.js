import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setup } from './helpers.js';
import { provisionAdministrator } from '../src/provisioning.js';
import { User } from '../src/models.js';

test('shared administrator bootstrap enforces password policy, private role assignment and no existing-account promotion', async () => {
  const context = await setup();
  try {
    await assert.rejects(provisionAdministrator({ name: 'Test Admin', email: 'bootstrap@example.test', password: 'short' }));
    await assert.rejects(provisionAdministrator({ name: 'Test Admin', email: 'bootstrap@example.test', password: '12345678901' }));
    const values = { name: 'Test Admin', email: 'bootstrap@example.test', password: 'Test-only12!' };
    const admin = await provisionAdministrator(values); assert.equal(admin.role, 'ADMIN'); assert.equal(admin.verified, true);
    assert.equal(await bcrypt.compare(values.password, (await User.findById(admin._id).select('+passwordHash')).passwordHash), true);
    await assert.rejects(provisionAdministrator(values), error => error.status === 409);
    const customer = await User.create({ name: 'Existing test customer', email: 'existing@example.test', passwordHash: 'test-only-non-loginable', role: 'CUSTOMER' });
    await assert.rejects(provisionAdministrator({ ...values, email: customer.email }), error => error.status === 409);
    assert.equal((await User.findById(customer._id)).role, 'CUSTOMER');
  } finally { await context.close(); }
});
