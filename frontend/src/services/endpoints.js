const identifier = value => encodeURIComponent(String(value));
export const approveBookingEndpoint = id => `/admin/bookings/${identifier(id)}/approve`;
export const endpoints = Object.freeze({
  auth: { csrf: '/auth/csrf', session: '/auth/session', login: '/auth/login', logout: '/auth/logout', register: '/auth/register', 'forgot-password': '/auth/forgot-password', 'reset-password': '/auth/reset-password', 'verify-email': '/auth/verify-email' },
  customer: { overview: '/customer/overview', profile: '/customer/profile', quotations: '/customer/quotations/workspace', commerce: '/customer/payments-and-orders' },
  services: { list: '/services', detail: slug => `/services/${identifier(slug)}` },
  products: { list: '/products', detail: slug => `/products/${identifier(slug)}` },
  bookings: { create: '/bookings', detail: id => `/bookings/${identifier(id)}`, uploadSign: '/uploads/sign' },
  quotations: { respond: id => `/quotations/${identifier(id)}/response` },
  orders: { create: '/orders', detail: id => `/orders/${identifier(id)}` },
  payments: { cleaningIntent: '/payments/cleaning/intents', orderIntent: '/payments/orders/intents', status: id => `/payments/${identifier(id)}` },
  contact: '/contact',
  admin: { workspace: '/admin/workspace', quotations: '/admin/quotations', quotationWorkspace: '/admin/quotations/workspace', settings: '/admin/settings', catalog: (kind, id) => `/admin/${kind}${id ? `/${identifier(id)}` : ''}`, information: id => `/admin/bookings/${identifier(id)}/information-requests`, schedule: id => `/admin/bookings/${identifier(id)}/schedule`, fulfilment: id => `/admin/orders/${identifier(id)}/fulfilment` },
});
