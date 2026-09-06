/** Cliente do WAHA (WhatsApp HTTP API). Fica dormente até WAHA_URL + WAHA_API_KEY
 *  estarem no .env — aí a tela de Integrações passa a conectar números de verdade. */
const base = () => (process.env.WAHA_URL || '').replace(/\/$/, '');
const key = () => process.env.WAHA_API_KEY || '';
/** URL pública do NOSSO backend, pro WAHA chamar o webhook de mensagens recebidas. */
const publicUrl = () => (process.env.PUBLIC_URL || '').replace(/\/$/, '');
export const webhookSecret = () => process.env.WAHA_WEBHOOK_SECRET || process.env.CAPTACAO_SECRET || 'sem-segredo';

export const wahaConfigurado = () => !!(base() && key());

type WahaOpts = { method?: string; body?: unknown };
async function waha<T = unknown>(path: string, opts: WahaOpts = {}): Promise<T> {
  if (!wahaConfigurado()) throw new Error('WAHA não configurado (defina WAHA_URL e WAHA_API_KEY no server/.env)');
  const r = await fetch(base() + path, {
    method: opts.method ?? 'GET',
    headers: { 'X-Api-Key': key(), 'Content-Type': 'application/json' },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const txt = await r.text();
  let json: unknown = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { /* resposta não-json */ }
  if (!r.ok) throw new Error(`WAHA ${path} -> ${r.status} ${txt.slice(0, 200)}`);
  return json as T;
}

// message.any cobre recebidas E enviadas (inclusive as que saem pelo celular do corretor);
// session.status mantém o status/numero em dia sem polling.
const EVENTOS = ['message.any', 'session.status'];

/** Cria (ou recria) a sessão no WAHA já com o webhook apontando pro nosso backend. */
export async function criarSessao(sessionName: string) {
  const webhookUrl = publicUrl() ? `${publicUrl()}/api/whatsapp/webhook?secret=${encodeURIComponent(webhookSecret())}` : undefined;
  await waha('/api/sessions', {
    method: 'POST',
    body: {
      name: sessionName,
      start: true,
      config: webhookUrl ? { webhooks: [{ url: webhookUrl, events: EVENTOS }] } : {},
    },
  }).catch(async e => {
    // já existe -> só (re)inicia
    if (String(e).includes('422') || String(e).includes('already')) {
      await waha(`/api/sessions/${sessionName}/start`, { method: 'POST' }).catch(() => {});
    } else { throw e; }
  });
}

export async function pararSessao(sessionName: string) {
  await waha(`/api/sessions/${sessionName}/stop`, { method: 'POST' }).catch(() => {});
  await waha(`/api/sessions/${sessionName}`, { method: 'DELETE' }).catch(() => {});
}

type WahaSession = { name: string; status: string; me?: { id?: string; pushName?: string } };
/** Devolve o status normalizado + o número, se conectado. */
export async function statusSessao(sessionName: string): Promise<{ status: 'desconectada' | 'conectando' | 'conectada'; numero: string | null }> {
  try {
    const s = await waha<WahaSession>(`/api/sessions/${sessionName}`);
    const st = (s.status || '').toUpperCase();
    if (st === 'WORKING') return { status: 'conectada', numero: (s.me?.id || '').replace(/@c\.us$/, '').replace(/[^0-9]/g, '') || null };
    if (st === 'SCAN_QR_CODE' || st === 'STARTING') return { status: 'conectando', numero: null };
    return { status: 'desconectada', numero: null };
  } catch {
    return { status: 'desconectada', numero: null };
  }
}

/** QR code em data-URL (base64 png) pra exibir na tela. */
export async function qrSessao(sessionName: string): Promise<string | null> {
  try {
    const r = await waha<{ mimetype?: string; data?: string; value?: string }>(`/api/${sessionName}/auth/qr?format=raw`);
    const b64 = r.data || r.value;
    if (!b64) return null;
    return b64.startsWith('data:') ? b64 : `data:${r.mimetype || 'image/png'};base64,${b64}`;
  } catch {
    return null;
  }
}

const chatId = (numero: string) => numero.replace(/[^0-9]/g, '') + '@c.us';

export async function enviarTexto(sessionName: string, numero: string, texto: string) {
  return waha('/api/sendText', { method: 'POST', body: { session: sessionName, chatId: chatId(numero), text: texto } });
}

export async function enviarMidia(sessionName: string, numero: string, url: string, tipo: 'imagem' | 'video' | 'documento' | 'audio', legenda?: string) {
  const endpoint = tipo === 'imagem' ? '/api/sendImage' : tipo === 'video' ? '/api/sendVideo' : tipo === 'audio' ? '/api/sendVoice' : '/api/sendFile';
  return waha(endpoint, { method: 'POST', body: { session: sessionName, chatId: chatId(numero), file: { url }, caption: legenda } });
}
