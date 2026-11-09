const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const requireQA = createRequire(path.resolve(process.env.QA_MODULE_ROOT || '.qa/tools', 'package.json'));
const { chromium } = requireQA('playwright');
const axePath = requireQA.resolve('axe-core/axe.min.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
const mode = process.env.AUDIT_MODE || 'full';
const report = { base, mode, browser: 'Installed Chrome / Chromium', startedAt: new Date().toISOString(), checks: [], accessibility: [], errors: [] };
fs.mkdirSync('.qa', { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => report.errors.push(error.message));
  async function ready() {
    await page.locator('h1').first().waitFor();
    await page.waitForFunction(() => ![...document.querySelectorAll('[role="status"]')].some(element => /^(Loading\b|Checking your session|Refreshing data)/i.test(element.textContent.trim())));
    await page.evaluate(() => document.fonts.ready);
  }
  async function navigate(route) {
    await page.evaluate(href => { history.pushState({}, '', href); dispatchEvent(new PopStateEvent('popstate')); }, route);
    await page.waitForURL(`${base}${route}`); await ready();
  }
  async function audit(label) {
    await ready();
    if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(async () => {
      const scan = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      return { violations: scan.violations.map(item => ({ id: item.id, impact: item.impact, help: item.help, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), incomplete: scan.incomplete.map(item => ({ id: item.id, nodes: item.nodes.length })) };
    });
    report.accessibility.push({ label, route: new URL(page.url()).pathname, width: page.viewportSize().width, ...result });
    console.log(`A11Y ${label}: ${result.violations.length} violations`);
  }
  function pass(label) { report.checks.push(label); console.log(`PASS: ${label}`); }
  async function noOverflow(label) { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal page overflow`); }
  try {
    if (mode === 'production') {
      await page.route('**/api/**', route => route.request().method() === 'GET' ? route.continue() : route.abort());
      await page.goto(`${base}/login`);
      await page.evaluate(() => { localStorage.setItem('ijobisco:auth', JSON.stringify({ user: { id: 'forged', role: 'ADMIN' }, token: 'not-a-real-token' })); });
      for (const route of ['/dashboard', '/dashboard/bookings', '/dashboard/quotations', '/dashboard/messages', '/dashboard/payments', '/dashboard/orders', '/dashboard/profile', '/bookings/new', '/admin', '/admin/bookings', '/admin/quotations', '/admin/messages', '/admin/services', '/admin/products', '/admin/orders', '/admin/customers', '/admin/payments', '/admin/settings']) {
        await page.goto(`${base}${route}`); await page.waitForURL(/\/(?:admin\/)?login(?:\?|$)/);
        assert.equal(await page.getByLabel('Use development demo adapter').count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Open Administrator Demo' }).count(), 0);
      }
      pass('Production route guards ignore forged stored roles and expose no demo authentication');
      await page.goto(`${base}/shop?demo=1`); await page.getByRole('heading', { name: 'Our product collection is on its way.' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Add to Cart', exact: true }).count(), 0);
      await page.goto(`${base}/checkout`); await page.getByRole('heading', { name: 'Your cart is empty.' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Place Simulated Order' }).count(), 0);
      for (const route of ['/', '/contact', '/login', '/admin/login']) { await page.goto(`${base}${route}`); await audit(`production ${route}`); }
      pass('Production demo inventory/checkout disabled and public accessibility smoke checks');
      assert.deepEqual(report.errors, []);
      assert.equal(report.accessibility.reduce((sum, entry) => sum + entry.violations.length, 0), 0);
      return;
    }
    for (const route of ['/', '/services', '/services/home-cleaning', '/about', '/contact', '/shop', '/cart', '/checkout', '/register', '/login', '/forgot-password', '/reset-password', '/verify-email', '/not-a-real-page']) {
      await page.goto(`${base}${route}`); await audit(`public ${route}`);
      assert.equal(await page.locator('main').count(), 1);
      assert.equal(await page.locator('img:not([alt])').count(), 0);
      await noOverflow(route);
    }
    pass('Public routes, one main landmark, image alt attributes and desktop overflow');
    for (const slug of ['home-cleaning', 'office-cleaning', 'deep-cleaning', 'post-construction-cleaning']) {
      await page.goto(`${base}/services/${slug}`); await page.locator('.detail-photo').waitFor();
      await page.locator('.detail-photo').evaluate(image => image.decode());
      assert(await page.locator('.detail-photo').evaluate(image => image.complete && image.naturalWidth > 0));
    }
    pass('All four structured service details and local photographs');
    await page.goto(`${base}/login`);
    await page.getByLabel('Use development demo adapter').check();
    await page.getByLabel('Email address', { exact: true }).fill('preview@example.test');
    await page.getByLabel('Password', { exact: true }).fill('sample-preview-only');
    await page.getByRole('button', { name: 'Log In', exact: true }).click();
    await page.waitForURL(`${base}/dashboard`); await page.getByRole('heading', { name: /Welcome, Demo Customer/ }).waitFor();
    await audit('customer overview');
    for (const route of ['/dashboard/bookings', '/dashboard/quotations', '/dashboard/quotations/demo-quote-v2', '/dashboard/messages', '/dashboard/payments', '/dashboard/orders', '/dashboard/profile', '/bookings/new']) {
      await navigate(route);
      if (route.includes('quotations/demo-')) await page.getByRole('button', { name: 'Accept Quotation', exact: true }).waitFor();
      if (route === '/dashboard/messages') await page.getByRole('heading', { name: 'Booking support' }).waitFor();
      await audit(route);
    }
    await page.getByRole('link', { name: 'Open Administrator Preview', exact: true }).click();
    await page.getByRole('button', { name: 'Open Administrator Demo' }).click();
    await page.waitForURL(`${base}/admin`); await page.getByRole('heading', { name: 'Business overview' }).waitFor();
    await audit('admin overview');
    for (const route of ['/admin/bookings', '/admin/bookings/demo-review', '/admin/quotations', '/admin/messages', '/admin/services', '/admin/products', '/admin/orders', '/admin/customers', '/admin/customers/demo-customer', '/admin/payments', '/admin/settings']) {
      await navigate(route);
      if (route === '/admin/messages') await page.getByRole('heading', { name: 'Booking support' }).waitFor();
      await audit(route);
    }
    await page.getByRole('button', { name: 'Review Settings' }).click();
    await page.getByRole('dialog').waitFor(); await audit('admin confirmation dialog');
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    pass('Customer/admin navigation and modal keyboard dismissal');
    if (mode !== 'baseline') {
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const route of ['/admin', '/admin/bookings', '/admin/products', '/admin/settings', '/admin/messages']) { await navigate(route); await noOverflow(`${width} ${route}`); }
        await page.screenshot({ path: `.qa/phase7-${width}-admin.png`, fullPage: true });
        if (width === 320) await audit('mobile administrator inbox');
      }
      pass('Admin mobile/tablet/desktop page overflow checks');
      await page.getByRole('button', { name: 'Open administrator menu', exact: true }).click();
      await page.getByRole('navigation', { name: 'Administrator navigation' }).waitFor();
      await page.keyboard.press('Escape');
      assert(!(await page.getByRole('navigation', { name: 'Administrator navigation' }).isVisible()));
      await navigate('/admin/settings'); await page.getByRole('button', { name: 'Review Settings' }).click();
      const mobileDialog = page.getByRole('dialog'); await mobileDialog.waitFor();
      const bounds = await mobileDialog.boundingBox(); assert(bounds.x >= 0 && bounds.x + bounds.width <= 321);
      await audit('mobile administrator confirmation'); await page.keyboard.press('Escape'); await mobileDialog.waitFor({ state: 'hidden' });
      pass('Mobile administrator menu, keyboard dismissal and accessible confirmation dialog');
      await require('./audit-workflows.cjs')({ page, base, navigate, audit, pass, noOverflow });
    }
    assert.deepEqual(report.errors, []);
  } catch (error) {
    report.failure = { message: error.message, url: page.url() };
    await page.screenshot({ path: '.qa/phase7-failure.png', fullPage: true });
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.violationCount = report.accessibility.reduce((sum, entry) => sum + entry.violations.length, 0);
    fs.writeFileSync(`.qa/audit-${mode}.json`, JSON.stringify(report, null, 2));
    console.log(`Recorded ${report.checks.length} checks and ${report.accessibility.length} accessibility scans; ${report.violationCount} violation groups.`);
    await browser.close();
  }
  if (mode !== 'baseline' && report.violationCount) throw new Error('Accessibility violations remain; review the JSON report.');
})().catch(error => { console.error(error); process.exitCode = 1; });
