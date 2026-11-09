import { Router } from 'express';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { rateLimit } from 'express-rate-limit';
import { User, Session, AccountToken, publicUser } from './models.js';
import { transaction } from './database.js';
import { audit } from './domain.js';
import { assert, HttpError } from './errors.js';

const random = () => randomBytes(32).toString('hex');
export const hash = value => createHash('sha256').update(value).digest('hex');
const safeEqual = (left, right) => typeof left === 'string' && typeof right === 'string' && left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right));
const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(8).max(128).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must use at most 72 UTF-8 bytes.');
const phone = z.string().trim().regex(/^[+\d ()-]{7,25}$/);
export const profileSchema = z.object({ name: z.string().trim().min(2).max(100), email, phone: z.union([z.literal(''), phone]).default('') }).strict();
const neutral = { message: 'If this account is eligible and email delivery is available, instructions may arrive. Delivery is not confirmed.' };
export function mailer(config) {
  const enabled = Boolean(config.SMTP_HOST && config.SMTP_FROM);
  const transport = enabled ? nodemailer.createTransport({ host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_SECURE, requireTLS: !config.SMTP_SECURE && config.production, ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } } : {}) }) : null;
  async function deliver(message) {
    assert(transport, 503, 'EMAIL_UNAVAILABLE', 'Email delivery requires SMTP configuration.');
    try { await transport.sendMail(message); }
    catch { throw new HttpError(503, 'EMAIL_DELIVERY_FAILED', 'The email service could not confirm delivery. Account verification may still be pending.'); }
  }
  return {
    available: enabled,
    async send(to, purpose, token) {
      assert(transport, 503, 'EMAIL_UNAVAILABLE', 'Email delivery requires SMTP configuration.');
      const route = purpose === 'verify' ? 'verify-email' : 'reset-password';
      await deliver({ from: config.SMTP_FROM, to, subject: purpose === 'verify' ? 'Verify your Ijobisco account' : 'Reset your Ijobisco password', text: `Open ${config.PUBLIC_APP_URL}/${route}?token=${encodeURIComponent(token)} . If you did not request this, ignore this email.` });
    },
    async contact(to, values) {
      assert(transport, 503, 'EMAIL_UNAVAILABLE', 'Email delivery requires SMTP configuration.');
      await deliver({ from: config.SMTP_FROM, to, replyTo: values.email, subject: 'Ijobisco website contact request', text: `Name: ${values.name}\nEmail: ${values.email}\nPhone: ${values.phone}\nSubject: ${values.subject}\n\n${values.message}` });
    },
  };
}
export function authentication(config) {
  const cookie = config.production ? '__Host-ijobisco' : 'ijobisco.sid';
  const options = { httpOnly: true, secure: config.production, sameSite: config.COOKIE_SAME_SITE, path: '/' };
  async function resolve(raw) {
    if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) return null;
    const session = await Session.findOne({ tokenHash: hash(raw), expiresAt: { $gt: new Date() } });
    if (!session) return null;
    const user = session.userId ? await User.findById(session.userId) : null;
    if (session.userId && (!user || user.status !== 'Active' || user.authVersion !== session.authVersion || ((user.role === 'ADMIN' || config.REQUIRE_EMAIL_VERIFICATION) && !user.verified))) return null;
    return { session, user };
  }
  async function sessionMiddleware(request, _response, next) {
    try { const found = await resolve(request.cookies[cookie]); request.session = found?.session; request.user = found?.user; next(); } catch (error) { next(error); }
  }
  async function establish(request, response, user) {
    const raw = random();
    const session = await Session.create({ tokenHash: hash(raw), csrf: request.session?.csrf || random(), ...(user ? { userId: user._id, authVersion: user.authVersion } : {}), expiresAt: new Date(Date.now() + (user ? config.SESSION_TTL_HOURS : 1) * 3600000) });
    if (request.session) await Session.deleteOne({ _id: request.session._id });
    response.cookie(cookie, raw, { ...options, maxAge: (user ? config.SESSION_TTL_HOURS : 1) * 3600000 });
    request.session = session; request.user = user;
    return session;
  }
  function csrf(request, _response, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    try {
      assert(config.origins.includes(request.get('Origin')), 403, 'ORIGIN_REJECTED', 'Request origin is not authorized.');
      assert(request.session && safeEqual(request.get('X-CSRF-Token'), request.session.csrf), 403, 'CSRF_REJECTED', 'Refresh the security token before trying again.'); next();
    } catch (error) { next(error); }
  }
  function requireUser(request, _response, next) { try { assert(request.user, 401, 'AUTH_REQUIRED', 'Please log in.'); next(); } catch (error) { next(error); } }
  function requireAdmin(request, _response, next) { try { assert(request.user?.role === 'ADMIN', 403, 'FORBIDDEN', 'Administrator access is required.'); next(); } catch (error) { next(error); } }
  return { cookie, resolve, establish, sessionMiddleware, csrf, requireUser, requireAdmin, clear: response => response.clearCookie(cookie, options) };
}
export function authRoutes(config, auth, emailService = mailer(config)) {
  const router = Router();
  const limited = rateLimit({ windowMs: 15 * 60000, limit: config.NODE_ENV === 'test' ? 1000 : 15, standardHeaders: 'draft-8', legacyHeaders: false });
  router.get('/auth/configuration', (_request, response) => response.json({ requireEmailVerification: config.REQUIRE_EMAIL_VERIFICATION }));
  router.get('/auth/csrf', async (request, response) => { if (!request.session) await auth.establish(request, response); response.json({ csrfToken: request.session.csrf }); });
  router.get('/auth/session', (request, response) => response.json({ user: request.user ? publicUser(request.user) : null }));
  router.post('/auth/register', limited, async (request, response) => {
    const values = profileSchema.extend({ password }).strict().parse(request.body);
    if (config.REQUIRE_EMAIL_VERIFICATION) assert(emailService.available, 503, 'EMAIL_UNAVAILABLE', 'Registration requires email delivery configuration.');
    const existing = await User.findOne({ email: values.email });
    assert(!existing, 409, 'ACCOUNT_EXISTS', 'An account with these details already exists. Log in or use account recovery.');
    const passwordHash = await bcrypt.hash(values.password, 12);
    const token = config.REQUIRE_EMAIL_VERIFICATION ? random() : null;
    await transaction(async session => {
      const [user] = await User.create([{ name: values.name, email: values.email, phone: values.phone, passwordHash, role: 'CUSTOMER', verified: false }], { session });
      if (token) await AccountToken.create([{ userId: user._id, tokenHash: hash(token), purpose: 'verify', expiresAt: new Date(Date.now() + 24 * 3600000) }], { session });
      await audit(user, 'account.registered', user, session);
    });
    if (token) await emailService.send(values.email, 'verify', token);
    response.status(token ? 202 : 201).json({ ...(token ? neutral : { message: 'Your customer account has been created. You can now log in.' }), verificationRequired: Boolean(token) });
  });
  router.post('/auth/login', limited, async (request, response) => {
    const values = z.object({ email, password: z.string().min(1).max(128) }).strict().parse(request.body);
    const user = await User.findOne({ email: values.email }).select('+passwordHash');
    const valid = await bcrypt.compare(values.password, user?.passwordHash || '$2b$12$u8jtNaXeG9SIXvzBY1IAoelK6tI7oky8GXAYZgrIh9yiVyb1VpJ8m');
    assert(user && valid && user.status === 'Active' && ((user.role === 'CUSTOMER' && !config.REQUIRE_EMAIL_VERIFICATION) || user.verified), 401, 'INVALID_LOGIN', 'Login failed. Check credentials and email verification.');
    await auth.establish(request, response, user); response.json({ user: publicUser(user) });
  });
  router.post('/auth/logout', async (request, response) => { if (request.session) await Session.deleteOne({ _id: request.session._id }); auth.clear(response); response.sendStatus(204); });
  for (const [route, purpose] of [['forgot-password', 'reset'], ['resend-verification', 'verify']]) router.post(`/auth/${route}`, limited, async (request, response) => {
    const values = z.object({ email }).strict().parse(request.body);
    assert(emailService.available, 503, 'EMAIL_UNAVAILABLE', 'Email delivery requires configuration.');
    const user = await User.findOne({ email: values.email, status: 'Active' });
    if (user && (purpose === 'reset' || !user.verified)) {
      const token = random();
      await AccountToken.create({ userId: user._id, purpose, tokenHash: hash(token), expiresAt: new Date(Date.now() + (purpose === 'reset' ? 30 * 60000 : 24 * 3600000)) });
      try { await emailService.send(user.email, purpose, token); }
      catch (error) { if (error.code !== 'EMAIL_DELIVERY_FAILED') throw error; }
    }
    response.status(202).json(neutral);
  });
  for (const [route, purpose] of [['verify-email', 'verify'], ['reset-password', 'reset']]) router.post(`/auth/${route}`, limited, async (request, response) => {
    const values = (purpose === 'reset' ? z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password }) : z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) })).strict().parse(request.body);
    const passwordHash = purpose === 'reset' ? await bcrypt.hash(values.password, 12) : null;
    await transaction(async session => {
      const token = await AccountToken.findOneAndDelete({ tokenHash: hash(values.token), purpose, expiresAt: { $gt: new Date() } }, { session });
      assert(token, 422, 'INVALID_TOKEN', 'This token is invalid or expired.');
      const user = await User.findById(token.userId).session(session);
      assert(user && user.status === 'Active', 422, 'INVALID_TOKEN', 'This token is invalid or expired.');
      if (purpose === 'reset') { user.passwordHash = passwordHash; user.authVersion++; await Session.deleteMany({ userId: user._id }, { session }); }
      else user.verified = true;
      await user.save({ session }); await AccountToken.deleteMany({ userId: user._id, purpose }, { session });
    });
    response.json({ message: 'Account action completed.' });
  });
  router.patch('/customer/profile', auth.requireUser, async (request, response) => {
    const values = profileSchema.parse(request.body);
    assert(values.email === request.user.email, 422, 'EMAIL_CHANGE_REQUIRES_VERIFICATION', 'Changing email requires a separate verified-email workflow.');
    const user = await User.findOneAndUpdate({ _id: request.user._id, status: 'Active' }, { $set: { name: values.name, phone: values.phone } }, { returnDocument: 'after' });
    response.json({ user: publicUser(user) });
  });
  return router;
}
