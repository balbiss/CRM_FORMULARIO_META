import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { linksUteis } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const linksUteisRouter = Router();
linksUteisRouter.use(requireAuth);

// Biblioteca é da imobiliária inteira — todo mundo vê, só Dono/Gerente cadastram/editam/excluem.

linksUteisRouter.get('/', async (req, res) => {
  const rows = await db.select().from(linksUteis).where(eq(linksUteis.imobiliariaId, req.auth!.imobiliariaId));
  res.json(rows);
});

const bodySchema = z.object({
  categoria: z.string().min(1),
  titulo: z.string().min(1),
  url: z.string().min(1),
});

linksUteisRouter.post('/', requireRole('dono', 'gerente'), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Categoria, título e URL são obrigatórios' });
  const [row] = await db.insert(linksUteis).values({ imobiliariaId: req.auth!.imobiliariaId, ...parsed.data }).returning();
  res.status(201).json(row);
});

linksUteisRouter.patch('/:id', requireRole('dono', 'gerente'), async (req, res) => {
  const parsed = bodySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  const [existe] = await db.select({ id: linksUteis.id }).from(linksUteis)
    .where(and(eq(linksUteis.id, req.params.id), eq(linksUteis.imobiliariaId, req.auth!.imobiliariaId))).limit(1);
  if (!existe) return res.status(404).json({ error: 'Link não encontrado' });
  const [row] = await db.update(linksUteis).set(parsed.data).where(eq(linksUteis.id, req.params.id)).returning();
  res.json(row);
});

linksUteisRouter.delete('/:id', requireRole('dono', 'gerente'), async (req, res) => {
  const [existe] = await db.select({ id: linksUteis.id }).from(linksUteis)
    .where(and(eq(linksUteis.id, req.params.id), eq(linksUteis.imobiliariaId, req.auth!.imobiliariaId))).limit(1);
  if (!existe) return res.status(404).json({ error: 'Link não encontrado' });
  await db.delete(linksUteis).where(eq(linksUteis.id, req.params.id));
  res.json({ ok: true });
});
