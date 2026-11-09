import { z } from 'zod';

const email = z.string().trim().email('Enter a valid email address.').max(254);
const password = z.string().min(8, 'Use at least 8 characters.').max(128, 'Use 128 characters or fewer.').refine(value => new TextEncoder().encode(value).length <= 72, 'Use at most 72 UTF-8 bytes for your password.');
export const phone = z.string().trim().regex(/^[+()\d\s-]{7,25}$/, 'Enter a valid phone number.').refine(value => value.replace(/\D/g, '').length >= 7, 'Enter at least 7 digits.');
export const profileSchema = z.object({ name: z.string().trim().min(2, 'Enter your full name.').max(100), email, phone: z.union([z.literal(''), phone]).default('') });

export function authSchema(mode) {
  if (mode === 'login') return z.object({ email, password: z.string().min(1, 'Enter your password.').max(128) });
  if (mode === 'forgot-password') return z.object({ email });
  if (mode === 'verify-email') return z.object({ token: z.string().trim().min(1, 'Enter the verification token from your email.').max(2048) });
  const fields = mode === 'register' ? { name: profileSchema.shape.name, email } : { token: z.string().trim().min(1, 'Enter the reset token from your email.').max(2048) };
  return z.object({ ...fields, password, confirmPassword: z.string() }).refine(values => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'Passwords must match.' });
}

export function safeDestination(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';
  const parsed = new URL(value, 'https://ijobisco.local');
  if (parsed.origin !== 'https://ijobisco.local' || !(/^\/dashboard(?:\/|$)/.test(parsed.pathname) || parsed.pathname === '/bookings/new' || parsed.pathname === '/checkout')) return '/dashboard';
  return parsed.pathname + parsed.search + parsed.hash;
}

export function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export const bookingSchema = z.object({
  contactPhone: phone.transform(value => /^\d{7}$/.test(value.replace(/[ ()-]/g, '')) ? '+220' + value.replace(/[ ()-]/g, '') : value),
  service: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Choose a cleaning service.').max(100),
  propertyType: z.union([z.literal(''), z.enum(['House', 'Apartment', 'Office', 'Other'])]).default(''),
  size: z.string().trim().refine(value => !value || (/^\d+(\.\d+)?$/.test(value) && Number(value) > 0 && Number(value) <= 1000000), 'Enter a positive size, or leave this blank.'),
  rooms: z.union([z.literal(''), z.string().regex(/^\d+$/, 'Enter the number of rooms or areas.').refine(value => Number(value) >= 1 && Number(value) <= 10000, 'Enter between 1 and 10,000 rooms or areas.')]),
  requirements: z.string().trim().max(2000, 'Use 2,000 characters or fewer.'),
  address: z.string().trim().min(5, 'Enter your address or location description.').max(500),
  town: z.string().trim().min(2, 'Enter your town or area.').max(100),
  directions: z.string().trim().max(1000),
  date: z.union([z.literal(''), z.string().refine(value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value && value >= localDate(), 'Choose today or a future preferred date.')]),
  time: z.enum(['Morning', 'Afternoon', 'Flexible'], { error: 'Choose a preferred time window.' }),
  description: z.string().trim().min(10, 'Describe the cleaning needed in at least 10 characters.').max(3000, 'Use 3,000 characters or fewer.'),
});

export const bookingStates = ['Submitted', 'Under Review', 'Awaiting Information', 'Quoted', 'Accepted', 'Awaiting Payment', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'];
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export function photoError(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Choose JPG, PNG or WebP photographs only.';
  if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) return 'Each photograph must be non-empty and no larger than 5 MB.';
  return '';
}
