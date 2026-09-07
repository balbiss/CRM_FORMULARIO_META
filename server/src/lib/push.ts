import webpush from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { pushSubscriptions } from '../db/schema.js';

let configurado = false;
function garantirConfig(): boolean {
  if (configurado) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:suporte@visitaia.com.br', pub, priv);
  configurado = true;
  return true;
}

export const pushConfigurado = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || '';

/** Manda uma notificação Web Push pra todos os dispositivos do corretor. */
export async function enviarPush(perfilId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!garantirConfig()) return;
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.perfilId, perfilId));
  if (!subs.length) return;

  const data = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || '/', tag: payload.tag || 'crm' });
  const mortas: string[] = [];
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data);
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) mortas.push(s.endpoint);
    }
  }));
  if (mortas.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, mortas)).catch(() => {});
}
