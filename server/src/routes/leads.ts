import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { leads, leadTags, mensagensWhatsapp, filasAtendimento, colunasKanban, eventosLead, perfis, tarefas, distribuicaoLog, imobiliarias, notificacoes } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { distribuirLead } from '../lib/roleta.js';
import { registrarEvento } from '../lib/eventos.js';
import { dispararGatilhoLeadNovo, encerrarPorLead } from '../lib/followup.js';
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
    finalidade: z.enum(['venda', 'locacao']).optional(),
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
    if (row.corretorId) void dispararGatilhoLeadNovo(io, imobiliariaId, row.id, row.corretorId);
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
      const [col] = await db.select({ titulo: colunasKanban.titulo, slug: colunasKanban.slug }).from(colunasKanban)
        .where(eq(colunasKanban.id, parsed.data.colunaId)).limit(1);
      registrarEvento(imobiliariaId, row.id, 'coluna', 'Movido para "' + (col?.titulo ?? 'outra etapa') + '"', nome);
      // fechou negócio ou saiu do funil → não faz sentido continuar a régua de follow-up
      if (col?.slug === 'venda' || col?.slug === 'rebatida') void encerrarPorLead(io, imobiliariaId, row.id, 'lead saiu do funil (' + col.slug + ')');
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
    cadencia: z.string().nullable().optional(),
    finalidade: z.enum(['venda', 'locacao']).nullable().optional(),
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
        void dispararGatilhoLeadNovo(io, imobiliariaId, row.id, rest.corretorId);
      } else {
        registrarEvento(imobiliariaId, row.id, 'atribuicao', 'Removido do corretor', nome);
        void encerrarPorLead(io, imobiliariaId, row.id, 'lead sem corretor');
      }
    }
    if (rest.motivoDescarte && rest.motivoDescarte !== antes?.motivoDescarte) {
      registrarEvento(imobiliariaId, row.id, 'descarte', 'Descartado: ' + rest.motivoDescarte, nome);
      void encerrarPorLead(io, imobiliariaId, row.id, 'lead descartado');
      // descarte manda o lead pro bolsão (coluna Rebatida) e tira o corretor
      const [colReb] = await db.select({ id: colunasKanban.id }).from(colunasKanban)
        .where(and(eq(colunasKanban.imobiliariaId, imobiliariaId), eq(colunasKanban.slug, 'rebatida'))).limit(1);
      if (colReb && row.colunaId !== colReb.id) {
        const [movido] = await db.update(leads).set({ colunaId: colReb.id, corretorId: null, entrouNaColunaEm: new Date() }).where(eq(leads.id, row.id)).returning();
        if (movido) { io.to('imobiliaria:' + imobiliariaId).emit('lead:updated', movido); return res.json(movido); }
      }
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
    await encerrarPorLead(io, imobiliariaId, lead.id, 'lead recusado');

    const novoCorretor = await distribuirLead(io, imobiliariaId, lead.id);
    res.json({ ok: true, redistribuido: !!novoCorretor });
  });

  // Limpa só a conversa de WhatsApp do lead (o lead continua). Só dono/gerente.
  router.delete('/:id/conversa', requireRole('dono', 'gerente'), async (req, res) => {
    const { imobiliariaId } = req.auth!;
    const [lead] = await db.select({ id: leads.id }).from(leads)
      .where(and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId))).limit(1);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    await db.delete(mensagensWhatsapp).where(eq(mensagensWhatsapp.leadId, lead.id));
    io.to('imobiliaria:' + imobiliariaId).emit('conversa:limpa', { leadId: lead.id });
    res.json({ ok: true });
  });

  // Exclui o lead do CRM inteiro (conversa, etiquetas, tudo — FKs ON DELETE CASCADE).
  // SÓ dono/gerente — corretor não apaga lead do CRM (usa "Descartar" pra tirar do funil).
  router.delete('/:id', requireRole('dono', 'gerente'), async (req, res) => {
    const { imobiliariaId } = req.auth!;
    const [lead] = await db.select({ id: leads.id }).from(leads)
      .where(and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId))).limit(1);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });
    await db.delete(leads).where(eq(leads.id, lead.id));
    io.to('imobiliaria:' + imobiliariaId).emit('lead:removido', { id: lead.id });
    res.json({ ok: true });
  });

  // --- Puxar rebatidas do bolsão (corretor pega leads rebatidos sem dono) ---
  async function statusRebatidas(imobiliariaId: string, corretorId: string) {
    const [imob] = await db.select({ limite: imobiliarias.limiteRebatidasDia }).from(imobiliarias).where(eq(imobiliarias.id, imobiliariaId)).limit(1);
    const limite = imob?.limite ?? 0;
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const [{ n: puxadasHoje }] = await db.select({ n: sql<number>`count(*)::int` }).from(distribuicaoLog)
      .where(and(eq(distribuicaoLog.corretorId, corretorId), eq(distribuicaoLog.origem, 'rebatida-puxada'), gte(distribuicaoLog.criadoEm, inicioDia)));
    const [{ n: tarefasAtrasadas }] = await db.select({ n: sql<number>`count(*)::int` }).from(tarefas)
      .where(and(eq(tarefas.corretorId, corretorId), eq(tarefas.concluida, false), lt(tarefas.venceEm, new Date())));
    const [colReb] = await db.select({ id: colunasKanban.id }).from(colunasKanban)
      .where(and(eq(colunasKanban.imobiliariaId, imobiliariaId), eq(colunasKanban.slug, 'rebatida'))).limit(1);
    const [{ n: disponiveis }] = colReb
      ? await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(and(eq(leads.colunaId, colReb.id), isNull(leads.corretorId)))
      : [{ n: 0 }];
    return { limite, puxadasHoje, tarefasAtrasadas, disponiveis, colRebId: colReb?.id ?? null };
  }

  router.get('/rebatidas/status', async (req, res) => {
    const { imobiliariaId, sub } = req.auth!;
    const s = await statusRebatidas(imobiliariaId, sub);
    res.json({ limite: s.limite, puxadasHoje: s.puxadasHoje, tarefasAtrasadas: s.tarefasAtrasadas, disponiveis: s.disponiveis });
  });

  router.post('/rebatidas/puxar', async (req, res) => {
    const { imobiliariaId, sub, nome, role } = req.auth!;
    const alvoId = role !== 'corretor' && typeof req.body?.corretorId === 'string' ? req.body.corretorId : sub;
    const s = await statusRebatidas(imobiliariaId, alvoId);
    if (s.tarefasAtrasadas > 0) return res.status(409).json({ error: 'Resolva suas ' + s.tarefasAtrasadas + ' tarefa(s) atrasada(s) antes de puxar rebatidas.', motivo: 'tarefas' });
    if (s.limite > 0 && s.puxadasHoje >= s.limite) return res.status(409).json({ error: 'Você já puxou o máximo de ' + s.limite + ' rebatidas hoje.', motivo: 'limite' });
    if (!s.colRebId) return res.status(400).json({ error: 'Coluna de rebatidas não configurada' });

    const [colAtend] = await db.select({ id: colunasKanban.id }).from(colunasKanban)
      .where(and(eq(colunasKanban.imobiliariaId, imobiliariaId), eq(colunasKanban.slug, 'atend'))).limit(1);

    const [lead] = await db.select().from(leads)
      .where(and(eq(leads.colunaId, s.colRebId), isNull(leads.corretorId), eq(leads.imobiliariaId, imobiliariaId)))
      .orderBy(asc(leads.entrouNaColunaEm)).limit(1);
    if (!lead) return res.status(404).json({ error: 'Nenhuma rebatida disponível no bolsão agora.', motivo: 'vazio' });

    const [atualizado] = await db.update(leads)
      .set({ corretorId: alvoId, colunaId: colAtend?.id ?? lead.colunaId, entrouNaColunaEm: new Date(), motivoDescarte: null })
      .where(and(eq(leads.id, lead.id), isNull(leads.corretorId))).returning();
    if (!atualizado) return res.status(409).json({ error: 'Alguém puxou essa rebatida primeiro. Tenta de novo.' });

    await db.insert(distribuicaoLog).values({ imobiliariaId, leadId: lead.id, corretorId: alvoId, origem: 'rebatida-puxada' });
    await db.insert(notificacoes).values({ perfilId: alvoId, tipo: 'lead', titulo: 'Rebatida puxada', texto: atualizado.nome + ' voltou pra sua carteira.', lida: false });
    registrarEvento(imobiliariaId, lead.id, 'roleta', 'Rebatida puxada do bolsão por ' + nome, nome);
    io.to('imobiliaria:' + imobiliariaId).emit('lead:updated', atualizado);

    const novo = await statusRebatidas(imobiliariaId, alvoId);
    res.json({ lead: atualizado, status: { limite: novo.limite, puxadasHoje: novo.puxadasHoje, tarefasAtrasadas: novo.tarefasAtrasadas, disponiveis: novo.disponiveis } });
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
