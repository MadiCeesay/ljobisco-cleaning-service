const http = require('node:http');
const path = require('node:path');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');

(async () => {
  const probe = http.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening'); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const preview = spawn(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore', windowsHide: true });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) { try { ready = (await fetch(base)).ok; } catch { ready = false; } if (ready) break; await new Promise(resolve => setTimeout(resolve, 1000)); }
    assert(ready, 'Local production preview did not start.');
    const audit = spawn(process.execPath, ['scripts/audit-browser.cjs'], { env: { ...process.env, BASE_URL: base, AUDIT_MODE: 'production' }, stdio: 'inherit', windowsHide: true });
    const [code] = await once(audit, 'exit'); assert.equal(code, 0, 'Local production audit failed.');
  } finally { preview.kill(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
