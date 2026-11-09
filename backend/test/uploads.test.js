import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { setup, post, baseEnvironment } from './helpers.js';
import { Upload } from '../src/models.js';
import { login, bookingValues } from './actors.js';
import { inspectImage } from '../src/uploads.js';

test('configured image-provider failures return a safe unavailable state without confirming an upload', async () => {
  const context = await setup({ media: { available: true, async upload() { throw new Error('Private provider credentials'); } } });
  try {
    const customer = await login(context);
    const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const response = await customer.agent.post('/api/uploads').set('Origin', baseEnvironment.PUBLIC_APP_URL).set('X-CSRF-Token', customer.token).field('purpose', 'booking-photo').attach('file', image, { filename: 'test.png', contentType: 'image/png' }).expect(503);
    assert.equal(response.body.error.code, 'UPLOAD_UNAVAILABLE'); assert(!JSON.stringify(response.body).includes('credentials'));
    assert.equal(await Upload.countDocuments(), 0);
  } finally { await context.close(); }
});

test('uploads inspect bytes and size, bind owner/purpose, and authorize private reads', async () => {
  const media = { available: true, async upload() { return { publicId: 'test-only-private-image', format: 'webp' }; }, async remove() {}, url() { return 'https://example.test/short-lived-test-only-link'; } };
  const context = await setup({ media });
  try {
    const customer = await login(context); const other = await login(context);
    const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffffff' } }).png().toBuffer();
    await assert.rejects(inspectImage({ buffer: Buffer.from('<svg><script/></svg>'), mimetype: 'image/png' }));
    await assert.rejects(inspectImage({ buffer: Buffer.alloc(5 * 1024 * 1024 + 1), mimetype: 'image/png' }));
    const upload = await customer.agent.post('/api/uploads').set('Origin', baseEnvironment.PUBLIC_APP_URL).set('X-CSRF-Token', customer.token).field('purpose', 'booking-photo').attach('file', image, { filename: 'test.png', contentType: 'image/png' }).expect(201);
    const id = upload.body.attachmentId;
    await context.agent().get(`/api/uploads/${id}`).expect(401); await other.agent.get(`/api/uploads/${id}`).expect(404);
    await customer.agent.get(`/api/uploads/${id}`).expect(302);
    await post(other.agent, '/bookings', other.token, { ...bookingValues(), photos: [{ attachmentId: id }] }).expect(422);
    const booking = (await post(customer.agent, '/bookings', customer.token, { ...bookingValues(), photos: [{ attachmentId: id }] }).expect(201)).body;
    assert.equal(booking.photos[0].attachmentId, id);
    await post(customer.agent, '/bookings', customer.token, { ...bookingValues(), photos: [{ attachmentId: id }] }).expect(422);
  } finally { await context.close(); }
});
