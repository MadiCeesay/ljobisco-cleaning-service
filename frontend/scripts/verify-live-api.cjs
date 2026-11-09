const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const requireQA = createRequire(path.resolve(process.env.QA_MODULE_ROOT || '.qa/tools', 'package.json'));
const { chromium } = requireQA('playwright');
const origin = 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { scope: 'Read-only existing frontend to port 4000 backend/MongoDB; no authenticated Atlas workflow', startedAt: new Date().toISOString(), writesBlocked: 0, checks: [] };
  try {
    const page = await browser.newPage();
    await page.route(`${origin}/api/**`, route => { if (route.request().method() !== 'GET') { report.writesBlocked++; return route.abort(); } return route.continue(); });
    const ready = await page.request.get('http://127.0.0.1:4000/ready');
    assert.equal(ready.status(), 200); assert.deepEqual(await ready.json(), { status: 'ready' }); report.checks.push('Existing port 4000 backend completed MongoDB readiness ping');
    assert.equal((await page.request.get('http://127.0.0.1:4000/socket.io/?EIO=4&transport=polling')).status(), 404);
    report.checks.push('Existing backend exposes no Socket.IO handshake endpoint');
    await page.goto(`${origin}/services`); await page.getByRole('heading', { level: 1 }).waitFor();
    const summary = await page.evaluate(async () => {
      const { apiRequest, apiConfigured } = await import('/src/services/apiClient.js');
      const services = await apiRequest('/services'); const products = await apiRequest('/products'); const session = await apiRequest('/auth/session'); const business = await apiRequest('/business'); const policy = await apiRequest('/auth/configuration');
      if (typeof business.whatsappNumber !== 'string') throw new Error('The running backend does not expose the updated WhatsApp settings contract. Restart the local backend.');
      if (typeof policy.requireEmailVerification !== 'boolean') throw new Error('The running backend needs the updated authentication configuration endpoint.');
      return { configured: apiConfigured, services: services.services.length, products: products.products.length, guest: session.user === null, whatsappConfigured: Boolean(business.whatsappNumber), requireEmailVerification: policy.requireEmailVerification };
    });
    assert(summary.configured); assert(summary.guest); assert(Number.isInteger(summary.services)); assert(Number.isInteger(summary.products));
    report.summary = summary; report.checks.push('Browser shared Axios adapter read real services/products/business WhatsApp configuration and restored anonymous session through Vite proxy');
    await page.goto(`${origin}/contact`);
    if (!summary.whatsappConfigured) { await page.getByRole('button', { name: 'Chat on WhatsApp', exact: true }).waitFor(); assert(await page.getByRole('button', { name: 'Chat on WhatsApp', exact: true }).isDisabled()); }
    else await page.getByRole('link', { name: /Chat on WhatsApp/ }).waitFor();
    report.checks.push('Current connected contact page reflects configured or disabled business WhatsApp state');
    for (const route of ['/dashboard', '/bookings/new', '/admin']) { await page.goto(`${origin}${route}`); await page.waitForURL(/\/(?:admin\/)?login(?:\?|$)/); }
    report.checks.push('Guest customer/administrator routes remain guarded');
    await page.goto(`${origin}/register`); await page.getByRole('heading', { level: 1 }).waitFor(); assert.equal(await page.getByLabel('Use development demo adapter').count(), 0);
    assert.equal(await page.getByLabel('Phone number', { exact: true }).count(), 0);
    for (const name of ['Full name', 'Email address', 'Password', 'Confirm password']) await page.getByLabel(name, { exact: true }).waitFor();
    await page.goto(`${origin}/shop?demo=1`); await page.getByRole('heading', { level: 1 }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Preview Demo Products' }).count(), 0);
    report.checks.push('Connected mode exposes no fixture account or inventory controls'); assert.equal(report.writesBlocked, 0); report.passed = true;
    console.log(JSON.stringify(report));
  } catch (error) { report.passed = false; report.failure = error.message; throw error; }
  finally { fs.mkdirSync('.qa', { recursive: true }); fs.writeFileSync('.qa/live-api-readonly.json', JSON.stringify(report, null, 2)); await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
