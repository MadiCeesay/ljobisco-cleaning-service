import { z } from 'zod';

const sessionUserSchema = z.object({ id: z.string().min(1), role: z.enum(['CUSTOMER', 'ADMIN']), name: z.string().min(1), email: z.email(), phone: z.string().optional(), emailVerified: z.boolean().optional() });
export function sessionUser(value, requiredRole) {
  const parsed = sessionUserSchema.safeParse(value);
  if (!parsed.success || (requiredRole && parsed.data.role !== requiredRole)) throw new Error('The service did not return the required account session.');
  return parsed.data;
}
export function profileUser(value, current) {
  const next = sessionUser(value, current?.role);
  if (!current || next.id !== current.id || next.role !== current.role) throw new Error('The profile response did not match your account. Refresh your session.');
  return next;
}
