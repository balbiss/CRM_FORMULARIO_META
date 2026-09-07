import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import type { Server as SocketServer } from 'socket.io';
import { db } from '../db/client.js';
import { roletas, filasAtendimento, perfis, sessoesWhatsapp } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { garantirRoletaPadrao } from '../lib/roleta.js';

const CANAIS = ['WhatsApp', 'Instagram', 'Facebook', 'Site', 'Indicacao', 'Manual'] as const;

export function roletasRouter(io: SocketServer) {
  const router = Router();
  router.use(requireAuth);

  const emit = (imobiliariaId: string) => io.to('imobiliaria:' + imobiliariaId).emit('roletas:mudou', {});

  // Lista as roletas com os membros (corretor + posição + plantão).
  router.get('/', async (req, res) => {
    const { imobiliariaId } = req.auth!;
    await garantirRoletaPadrao(imobiliariaId);
    const lista = await db.select().from(roletas)
      .where(eq(roletas.imobiliariaId, imobiliariaId)).orderBy(asc(roletas.ordem), asc(roletas.criadoEm));
    const membros = await db.select({
      roletaId: filasAtendimento.roletaId, corretorId: filasAtendimento.corretorId,
      posicao: filasAtendimento.posicao, ultimaAtribuicao: filasAtendimento.ultimaAtribuicao,
      nome: perfis.nome, emPlantao: perfis.emPlantao, bloqueado: perfis.bloqueado,
    }).from(filasAtendimento)
      .innerJoin(perfis, eq(perfis.id, filasAtendimento.corretorId))
      .where(eq(filasAtendimento.imobiliariaId, imobiliariaId))
      .orderBy(asc(filasAtendimento.posicao));

    res.json(lista.map(r => ({
      ...r,
      membros: membros.filter(m => m.roletaId === r.id).map(m => ({
        corretorId: m.corretorId, nome: m.nome, posicao: m.posicao, emPlantao: m.emPlantao, bloqueado: m.bloqueado,
      })),
    })));
  });

  router.use(requireRole('dono', 'gerente'));

  router.post('/', async (req, res) => {
    const parsed = z.object({ nome: z.string().min(1).max(80) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Nome obrigatório' });
    const { imobiliariaId } = req.auth!;
    const qtd = await db.select({ id: roletas.id }).from(roletas).where(eq(roletas.imobiliariaId, imobiliariaId));
    const [row] = await db.insert(roletas).values({ imobiliariaId, nome: parsed.data.nome.trim(), ordem: qtd.length }).returning();
    emit(imobiliariaId);
    res.status(201).json({ ...row, membros: [] });
  });

  const patchSchema = z.object({
    nome: z.string().min(1).max(80).optional(),
    ativa: z.boolean().optional(),
    padrao: z.boolean().optional(),
    canais: z.array(z.enum(CANAIS)).optional(),
    finalidade: z.enum(['venda', 'locacao', 'ambos']).optional(),
    sessaoWhatsappId: z.string().uuid().nullable().optional(),
  });

  router.patch('/:id', async (req, res) => {
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });
    const { imobiliariaId } = req.auth!;
    const [alvo] = await db.select().from(roletas)
      .where(and(eq(roletas.id, req.params.id), eq(roletas.imobiliariaId, imobiliariaId))).limit(1);
    if (!alvo) return res.status(404).json({ error: 'Roleta não encontrada' });

    if (parsed.data.sessaoWhatsappId) {
      const [s] = await db.select({ id: sessoesWhatsapp.id }).from(sessoesWhatsapp)
        .where(and(eq(sessoesWhatsapp.id, parsed.data.sessaoWhatsappId), eq(sessoesWhatsapp.imobiliariaId, imobiliariaId))).limit(1);
      if (!s) return res.status(400).json({ error: 'Número de WhatsApp inválido' });
    }
    // só uma roleta padrão por imobiliária
    if (parsed.data.padrao) {
      await db.update(roletas).set({ padrao: false }).where(and(eq(roletas.imobiliariaId, imobiliariaId), ne(roletas.id, alvo.id)));
    }
    const [row] = await db.update(roletas).set(parsed.data as Record<string, unknown>).where(eq(roletas.id, alvo.id)).returning();
    emit(imobiliariaId);
    res.json(row);
  });

  router.delete('/:id', async (req, res) => {
    const { imobiliariaId } = req.auth!;
    const [alvo] = await db.select().from(roletas)
      .where(and(eq(roletas.id, req.params.id), eq(roletas.imobiliariaId, imobiliariaId))).limit(1);
    if (!alvo) return res.status(404).json({ error: 'Roleta não encontrada' });
    if (alvo.padrao) return res.status(400).json({ error: 'Não dá pra excluir a roleta padrão — marque outra como padrão antes.' });
    const restantes = await db.select({ id: roletas.id }).from(roletas).where(eq(roletas.imobiliariaId, imobiliariaId));
    if (restantes.length <= 1) return res.status(400).json({ error: 'A imobiliária precisa de pelo menos uma roleta.' });
    await db.delete(roletas).where(eq(roletas.id, alvo.id));
    emit(imobiliariaId);
    res.json({ ok: true });
  });

  // Define a lista de membros de UMA roleta (corretorIds em ordem).
  router.put('/:id/membros', async (req, res) => {
    const parsed = z.object({ corretorIds: z.array(z.string().uuid()).max(200) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
    const { imobiliariaId } = req.auth!;
    const [alvo] = await db.select().from(roletas)
      .where(and(eq(roletas.id, req.params.id), eq(roletas.imobiliariaId, imobiliariaId))).limit(1);
    if (!alvo) return res.status(404).json({ error: 'Roleta não encontrada' });

    const validos = parsed.data.corretorIds.length
      ? (await db.select({ id: perfis.id }).from(perfis)
          .where(and(inArray(perfis.id, parsed.data.corretorIds), eq(perfis.imobiliariaId, imobiliariaId)))).map(p => p.id)
      : [];
    const ordenados = parsed.data.corretorIds.filter(id => validos.includes(id));

    const atuais = await db.select().from(filasAtendimento).where(eq(filasAtendimento.roletaId, alvo.id));
    const atuaisPorId = new Map(atuais.map(m => [m.corretorId, m]));

    // remove quem saiu
    for (const m of atuais) {
      if (!ordenados.includes(m.corretorId)) await db.delete(filasAtendimento).where(eq(filasAtendimento.id, m.id));
    }
    // insere/reordena
    for (let i = 0; i < ordenados.length; i++) {
      const ex = atuaisPorId.get(ordenados[i]);
      if (ex) {
        if (ex.posicao !== i) await db.update(filasAtendimento).set({ posicao: i }).where(eq(filasAtendimento.id, ex.id));
      } else {
        await db.insert(filasAtendimento).values({ imobiliariaId, roletaId: alvo.id, corretorId: ordenados[i], posicao: i });
      }
    }
    emit(imobiliariaId);
    res.json({ ok: true });
  });

  return router;
}
