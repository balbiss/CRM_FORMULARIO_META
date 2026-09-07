import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import type { Server as SocketServer } from 'socket.io';
import { db } from '../db/client.js';
import { followupFluxos, followupPassos, followupExecucoes, leads, perfis } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { iniciarFollowup } from '../lib/followup.js';

const passoSchema = z.object({
  tipo: z.enum(['texto', 'audio', 'imagem', 'pdf']).default('texto'),
  conteudo: z.string().default(''),
  anexoUrl: z.string().nullable().optional(),
  anexoNome: z.string().nullable().optional(),
  atrasoMinutos: z.number().int().min(0).max(60 * 24 * 60).default(0),
  atrasoTexto: z.string().default('na hora'),
  cadenciaLabel: z.string().nullable().optional(),
});

const fluxoPatchSchema = z.object({
  nome: z.string().min(1).optional(),
  ativo: z.boolean().optional(),
  disparaEmLeadNovo: z.boolean().optional(),
  janelaInicioMin: z.number().int().min(0).max(1439).optional(),
  janelaFimMin: z.number().int().min(1).max(1440).optional(),
  janelaDias: z.array(z.boolean()).length(7).optional(),
  aoEsgotar: z.enum(['nada', 'descartar', 'mover']).optional(),
  aoEsgotarColunaId: z.string().uuid().nullable().optional(),
});

export function followupRouter(io: SocketServer) {
  const router = Router();
  router.use(requireAuth);

  async function comPassos(fluxos: (typeof followupFluxos.$inferSelect)[]) {
    if (!fluxos.length) return [];
    const ps = await db.select().from(followupPassos)
      .where(inArray(followupPassos.fluxoId, fluxos.map(f => f.id)))
      .orderBy(asc(followupPassos.ordem));
    return fluxos.map(f => ({ ...f, passos: ps.filter(p => p.fluxoId === f.id) }));
  }

  // Fluxos: corretor vê os dele; dono/gerente veem todos (ou ?corretorId=).
  router.get('/fluxos', async (req, res) => {
    const { imobiliariaId, role, sub } = req.auth!;
    const conds = [eq(followupFluxos.imobiliariaId, imobiliariaId)];
    if (role === 'corretor') conds.push(eq(followupFluxos.corretorId, sub));
    else if (typeof req.query.corretorId === 'string') conds.push(eq(followupFluxos.corretorId, req.query.corretorId));
    const fluxos = await db.select().from(followupFluxos).where(and(...conds)).orderBy(asc(followupFluxos.criadoEm));
    res.json(await comPassos(fluxos));
  });

  router.post('/fluxos', async (req, res) => {
    const parsed = z.object({ nome: z.string().min(1), corretorId: z.string().uuid().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Nome obrigatório' });
    const { imobiliariaId, role, sub } = req.auth!;
    const corretorId = role === 'corretor' ? sub : (parsed.data.corretorId || sub);
    const [row] = await db.insert(followupFluxos).values({ imobiliariaId, corretorId, nome: parsed.data.nome.trim(), ativo: true }).returning();
    io.to('imobiliaria:' + imobiliariaId).emit('followup:mudou', {});
    res.status(201).json({ ...row, passos: [] });
  });

  async function fluxoDoUsuario(id: string, req: import('express').Request) {
    const { imobiliariaId, role, sub } = req.auth!;
    const cond = role === 'corretor'
      ? and(eq(followupFluxos.id, id), eq(followupFluxos.imobiliariaId, imobiliariaId), eq(followupFluxos.corretorId, sub))
      : and(eq(followupFluxos.id, id), eq(followupFluxos.imobiliariaId, imobiliariaId));
    const [f] = await db.select().from(followupFluxos).where(cond).limit(1);
    return f ?? null;
  }

  router.patch('/fluxos/:id', async (req, res) => {
    const parsed = fluxoPatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });
    const alvo = await fluxoDoUsuario(req.params.id, req);
    if (!alvo) return res.status(404).json({ error: 'Fluxo não encontrado' });

    // Só um fluxo por corretor pode "disparar em lead novo".
    if (parsed.data.disparaEmLeadNovo && alvo.corretorId) {
      await db.update(followupFluxos).set({ disparaEmLeadNovo: false })
        .where(and(eq(followupFluxos.corretorId, alvo.corretorId), ne(followupFluxos.id, alvo.id)));
    }
    const [row] = await db.update(followupFluxos).set(parsed.data as Record<string, unknown>).where(eq(followupFluxos.id, alvo.id)).returning();
    io.to('imobiliaria:' + req.auth!.imobiliariaId).emit('followup:mudou', {});
    res.json((await comPassos([row]))[0]);
  });

  router.delete('/fluxos/:id', async (req, res) => {
    const alvo = await fluxoDoUsuario(req.params.id, req);
    if (!alvo) return res.status(404).json({ error: 'Fluxo não encontrado' });
    await db.delete(followupFluxos).where(eq(followupFluxos.id, alvo.id));
    io.to('imobiliaria:' + req.auth!.imobiliariaId).emit('followup:mudou', {});
    res.json({ ok: true });
  });

  // Substitui todos os passos do fluxo de uma vez.
  router.put('/fluxos/:id/passos', async (req, res) => {
    const parsed = z.object({ passos: z.array(passoSchema).max(30) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Passos inválidos' });
    const alvo = await fluxoDoUsuario(req.params.id, req);
    if (!alvo) return res.status(404).json({ error: 'Fluxo não encontrado' });

    await db.delete(followupPassos).where(eq(followupPassos.fluxoId, alvo.id));
    if (parsed.data.passos.length) {
      await db.insert(followupPassos).values(parsed.data.passos.map((p, i) => ({
        fluxoId: alvo.id, ordem: i, tipo: p.tipo, conteudo: p.conteudo,
        anexoUrl: p.anexoUrl ?? null, anexoNome: p.anexoNome ?? null,
        atrasoMinutos: p.atrasoMinutos, atrasoTexto: p.atrasoTexto, cadenciaLabel: p.cadenciaLabel ?? null,
      })));
    }
    io.to('imobiliaria:' + req.auth!.imobiliariaId).emit('followup:mudou', {});
    res.json((await comPassos([alvo]))[0]);
  });

  // Execuções em andamento (aba "Em andamento"). Corretor vê as dele.
  router.get('/execucoes', async (req, res) => {
    const { imobiliariaId, role, sub } = req.auth!;
    const conds = [eq(followupExecucoes.imobiliariaId, imobiliariaId), ne(followupExecucoes.status, 'encerrada')];
    if (role === 'corretor') conds.push(eq(followupExecucoes.corretorId, sub));
    const rows = await db.select().from(followupExecucoes).where(and(...conds)).orderBy(asc(followupExecucoes.proximoEnvioEm));
    if (!rows.length) return res.json([]);

    const ls = await db.select({ id: leads.id, nome: leads.nome }).from(leads).where(inArray(leads.id, rows.map(r => r.leadId)));
    const fs = await db.select({ id: followupFluxos.id, nome: followupFluxos.nome }).from(followupFluxos).where(inArray(followupFluxos.id, rows.map(r => r.fluxoId)));
    const corrIds = [...new Set(rows.map(r => r.corretorId).filter(Boolean))] as string[];
    const ps = corrIds.length ? await db.select({ id: perfis.id, nome: perfis.nome }).from(perfis).where(inArray(perfis.id, corrIds)) : [];
    const totalPorFluxo = new Map<string, number>();
    const passosCount = await db.select({ fluxoId: followupPassos.fluxoId }).from(followupPassos).where(inArray(followupPassos.fluxoId, rows.map(r => r.fluxoId)));
    for (const p of passosCount) totalPorFluxo.set(p.fluxoId, (totalPorFluxo.get(p.fluxoId) || 0) + 1);
    const lm = new Map(ls.map(l => [l.id, l.nome]));
    const fm = new Map(fs.map(f => [f.id, f.nome]));
    const pm = new Map(ps.map(p => [p.id, p.nome]));

    res.json(rows.map(r => ({
      id: r.id, leadId: r.leadId, leadNome: lm.get(r.leadId) ?? '—',
      fluxoId: r.fluxoId, fluxoNome: fm.get(r.fluxoId) ?? '—',
      passoAtual: r.passoAtual, totalPassos: totalPorFluxo.get(r.fluxoId) ?? 0,
      status: r.status, proximoEnvioEm: r.proximoEnvioEm, motivoFim: r.motivoFim,
      corretorId: r.corretorId, corretorNome: r.corretorId ? pm.get(r.corretorId) ?? null : null,
    })));
  });

  // Inicia manualmente a régua pra um lead.
  router.post('/execucoes', async (req, res) => {
    const parsed = z.object({ leadId: z.string().uuid(), fluxoId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'leadId e fluxoId obrigatórios' });
    const { imobiliariaId, role, sub } = req.auth!;

    const leadCond = role === 'corretor'
      ? and(eq(leads.id, parsed.data.leadId), eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : and(eq(leads.id, parsed.data.leadId), eq(leads.imobiliariaId, imobiliariaId));
    const [lead] = await db.select({ id: leads.id, corretorId: leads.corretorId }).from(leads).where(leadCond).limit(1);
    if (!lead) return res.status(404).json({ error: 'Lead não encontrado' });

    const r = await iniciarFollowup(io, {
      leadId: lead.id, fluxoId: parsed.data.fluxoId, imobiliariaId,
      corretorId: lead.corretorId ?? (role === 'corretor' ? sub : null), automatico: false,
    });
    if (!r.ok) return res.status(400).json({ error: r.motivo || 'Não foi possível iniciar' });
    res.status(201).json({ ok: true });
  });

  // Pausar / retomar / encerrar.
  router.patch('/execucoes/:id', async (req, res) => {
    const parsed = z.object({ status: z.enum(['ativa', 'pausada', 'encerrada']) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'status inválido' });
    const { imobiliariaId, role, sub } = req.auth!;
    const cond = role === 'corretor'
      ? and(eq(followupExecucoes.id, req.params.id), eq(followupExecucoes.imobiliariaId, imobiliariaId), eq(followupExecucoes.corretorId, sub))
      : and(eq(followupExecucoes.id, req.params.id), eq(followupExecucoes.imobiliariaId, imobiliariaId));
    const [ex] = await db.select().from(followupExecucoes).where(cond).limit(1);
    if (!ex) return res.status(404).json({ error: 'Follow-up não encontrado' });

    if (parsed.data.status === 'encerrada') {
      await db.update(followupExecucoes).set({ status: 'encerrada', motivoFim: 'encerrado pelo corretor', proximoEnvioEm: null }).where(eq(followupExecucoes.id, ex.id));
    } else if (parsed.data.status === 'ativa') {
      // retomar: agenda o próximo envio pra agora (a varredura respeita a janela)
      await db.update(followupExecucoes).set({ status: 'ativa', motivoFim: null, proximoEnvioEm: new Date() }).where(eq(followupExecucoes.id, ex.id));
    } else {
      await db.update(followupExecucoes).set({ status: 'pausada', motivoFim: 'pausado pelo corretor' }).where(eq(followupExecucoes.id, ex.id));
    }
    io.to('imobiliaria:' + imobiliariaId).emit('followup:mudou', { leadId: ex.leadId });
    res.json({ ok: true });
  });

  return router;
}
