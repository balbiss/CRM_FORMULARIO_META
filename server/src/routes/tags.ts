import { Router } from 'express';
import { z } from 'zod';
import { and, eq, asc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tags, leadTags, leads } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import type { JwtClaims } from '../lib/jwt.js';
import type { Server as SocketServer } from 'socket.io';

const CORES = ['#123C87', '#0E7C66', '#B5652F', '#7A3E9D', '#B02E4A', '#2C7A8C', '#6B7280', '#C08A00'];

export function tagsRouter(io: SocketServer) {
  const router = Router();
  router.use(requireAuth);

  // lê o lead respeitando o escopo (corretor só mexe nos próprios)
  async function leadNoEscopo(leadId: string, auth: JwtClaims) {
    const { imobiliariaId, role, sub } = auth;
    const scoped = role === 'corretor'
      ? and(eq(leads.id, leadId), eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : and(eq(leads.id, leadId), eq(leads.imobiliariaId, imobiliariaId));
    const [row] = await db.select({ id: leads.id }).from(leads).where(scoped).limit(1);
    return row;
  }

  router.get('/', async (req, res) => {
    const rows = await db.select().from(tags)
      .where(eq(tags.imobiliariaId, req.auth!.imobiliariaId))
      .orderBy(asc(tags.ordem), asc(tags.criadoEm));
    res.json(rows);
  });

  const bodySchema = z.object({
    nome: z.string().min(1).max(40),
    cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  });

  router.post('/', requireRole('dono', 'gerente'), async (req, res) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Nome da etiqueta é obrigatório' });
    const { imobiliariaId } = req.auth!;
    const count = await db.select({ id: tags.id }).from(tags).where(eq(tags.imobiliariaId, imobiliariaId));
    const [row] = await db.insert(tags).values({
      imobiliariaId,
      nome: parsed.data.nome.trim(),
      cor: parsed.data.cor ?? CORES[count.length % CORES.length],
      ordem: count.length,
    }).returning();
    io.to('imobiliaria:' + imobiliariaId).emit('tag:changed');
    res.status(201).json(row);
  });

  router.patch('/:id', requireRole('dono', 'gerente'), async (req, res) => {
    const parsed = bodySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
    const { imobiliariaId } = req.auth!;
    const [existe] = await db.select({ id: tags.id }).from(tags)
      .where(and(eq(tags.id, req.params.id), eq(tags.imobiliariaId, imobiliariaId))).limit(1);
    if (!existe) return res.status(404).json({ error: 'Etiqueta não encontrada' });
    const [row] = await db.update(tags)
      .set({ ...(parsed.data.nome ? { nome: parsed.data.nome.trim() } : {}), ...(parsed.data.cor ? { cor: parsed.data.cor } : {}) })
      .where(eq(tags.id, req.params.id)).returning();
    io.to('imobiliaria:' + imobiliariaId).emit('tag:changed');
    res.json(row);
  });

  router.delete('/:id', requireRole('dono', 'gerente'), async (req, res) => {
    const { imobiliariaId } = req.auth!;
    const [existe] = await db.select({ id: tags.id }).from(tags)
      .where(and(eq(tags.id, req.params.id), eq(tags.imobiliariaId, imobiliariaId))).limit(1);
    if (!existe) return res.status(404).json({ error: 'Etiqueta não encontrada' });
    await db.delete(tags).where(eq(tags.id, req.params.id));
    io.to('imobiliaria:' + imobiliariaId).emit('tag:changed');
    res.json({ ok: true });
  });

  // --- atribuição a leads ---

  async function tagNoEscopo(tagId: string, imobiliariaId: string) {
    const [row] = await db.select({ id: tags.id }).from(tags)
      .where(and(eq(tags.id, tagId), eq(tags.imobiliariaId, imobiliariaId))).limit(1);
    return row;
  }

  router.post('/:tagId/lead/:leadId', async (req, res) => {
    const { imobiliariaId } = req.auth!;
    if (!(await tagNoEscopo(req.params.tagId, imobiliariaId))) return res.status(404).json({ error: 'Etiqueta não encontrada' });
    if (!(await leadNoEscopo(req.params.leadId, req.auth!))) return res.status(404).json({ error: 'Lead não encontrado' });
    await db.insert(leadTags).values({ leadId: req.params.leadId, tagId: req.params.tagId }).onConflictDoNothing();
    const atuais = await db.select({ tagId: leadTags.tagId }).from(leadTags).where(eq(leadTags.leadId, req.params.leadId));
    const tagIds = atuais.map(a => a.tagId);
    io.to('imobiliaria:' + imobiliariaId).emit('lead:tags', { leadId: req.params.leadId, tagIds });
    res.json({ leadId: req.params.leadId, tagIds });
  });

  router.delete('/:tagId/lead/:leadId', async (req, res) => {
    const { imobiliariaId } = req.auth!;
    if (!(await leadNoEscopo(req.params.leadId, req.auth!))) return res.status(404).json({ error: 'Lead não encontrado' });
    await db.delete(leadTags).where(and(eq(leadTags.leadId, req.params.leadId), eq(leadTags.tagId, req.params.tagId)));
    const atuais = await db.select({ tagId: leadTags.tagId }).from(leadTags).where(eq(leadTags.leadId, req.params.leadId));
    const tagIds = atuais.map(a => a.tagId);
    io.to('imobiliaria:' + imobiliariaId).emit('lead:tags', { leadId: req.params.leadId, tagIds });
    res.json({ leadId: req.params.leadId, tagIds });
  });

  return router;
}
