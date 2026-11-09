import { resolveApiConfiguration } from './config.js';
import { createApiClient } from './httpClient.js';
import { createAxiosTransport } from './axiosTransport.js';

const configuration = resolveApiConfiguration(import.meta.env.VITE_API_BASE_URL, import.meta.env.PROD);
const listeners = new Set();
const client = createApiClient({ base: configuration.base, configurationError: configuration.error, fetcher: createAxiosTransport(), onUnauthorized: () => listeners.forEach(listener => listener()) });
export const apiConfigured = Boolean(configuration.base);
export const apiRequest = client.request;
export const clearApiSession = client.clear;
export function onSessionExpired(listener) { listeners.add(listener); return () => listeners.delete(listener); }
