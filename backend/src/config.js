import { z } from 'zod';
const flag = z.enum(['true', 'false']).default('false').transform(value => value === 'true');
export function loadConfig(environment = process.env) {
  const input = { ...environment };
  const frontendPending = input.FRONTEND_PENDING === 'true';
  if (frontendPending) {
    if (input.NODE_ENV !== 'production' || input.RENDER !== 'true' || !input.RENDER_EXTERNAL_URL) throw new Error('Frontend-pending mode requires a Render production web service.');
    if (input.FRONTEND_ORIGINS?.trim() || input.PUBLIC_APP_URL?.trim()) throw new Error('Remove frontend URL overrides during frontend-pending setup; configure actual HTTPS origins when the frontend is deployed.');
    input.FRONTEND_ORIGINS = input.RENDER_EXTERNAL_URL;
    input.PUBLIC_APP_URL = input.RENDER_EXTERNAL_URL;
  }
  const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000), HOST: z.string().default(input.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
    FRONTEND_PENDING: flag, TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
    MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\//),
    FRONTEND_ORIGINS: z.string().min(1), PUBLIC_APP_URL: z.string().url(),
    SESSION_TTL_HOURS: z.coerce.number().min(1).max(168).default(24),
    REQUIRE_EMAIL_VERIFICATION: flag,
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'), MOCK_PAYMENTS_ENABLED: flag,
    SMTP_HOST: z.string().default(''), SMTP_PORT: z.coerce.number().int().default(587), SMTP_SECURE: flag,
    SMTP_USER: z.string().default(''), SMTP_PASS: z.string().default(''), SMTP_FROM: z.string().default(''),
    CLOUDINARY_CLOUD_NAME: z.string().default(''), CLOUDINARY_API_KEY: z.string().default(''), CLOUDINARY_API_SECRET: z.string().default(''),
  });
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid environment fields: ${[...new Set(result.error.issues.map(issue => issue.path[0]))].join(', ')}`);
  const config = result.data;
  config.production = config.NODE_ENV === 'production';
  config.frontendPending = frontendPending;
  config.origins = config.FRONTEND_ORIGINS.split(',').map(value => value.trim());
  for (const value of [...config.origins, config.PUBLIC_APP_URL]) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || (config.production && url.protocol !== 'https:')) throw new Error('Application origins must be exact approved HTTP(S) origins; production requires HTTPS.');
  }
  if (!config.origins.includes(config.PUBLIC_APP_URL)) throw new Error('PUBLIC_APP_URL must be an allowed frontend origin.');
  if (config.production && config.MOCK_PAYMENTS_ENABLED) throw new Error('Mock payments cannot be enabled in production.');
  if (config.MOCK_PAYMENTS_ENABLED && !['127.0.0.1', 'localhost', '::1'].includes(config.HOST)) throw new Error('Development mock payments require a loopback bind address.');
  if (!config.production && config.COOKIE_SAME_SITE === 'none') throw new Error('Cross-site cookies require production HTTPS.');
  return Object.freeze(config);
}
