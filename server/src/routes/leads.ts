import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { leads, leadTags } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
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
    valor: z.number().optional(),
    canal: z.enum(['WhatsApp', 'Instagram', 'Facebook', 'Indicacao', 'Manual']).default('Manual'),
    colunaId: z.string().uuid().optional(),
    corretorId: z.string().uuid().optional(),
  });

  router.post('/', async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });
    const { imobiliariaId } = req.auth!;
    const [row] = await db.insert(leads).values({ ...parsed.data, imobiliariaId, valor: parsed.data.valor?.toString() }).returning();
    io.to('imobiliaria:' + imobiliariaId).emit('lead:created', row);
    res.status(201).json(row);
  });

  const moveSchema = z.object({ colunaId: z.string().uuid() });

  router.patch('/:id/mover', async (req, res) => {
    const parsed = moveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'colunaId inválido' });
    const { imobiliariaId, role, sub } = req.auth!;

    const scoped = role === 'corretor'
      ? and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId));

    const [row] = await db.update(leads)
      .set({ colunaId: parsed.data.colunaId, entrouNaColunaEm: new Date() })
      .where(scoped)
      .returning();
    if (!row) return res.status(404).json({ error: 'Lead não encontrado' });
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
    const { imobiliariaId, role, sub } = req.auth!;
    const scoped = role === 'corretor'
      ? and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId), eq(leads.corretorId, sub))
      : and(eq(leads.id, req.params.id), eq(leads.imobiliariaId, imobiliariaId));

    const { rendaDeclarada, ...rest } = parsed.data;
    const [row] = await db.update(leads)
      .set({ ...rest, ...(rendaDeclarada != null ? { rendaDeclarada: rendaDeclarada.toString() } : {}) })
      .where(scoped)
      .returning();
    if (!row) return res.status(404).json({ error: 'Lead não encontrado' });
    io.to('imobiliaria:' + imobiliariaId).emit('lead:updated', row);
    res.json(row);
  });

  return router;
}
