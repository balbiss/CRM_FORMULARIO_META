import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { pushSubscriptions } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { pushConfigurado, vapidPublicKey } from '../lib/push.js';

export const pushRouter = Router();
pushRouter.use(requireAuth);

pushRouter.get('/vapid', (_req, res) => {
  res.json({ habilitado: pushConfigurado(), publicKey: vapidPublicKey() });
});

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

pushRouter.post('/subscribe', async (req, res) => {
  const parsed = subSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Assinatura inválida' });
  const { endpoint, keys } = parsed.data;
  await db.insert(pushSubscriptions)
    .values({ perfilId: req.auth!.sub, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { perfilId: req.auth!.sub, p256dh: keys.p256dh, auth: keys.auth } });
  res.json({ ok: true });
});

pushRouter.post('/unsubscribe', async (req, res) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
  if (endpoint) await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.perfilId, req.auth!.sub)));
  res.json({ ok: true });
});
