export function resolveApiConfiguration(value, production = false) {
  const base = String(value || '').trim().replace(/\/+$/, '');
  if (!base) return { base: '', error: '' };
  const invalid = { base: '', error: 'Invalid VITE_API_BASE_URL. Use an HTTPS API URL or a same-origin path such as /api. No request was sent.' };
  if (base.startsWith('/') && !base.startsWith('//')) {
    if (/[\\?#\s]/.test(base) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(decodeURIComponentSafely(base))) return invalid;
    return { base, error: '' };
  }
  try {
    const url = new URL(base);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!['https:', 'http:'].includes(url.protocol) || (production && url.protocol !== 'https:' && !local) || url.username || url.password || url.search || url.hash || /[\\\s]/.test(base)) return invalid;
    return { base: url.href.replace(/\/+$/, ''), error: '' };
  } catch { return invalid; }
}
function decodeURIComponentSafely(value) { try { return decodeURIComponent(value); } catch { return '..'; } }
