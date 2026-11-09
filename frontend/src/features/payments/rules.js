import { z } from 'zod';

export const paymentStates = ['Pending', 'Processing', 'Partially Paid', 'Paid', 'Failed', 'Refunded'];
export function depositSetting(value) {
  const percent = Number(value);
  return value !== '' && value != null && Number.isFinite(percent) && percent > 0 && percent <= 100 ? percent : 30;
}
export function paymentPreview(total, percentage = 30, paid = 0) {
  if (![total, paid].every(Number.isFinite) || total <= 0 || paid < 0 || paid > total) throw new Error('Invalid payment summary.');
  const totalMinor = Math.round(total * 100);
  const depositMinor = Math.round(totalMinor * depositSetting(percentage) / 100);
  return { total: totalMinor / 100, percentage: depositSetting(percentage), deposit: depositMinor / 100, remaining: (totalMinor - depositMinor) / 100, paid, outstanding: Math.max(0, totalMinor - Math.round(paid * 100)) / 100 };
}
export function payableAmount(summary, choice, completed) {
  if (!['deposit', 'full', 'balance'].includes(choice) || (summary.paid === 0 && choice === 'balance')) return 0;
  if (summary.paid === 0) return choice === 'deposit' ? summary.deposit : summary.total;
  return completed ? summary.outstanding : 0;
}
export const checkoutSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.email('Enter a valid email address.'),
  phone: z.string().trim().regex(/^[+\d ()-]{7,25}$/, 'Enter a valid phone number.').refine(value => value.replace(/\D/g, '').length >= 7, 'Enter at least 7 digits.'),
  fulfilment: z.enum(['delivery', 'pickup']),
  address: z.string().trim().max(500),
  town: z.string().trim().max(120),
}).superRefine((values, context) => {
  if (values.fulfilment === 'delivery') {
    if (values.address.length < 5) context.addIssue({ code: 'custom', path: ['address'], message: 'Enter a delivery address.' });
    if (values.town.length < 2) context.addIssue({ code: 'custom', path: ['town'], message: 'Enter your town or area.' });
  }
});
