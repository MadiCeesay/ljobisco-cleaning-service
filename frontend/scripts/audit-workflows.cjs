const assert = require('node:assert/strict');

module.exports = async function workflows({ page, base, navigate, audit, pass, noOverflow }) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const pngData = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 4; const context = canvas.getContext('2d'); context.fillStyle = '#073b91'; context.fillRect(0, 0, 4, 4); return canvas.toDataURL('image/png').split(',')[1]; });
  const photograph = { name: 'sample-cleaning-area.png', mimeType: 'image/png', buffer: Buffer.from(pngData, 'base64') };
  async function confirmChange() { await page.getByRole('dialog').getByRole('button', { name: 'Confirm Change' }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' }); }
  async function customerLogin(redirect = '/dashboard') {
    await page.goto(`${base}/login?${new URLSearchParams({ redirect })}`);
    await page.getByLabel('Use development demo adapter').check();
    await page.getByLabel('Email address', { exact: true }).fill('preview@example.test');
    await page.getByLabel('Password', { exact: true }).fill('sample-preview-only');
    await page.getByRole('button', { name: 'Log In', exact: true }).click(); await page.waitForURL(`${base}${redirect}`);
  }
  await page.goto(base);
  await page.locator('.skip-link').focus();
  assert(await page.locator('.skip-link').evaluate(element => { const bounds = element.getBoundingClientRect(); return bounds.top >= 0 && document.elementFromPoint(bounds.left + 5, bounds.top + 5) === element; }));
  await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Services', exact: true }).click();
  await page.waitForURL(`${base}/services`);
  await page.getByRole('link', { name: 'Learn more about House Cleaning' }).click(); await page.waitForURL(`${base}/services/home-cleaning`);
  assert.equal(await page.getByText('The request form is coming in the next development phase.').count(), 0);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'About', exact: true }).click();
  await navigate('/privacy'); await page.getByRole('heading', { name: 'Privacy Policy' }).waitFor();
  await navigate('/terms'); await page.getByRole('heading', { name: 'Terms of Service' }).waitFor();
  await navigate('/contact');
  await page.getByRole('button', { name: 'Submit Message' }).click(); await page.locator('[aria-invalid="true"]').first().waitFor();
  await page.getByLabel('Full name', { exact: false }).fill('Sample Customer');
  await page.getByLabel('Email address', { exact: false }).fill('sample@example.test');
  await page.getByLabel('Phone number', { exact: false }).fill('1234567');
  await page.getByLabel('Subject', { exact: false }).fill('Sample enquiry');
  await page.getByLabel('Message', { exact: false }).fill('A sample enquiry for this local interface test.');
  await page.getByRole('button', { name: 'Submit Message' }).click();
  await page.getByText(/Your message has not been sent or saved/).waitFor();
  pass('Public link navigation, skip-link keyboard focus, legal unavailable states and contact validation/non-delivery');
  for (const [route, button] of [['/register', 'Create Customer Account'], ['/forgot-password', 'Request Reset'], ['/reset-password', 'Reset Password'], ['/verify-email', 'Verify Email']]) {
    await page.goto(`${base}${route}`); await page.getByLabel('Use development demo adapter').check();
    await page.getByRole('button', { name: button, exact: true }).click(); await page.locator('[aria-invalid="true"]').first().waitFor();
    if (route === '/register') {
      assert.equal(await page.getByRole('combobox', { name: /role/i }).count(), 0);
      await page.getByLabel('Full name', { exact: true }).fill('Demo Customer');
      await page.getByLabel('Email address', { exact: true }).fill('preview@example.test');
    }
    if (route === '/register' || route === '/forgot-password') await page.getByLabel('Email address', { exact: true }).fill('preview@example.test');
    if (route === '/register' || route === '/reset-password') {
      await page.getByLabel('Password', { exact: true }).fill('sample-passphrase-123');
      await page.getByLabel('Confirm password', { exact: true }).fill('different-passphrase');
      await page.getByRole('button', { name: 'Show password', exact: true }).click();
      assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('type'), 'text');
      await page.getByRole('button', { name: button, exact: true }).click(); await page.getByText('Passwords must match.').waitFor();
      await page.getByLabel('Confirm password', { exact: true }).fill('sample-passphrase-123');
    }
    if (route === '/reset-password') await page.getByLabel('Reset token', { exact: true }).fill('sample-token-not-real');
    if (route === '/verify-email') await page.getByLabel('Verification token', { exact: true }).fill('sample-token-not-real');
    await page.getByRole('button', { name: button, exact: true }).click();
    await page.getByText(route === '/register' ? /No real account was created/ : /No account credentials were changed/).waitFor();
  }
  pass('Registration/recovery/verification validation, password visibility and explicit demo-only outcomes');
  await page.goto(`${base}/shop?demo=1`);
  await page.locator('.product-card').first().waitFor();
  await page.getByLabel('Search products').fill('cloths'); assert.equal(await page.locator('.product-card').count(), 1);
  await page.getByLabel('Search products').fill('not-a-product'); await page.getByRole('heading', { name: 'No products match your search.' }).waitFor();
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await page.getByLabel('Category', { exact: true }).selectOption('Tools'); assert.equal(await page.locator('.product-card').count(), 2);
  await page.getByLabel('Sort by').selectOption('price-high'); await page.getByRole('link', { name: 'Demo Spray Bottle', exact: true }).click();
  await page.getByRole('button', { name: 'View product image 2' }).click(); assert.match(await page.locator('.gallery-main').getAttribute('src'), /supplies/);
  await page.getByLabel('Quantity', { exact: true }).fill('2'); await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  await page.getByRole('link', { name: 'View Cart', exact: true }).click();
  await page.getByRole('button', { name: 'Increase quantity of Demo Spray Bottle' }).click();
  await page.getByRole('button', { name: 'Decrease quantity of Demo Spray Bottle' }).click();
  await page.getByRole('button', { name: 'Remove Demo Spray Bottle' }).click(); await page.getByRole('heading', { name: 'Your cart is empty.' }).waitFor();
  await navigate('/shop?demo=1'); await page.getByRole('link', { name: 'Demo Cleaning Cloths', exact: true }).click();
  await page.getByLabel('Quantity', { exact: true }).fill('2'); await page.getByRole('button', { name: 'Add to Cart', exact: true }).click();
  await page.getByRole('link', { name: 'View Cart', exact: true }).click(); await page.reload();
  await page.getByLabel('Quantity: 2', { exact: true }).waitFor();
  const persisted = await page.evaluate(() => localStorage.getItem('ijobisco:cart:demo:v1'));
  assert(persisted && !/price|stock|email|token/i.test(persisted));
  pass('Product search/category/sort/gallery, cart add/quantity/remove, empty cart and identifier-only persistence');
  await customerLogin('/bookings/new');
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByText('Choose a cleaning service.').waitFor();
  await page.getByLabel('Cleaning service', { exact: true }).selectOption('home-cleaning'); await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Property type', { exact: true }).selectOption('House');
  await page.getByLabel('Number of rooms or cleaning areas').fill('2');
  await page.getByLabel('Special cleaning requirements (optional)').fill('Sample requirements only.');
  await page.getByRole('link', { name: 'My Bookings', exact: true }).click(); await page.getByRole('link', { name: 'New Request', exact: true }).click();
  assert.equal(await page.getByLabel('Number of rooms or cleaning areas').inputValue(), '2');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Contact phone number', { exact: true }).fill('+2201234567'); await page.getByLabel('Address or location description').fill('Sample property — local test only');
  await page.getByLabel('Town or area', { exact: true }).fill('Sample area');
  await page.getByLabel('Preferred cleaning date').fill('2099-01-01'); await page.getByLabel('Preferred time window').selectOption('Flexible');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Describe the cleaning needed').fill('A sample cleaning request for the living areas.');
  await page.getByLabel('Photographs (optional)').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await page.getByText(/Choose JPG, PNG or WebP photographs only/).waitFor();
  await page.getByLabel('Photographs (optional)').setInputFiles([photograph, { ...photograph, name: 'second-area.png' }]);
  await page.getByRole('button', { name: 'Remove photograph 2' }).click(); assert.equal(await page.locator('.photo-previews img').count(), 1);
  await audit('cleaning request photos');
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click(); await page.getByRole('button', { name: 'Submit Demo Request' }).click();
  await page.waitForURL(/\/dashboard\/bookings\/demo-/); const bookingId = page.url().split('/').pop();
  await page.getByText('sample-cleaning-area.png — local preview only, not uploaded', { exact: true }).waitFor();
  pass('Five-step request validation, session draft preservation, previous/next, image validation/preview/removal and demo submission');
  await navigate('/dashboard/quotations/demo-quote-v1'); await page.getByRole('heading', { name: 'House Cleaning', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Accept Quotation', exact: true }).count(), 0);
  await navigate('/dashboard/quotations/demo-quote-v2'); await page.getByRole('button', { name: 'Accept Quotation', exact: true }).click(); await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button', { name: 'Chat on WhatsApp', exact: true }).isDisabled(), true);
  await navigate('/dashboard/quotations/demo-quote-v2'); await page.getByRole('button', { name: 'Decline Quotation', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Decline' }).click(); await page.getByText('The service confirmed quotation decline.').waitFor();
  await page.getByRole('link', { name: 'Open Administrator Preview', exact: true }).click(); await page.getByRole('button', { name: 'Open Administrator Demo' }).click(); await page.waitForURL(`${base}/admin`);
  await navigate(`/admin/bookings/${bookingId}`); await page.getByRole('img', { name: 'sample-cleaning-area.png', exact: true }).waitFor();
  await page.getByLabel('Information needed').fill('Please clarify the photographed cleaning area.');
  await page.getByRole('button', { name: 'Review Information Request' }).click(); await confirmChange();
  await page.locator('dd').getByText('Awaiting Information', { exact: true }).waitFor();
  await navigate('/admin/quotations'); await page.getByLabel('Eligible booking').selectOption('demo-review');
  await page.getByLabel('Description for item 1').fill('Demo revised cleaning scope'); await page.getByLabel('Unit price (GMD) for item 1').fill('2100');
  await page.getByLabel('Expiry date and time').fill('2099-01-08T12:00'); await page.getByRole('button', { name: 'Review Quotation' }).click();
  await page.getByRole('button', { name: 'Edit Quotation' }).click(); await page.getByRole('button', { name: 'Review Quotation' }).click();
  await page.getByRole('button', { name: 'Send Official Quotation' }).click(); await page.getByText('The demo/service returned official version 3.').waitFor();
  await navigate('/admin/products'); await page.getByRole('button', { name: 'Edit Demo Spray Bottle' }).click();
  await page.getByLabel('Stock quantity', { exact: true }).fill('1000000'); await page.getByRole('button', { name: 'Review Product', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click(); await page.getByRole('button', { name: 'Review Product', exact: true }).click(); await confirmChange();
  await navigate('/admin/settings'); await page.getByLabel('Deposit percentage').fill('25'); await page.getByRole('button', { name: 'Review Settings' }).click(); await confirmChange();
  pass('Old quote rejection, WhatsApp configuration-required state, decline confirmation, new-booking clarification/photo review, revision issuance and admin editing');
  await page.getByRole('button', { name: 'Switch to Customer Preview' }).click(); await page.waitForURL(`${base}/dashboard`);
  await navigate('/dashboard/quotations'); const latest = page.locator('.quotation-list-row').filter({ hasText: 'Version 3' }); await latest.waitFor();
  await latest.press('Enter'); await page.getByRole('button', { name: 'Accept Quotation', exact: true }).click(); await page.getByRole('button', { name: 'Confirm Acceptance' }).click();
  await page.getByRole('link', { name: 'Continue to Payment Selection' }).click(); await page.getByLabel(/Pay 25% deposit/).waitFor();
  await page.getByLabel(/Pay 100% upfront/).check(); await page.getByLabel(/Pay 25% deposit/).check();
  await page.getByLabel('Simulated gateway outcome').selectOption('failed'); await page.getByRole('button', { name: /Simulate Payment/ }).click();
  await page.getByText('Mock gateway returned a failed simulated payment. No money moved.').waitFor();
  await page.getByLabel('Simulated gateway outcome').selectOption('paid'); await page.getByRole('button', { name: /Simulate Payment/ }).click();
  await page.getByText('Partially Paid', { exact: true }).waitFor(); assert(await page.getByRole('button', { name: /Simulate Payment/ }).isDisabled());
  await audit('accepted payment and history');
  await navigate('/shop/demo-spray-bottle?demo=1');
  const quantity = page.getByLabel('Quantity', { exact: true });
  await quantity.fill('1.5'); assert(await page.getByRole('button', { name: 'Add to Cart', exact: true }).isDisabled());
  await quantity.fill('1000000'); assert(!(await page.getByRole('button', { name: 'Add to Cart', exact: true }).isDisabled()));
  assert.equal(await page.locator('#product-quantity option').count(), 0);
  await quantity.fill('2'); await audit('large-stock product quantity');
  pass('Large-stock quantity control stays constant-size and rejects fractional quantities');
  await navigate('/checkout'); await page.getByRole('heading', { name: 'Checkout', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Review Order' }).click(); await page.getByText('Enter a delivery address.', { exact: true }).waitFor();
  await page.getByLabel('Delivery address', { exact: true }).fill('Sample delivery address'); await page.getByLabel('Town or area', { exact: true }).fill('Sample area');
  await page.getByLabel('Fulfilment preference').selectOption('pickup'); await page.getByRole('button', { name: 'Review Order' }).click();
  assert(await page.getByRole('button', { name: 'Place Simulated Order' }).isDisabled());
  await page.getByLabel(/I understand this is a simulated order/).check();
  await audit('checkout review');
  for (const width of [1440, 768, 390, 320]) { await page.setViewportSize({ width, height: 1000 }); await noOverflow(`checkout ${width}`); }
  await page.getByRole('button', { name: 'Place Simulated Order' }).click(); await page.getByRole('heading', { name: 'Simulated order confirmation' }).waitFor();
  await page.getByText('Paid', { exact: true }).waitFor(); await noOverflow('mobile order confirmation');
  await navigate('/cart'); await page.getByRole('heading', { name: 'Your cart is empty.' }).waitFor();
  pass('Configured deposit/full preview, mock failure/success, partial payment lock, delivery/pickup validation, review acknowledgement and checkout confirmation');
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of ['/admin', '/admin/bookings', '/admin/products', '/admin/settings', '/admin/quotations', '/admin/messages', '/admin/payments']) { await navigate(route); await page.getByRole('heading', { name: 'Administrator access required.', exact: true }).waitFor(); assert.equal(await page.locator('.admin-shell').count(), 0); }
  pass('Customer role denied administrator controls');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/', '/services', '/about', '/contact', '/shop?demo=1', '/dashboard', '/dashboard/bookings', '/dashboard/messages', '/dashboard/profile']) { await navigate(route); await noOverflow(`${width} ${route}`); }
    await page.screenshot({ path: `.qa/phase7-${width}-customer.png`, fullPage: true });
    if (width === 320) await audit('mobile customer profile');
  }
  await navigate('/'); await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.service-image img').first().evaluate(element => getComputedStyle(element).transitionDuration), '0s');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).waitFor();
  await page.keyboard.press('Escape'); assert(!(await page.getByRole('navigation', { name: 'Mobile navigation' }).isVisible()));
  pass('Public/customer/checkout mobile-tablet-desktop layouts and reduced-motion preference');
};
