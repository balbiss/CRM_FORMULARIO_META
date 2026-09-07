import { Router } from 'express';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { sessoesWhatsapp, imobiliarias, perfis, leads, colunasKanban, mensagensWhatsapp } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { wahaConfigurado, criarSessao, pararSessao, statusSessao, qrSessao, webhookSecret, fotoPerfil, baixarMidiaMensagem } from '../lib/waha.js';
import { uploadFile } from '../lib/storage.js';
import { distribuirLead } from '../lib/roleta.js';
import { enviarPush } from '../lib/push.js';
import type { Server as SocketServer } from 'socket.io';

const soDigitos = (s: string) => (s || '').replace(/[^0-9]/g, '');

/** 5591982935558 -> (91) 98293-5558 ; formata BR quando dá, senão devolve o número cru. */
function formatarTelefone(num: string): string {
  const d = soDigitos(num);
  const semPais = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
  const m = semPais.match(/^(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : (d || num);
}
/** telefone do lead casa com o número do WhatsApp? compara os últimos 8 dígitos (número local). */
function mesmoNumero(a: string, b: string) {
  const x = soDigitos(a), y = soDigitos(b);
  if (!x || !y) return false;
  return x.slice(-8) === y.slice(-8);
}

export function whatsappRouter(io: SocketServer) {
  const router = Router();

  // ---------------------------------------------------------------
  // WEBHOOK do WAHA — sem JWT (o WAHA chama), protegido por ?secret=
  // ---------------------------------------------------------------
  router.post('/webhook', async (req, res) => {
    if (req.query.secret !== webhookSecret()) return res.status(401).json({ error: 'segredo inválido' });
    res.json({ ok: true }); // responde rápido, processa depois

    try {
      const ev = req.body as { event?: string; session?: string; payload?: any };
      if (!ev.session) return;

      // --- session.status: mantém o status da sessão em dia (WAHA não empurra QR sempre) ---
      if (ev.event === 'session.status') {
        const st = String(ev.payload?.status || '').toUpperCase();
        const novo = st === 'WORKING' ? 'conectada' : (st === 'SCAN_QR_CODE' || st === 'STARTING') ? 'conectando' : 'desconectada';
        await db.update(sessoesWhatsapp).set({ status: novo }).where(eq(sessoesWhatsapp.sessionName, ev.session));
        if (novo === 'conectada') {
          const stf = await statusSessao(ev.session).catch(() => null);
          if (stf?.numero) await db.update(sessoesWhatsapp).set({ numero: stf.numero }).where(eq(sessoesWhatsapp.sessionName, ev.session));
          io.emit('sessao:mudou', { sessionName: ev.session, status: novo });
        }
        return;
      }

      // --- message.ack: "visto" do WhatsApp (entregue/lido) ---
      if (ev.event === 'message.ack') {
        const pa = ev.payload || {};
        const id: string | undefined = pa.id;
        const ack: number = Number(pa.ack) || 0;
        if (id && ack > 0) {
          const [row] = await db.update(mensagensWhatsapp)
            .set({ ackStatus: ack })
            .where(eq(mensagensWhatsapp.waMessageId, id))
            .returning({ id: mensagensWhatsapp.id, leadId: mensagensWhatsapp.leadId });
          if (row) {
            const [l] = await db.select({ imob: leads.imobiliariaId }).from(leads).where(eq(leads.id, row.leadId)).limit(1);
            if (l) io.to('imobiliaria:' + l.imob).emit('mensagem:ack', { id: row.id, ackStatus: ack });
          }
        }
        return;
      }

      if (ev.event !== 'message' && ev.event !== 'message.any') return;
      const p = ev.payload || {};
      const info = p._data?.Info || p._data?.info || {};
      const fromMe: boolean = !!(p.fromMe ?? info.IsFromMe);
      if (info.IsGroup || info.IsNewsletterStatus) return;

      // Endereço do contato. Rejeita grupo / canal / lista de transmissão / status.
      const enderecoRaw: string = (fromMe ? p.to : p.from) || info.Sender || info.Chat || p._data?.id?.remote || '';
      if (/@g\.us|@newsletter|@broadcast|status@broadcast/i.test(enderecoRaw)) return;

      // @lid = id interno do WhatsApp (não é telefone). Resolve pro número real:
      //  - GOWS: _data.Info.SenderAlt / RecipientAlt (@s.whatsapp.net)
      //  - WEBJS/NOWEB: _data.key.remoteJidAlt / _data.author
      let numeroRaw = enderecoRaw;
      if (/@lid$/i.test(enderecoRaw)) {
        const alt = (fromMe ? info.RecipientAlt : info.SenderAlt)
          || info.SenderAlt || info.RecipientAlt
          || p._data?.key?.remoteJidAlt || p._data?.author || '';
        if (!/@s\.whatsapp\.net|@c\.us/i.test(alt)) return;
        numeroRaw = alt;
      }
      const numero = soDigitos(numeroRaw);
      const texto: string | null = p.body || p._data?.Message?.conversation || null;
      const waId: string | undefined = p.id;
      // Número de verdade tem no máximo 13 dígitos (55 + DDD + 9 + 8). Acima disso é lixo (LID não resolvido).
      if (!numero || numero.length > 13) return;

      // WAHA re-emite histórico recente como eventos "message" ao conectar — só processa msg dos últimos 10 min.
      const tsSeg: number = Number(p.timestamp) || 0;
      if (tsSeg && Date.now() / 1000 - tsSeg > 600) return;

      const [sessao] = await db.select().from(sessoesWhatsapp).where(eq(sessoesWhatsapp.sessionName, ev.session)).limit(1);
      if (!sessao) return;

      // dedup
      if (waId) {
        const [existe] = await db.select({ id: mensagensWhatsapp.id }).from(mensagensWhatsapp).where(eq(mensagensWhatsapp.waMessageId, waId)).limit(1);
        if (existe) return;
      }

      // acha o lead pelo telefone dentro da imobiliária (do corretor, se a sessão é de um corretor)
      const escopoLeads = sessao.escopo === 'corretor' && sessao.corretorId
        ? and(eq(leads.imobiliariaId, sessao.imobiliariaId), eq(leads.corretorId, sessao.corretorId))
        : eq(leads.imobiliariaId, sessao.imobiliariaId);
      // Nome do perfil do WhatsApp (quando não veio de formulário de campanha).
      const pushName: string = (fromMe ? '' : (p.notifyName || p._data?.notifyName || info.PushName || p._data?.pushName || '')).trim();
      const nomePlaceholder = 'Contato ' + formatarTelefone(numero);

      const candidatos = await db.select().from(leads).where(escopoLeads);
      let lead = candidatos.find(l => mesmoNumero(l.telefone, numero));

      // sem lead e é mensagem RECEBIDA -> cria um lead novo na coluna "Lead Novo"
      if (!lead && !fromMe) {
        const [colNova] = await db.select().from(colunasKanban)
          .where(and(eq(colunasKanban.imobiliariaId, sessao.imobiliariaId), eq(colunasKanban.slug, 'novo'))).limit(1);
        const [novo] = await db.insert(leads).values({
          imobiliariaId: sessao.imobiliariaId,
          nome: pushName || nomePlaceholder,
          telefone: numero,
          canal: 'WhatsApp',
          colunaId: colNova?.id,
          corretorId: sessao.escopo === 'corretor' ? sessao.corretorId : null,
        }).returning();
        lead = novo;
        io.to('imobiliaria:' + sessao.imobiliariaId).emit('lead:created', novo);
        // modo central: sem corretor fixo -> roleta. modo corretor: já nasceu com o dono da sessão.
        if (!novo.corretorId) {
          const leadNovoId = novo.id, imobNovo = sessao.imobiliariaId;
          void distribuirLead(io, imobNovo, leadNovoId).catch(e => console.error('roleta wa:', (e as Error).message));
        }
      }
      if (!lead) return;

      // Lead já existia com nome-placeholder e agora temos o nome do perfil -> atualiza.
      if (pushName && lead.nome !== pushName && /^(Contato |WhatsApp )/.test(lead.nome)) {
        const [atualizado] = await db.update(leads).set({ nome: pushName }).where(eq(leads.id, lead.id)).returning();
        if (atualizado) {
          lead = atualizado;
          io.to('imobiliaria:' + sessao.imobiliariaId).emit('lead:updated', atualizado);
        }
      }

      // Foto de perfil do WhatsApp — busca uma vez (fire-and-forget) se o lead ainda não tem.
      // A URL do WhatsApp expira, então baixa e guarda no MinIO (cai de volta na URL crua se o upload falhar).
      if (!lead.fotoUrl && !fromMe) {
        const leadId = lead.id, imobId = sessao.imobiliariaId, sn = sessao.sessionName, tel = numero;
        void (async () => {
          const urlWa = await fotoPerfil(sn, tel);
          if (!urlWa) return;
          let fotoUrl = urlWa;
          try {
            const img = await fetch(urlWa);
            if (img.ok) {
              const buf = Buffer.from(await img.arrayBuffer());
              const ct = img.headers.get('content-type') || 'image/jpeg';
              fotoUrl = await uploadFile(`perfis-wa/${leadId}.jpg`, buf, ct);
            }
          } catch { /* usa a URL crua do WhatsApp */ }
          const [row] = await db.update(leads).set({ fotoUrl }).where(and(eq(leads.id, leadId), isNull(leads.fotoUrl))).returning();
          if (row) io.to('imobiliaria:' + imobId).emit('lead:updated', row);
        })().catch(() => {});
      }

      // Tipo do anexo pelo shape do GOWS (_data.Message.xxxMessage) ou pelo mimetype/type.
      const msgKeys = Object.keys(p._data?.Message || {});
      const mimeHint: string = p.media?.mimetype || info.MediaType || p.type || '';
      const anexoTipo = (p.hasMedia || msgKeys.some(k => /Message$/.test(k) && k !== 'extendedTextMessage'))
        ? (msgKeys.includes('imageMessage') || /image/i.test(mimeHint) ? 'imagem'
          : msgKeys.includes('videoMessage') || /video/i.test(mimeHint) ? 'video'
          : msgKeys.includes('audioMessage') || /audio|ptt|voice/i.test(mimeHint) ? 'audio'
          : msgKeys.includes('documentMessage') || msgKeys.includes('stickerMessage') ? 'documento'
          : /image|video|audio/i.test(mimeHint) ? (/image/i.test(mimeHint) ? 'imagem' : /video/i.test(mimeHint) ? 'video' : 'audio')
          : msgKeys.length ? 'documento' : null)
        : null;

      // SEMPRE baixa a mídia e sobe pro MinIO — a URL do WAHA (media.url) exige X-Api-Key,
      // então o navegador não consegue abrir direto (img/audio/pdf davam 401).
      let anexoUrl: string | null = null;
      let anexoNome: string | null = p.media?.filename || p._data?.Message?.documentMessage?.fileName || p._data?.Message?.documentMessage?.title || null;
      if (anexoTipo && waId) {
        const chatIdMidia = fromMe ? p.to || info.Chat : p.from || info.Chat;
        const m = await baixarMidiaMensagem(ev.session, String(chatIdMidia || ''), waId).catch(() => null);
        if (m) {
          const ext = (m.filename?.match(/\.[a-z0-9]{1,6}$/i)?.[0])
            || ({ 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'audio/ogg': '.ogg', 'audio/opus': '.ogg', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'application/pdf': '.pdf' } as Record<string, string>)[m.mimetype]
            || '.bin';
          const nomeArquivo = (anexoTipo === 'documento' && m.filename) ? m.filename : (waId.replace(/[^a-z0-9]/gi, '').slice(-24) + ext);
          anexoUrl = await uploadFile(`wa/${lead.id}/${nomeArquivo}`, m.buffer, m.mimetype).catch(() => null);
          if (!anexoNome && anexoTipo === 'documento') anexoNome = m.filename;
        }
      }

      const inseridas = await db.insert(mensagensWhatsapp).values({
        leadId: lead.id,
        direcao: fromMe ? 'out' : 'in',
        canal: 'corretor',
        waMessageId: waId ?? null,
        ackStatus: fromMe ? 2 : null,
        enviadoPor: fromMe ? (sessao.corretorId ?? null) : null,
        texto,
        anexoUrl,
        anexoTipo,
        anexoNome,
      }).onConflictDoNothing().returning(); // ON CONFLICT DO NOTHING (sem target — casa com o índice parcial)

      const msg = inseridas[0];
      if (!msg) return; // era duplicada (webhook 2x) — ignora em silêncio
      io.to('imobiliaria:' + sessao.imobiliariaId).emit('mensagem:created', msg);

      // mensagem RECEBIDA -> push pro corretor dono do lead (mesmo com o CRM fechado)
      if (!fromMe && lead.corretorId) {
        const previa = texto ? texto.slice(0, 80)
          : anexoTipo === 'imagem' ? 'Enviou uma foto'
          : anexoTipo === 'audio' ? 'Enviou um áudio'
          : anexoTipo === 'video' ? 'Enviou um vídeo'
          : anexoTipo ? 'Enviou um arquivo' : 'Nova mensagem';
        enviarPush(lead.corretorId, {
          title: lead.nome,
          body: previa,
          url: '/conversas',
          tag: 'msg-' + lead.id,
        }).catch(() => {});
      }
    } catch (e) {
      console.error('webhook WAHA:', (e as Error).message);
    }
  });

  // ---------------------------------------------------------------
  // Sessões — Dono/Gerente
  // ---------------------------------------------------------------
  router.use(requireAuth);

  router.get('/status', async (req, res) => {
    const rows = await db.select().from(sessoesWhatsapp).where(eq(sessoesWhatsapp.imobiliariaId, req.auth!.imobiliariaId));
    res.json({ wahaConfigurado: wahaConfigurado(), conectadas: rows.filter(r => r.status === 'conectada').length, total: rows.length });
  });

  router.use(requireRole('dono', 'gerente'));

  async function refrescar(sessionName: string, id: string) {
    if (!wahaConfigurado()) return;
    const st = await statusSessao(sessionName);
    await db.update(sessoesWhatsapp).set({ status: st.status, numero: st.numero }).where(eq(sessoesWhatsapp.id, id));
  }

  router.get('/sessoes', async (req, res) => {
    const rows = await db.select().from(sessoesWhatsapp).where(eq(sessoesWhatsapp.imobiliariaId, req.auth!.imobiliariaId));
    // atualiza status de cada uma no WAHA (em paralelo)
    await Promise.all(rows.map(r => refrescar(r.sessionName, r.id).catch(() => {})));
    const atualizados = await db.select().from(sessoesWhatsapp).where(eq(sessoesWhatsapp.imobiliariaId, req.auth!.imobiliariaId));
    res.json({ wahaConfigurado: wahaConfigurado(), sessoes: atualizados });
  });

  router.post('/sessoes', async (req, res) => {
    if (!wahaConfigurado()) return res.status(400).json({ error: 'WAHA não está configurado no servidor ainda (WAHA_URL / WAHA_API_KEY).' });
    const parsed = z.object({ escopo: z.enum(['central', 'corretor']), corretorId: z.string().uuid().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
    const { imobiliariaId } = req.auth!;

    if (parsed.data.escopo === 'corretor') {
      if (!parsed.data.corretorId) return res.status(400).json({ error: 'Escolha o corretor' });
      const [c] = await db.select({ id: perfis.id }).from(perfis).where(and(eq(perfis.id, parsed.data.corretorId), eq(perfis.imobiliariaId, imobiliariaId))).limit(1);
      if (!c) return res.status(404).json({ error: 'Corretor não encontrado' });
    }

    const sessionName = parsed.data.escopo === 'central'
      ? 'imob-' + imobiliariaId
      : 'cor-' + parsed.data.corretorId;

    const [ja] = await db.select().from(sessoesWhatsapp).where(eq(sessoesWhatsapp.sessionName, sessionName)).limit(1);
    let row = ja;
    if (!row) {
      [row] = await db.insert(sessoesWhatsapp).values({
        imobiliariaId, escopo: parsed.data.escopo,
        corretorId: parsed.data.escopo === 'corretor' ? parsed.data.corretorId : null,
        sessionName, status: 'conectando',
      }).returning();
    } else {
      await db.update(sessoesWhatsapp).set({ status: 'conectando' }).where(eq(sessoesWhatsapp.id, row.id));
    }

    try {
      await criarSessao(sessionName);
    } catch (e) {
      return res.status(502).json({ error: 'WAHA recusou: ' + (e as Error).message });
    }
    res.status(201).json(row);
  });

  router.get('/sessoes/:id/qr', async (req, res) => {
    const [row] = await db.select().from(sessoesWhatsapp)
      .where(and(eq(sessoesWhatsapp.id, req.params.id), eq(sessoesWhatsapp.imobiliariaId, req.auth!.imobiliariaId))).limit(1);
    if (!row) return res.status(404).json({ error: 'Sessão não encontrada' });
    await refrescar(row.sessionName, row.id).catch(() => {});
    const [atual] = await db.select().from(sessoesWhatsapp).where(eq(sessoesWhatsapp.id, row.id)).limit(1);
    const qr = atual.status === 'conectada' ? null : await qrSessao(row.sessionName).catch(() => null);
    res.json({ status: atual.status, numero: atual.numero, qr });
  });

  router.delete('/sessoes/:id', async (req, res) => {
    const [row] = await db.select().from(sessoesWhatsapp)
      .where(and(eq(sessoesWhatsapp.id, req.params.id), eq(sessoesWhatsapp.imobiliariaId, req.auth!.imobiliariaId))).limit(1);
    if (!row) return res.status(404).json({ error: 'Sessão não encontrada' });
    await pararSessao(row.sessionName).catch(() => {});
    await db.delete(sessoesWhatsapp).where(eq(sessoesWhatsapp.id, row.id));
    res.json({ ok: true });
  });

  return router;
}

/** Usado pelo mensagens.ts: manda a mensagem pelo WhatsApp certo (central ou do corretor). */
export async function despacharPeloWhatsapp(opts: {
  imobiliariaId: string;
  telefone: string;
  corretorId: string | null;
  texto?: string | null;
  anexoUrl?: string | null;
  anexoTipo?: 'imagem' | 'video' | 'documento' | 'audio' | null;
  anexoNome?: string | null;
}): Promise<{ enviado: boolean; erro?: string }> {
  if (!wahaConfigurado()) return { enviado: false, erro: 'WAHA não configurado' };
  const { enviarTexto, enviarMidia } = await import('../lib/waha.js');
  const [imob] = await db.select({ modo: imobiliarias.modoWhatsapp }).from(imobiliarias).where(eq(imobiliarias.id, opts.imobiliariaId)).limit(1);

  let sessao;
  if (imob?.modo === 'central') {
    [sessao] = await db.select().from(sessoesWhatsapp)
      .where(and(eq(sessoesWhatsapp.imobiliariaId, opts.imobiliariaId), eq(sessoesWhatsapp.escopo, 'central'), eq(sessoesWhatsapp.status, 'conectada'))).limit(1);
  } else if (opts.corretorId) {
    [sessao] = await db.select().from(sessoesWhatsapp)
      .where(and(eq(sessoesWhatsapp.corretorId, opts.corretorId), eq(sessoesWhatsapp.status, 'conectada'))).limit(1);
  }
  if (!sessao) return { enviado: false, erro: 'nenhuma sessão conectada' };

  try {
    if (opts.anexoUrl && opts.anexoTipo) await enviarMidia(sessao.sessionName, opts.telefone, opts.anexoUrl, opts.anexoTipo, opts.texto ?? undefined, opts.anexoNome ?? undefined);
    else if (opts.texto) await enviarTexto(sessao.sessionName, opts.telefone, opts.texto);
    return { enviado: true };
  } catch (e) {
    return { enviado: false, erro: (e as Error).message };
  }
}
