import { Router } from 'express';
import { webhookVerifyToken } from '../lib/baileysApi.js';

/** Estado da última conexão — em memória mesmo (é uma sessão única, de um número só, sem
 *  necessidade de persistir em banco; se o processo reiniciar, o próprio baileys-api reemite
 *  o evento de status ao reconectar). */
let ultimoEvento: { tipo: string; qr?: string | null; connected?: boolean; recebidoEm: string; bruto?: unknown } | null = null;

export const getUltimoEventoBaileys = () => ultimoEvento;

export function baileysWebhookRouter() {
  const router = Router();

  // Sem JWT — é o baileys-api chamando. Autentica pelo token na query (mesmo padrão do
  // webhook do WAHA, ver whatsapp.ts).
  router.post('/webhook', (req, res) => {
    if (req.query.token !== webhookVerifyToken()) return res.status(401).json({ error: 'token inválido' });
    const body = req.body as { event?: string; data?: { qrDataUrl?: string; connection?: string } };
    ultimoEvento = {
      tipo: String(body?.event ?? 'desconhecido'),
      qr: body?.data?.qrDataUrl ?? null,
      connected: body?.data?.connection === 'open' ? true : body?.data?.connection ? false : undefined,
      recebidoEm: new Date().toISOString(),
    };
    console.log('baileys webhook:', ultimoEvento.tipo, body?.data?.connection ?? '');
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
