import { endpoints } from './endpoints.js';

export class ApiError extends Error {
  constructor(message, status = 0, code) { super(message); this.name = 'ApiError'; this.status = status; this.code = code; }
}
const serviceErrors = Object.freeze({
  ACCOUNT_EXISTS: 'An account with this email already exists. Log in or use password recovery.',
  CONTACT_REQUIRED: 'Provide a valid contact phone number with your booking.',
  EMAIL_UNAVAILABLE: 'Email delivery is not configured. This account action requires configured SMTP; no email was sent.',
  EMAIL_DELIVERY_FAILED: 'The email service is temporarily unavailable. Your account may have been created but still needs verification. Request another verification email after email service is restored.',
  UPLOAD_UNAVAILABLE: 'Secure image storage is not configured or is unavailable. No image upload was confirmed.',
  PROVIDER_UNAVAILABLE: 'This payment provider is not operational. No payment was taken.',
  CONTACT_UNAVAILABLE: 'Contact submission requires configured SMTP and an approved business email.',
  CONFIGURATION_REQUIRED: 'The selected fulfilment method needs approved business configuration before checkout.',
  DELIVERY_UNAVAILABLE: 'Delivery is not configured for this town or area. Choose an approved area or pickup.',
  EMAIL_CHANGE_REQUIRES_VERIFICATION: 'Changing email requires a separate verification workflow. Your email was not changed.',
});
export function createApiClient({ base = '', configurationError = '', fetcher = (...args) => fetch(...args), timeout = 20000, onUnauthorized = () => {} } = {}) {
  let csrfToken;
  let csrfRequest;
  let generation = 0;
  function clear() { generation++; csrfToken = undefined; csrfRequest = undefined; }
  async function send(path, method, body, token) {
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetcher(`${base}${path}`, { method, credentials: 'include', cache: 'no-store', redirect: 'error', signal: controller.signal, headers: { Accept: 'application/json', ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}), ...(token ? { 'X-CSRF-Token': token } : {}) }, ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}) });
      if (!response.ok) {
        let code;
        if (response.headers.get('content-type')?.includes('application/json')) { try { const data = await response.json(); if (typeof data?.error?.code === 'string') code = data.error.code; } catch { code = undefined; } }
        const messages = { 401: 'Please log in to continue.', 403: 'This operation is not authorized. Refresh your session before trying again.', 409: 'This record changed. Refresh and review the latest version.', 422: 'The service rejected these details. Review the form and try again.', 429: 'Too many requests. Please wait before trying again.' };
        const loginError = response.status === 401 && path === endpoints.auth.login ? 'Login failed. Check your email, password and email verification.' : undefined;
        throw new ApiError(serviceErrors[code] || loginError || messages[response.status] || 'The service could not complete your request. Please try again.', response.status, code);
      }
      if (response.status === 204) return {};
      if (!response.headers.get('content-type')?.includes('application/json')) throw new ApiError('The service returned an unexpected response. Check the API configuration before retrying.');
      try { return await response.json(); } catch { throw new ApiError('The service returned invalid JSON. No confirmation was received.'); }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'The service timed out. Check the current record before retrying; the request may have reached the server.' : 'The service could not be reached. No confirmation was received; check the current record before retrying.');
    } finally { clearTimeout(timer); }
  }
  async function request(path, { method = 'GET', body } = {}) {
    if (configurationError) throw new ApiError(configurationError);
    if (!base) throw new ApiError('The API service is not connected yet. No information has been sent.');
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\\s]/.test(path) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(path)) throw new ApiError('Invalid API endpoint. No request was sent.');
    const current = generation;
    try {
      if (method !== 'GET' && !csrfToken) {
        if (!csrfRequest) {
          const pending = send(endpoints.auth.csrf, 'GET').then(response => {
            if (current !== generation) throw new ApiError('The session changed. No operation was sent.');
            if (typeof response.csrfToken !== 'string' || !response.csrfToken) throw new ApiError('The service did not provide a security token.');
            csrfToken = response.csrfToken;
          });
          csrfRequest = pending;
          pending.finally(() => { if (csrfRequest === pending) csrfRequest = undefined; }).catch(() => {});
        }
        await csrfRequest;
      }
      if (current !== generation) throw new ApiError('The session changed. No operation was sent.');
      const response = await send(path, method, body, method !== 'GET' ? csrfToken : undefined);
      if (current !== generation) throw new ApiError('The session changed. Check the current record before retrying.');
      return response;
    } catch (error) {
      if (current === generation && error.status === 401) { clear(); if (path !== endpoints.auth.login) onUnauthorized(); }
      else if (current === generation && error.status === 403) { csrfToken = undefined; }
      throw error;
    }
  }
  return { request, clear };
}
