// Only fixed categories leave this module; driver messages can contain credentials.
export function startupDiagnostic(stage, error) {
  const errors = [error];
  for (const server of error?.reason?.servers?.values?.() || []) errors.push(server.error);
  for (let index = 0; index < errors.length && index < 20; index++) {
    if (errors[index]?.cause && !errors.includes(errors[index].cause)) errors.push(errors[index].cause);
  }
  const text = errors.map(item => `${item?.code || ''} ${item?.message || ''}`).join(' ');
  let reason = 'unclassified';
  if (stage === 'environment') reason = 'invalid-environment-settings';
  else if (/authentication failed|bad auth|AuthenticationFailed/i.test(text) || errors.some(item => item?.code === 18)) reason = 'database-authentication-failed';
  else if (/TLS|SSL|certificate/i.test(text)) reason = 'database-tls-failed';
  else if (/ENOTFOUND|EAI_AGAIN|querySrv|queryTxt/i.test(text)) reason = 'database-dns-failed';
  else if (/replica set or sharded cluster is required/i.test(text)) reason = 'database-replica-set-required';
  else if (/ECONNREFUSED|ETIMEDOUT|server selection|IP.*whitelist/i.test(text) || error?.name === 'MongooseServerSelectionError') reason = 'database-unreachable';
  else if (stage === 'models') reason = 'database-model-initialization-failed';
  return { event: 'startup-failed', stage, reason, message: 'Check Render environment settings and Atlas network access. Sensitive diagnostic details are not logged.' };
}
