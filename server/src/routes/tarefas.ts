import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tarefas, leads, perfis, notificacoes } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { registrarEvento } from '../lib/eventos.js';
import type { Server as SocketServer } from 'socket.io';

export function tarefasRouter(io: SocketServer) {
  const router = Router();
  router.use(requireAuth);

  async function enriquecer(rows: (typeof tarefas.$inferSelect)[]) {
    if (!rows.length) return [];
    const leadIds = [...new Set(rows.map(r => r.leadId).filter(Boolean))] as string[];
    const corrIds = [...new Set(rows.map(r => r.corretorId).filter(Boolean))] as string[];
    const ls = leadIds.length ? await db.select({ id: leads.id, nome: leads.nome }).from(leads).where(inArray(leads.id, leadIds)) : [];
    const ps = corrIds.length ? await db.select({ id: perfis.id, nome: perfis.nome }).from(perfis).where(inArray(perfis.id, corrIds)) : [];
    const lm = new Map(ls.map(l => [l.id, l.nome]));
    const pm = new Map(ps.map(p => [p.id, p.nome]));
    return rows.map(r => ({ ...r, leadNome: r.leadId ? lm.get(r.leadId) ?? null : null, corretorNome: r.corretorId ? pm.get(r.corretorId) ?? null : null }));
  }

  // Lista tarefas. corretor vê só as dele; ?de=&ate= (YYYY-MM-DD) filtra por janela; ?pendentes=1 só não concluídas.
  router.get('/', async (req, res) => {
    const { imobiliariaId, role, sub } = req.auth!;
    const conds = [eq(tarefas.imobiliariaId, imobiliariaId)];
    if (role === 'corretor') conds.push(eq(tarefas.corretorId, sub));
    if (typeof req.query.de === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.de)) conds.push(gte(tarefas.venceEm, new Date(req.query.de + 'T00:00:00')));
    if (typeof req.query.ate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.ate)) conds.push(lte(tarefas.venceEm, new Date(req.query.ate + 'T23:59:59')));
    if (req.query.pendentes === '1') conds.push(eq(tarefas.concluida, false));

    const rows = await db.select().from(tarefas).where(and(...conds)).orderBy(asc(tarefas.venceEm));
    res.json(rows.length ? await enriquecer(rows) : []);
  });

  const criarSchema = z.object({
    titulo: z.string().min(1),
    descricao: z.string().optional(),
    venceEm: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
    leadId: z.string().uuid().optional(),
    corretorId: z.string().uuid().optional(),
  });

  router.post('/', async (req, res) => {
    const parsed = criarSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });
    const { imobiliariaId, role, sub, nome } = req.auth!;

    // corretor só cria pra si; dono/gerente pra qualquer um (default: quem criou).
    let corretorId = parsed.data.corretorId || sub;
    if (role === 'corretor') corretorId = sub;

    if (parsed.data.leadId) {
      const [l] = await db.select({ id: leads.id }).from(leads)
        .where(and(eq(leads.id, parsed.data.leadId), eq(leads.imobiliariaId, imobiliariaId))).limit(1);
      if (!l) return res.status(404).json({ error: 'Lead não encontrado' });
    }

    const [row] = await db.insert(tarefas).values({
      imobiliariaId, titulo: parsed.data.titulo, descricao: parsed.data.descricao ?? null,
      venceEm: new Date(parsed.data.venceEm), leadId: parsed.data.leadId ?? null, corretorId, criadoPor: sub,
    }).returning();

    if (parsed.data.leadId) registrarEvento(imobiliariaId, parsed.data.leadId, 'tarefa', 'Tarefa criada: ' + parsed.data.titulo, nome);
    if (corretorId !== sub) {
      await db.insert(notificacoes).values({ perfilId: corretorId, tipo: 'tarefa', titulo: 'Nova tarefa pra você', texto: parsed.data.titulo, lida: false });
    }
    io.to('imobiliaria:' + imobiliariaId).emit('tarefa:mudou', {});
    res.status(201).json((await enriquecer([row]))[0]);
  });

  router.patch('/:id', async (req, res) => {
    const parsed = z.object({
      concluida: z.boolean().optional(),
      titulo: z.string().min(1).optional(),
      descricao: z.string().nullable().optional(),
      venceEm: z.string().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
    const { imobiliariaId, role, sub } = req.auth!;

    const cond = role === 'corretor'
      ? and(eq(tarefas.id, req.params.id), eq(tarefas.imobiliariaId, imobiliariaId), eq(tarefas.corretorId, sub))
      : and(eq(tarefas.id, req.params.id), eq(tarefas.imobiliariaId, imobiliariaId));
    const [alvo] = await db.select().from(tarefas).where(cond).limit(1);
    if (!alvo) return res.status(404).json({ error: 'Tarefa não encontrada' });

    const patch: Record<string, unknown> = {};
    if (parsed.data.titulo !== undefined) patch.titulo = parsed.data.titulo;
    if (parsed.data.descricao !== undefined) patch.descricao = parsed.data.descricao;
    if (parsed.data.venceEm) patch.venceEm = new Date(parsed.data.venceEm);
    if (parsed.data.concluida !== undefined) {
      patch.concluida = parsed.data.concluida;
      patch.concluidaEm = parsed.data.concluida ? new Date() : null;
    }
    const [row] = await db.update(tarefas).set(patch).where(eq(tarefas.id, alvo.id)).returning();
    io.to('imobiliaria:' + imobiliariaId).emit('tarefa:mudou', {});
    res.json((await enriquecer([row]))[0]);
  });

  router.delete('/:id', async (req, res) => {
    const { imobiliariaId, role, sub } = req.auth!;
    const cond = role === 'corretor'
      ? and(eq(tarefas.id, req.params.id), eq(tarefas.imobiliariaId, imobiliariaId), eq(tarefas.corretorId, sub))
      : and(eq(tarefas.id, req.params.id), eq(tarefas.imobiliariaId, imobiliariaId));
    const [alvo] = await db.select({ id: tarefas.id }).from(tarefas).where(cond).limit(1);
    if (!alvo) return res.status(404).json({ error: 'Tarefa não encontrada' });
    await db.delete(tarefas).where(eq(tarefas.id, alvo.id));
    io.to('imobiliaria:' + imobiliariaId).emit('tarefa:mudou', {});
    res.json({ ok: true });
  });

  return router;
}
