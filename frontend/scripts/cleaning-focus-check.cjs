const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const requireQA = createRequire(path.resolve(process.env.QA_MODULE_ROOT || '.qa/tools', 'package.json'));
const { chromium } = requireQA('playwright');
const axePath = requireQA.resolve('axe-core/axe.min.js');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';

(async () => {
  fs.mkdirSync('.qa', { recursive: true });
  const { services } = await import('../src/data/services.js');
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.context().route('https://wa.me/**', route => route.fulfill({ status: 200, body: 'Isolated WhatsApp navigation check' }));
  const errors = [];
  const unexpected = [];
  page.on('pageerror', error => errors.push(error.message));
  const user = { id: 'test-customer', name: 'UI Test Customer', email: 'ui@example.test', role: 'CUSTOMER', phone: '' };
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    assert.equal(request.method(), 'GET', 'This browser check must never write real records.');
    let body;
    if (pathname.endsWith('/auth/session')) body = { user };
    else if (pathname.endsWith('/services')) body = { services };
    else if (pathname.endsWith('/business')) body = { whatsappNumber: '+2205393273' };
    else if (pathname.endsWith('/customer/overview')) body = { bookings: [], quotations: [], notifications: [], payments: [], orders: [] };
    else { unexpected.push(pathname); body = {}; }
    await route.fulfill({ status: 200, json: body });
  });
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/');
      await page.getByRole('heading', { name: /A Cleaner Space/ }).waitFor();
      assert.equal(await page.locator('a[href="/shop"], a[href="/cart"]').count(), 0);
      const whatsapp = page.locator('a[href^="https://wa.me/2205393273"]').first();
      await whatsapp.waitFor();
      assert.equal(await whatsapp.locator('svg').count(), 1);
      assert.equal(await whatsapp.getAttribute('target'), '_blank');
      if (width === 1440) {
        const [popup] = await Promise.all([page.waitForEvent('popup'), whatsapp.click()]);
        await popup.waitForLoadState();
        assert.equal(new URL(popup.url()).pathname, '/2205393273');
        await popup.close();
      }
      await page.goto(base + '/bookings/new');
      await page.getByRole('heading', { name: 'Your clean', exact: true }).waitFor();
      assert.equal(await page.locator('.booking-progress li').count(), 3);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      assert(await page.locator('.field-error').count() > 0);
      await page.getByLabel('What would you like cleaned?').selectOption('home-cleaning');
      assert.equal(await page.getByLabel('Property type', { exact: true }).count(), 0);
      await page.getByLabel('What cleaning do you need?').fill('Please clean the living room and kitchen.');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('heading', { name: 'Location & contact', exact: true }).waitFor();
      await page.getByLabel('Phone / WhatsApp number').fill('5393273');
      await page.getByLabel('Address or nearby landmark').fill('Sample location for UI testing');
      await page.getByLabel('Town or area', { exact: true }).fill('Test town');
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('heading', { name: 'Review & send', exact: true }).waitFor();
      await page.getByText('To be discussed', { exact: true }).waitFor();
      await page.locator('summary').click();
      await page.locator('#booking-photos').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT1cAAAAASUVORK5CYII=', 'base64') });
      await page.getByRole('button', { name: 'Remove photograph 1' }).click();
      assert.equal(await page.locator('.photo-previews figure').count(), 0);
      assert.equal(await page.locator('.error-notice').count(), 0, 'Review must not submit automatically.');
      assert.deepEqual(unexpected, [], 'Review must not request a CSRF token or submit.');
      await page.addScriptTag({ path: axePath });
      const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })));
      assert.deepEqual(violations, [], 'Accessibility violations at ' + width);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Booking overflow at ' + width);
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: '.qa/cleaning-booking-' + width + '.png', fullPage: true });
      for (const legacy of ['/shop', '/cart', '/checkout', '/dashboard/orders']) {
        await page.goto(base + legacy);
        await page.waitForURL(base + '/services');
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: cleaning-only navigation, WhatsApp target/icon, three-step validation, optional fields, photo removal, redirects and responsive widths 1440/768/390/320. Browser APIs were isolated fixtures; no real writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
