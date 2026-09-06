import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { notificacoes } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

export const notificacoesRouter = Router();
notificacoesRouter.use(requireAuth);

// Notificação é pessoal — cada um só vê e mexe nas próprias, sem exceção (nem Dono vê as dos outros).

notificacoesRouter.get('/', async (req, res) => {
  const rows = await db.select().from(notificacoes)
    .where(eq(notificacoes.perfilId, req.auth!.sub))
    .orderBy(desc(notificacoes.criadoEm))
    .limit(50);
  res.json(rows);
});

notificacoesRouter.patch('/marcar-todas', async (req, res) => {
  await db.update(notificacoes).set({ lida: true }).where(eq(notificacoes.perfilId, req.auth!.sub));
  res.json({ ok: true });
});

notificacoesRouter.patch('/:id', async (req, res) => {
  const [existe] = await db.select({ id: notificacoes.id }).from(notificacoes)
    .where(and(eq(notificacoes.id, req.params.id), eq(notificacoes.perfilId, req.auth!.sub))).limit(1);
  if (!existe) return res.status(404).json({ error: 'Notificação não encontrada' });
  const [row] = await db.update(notificacoes).set({ lida: true }).where(eq(notificacoes.id, req.params.id)).returning();
  res.json(row);
});
