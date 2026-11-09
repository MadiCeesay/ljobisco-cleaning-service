import { Router } from 'express';
import { authentication, authRoutes, mailer } from './auth.js';
import { contactRoutes } from './contact.js';
import { cleaningRoutes } from './cleaning.js';
import { uploadRoutes, cloudinaryMedia } from './uploads.js';
import { commerceRoutes, commerceAccount } from './commerce.js';
import { adminRoutes } from './admin.js';
export function createRoutes(config, dependencies = {}) {
  const auth = authentication(config);
  const router = Router();
  router.use(auth.sessionMiddleware, auth.csrf);
  router.use(authRoutes(config, auth, dependencies.email));
  router.use(contactRoutes(dependencies.email || mailer(config)));
  router.use(uploadRoutes(auth, dependencies.media || cloudinaryMedia(config)));
  router.all(['/conversations', '/conversations/*path'], auth.requireUser, (_request, response) => response.status(410).json({ error: { code: 'CHAT_RETIRED', message: 'In-app chat has been replaced by WhatsApp. Formal quotations remain in Ijobisco.' } }));
  router.use(commerceRoutes(auth, config, dependencies.providers));
  router.use(cleaningRoutes(auth, { ...dependencies, commerce: user => commerceAccount(user, config) }));
  router.use(adminRoutes(auth, config));
  return { router, auth };
}
