import { Router } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { leads, mensagensWhatsapp } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { despacharPeloWhatsapp } from './whatsapp.js';
import type { Server as SocketServer } from 'socket.io';

/** Carrega o lead e confere que quem está pedindo pode ver essa conversa: precisa ser da mesma
 * imobiliária, e se for corretor, o lead precisa ser dele (mesma régua de leads.ts). */
async function carregarLeadAutorizado(leadId: string, imobiliariaId: string, role: string, sub: string) {
  const [lead] = await db.select().from(leads).where(and(eq(leads.id, leadId), eq(leads.imobiliariaId, imobiliariaId))).limit(1);
  if (!lead) return null;
  if (role === 'corretor' && lead.corretorId !== sub) return undefined;
  return lead;
}

export function mensagensRouter(io: SocketServer) {
  const router = Router();
  router.use(requireAuth);

  // Lista só os leads que JÁ tiveram alguma mensagem de verdade — evita a tela de Conversas
  // ter que lidar com todo mundo da base (com 10k+ leads reais, isso ficava enorme e inútil,
  // já que a maioria nunca trocou mensagem nenhuma pelo CRM ainda).
  router.get('/', async (req, res) => {
    const { imobiliariaId, role, sub } = req.auth!;
    const scoped = role === 'corretor'
      ? and(eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : eq(leads.imobiliariaId, imobiliariaId);

    const rows = await db.select({
      leadId: mensagensWhatsapp.leadId,
      texto: mensagensWhatsapp.texto,
      anexoTipo: mensagensWhatsapp.anexoTipo,
      direcao: mensagensWhatsapp.direcao,
      enviadoEm: mensagensWhatsapp.enviadoEm,
    })
      .from(mensagensWhatsapp)
      .innerJoin(leads, eq(leads.id, mensagensWhatsapp.leadId))
      .where(scoped)
      .orderBy(desc(mensagensWhatsapp.enviadoEm));

    const ultimaPorLead = new Map<string, typeof rows[number]>();
    for (const row of rows) if (!ultimaPorLead.has(row.leadId)) ultimaPorLead.set(row.leadId, row);

    // não lidas (recebidas e ainda não vistas) por lead
    const naoLidas = await db.select({ leadId: mensagensWhatsapp.leadId, n: sql<number>`count(*)::int` })
      .from(mensagensWhatsapp)
      .innerJoin(leads, eq(leads.id, mensagensWhatsapp.leadId))
      .where(and(scoped, eq(mensagensWhatsapp.direcao, 'in'), eq(mensagensWhatsapp.lida, false)))
      .groupBy(mensagensWhatsapp.leadId);
    const nlMap = new Map(naoLidas.map(r => [r.leadId, r.n]));

    res.json([...ultimaPorLead.values()].map(r => ({ ...r, naoLidas: nlMap.get(r.leadId) ?? 0 })));
  });

  router.get('/:leadId', async (req, res) => {
    const { imobiliariaId, role, sub } = req.auth!;
    const lead = await carregarLeadAutorizado(req.params.leadId, imobiliariaId, role, sub);
    if (lead === null) return res.status(404).json({ error: 'Lead não encontrado' });
    if (lead === undefined) return res.status(403).json({ error: 'Sem permissão para ver esta conversa' });
    const rows = await db.select().from(mensagensWhatsapp)
      .where(eq(mensagensWhatsapp.leadId, req.params.leadId))
      .orderBy(asc(mensagensWhatsapp.enviadoEm));

    // abrir a conversa marca as recebidas como lidas
    await db.update(mensagensWhatsapp)
      .set({ lida: true })
      .where(and(eq(mensagensWhatsapp.leadId, req.params.leadId), eq(mensagensWhatsapp.direcao, 'in'), eq(mensagensWhatsapp.lida, false)));
    io.to('imobiliaria:' + imobiliariaId).emit('conversa:lida', { leadId: req.params.leadId });

    res.json(rows);
  });

  const bodySchema = z.object({
    texto: z.string().min(1).optional(),
    anexoUrl: z.string().min(1).optional(),
    anexoTipo: z.enum(['imagem', 'video', 'documento', 'audio']).optional(),
    anexoNome: z.string().optional(),
  }).refine(b => !!b.texto || !!b.anexoUrl, { message: 'Mensagem precisa ter texto ou anexo' });

  router.post('/:leadId', async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });
    const { imobiliariaId, role, sub } = req.auth!;
    const lead = await carregarLeadAutorizado(req.params.leadId, imobiliariaId, role, sub);
    if (lead === null) return res.status(404).json({ error: 'Lead não encontrado' });
    if (lead === undefined) return res.status(403).json({ error: 'Sem permissão para enviar nesta conversa' });

    const [row] = await db.insert(mensagensWhatsapp).values({
      leadId: req.params.leadId, direcao: 'out', canal: 'corretor', enviadoPor: sub, ackStatus: 1,
      texto: parsed.data.texto ?? null,
      anexoUrl: parsed.data.anexoUrl ?? null,
      anexoTipo: parsed.data.anexoTipo ?? null,
      anexoNome: parsed.data.anexoNome ?? null,
    }).returning();

    io.to('imobiliaria:' + imobiliariaId).emit('mensagem:created', row);
    res.status(201).json(row);

    // dispara pelo WhatsApp (central ou do corretor) sem travar a resposta;
    // se não houver sessão conectada, a mensagem fica só no histórico do CRM.
    despacharPeloWhatsapp({
      imobiliariaId, telefone: lead.telefone, corretorId: lead.corretorId, sessaoWhatsappId: lead.sessaoWhatsappId,
      texto: parsed.data.texto, anexoUrl: parsed.data.anexoUrl, anexoTipo: parsed.data.anexoTipo, anexoNome: parsed.data.anexoNome,
    })
      .then(r => { if (!r.enviado && r.erro && r.erro !== 'WAHA não configurado' && r.erro !== 'nenhuma sessão conectada') console.warn('WhatsApp não enviou:', r.erro); })
      .catch(() => {});
  });

  return router;
}
