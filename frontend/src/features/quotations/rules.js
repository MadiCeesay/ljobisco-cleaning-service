import { z } from 'zod';

export const quotationStatuses = ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired', 'Superseded'];

export function latestQuote(quotes, bookingId) {
  return quotes.filter(quote => quote.bookingId === bookingId && quote.status !== 'Draft').reduce((latest, quote) => !latest || quote.version > latest.version ? quote : latest, null);
}

export function displayStatus(quote, now = Date.now()) {
  if (!quotationStatuses.includes(quote.status)) return 'Unavailable';
  return quote.status === 'Sent' && quote.expiresAt && Date.parse(quote.expiresAt) <= now ? 'Expired' : quote.status;
}

export function canRespond(quote, quotes, actor, now = Date.now()) {
  return Boolean(quote && actor?.role === 'CUSTOMER' && actor.id === quote.customerId && latestQuote(quotes, quote.bookingId)?.id === quote.id && quote.status === 'Sent' && Number.isFinite(Date.parse(quote.issuedAt)) && Date.parse(quote.issuedAt) <= now && (!quote.expiresAt || Date.parse(quote.expiresAt) > now));
}

export function canSelectPayment(quote, quotes, actor) {
  return Boolean(quote && actor?.role === 'CUSTOMER' && actor.id === quote.customerId && latestQuote(quotes, quote.bookingId)?.id === quote.id && quote.status === 'Accepted' && Number.isFinite(Date.parse(quote.acceptedAt)) && Date.parse(quote.acceptedAt) >= Date.parse(quote.issuedAt) && (!quote.expiresAt || Date.parse(quote.acceptedAt) < Date.parse(quote.expiresAt)));
}

const decimal = /^\d+(\.\d{1,2})?$/;
export const quotationEditorSchema = z.object({
  bookingId: z.string().min(1, 'Select an eligible booking.'),
  items: z.array(z.object({ description: z.string().trim().min(3, 'Use at least 3 characters.').max(300), quantity: z.string().refine(value => decimal.test(value) && Number(value) > 0 && Number(value) <= 10000, 'Enter a quantity above 0 and no greater than 10,000 (up to 2 decimal places).'), unitPrice: z.string().refine(value => decimal.test(value) && Number(value) <= 1000000, 'Enter a non-negative price up to 1,000,000 with at most 2 decimal places.') })).min(1, 'Add at least one line item.').max(20, 'Use no more than 20 line items.'),
  notes: z.string().trim().max(2000),
  expiresAt: z.string().refine(value => Number.isFinite(Date.parse(value)) && Date.parse(value) > Date.now(), 'Choose a future expiry date and time.'),
});

export function previewAmounts(items) {
  const lines = items.map(item => {
    if (!decimal.test(String(item.quantity)) || !decimal.test(String(item.unitPrice))) return NaN;
    return Math.round(Math.round(Number(item.quantity) * 100) * Math.round(Number(item.unitPrice) * 100) / 100);
  });
  return { lines: lines.map(value => value / 100), total: lines.reduce((total, value) => total + value, 0) / 100 };
}
