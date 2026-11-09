export const BUSINESS_WHATSAPP = '+2205393273';

export function internationalPhone(value) {
  if (typeof value !== 'string' || value.length > 40) return '';
  const number = value.trim().replace(/[ ()-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : '';
}

export function whatsappLink(number, { bookingReference, quotationVersion, administrator = false } = {}) {
  const phone = internationalPhone(number);
  if (!phone) return '';
  if (bookingReference !== undefined && !/^(?:BKG-[a-zA-Z0-9-]{1,80}|[a-f0-9]{24}|demo-[a-zA-Z0-9-]{1,80})$/.test(bookingReference)) return '';
  if (quotationVersion !== undefined && (!Number.isSafeInteger(quotationVersion) || quotationVersion < 1)) return '';
  let text = administrator ? 'Hello, this is Ijobisco Cleaning Services.' : 'Hello Ijobisco, I would like help with a cleaning enquiry.';
  if (bookingReference) text += ` Regarding booking ${bookingReference}${quotationVersion ? `, quotation version ${quotationVersion}` : ''}.`;
  text += ' Official quotations, acceptance and payments remain in the Ijobisco account.';
  return `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(text)}`;
}

export function customerContactAllowed(customer, booking) {
  return Boolean(booking && customer?.status === 'Active' && typeof customer.id === 'string' && customer.id === booking.customerId && ['Submitted', 'Under Review', 'Awaiting Information', 'Quoted', 'Accepted', 'Awaiting Payment', 'Scheduled', 'In Progress'].includes(booking.status) && internationalPhone(booking.contactPhone || customer.phone));
}
