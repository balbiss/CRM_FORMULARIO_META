import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { colunasKanban, leads } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import type { Server as SocketServer } from 'socket.io';

export function colunasRouter(io: SocketServer) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const rows = await db.select().from(colunasKanban)
      .where(eq(colunasKanban.imobiliariaId, req.auth!.imobiliariaId))
      .orderBy(asc(colunasKanban.ordem));
    res.json(rows);
  });

  const bodySchema = z.object({
    titulo: z.string().min(1).max(40),
    cor: z.string().max(40).nullable().optional(),
  });

  // Criar coluna nova (sempre no fim). Colunas criadas pelo usuário têm slug null.
  router.post('/', requireRole('dono', 'gerente'), async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Título da coluna é obrigatório' });
    const { imobiliariaId } = req.auth!;
    const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${colunasKanban.ordem}), -1)` })
      .from(colunasKanban).where(eq(colunasKanban.imobiliariaId, imobiliariaId));
    const [row] = await db.insert(colunasKanban).values({
      imobiliariaId, titulo: parsed.data.titulo.trim(), cor: parsed.data.cor ?? 'var(--terra)', ordem: Number(max) + 1,
    }).returning();
    io.to('imobiliaria:' + imobiliariaId).emit('colunas:mudou');
    res.status(201).json(row);
  });

  router.patch('/:id', requireRole('dono', 'gerente'), async (req, res) => {
    const parsed = bodySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
    const { imobiliariaId } = req.auth!;
    const [existe] = await db.select({ id: colunasKanban.id }).from(colunasKanban)
      .where(and(eq(colunasKanban.id, req.params.id), eq(colunasKanban.imobiliariaId, imobiliariaId))).limit(1);
    if (!existe) return res.status(404).json({ error: 'Coluna não encontrada' });
    const patch: Record<string, unknown> = {};
    if (parsed.data.titulo) patch.titulo = parsed.data.titulo.trim();
    if (parsed.data.cor !== undefined) patch.cor = parsed.data.cor;
    const [row] = await db.update(colunasKanban).set(patch).where(eq(colunasKanban.id, req.params.id)).returning();
    io.to('imobiliaria:' + imobiliariaId).emit('colunas:mudou');
    res.json(row);
  });

  // Reordenar: recebe a lista de ids na ordem desejada.
  router.patch('/', requireRole('dono', 'gerente'), async (req, res) => {
    const parsed = z.object({ ordem: z.array(z.string().uuid()) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Lista de ordem inválida' });
    const { imobiliariaId } = req.auth!;
    const minhas = await db.select({ id: colunasKanban.id }).from(colunasKanban).where(eq(colunasKanban.imobiliariaId, imobiliariaId));
    const validos = new Set(minhas.map(c => c.id));
    let i = 0;
    for (const id of parsed.data.ordem) {
      if (!validos.has(id)) continue;
      await db.update(colunasKanban).set({ ordem: i++ }).where(eq(colunasKanban.id, id));
    }
    io.to('imobiliaria:' + imobiliariaId).emit('colunas:mudou');
    res.json({ ok: true });
  });

  // Excluir: os leads da coluna vão pra primeira coluna (por ordem). Não deixa apagar
  // as colunas de sistema com slug (novo, credito, venda, rebatida...) — elas são usadas
  // por outras telas.
  router.delete('/:id', requireRole('dono', 'gerente'), async (req, res) => {
    const { imobiliariaId } = req.auth!;
    const [alvo] = await db.select().from(colunasKanban)
      .where(and(eq(colunasKanban.id, req.params.id), eq(colunasKanban.imobiliariaId, imobiliariaId))).limit(1);
    if (!alvo) return res.status(404).json({ error: 'Coluna não encontrada' });
    if (alvo.slug) return res.status(400).json({ error: 'Essa é uma coluna do sistema e não pode ser excluída (só renomeada).' });

    const [destino] = await db.select().from(colunasKanban)
      .where(and(eq(colunasKanban.imobiliariaId, imobiliariaId), ne(colunasKanban.id, alvo.id)))
      .orderBy(asc(colunasKanban.ordem)).limit(1);
    if (destino) {
      await db.update(leads).set({ colunaId: destino.id }).where(eq(leads.colunaId, alvo.id));
    }
    await db.delete(colunasKanban).where(eq(colunasKanban.id, alvo.id));
    io.to('imobiliaria:' + imobiliariaId).emit('colunas:mudou');
    res.json({ ok: true, movidosPara: destino?.id ?? null });
  });

  return router;
}
