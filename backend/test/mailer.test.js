import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { mailer } from '../src/auth.js';

test('SMTP failures become safe service-unavailable errors without exposing credentials or provider details', async () => {
  const configuration = { SMTP_HOST: 'smtp.example.test', SMTP_PORT: 587, SMTP_SECURE: false, SMTP_FROM: 'sender@example.test', PUBLIC_APP_URL: 'http://127.0.0.1:5173' };
  const stub = mock.method(nodemailer, 'createTransport', () => ({ async sendMail() { throw Object.assign(new Error('Private provider details and credentials'), { code: 'EDNS' }); } }));
  try {
    const service = mailer(configuration);
    for (const operation of [() => service.send('customer@example.test', 'verify', 'private-token'), () => service.contact('owner@example.test', { name: 'Sample', email: 'customer@example.test', phone: '1234567', subject: 'Test', message: 'Test message' })]) await assert.rejects(operation, error => error.status === 503 && error.code === 'EMAIL_DELIVERY_FAILED' && !/credentials|private-token|provider details/i.test(error.message));
    await assert.rejects(mailer({}).send('customer@example.test', 'verify', 'private-token'), error => error.status === 503 && error.code === 'EMAIL_UNAVAILABLE');
  } finally { stub.mock.restore(); }
});
