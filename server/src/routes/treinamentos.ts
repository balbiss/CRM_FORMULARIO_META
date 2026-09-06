import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { treinamentos } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const treinamentosRouter = Router();
treinamentosRouter.use(requireAuth);

// Biblioteca é da imobiliária inteira — todo mundo vê (assiste), só Dono/Gerente cadastram/editam/excluem.

treinamentosRouter.get('/', async (req, res) => {
  const rows = await db.select().from(treinamentos).where(eq(treinamentos.imobiliariaId, req.auth!.imobiliariaId));
  res.json(rows);
});

const bodySchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().nullable().optional(),
  duracaoTexto: z.string().nullable().optional(),
  categoria: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
});

treinamentosRouter.post('/', requireRole('dono', 'gerente'), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Título é obrigatório' });
  const [row] = await db.insert(treinamentos).values({ imobiliariaId: req.auth!.imobiliariaId, ...parsed.data }).returning();
  res.status(201).json(row);
});

treinamentosRouter.patch('/:id', requireRole('dono', 'gerente'), async (req, res) => {
  const parsed = bodySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  const [existe] = await db.select({ id: treinamentos.id }).from(treinamentos)
    .where(and(eq(treinamentos.id, req.params.id), eq(treinamentos.imobiliariaId, req.auth!.imobiliariaId))).limit(1);
  if (!existe) return res.status(404).json({ error: 'Treinamento não encontrado' });
  const [row] = await db.update(treinamentos).set(parsed.data).where(eq(treinamentos.id, req.params.id)).returning();
  res.json(row);
});

treinamentosRouter.delete('/:id', requireRole('dono', 'gerente'), async (req, res) => {
  const [existe] = await db.select({ id: treinamentos.id }).from(treinamentos)
    .where(and(eq(treinamentos.id, req.params.id), eq(treinamentos.imobiliariaId, req.auth!.imobiliariaId))).limit(1);
  if (!existe) return res.status(404).json({ error: 'Treinamento não encontrado' });
  await db.delete(treinamentos).where(eq(treinamentos.id, req.params.id));
  res.json({ ok: true });
});
