import fs from 'node:fs';
import { parseEnv } from 'node:util';

const current = parseEnv(fs.readFileSync('.env', 'utf8'));
if (!current.MONGODB_URI) throw new Error('A private MongoDB URI is required in backend/.env.');
const values = {
  NODE_ENV: 'production', NODE_VERSION: '24', HOST: '0.0.0.0',
  FRONTEND_PENDING: 'true', TRUST_PROXY_HOPS: '1',
  SESSION_TTL_HOURS: '24', COOKIE_SAME_SITE: 'none',
  REQUIRE_EMAIL_VERIFICATION: 'false', MOCK_PAYMENTS_ENABLED: 'false',
  MONGODB_URI: current.MONGODB_URI,
  SMTP_HOST: current.SMTP_HOST || '', SMTP_PORT: current.SMTP_PORT || '587',
  SMTP_SECURE: current.SMTP_SECURE || 'false', SMTP_USER: current.SMTP_USER || '',
  SMTP_PASS: current.SMTP_PASS || '', SMTP_FROM: current.SMTP_FROM || '',
  CLOUDINARY_CLOUD_NAME: current.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: current.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: current.CLOUDINARY_API_SECRET || '',
};
const content = '# PRIVATE: import into Render Environment. Never commit or share.\n# Replace exposed provider credentials before using this file.\n# Delete old FRONTEND_ORIGINS and PUBLIC_APP_URL entries in Render during pending setup.\n# Render supplies PORT, RENDER and RENDER_EXTERNAL_URL; do not override them.\n' + Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n';
fs.writeFileSync('.env.render', content, { mode: 0o600 });
console.log('Prepared private backend/.env.render. Values were not printed. No deployment or database write was performed.');
