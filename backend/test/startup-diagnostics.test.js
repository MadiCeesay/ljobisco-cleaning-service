import test from 'node:test';
import assert from 'node:assert/strict';
import { startupDiagnostic } from '../src/startup-diagnostics.js';

test('startup diagnostics classify failures without disclosing driver details', () => {
  const secret = 'mongodb://private-user:private-password@private-host/database';
  const cases = [
    ['environment', new Error(secret), 'invalid-environment-settings'],
    ['database', new Error(`bad auth ${secret}`), 'database-authentication-failed'],
    ['database', new Error(`querySrv ENOTFOUND ${secret}`), 'database-dns-failed'],
    ['database', new Error(`ECONNREFUSED ${secret}`), 'database-unreachable'],
    ['database', new Error('A MongoDB replica set or sharded cluster is required for transactions.'), 'database-replica-set-required'],
    ['models', new Error(secret), 'database-model-initialization-failed'],
  ];
  const tls = { reason: { servers: new Map([['private-host', { error: { cause: new Error(`ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR ${secret}`) } }]]) } };
  cases.push(['database', tls, 'database-tls-failed']);
  for (const [stage, error, reason] of cases) {
    const result = startupDiagnostic(stage, error);
    assert.equal(result.reason, reason);
    assert.equal(result.stage, stage);
    assert.doesNotMatch(JSON.stringify(result), /private-user|private-password|private-host/);
  }
});
