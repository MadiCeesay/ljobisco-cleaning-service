import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { text, settings } from './domain.js';
import { assert } from './errors.js';
export function contactRoutes(email) {
  const router = Router();
  router.get('/business', async (_request, response) => { const { values } = await settings(); response.json({ companyName: values.companyName, tagline: values.tagline, email: values.email, phone: values.phone, whatsappNumber: values.whatsappNumber || '+2205393273', address: values.address, serviceAreas: values.serviceAreas }); });
  router.post('/contact', rateLimit({ windowMs: 15 * 60000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }), async (request, response) => {
    const values = z.object({ name: text(2, 100), email: z.string().email().max(254), phone: z.string().regex(/^[+\d ()-]{7,25}$/), subject: text(3, 150), message: text(10, 3000) }).strict().parse(request.body);
    const { values: business } = await settings();
    assert(email.available && email.contact && business.email, 503, 'CONTACT_UNAVAILABLE', 'Contact submission requires SMTP and an approved business email.');
    await email.contact(business.email, values); response.status(202).json({ accepted: true, delivered: false, message: 'The email service accepted your message for delivery. Inbox delivery is not confirmed.' });
  });
  return router;
}
