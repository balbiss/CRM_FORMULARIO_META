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

// message.any cobre recebidas E enviadas (uma vez cada — registrar 'message' junto
// duplica). message.ack traz o "visto" (entregue/lido). session.status mantém o status.
const EVENTOS = ['message.any', 'message.ack', 'session.status'];

function webhookConfig() {
  const url = publicUrl() ? `${publicUrl()}/api/whatsapp/webhook?secret=${encodeURIComponent(webhookSecret())}` : undefined;
  return url ? { webhooks: [{ url, events: EVENTOS }] } : {};
}

// Engine do WhatsApp. GOWS (Go/whatsmeow, sem browser) é o recomendado — o WEBJS
// (Chromium) quebra quando a versão do WhatsApp Web muda e para de receber mensagens.
// Ignorado se a instância do WAHA não permitir engine por sessão (aí vale o default dela).
const ENGINE = process.env.WAHA_ENGINE || 'GOWS';

/** Cria (ou recria) a sessão no WAHA já com o webhook apontando pro nosso backend.
 *  Se a sessão já existe, ATUALIZA a config do webhook (corrige webhook quebrado) e reinicia. */
export async function criarSessao(sessionName: string) {
  const config = webhookConfig();
  await waha('/api/sessions', {
    method: 'POST',
    body: { name: sessionName, start: true, config, engine: ENGINE },
  }).catch(async e => {
    if (String(e).includes('422') || String(e).includes('already') || String(e).includes('exist')) {
      // já existe -> reescreve a config do webhook e reinicia pra aplicar
      await waha(`/api/sessions/${sessionName}`, { method: 'PUT', body: { config } }).catch(() => {});
      await waha(`/api/sessions/${sessionName}/restart`, { method: 'POST' })
        .catch(() => waha(`/api/sessions/${sessionName}/start`, { method: 'POST' }).catch(() => {}));
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
  // format=image → { mimetype, data } com o PNG em base64 (raw devolve só a string do QR, não renderiza).
  try {
    const r = await waha<{ mimetype?: string; data?: string }>(`/api/${sessionName}/auth/qr?format=image`);
    if (r?.data) return r.data.startsWith('data:') ? r.data : `data:${r.mimetype || 'image/png'};base64,${r.data}`;
  } catch { /* tenta o binário abaixo */ }
  // Fallback: endpoint devolve o PNG binário direto.
  try {
    const res = await fetch(base() + `/api/${sessionName}/auth/qr`, { headers: { 'X-Api-Key': key(), Accept: 'image/png' } });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || 'image/png';
    if (ct.includes('json')) {
      const jj = await res.json() as { mimetype?: string; data?: string };
      return jj.data ? `data:${jj.mimetype || 'image/png'};base64,${jj.data}` : null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

const chatId = (numero: string) => numero.replace(/[^0-9]/g, '') + '@c.us';

/** URL da foto de perfil do contato no WhatsApp (null se não tiver / for privada). */
export async function fotoPerfil(sessionName: string, numero: string): Promise<string | null> {
  try {
    const r = await waha<{ profilePictureURL?: string; url?: string }>(
      `/api/contacts/profile-picture?contactId=${encodeURIComponent(chatId(numero))}&session=${encodeURIComponent(sessionName)}`,
    );
    return r?.profilePictureURL || r?.url || null;
  } catch {
    return null;
  }
}

export async function enviarTexto(sessionName: string, numero: string, texto: string) {
  return waha('/api/sendText', { method: 'POST', body: { session: sessionName, chatId: chatId(numero), text: texto } });
}

/** Baixa a mídia de uma mensagem recebida: pede pro WAHA baixar (downloadMedia=true) e puxa
 *  o arquivo do storage local do WAHA (que exige a X-Api-Key). */
export async function baixarMidiaMensagem(sessionName: string, chatId: string, msgId: string): Promise<{ buffer: Buffer; mimetype: string; filename: string | null } | null> {
  try {
    const msg = await waha<{ media?: { url?: string | null; mimetype?: string; filename?: string } }>(
      `/api/${sessionName}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(msgId)}?downloadMedia=true`,
    );
    const url = msg?.media?.url;
    if (!url) return null;
    const r = await fetch(url, { headers: { 'X-Api-Key': key() } });
    if (!r.ok) return null;
    return {
      buffer: Buffer.from(await r.arrayBuffer()),
      mimetype: (msg.media?.mimetype || r.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim(),
      filename: msg.media?.filename || null,
    };
  } catch {
    return null;
  }
}

export async function enviarMidia(sessionName: string, numero: string, url: string, tipo: 'imagem' | 'video' | 'documento' | 'audio', legenda?: string) {
  const endpoint = tipo === 'imagem' ? '/api/sendImage' : tipo === 'video' ? '/api/sendVideo' : tipo === 'audio' ? '/api/sendVoice' : '/api/sendFile';
  return waha(endpoint, { method: 'POST', body: { session: sessionName, chatId: chatId(numero), file: { url }, caption: legenda } });
}
