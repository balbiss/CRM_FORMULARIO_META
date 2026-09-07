import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { leads, leadTags, mensagensWhatsapp, filasAtendimento, colunasKanban, eventosLead, perfis } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { distribuirLead } from '../lib/roleta.js';
import { registrarEvento } from '../lib/eventos.js';
import { desc } from 'drizzle-orm';
import type { Server as SocketServer } from 'socket.io';

export function leadsRouter(io: SocketServer) {
  const router = Router();
  router.use(requireAuth);

  // Corretor only ever sees their own leads; dono/gerente see everyone's in the imobiliária.
  router.get('/', async (req, res) => {
    const { imobiliariaId, role, sub } = req.auth!;
    const scoped = role === 'corretor'
      ? and(eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : eq(leads.imobiliariaId, imobiliariaId);
    const rows = await db.select().from(leads).where(scoped);
    // etiquetas de cada lead (mesmo escopo — join por lead_id)
    const vinculos = await db.select({ leadId: leadTags.leadId, tagId: leadTags.tagId })
      .from(leadTags).innerJoin(leads, eq(leadTags.leadId, leads.id)).where(scoped);
    const porLead = new Map<string, string[]>();
    for (const v of vinculos) {
      const arr = porLead.get(v.leadId) ?? [];
      arr.push(v.tagId);
      porLead.set(v.leadId, arr);
    }
    res.json(rows.map(r => ({ ...r, tagIds: porLead.get(r.id) ?? [] })));
  });

  const createSchema = z.object({
    nome: z.string().min(1),
    telefone: z.string().min(8),
    email: z.string().email().optional(),
    fotoUrl: z.string().url().optional(),
    imovelTitulo: z.string().optional(),
    imovelSub: z.string().optional(),
    campanha: z.string().optional(),
    valor: z.number().optional(),
    canal: z.enum(['WhatsApp', 'Instagram', 'Facebook', 'Indicacao', 'Manual']).default('Manual'),
    colunaId: z.string().uuid().optional(),
    corretorId: z.string().uuid().optional(),
  });

  router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });
    const { imobiliariaId, nome } = req.auth!;
    const [row] = await db.insert(leads).values({ ...parsed.data, imobiliariaId, valor: parsed.data.valor?.toString() }).returning();
    registrarEvento(imobiliariaId, row.id, 'criado', 'Lead cadastrado manualmente (canal ' + row.canal + ')', nome);
    io.to('imobiliaria:' + imobiliariaId).emit('lead:created', row);
    res.status(201).json(row);
  });

  const moveSchema = z.object({ colunaId: z.string().uuid() });

  router.patch('/:id/mover', async (req, res) => {
    const parsed = moveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'colunaId inválido' });
    const { imobiliariaId, role, sub, nome } = req.auth!;

    const scoped = role === 'corretor'
      ? and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId));

    const [antes] = await db.select({ colunaId: leads.colunaId }).from(leads).where(scoped).limit(1);
    const [row] = await db.update(leads)
      .set({ colunaId: parsed.data.colunaId, entrouNaColunaEm: new Date() })
      .where(scoped)
      .returning();
    if (!row) return res.status(404).json({ error: 'Lead não encontrado' });
    if (antes?.colunaId !== parsed.data.colunaId) {
      const [col] = await db.select({ titulo: colunasKanban.titulo }).from(colunasKanban)
        .where(eq(colunasKanban.id, parsed.data.colunaId)).limit(1);
      registrarEvento(imobiliariaId, row.id, 'coluna', 'Movido para "' + (col?.titulo ?? 'outra etapa') + '"', nome);
    }
    io.to('imobiliaria:' + imobiliariaId).emit('lead:updated', row);
    res.json(row);
  });

  const updateSchema = z.object({
    nome: z.string().min(1).optional(),
    telefone: z.string().min(8).optional(),
    email: z.string().email().optional(),
    corretorId: z.string().uuid().nullable().optional(),
    motivoDescarte: z.string().nullable().optional(),
    rendaDeclarada: z.number().optional(),
  });

  router.patch('/:id', async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });
    const { imobiliariaId, role, sub, nome } = req.auth!;
    const scoped = role === 'corretor'
      ? and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId));

    const [antes] = await db.select({ corretorId: leads.corretorId, motivoDescarte: leads.motivoDescarte })
      .from(leads).where(scoped).limit(1);
    const { rendaDeclarada, ...rest } = parsed.data;
    const [row] = await db.update(leads)
      .set({ ...rest, ...(rendaDeclarada != null ? { rendaDeclarada: rendaDeclarada.toString() } : {}) })
      .where(scoped)
      .returning();
    if (!row) return res.status(404).json({ error: 'Lead não encontrado' });
    if (rest.corretorId !== undefined && rest.corretorId !== antes?.corretorId) {
      if (rest.corretorId) {
        const [c] = await db.select({ nome: perfis.nome }).from(perfis).where(eq(perfis.id, rest.corretorId)).limit(1);
        registrarEvento(imobiliariaId, row.id, 'atribuicao', 'Atribuído a ' + (c?.nome ?? 'corretor'), nome);
      } else {
        registrarEvento(imobiliariaId, row.id, 'atribuicao', 'Removido do corretor', nome);
      }
    }
    if (rest.motivoDescarte && rest.motivoDescarte !== antes?.motivoDescarte) {
      registrarEvento(imobiliariaId, row.id, 'descarte', 'Descartado: ' + rest.motivoDescarte, nome);
    }
    io.to('imobiliaria:' + imobiliariaId).emit('lead:updated', row);
    res.json(row);
  });

  // Corretor recusa um lead que caiu pra ele — volta pra roleta (ele vai pro fim da fila).
  router.post('/:id/recusar', async (req, res) => {
    const { imobiliariaId, sub, nome } = req.auth!;
    const [lead] = await db.select().from(leads)
      .where(and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))).limit(1);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado ou não é seu' });

    await db.update(leads).set({ corretorId: null }).where(eq(leads.id, lead.id));
    // quem recusou vai pro fim: marca ultimaAtribuicao como agora
    await db.update(filasAtendimento).set({ ultimaAtribuicao: new Date() }).where(eq(filasAtendimento.corretorId, sub));
    io.to('imobiliaria:' + imobiliariaId).emit('lead:updated', { ...lead, corretorId: null });
    registrarEvento(imobiliariaId, lead.id, 'recusa', 'Lead recusado por ' + nome + ' — devolvido à roleta', nome);

    const novoCorretor = await distribuirLead(io, imobiliariaId, lead.id);
    res.json({ ok: true, redistribuido: !!novoCorretor });
  });

  // Limpa só a conversa de WhatsApp do lead (o lead continua).
  router.delete('/:id/conversa', async (req, res) => {
    const { imobiliariaId, role, sub } = req.auth!;
    const scoped = role === 'corretor'
      ? and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId));
    const [lead] = await db.select({ id: leads.id }).from(leads).where(scoped).limit(1);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    await db.delete(mensagensWhatsapp).where(eq(mensagensWhatsapp.leadId, lead.id));
    io.to('imobiliaria:' + imobiliariaId).emit('conversa:limpa', { leadId: lead.id });
    res.json({ ok: true });
  });

  // Exclui o lead do CRM inteiro (conversa, etiquetas, tudo — FKs ON DELETE CASCADE).
  // Corretor pode excluir só os próprios; gerente/dono qualquer um da imobiliária.
  router.delete('/:id', async (req, res) => {
    const { imobiliariaId, role, sub } = req.auth!;
    const scoped = role === 'corretor'
      ? and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId));
    const [lead] = await db.select({ id: leads.id }).from(leads).where(scoped).limit(1);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    await db.delete(leads).where(eq(leads.id, lead.id));
    io.to('imobiliaria:' + imobiliariaId).emit('lead:removido', { id: lead.id });
    res.json({ ok: true });
  });

  // Linha do tempo do lead (eventos reais registrados pelo sistema + notas manuais).
  router.get('/:id/eventos', async (req, res) => {
    const { imobiliariaId, role, sub } = req.auth!;
    const scoped = role === 'corretor'
      ? and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId));
    const [lead] = await db.select({ id: leads.id }).from(leads).where(scoped).limit(1);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    const rows = await db.select().from(eventosLead)
      .where(eq(eventosLead.leadId, lead.id)).orderBy(desc(eventosLead.criadoEm));
    res.json(rows);
  });

  // Nota manual na linha do tempo.
  router.post('/:id/eventos', async (req, res) => {
    const parsed = z.object({ texto: z.string().min(1).max(1000) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Texto obrigatório' });
    const { imobiliariaId, role, sub, nome } = req.auth!;
    const scoped = role === 'corretor'
      ? and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId));
    const [lead] = await db.select({ id: leads.id }).from(leads).where(scoped).limit(1);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    const [row] = await db.insert(eventosLead)
      .values({ imobiliariaId, leadId: lead.id, tipo: 'nota', descricao: parsed.data.texto, atorNome: nome })
      .returning();
    res.status(201).json(row);
  });

  return router;
}
