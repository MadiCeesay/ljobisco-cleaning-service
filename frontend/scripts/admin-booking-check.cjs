const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const requireQA = createRequire(path.resolve(process.env.QA_MODULE_ROOT || '.qa/tools', 'package.json'));
const { chromium } = requireQA('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:5173';

(async () => {
  fs.mkdirSync('.qa', { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let booking;
  let quotes = [];
  let balances = [];
  const customer = { id: 'customer-test', name: 'Test Customer', phone: '+2201234567', status: 'Active', email: 'customer@example.test' };
  const user = { id: 'admin-test', name: 'Test Administrator', email: 'admin@example.test', role: 'ADMIN' };
  const writes = [];
  const workspace = () => ({ bookings: [booking], quotes, balances, customers: [customer], services: [{ slug: 'home-cleaning', name: 'House Cleaning' }], products: [], orders: [], payments: [], settings: { depositPercentage: '30' }, settingsRevision: 0 });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let body;
    if (pathname.endsWith('/auth/session')) body = { user };
    else if (pathname.endsWith('/auth/csrf')) body = { csrfToken: 'isolated-browser-token' };
    else if (pathname.endsWith('/admin/workspace')) body = workspace();
    else if (pathname.endsWith('/quotations/workspace')) body = { bookings: [booking], quotes, conversations: [] };
    else if (pathname.endsWith('/business')) body = { whatsappNumber: '+2205393273' };
    else if (pathname.endsWith('/approve') && request.method() === 'POST') {
      const payload = request.postDataJSON();
      assert.equal(payload.id, booking.id);
      assert.equal(payload.expectedRevision, booking.revision);
      booking = { ...booking, requestApprovedAt: new Date().toISOString(), status: 'Under Review', revision: booking.revision + 1 };
      body = { record: booking };
    }
    else if (pathname.endsWith('/schedule') && request.method() === 'POST') {
      const payload = request.postDataJSON();
      assert.equal(payload.id, booking.id);
      assert.equal(payload.expectedRevision, booking.revision);
      writes.push(payload);
      booking = { ...booking, status: payload.values.status, scheduledDate: payload.values.date, scheduledTime: payload.values.time, revision: booking.revision + 1 };
      body = { record: booking };
    } else throw new Error('Unexpected isolated API request: ' + pathname);
    await route.fulfill({ status: 200, json: body });
  });
  async function openBooking() {
    await page.goto(base + '/admin/bookings/' + booking.id);
    await page.getByRole('heading', { name: 'Next step', exact: true }).waitFor();
  }
  async function confirm() {
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Confirm Change', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  try {
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      booking = { id: 'booking-test', reference: 'BKG-TEST', customerId: customer.id, service: 'home-cleaning', address: 'Sample test location', town: 'Test town', description: 'Please clean the kitchen and living room.', contactPhone: customer.phone, status: 'Submitted', revision: 0, photos: [], history: [], createdAt: new Date().toISOString() };
      quotes = []; balances = [];
      await openBooking();
      assert.equal(await page.getByLabel('Information needed').count(), 0);
      assert.equal(await page.getByLabel('Booking update').count(), 0);
      assert.equal(await page.getByLabel('Cleaning date', { exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Approve Request', exact: true }).click();
      await confirm();
      await page.getByText('Request approved for quotation.', { exact: true }).first().waitFor();
      assert.equal(await page.getByRole('button', { name: 'Approve Request', exact: true }).count(), 0);
      await page.getByRole('link', { name: 'Create Quotation', exact: true }).click();
      await page.getByLabel('Eligible booking').waitFor();
      assert.equal(await page.getByLabel('Eligible booking').inputValue(), booking.id);
      booking.status = 'Accepted';
      quotes = [{ id: 'quote-test', bookingId: booking.id, status: 'Accepted', version: 1, total: 5000 }];
      balances = [{ bookingId: booking.id, canSchedule: false }];
      await openBooking();
      await page.getByText(/Scheduling becomes available/).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Create Quotation', exact: true }).count(), 0);
      assert.equal(await page.locator('.booking-schedule-disclosure').count(), 0);
      balances[0].canSchedule = true;
      await openBooking();
      await page.getByText('Set cleaning date', { exact: true }).click();
      await page.getByLabel('Cleaning date', { exact: true }).fill('2035-01-02');
      await page.getByLabel('Time or time window').fill('09:00–11:00');
      assert.equal(await page.getByLabel('Change reason').count(), 0);
      await page.getByRole('button', { name: 'Confirm Schedule', exact: true }).click();
      await confirm();
      await page.getByRole('button', { name: 'Start Cleaning', exact: true }).click();
      await confirm();
      await page.getByRole('button', { name: 'Mark Cleaning Complete', exact: true }).click();
      await confirm();
      await page.getByText('This booking is completed.', { exact: false }).waitFor();
      assert.deepEqual(writes.slice(-3).map(item => item.values.status), ['Scheduled', 'In Progress', 'Completed']);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Overflow at width ' + width);
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: '.qa/admin-booking-' + width + '.png', fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log('PASS: compact review, quotation preselection, payment-gated scheduling, confirmed start/completion and no overflow at 1440/768/390/320. All API responses/mutations were isolated fixtures.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
