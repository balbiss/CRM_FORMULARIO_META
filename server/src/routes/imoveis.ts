import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { imoveis } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const imoveisRouter = Router();
imoveisRouter.use(requireAuth);

// Catálogo é da imobiliária inteira — todo mundo vê (corretor precisa consultar pra falar com
// lead), mas só Dono/Gerente cadastram/editam/excluem (mesma régua da Equipe).

imoveisRouter.get('/', async (req, res) => {
  const rows = await db.select().from(imoveis).where(eq(imoveis.imobiliariaId, req.auth!.imobiliariaId));
  res.json(rows);
});

const bodySchema = z.object({
  tipo: z.string().min(1),
  finalidade: z.string().min(1),
  titulo: z.string().min(1),
  endereco: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
  preco: z.number().nonnegative(),
  area: z.number().nonnegative().nullable().optional(),
  quartos: z.number().int().nonnegative().optional(),
  suites: z.number().int().nonnegative().optional(),
  banheiros: z.number().int().nonnegative().optional(),
  vagas: z.number().int().nonnegative().optional(),
  amenidades: z.array(z.string()).optional(),
  descricao: z.string().nullable().optional(),
  imagens: z.array(z.string()).optional(),
  videoUrl: z.string().nullable().optional(),
  situacao: z.enum(['Pronto para morar', 'Em obras', 'Lançamento']).optional(),
  previsaoEntrega: z.string().nullable().optional(),
  aceitaFinanciamento: z.boolean().optional(),
  valorCondominio: z.number().nonnegative().nullable().optional(),
  valorIptu: z.number().nonnegative().nullable().optional(),
});

imoveisRouter.post('/', requireRole('dono', 'gerente'), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  const { preco, area, valorCondominio, valorIptu, ...rest } = parsed.data;
  const [row] = await db.insert(imoveis).values({
    imobiliariaId: req.auth!.imobiliariaId,
    preco: String(preco),
    area: area != null ? String(area) : null,
    valorCondominio: valorCondominio != null ? String(valorCondominio) : null,
    valorIptu: valorIptu != null ? String(valorIptu) : null,
    ...rest,
  }).returning();
  res.status(201).json(row);
});

const updateSchema = bodySchema.partial();

imoveisRouter.patch('/:id', requireRole('dono', 'gerente'), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  const [existe] = await db.select({ id: imoveis.id }).from(imoveis)
    .where(and(eq(imoveis.id, req.params.id), eq(imoveis.imobiliariaId, req.auth!.imobiliariaId))).limit(1);
  if (!existe) return res.status(404).json({ error: 'Imóvel não encontrado' });

  const { preco, area, valorCondominio, valorIptu, ...rest } = parsed.data;
  const patch: Record<string, unknown> = { ...rest };
  if (preco !== undefined) patch.preco = String(preco);
  if (area !== undefined) patch.area = area != null ? String(area) : null;
  if (valorCondominio !== undefined) patch.valorCondominio = valorCondominio != null ? String(valorCondominio) : null;
  if (valorIptu !== undefined) patch.valorIptu = valorIptu != null ? String(valorIptu) : null;

  const [row] = await db.update(imoveis).set(patch).where(eq(imoveis.id, req.params.id)).returning();
  res.json(row);
});

imoveisRouter.delete('/:id', requireRole('dono', 'gerente'), async (req, res) => {
  const [existe] = await db.select({ id: imoveis.id }).from(imoveis)
    .where(and(eq(imoveis.id, req.params.id), eq(imoveis.imobiliariaId, req.auth!.imobiliariaId))).limit(1);
  if (!existe) return res.status(404).json({ error: 'Imóvel não encontrado' });
  await db.delete(imoveis).where(eq(imoveis.id, req.params.id));
  res.json({ ok: true });
});
