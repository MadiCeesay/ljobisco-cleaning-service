export function createAxiosTransport(client) {
  let pending = client ? Promise.resolve(client) : undefined;
  return async (url, options) => {
    pending ||= import('axios').then(({ default: axios }) => axios.create({ adapter: 'fetch', withCredentials: true, withXSRFToken: false, responseType: 'text', transformResponse: [value => value], validateStatus: () => true, fetchOptions: { cache: 'no-store', redirect: 'error' }, maxRedirects: 0 }));
    const response = await (await pending).request({ url, method: options.method, data: options.body, headers: options.headers, signal: options.signal });
    return { ok: response.status >= 200 && response.status < 300, status: response.status, headers: { get: name => response.headers.get(name) || null }, json: async () => JSON.parse(response.data) };
  };
}
