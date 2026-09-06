import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { templatesMensagem } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

export const templatesRouter = Router();
templatesRouter.use(requireAuth);

// Templates são pessoais — cada corretor só vê/mexe nos próprios, dono e gerente incluso
// (mesma regra do mock que já existia: "cada corretor vê apenas os próprios templates").

templatesRouter.get('/', async (req, res) => {
  const rows = await db.select().from(templatesMensagem).where(eq(templatesMensagem.criadoPor, req.auth!.sub));
  res.json(rows);
});

const bodySchema = z.object({
  titulo: z.string().min(1),
  texto: z.string().min(1),
  anexoUrl: z.string().nullable().optional(),
});

templatesRouter.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Título e texto são obrigatórios' });
  const [row] = await db.insert(templatesMensagem).values({ criadoPor: req.auth!.sub, ...parsed.data }).returning();
  res.status(201).json(row);
});

templatesRouter.patch('/:id', async (req, res) => {
  const parsed = bodySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  const [existe] = await db.select({ id: templatesMensagem.id }).from(templatesMensagem)
    .where(and(eq(templatesMensagem.id, req.params.id), eq(templatesMensagem.criadoPor, req.auth!.sub))).limit(1);
  if (!existe) return res.status(404).json({ error: 'Template não encontrado' });
  const [row] = await db.update(templatesMensagem).set(parsed.data).where(eq(templatesMensagem.id, req.params.id)).returning();
  res.json(row);
});

templatesRouter.delete('/:id', async (req, res) => {
  const [existe] = await db.select({ id: templatesMensagem.id }).from(templatesMensagem)
    .where(and(eq(templatesMensagem.id, req.params.id), eq(templatesMensagem.criadoPor, req.auth!.sub))).limit(1);
  if (!existe) return res.status(404).json({ error: 'Template não encontrado' });
  await db.delete(templatesMensagem).where(eq(templatesMensagem.id, req.params.id));
  res.json({ ok: true });
});
