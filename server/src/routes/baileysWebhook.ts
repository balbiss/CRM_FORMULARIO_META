import { Router } from 'express';
import { webhookVerifyToken } from '../lib/baileysApi.js';

/** Estado da última conexão — em memória mesmo (é uma sessão única, de um número só, sem
 *  necessidade de persistir em banco; se o processo reiniciar, o próprio baileys-api reemite
 *  o evento de status ao reconectar). */
let ultimoEvento: { tipo: string; qr?: string | null; connected?: boolean; recebidoEm: string } | null = null;

export const getUltimoEventoBaileys = () => ultimoEvento;

export function baileysWebhookRouter() {
  const router = Router();

  // Sem JWT — é o baileys-api chamando. Autentica pelo token na query (mesmo padrão do
  // webhook do WAHA, ver whatsapp.ts).
  router.post('/webhook', (req, res) => {
    if (req.query.token !== webhookVerifyToken()) return res.status(401).json({ error: 'token inválido' });
    const body = req.body as Record<string, unknown>;
    ultimoEvento = {
      tipo: String(body?.event ?? body?.type ?? 'desconhecido'),
      qr: (body?.qr as string | undefined) ?? (body?.qrCode as string | undefined) ?? null,
      connected: typeof body?.connected === 'boolean' ? body.connected as boolean : undefined,
      recebidoEm: new Date().toISOString(),
    };
    console.log('baileys webhook:', ultimoEvento.tipo, ultimoEvento.connected ?? '');
    res.json({ ok: true });
  });

  // Só pra eu (via curl/administração) conseguir ver o QR/status mais recente sem precisar
  // de UI nova — protegido pelo mesmo secret do webhook, passado por query.
  router.get('/status', (req, res) => {
    if (req.query.token !== webhookVerifyToken()) return res.status(401).json({ error: 'token inválido' });
    res.json(ultimoEvento ?? { tipo: 'nenhum evento recebido ainda' });
  });

  return router;
}
