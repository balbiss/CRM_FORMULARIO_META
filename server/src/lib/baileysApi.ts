/** Cliente do baileys-api (fazer-ai) — usado SÓ pelo aviso automático de lead pro WhatsApp
 *  pessoal do corretor (ver roleta.ts). O resto do CRM continua no WAHA; isso é um serviço
 *  à parte porque o WAHA (engine GOWS) falha de forma consistente pra mensagem "a frio"
 *  (iniciada pelo sistema, sem o destinatário ter mandado nada antes) — ver histórico da
 *  investigação. Fica dormente até BAILEYS_URL + BAILEYS_API_KEY estarem no .env. */
const base = () => (process.env.BAILEYS_URL || '').replace(/\/$/, '');
const key = () => process.env.BAILEYS_API_KEY || '';
const publicUrl = () => (process.env.PUBLIC_URL || '').replace(/\/$/, '');
export const webhookVerifyToken = () => process.env.BAILEYS_WEBHOOK_VERIFY_TOKEN || 'sem-segredo-baileys';

export const baileysConfigurado = () => !!(base() && key());

type Opts = { method?: string; body?: unknown };
async function chamar<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  if (!baileysConfigurado()) throw new Error('Baileys não configurado (defina BAILEYS_URL e BAILEYS_API_KEY)');
  const r = await fetch(base() + path, {
    method: opts.method ?? 'GET',
    headers: { 'x-api-key': key(), 'Content-Type': 'application/json' },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const txt = await r.text();
  let json: unknown = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { /* resposta não-json */ }
  if (!r.ok) throw new Error(`baileys-api ${path} -> ${r.status} ${txt.slice(0, 300)}`);
  return json as T;
}

const numeroLimpo = (n: string) => n.replace(/[^0-9]/g, '');
/** O número CENTRAL usado pra conectar essa sessão — o mesmo já conectado no WAHA, como
 *  um 2º aparelho ligado na mesma conta (decisão do dono). */
export const numeroConexao = () => process.env.BAILEYS_PHONE_NUMBER || '';

/** Inicia (ou reconecta) a sessão — o QR/status chegam pelo webhook, não nessa resposta. */
export async function criarConexao() {
  const phone = numeroConexao();
  return chamar(`/connections/${encodeURIComponent(phone)}`, {
    method: 'POST',
    body: {
      webhookUrl: `${publicUrl()}/api/baileys/webhook?token=${encodeURIComponent(webhookVerifyToken())}`,
      webhookVerifyToken: webhookVerifyToken(),
      clientName: 'Visita IA CRM',
      groupsEnabled: false,
    },
  });
}

export async function statusConexao(): Promise<{ connected: boolean } | null> {
  try {
    return await chamar(`/connections/${encodeURIComponent(numeroConexao())}/health`);
  } catch {
    return null;
  }
}

/** Manda texto puro pro número do corretor (JID no formato <numero>@s.whatsapp.net). */
export async function enviarTexto(numeroDestino: string, texto: string) {
  const jid = numeroLimpo(numeroDestino) + '@s.whatsapp.net';
  return chamar(`/connections/${encodeURIComponent(numeroConexao())}/send-message`, {
    method: 'POST',
    body: { jid, messageContent: { text: texto } },
  });
}
