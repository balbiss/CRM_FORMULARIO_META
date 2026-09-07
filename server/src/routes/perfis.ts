import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { perfis, filasAtendimento, roletas, imobiliarias } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { garantirRoletaPadrao } from '../lib/roleta.js';
import type { Server as SocketServer } from 'socket.io';

function pluck(row: typeof perfis.$inferSelect) {
  return { id: row.id, nome: row.nome, email: row.email, role: row.role, telefone: row.telefone, bloqueado: row.bloqueado, emPlantao: row.emPlantao };
}

/** Ajusta as roletas que um corretor participa. `roletaIds` = lista final desejada. */
async function sincronizarRoletas(imobiliariaId: string, corretorId: string, roletaIds: string[]) {
  const daImob = await db.select({ id: roletas.id }).from(roletas).where(eq(roletas.imobiliariaId, imobiliariaId));
  const validas = roletaIds.filter(id => daImob.some(r => r.id === id));
  const atuais = await db.select().from(filasAtendimento).where(eq(filasAtendimento.corretorId, corretorId));

  for (const m of atuais) {
    if (m.roletaId && !validas.includes(m.roletaId)) await db.delete(filasAtendimento).where(eq(filasAtendimento.id, m.id));
  }
  for (const rid of validas) {
    if (atuais.some(m => m.roletaId === rid)) continue;
    const na = await db.select({ posicao: filasAtendimento.posicao }).from(filasAtendimento).where(eq(filasAtendimento.roletaId, rid));
    const proxima = na.reduce((mx, r) => Math.max(mx, r.posicao), -1) + 1;
    await db.insert(filasAtendimento).values({ imobiliariaId, roletaId: rid, corretorId, posicao: proxima });
  }
}

export function perfisRouter(io: SocketServer) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const { imobiliariaId } = req.auth!;
    const rows = await db
      .select({ id: perfis.id, nome: perfis.nome, email: perfis.email, role: perfis.role, telefone: perfis.telefone, bloqueado: perfis.bloqueado, emPlantao: perfis.emPlantao })
      .from(perfis)
      .where(eq(perfis.imobiliariaId, imobiliariaId));
    const memb = await db.select({ corretorId: filasAtendimento.corretorId, roletaId: filasAtendimento.roletaId })
      .from(filasAtendimento).where(eq(filasAtendimento.imobiliariaId, imobiliariaId));
    res.json(rows.map(r => ({
      ...r,
      roletaIds: memb.filter(m => m.corretorId === r.id && m.roletaId).map(m => m.roletaId),
    })));
  });

  const createSchema = z.object({
    nome: z.string().min(2),
    email: z.string().email(),
    telefone: z.string().optional(),
    role: z.enum(['gerente', 'corretor']).default('corretor'),
    roletaIds: z.array(z.string().uuid()).optional(),
  });

  router.post('/', requireRole('dono', 'gerente'), async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos — confira nome e e-mail' });
    const { imobiliariaId, role: minhaRole } = req.auth!;
    if (parsed.data.role === 'gerente' && minhaRole !== 'dono') {
      return res.status(403).json({ error: 'Só o dono pode convidar outro gerente' });
    }

    const email = parsed.data.email.toLowerCase();
    const [existe] = await db.select({ id: perfis.id }).from(perfis).where(eq(perfis.email, email)).limit(1);
    if (existe) return res.status(409).json({ error: 'Já existe um perfil com esse e-mail' });

    // Teto de corretores definido pelo dono do SaaS (0 = ilimitado).
    if (parsed.data.role === 'corretor') {
      const [imob] = await db.select({ limite: imobiliarias.limiteCorretores }).from(imobiliarias).where(eq(imobiliarias.id, imobiliariaId)).limit(1);
      const limite = imob?.limite ?? 0;
      if (limite > 0) {
        const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(perfis)
          .where(and(eq(perfis.imobiliariaId, imobiliariaId), eq(perfis.role, 'corretor')));
        if (n >= limite) return res.status(403).json({ error: `Limite de ${limite} corretores atingido. Fale com o suporte da Visita IA para ampliar o plano.` });
      }
    }

    const senhaHash = await bcrypt.hash('123456', 10);
    const [inserido] = await db.insert(perfis).values({
      imobiliariaId, nome: parsed.data.nome, email, senhaHash,
      role: parsed.data.role, telefone: parsed.data.telefone,
    }).returning();

    if (parsed.data.role === 'corretor') {
      const alvo = parsed.data.roletaIds?.length ? parsed.data.roletaIds : [await garantirRoletaPadrao(imobiliariaId)];
      await sincronizarRoletas(imobiliariaId, inserido.id, alvo);
    }

    const perfil = pluck(inserido);
    io.to('imobiliaria:' + imobiliariaId).emit('perfil:criado', perfil);
    res.status(201).json(perfil);
  });

  const updateSchema = z.object({
    nome: z.string().min(2).optional(),
    telefone: z.string().nullable().optional(),
    roletaIds: z.array(z.string().uuid()).optional(),
  });

  router.patch('/:id', requireRole('dono', 'gerente'), async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
    const { imobiliariaId, role } = req.auth!;

    const [alvo] = await db.select().from(perfis).where(and(eq(perfis.id, req.params.id), eq(perfis.imobiliariaId, imobiliariaId))).limit(1);
    if (!alvo) return res.status(404).json({ error: 'Perfil não encontrado' });
    if (role === 'gerente' && alvo.role !== 'corretor') return res.status(403).json({ error: 'Gerente só edita corretores' });

    const { roletaIds, ...campos } = parsed.data;
    const [row] = Object.keys(campos).length
      ? await db.update(perfis).set(campos).where(eq(perfis.id, alvo.id)).returning()
      : [alvo];
    if (roletaIds && alvo.role === 'corretor') {
      await sincronizarRoletas(imobiliariaId, alvo.id, roletaIds);
      io.to('imobiliaria:' + imobiliariaId).emit('roletas:mudou', {});
    }
    const perfil = pluck(row);
    io.to('imobiliaria:' + imobiliariaId).emit('perfil:atualizado', perfil);
    res.json(perfil);
  });

  router.patch('/:id/bloquear', requireRole('dono', 'gerente'), async (req, res) => {
    const { imobiliariaId, role } = req.auth!;
    const [alvo] = await db.select().from(perfis).where(and(eq(perfis.id, req.params.id), eq(perfis.imobiliariaId, imobiliariaId))).limit(1);
    if (!alvo) return res.status(404).json({ error: 'Perfil não encontrado' });
    if (role === 'gerente' && alvo.role !== 'corretor') return res.status(403).json({ error: 'Gerente só bloqueia corretores' });

    const bloqueado = !alvo.bloqueado;
    // Bloquear tira automaticamente da roleta — mesma regra do CRM original.
    const emPlantao = bloqueado ? false : alvo.emPlantao;
    const [row] = await db.update(perfis).set({ bloqueado, emPlantao }).where(eq(perfis.id, alvo.id)).returning();

    const perfil = pluck(row);
    io.to('imobiliaria:' + imobiliariaId).emit('perfil:atualizado', perfil);
    if (row.emPlantao !== alvo.emPlantao) {
      io.to('imobiliaria:' + imobiliariaId).emit('fila:atualizada', { corretorId: row.id, emPlantao: row.emPlantao });
    }
    res.json(perfil);
  });

  // Redefinir senha de um subordinado: gera uma senha temporária mostrada uma vez pra quem
  // redefiniu repassar. Atende o fluxo "esqueci minha senha" (o pedido chega como notificação).
  router.post('/:id/redefinir-senha', requireRole('dono', 'gerente'), async (req, res) => {
    const { imobiliariaId, role } = req.auth!;
    const [alvo] = await db.select().from(perfis).where(and(eq(perfis.id, req.params.id), eq(perfis.imobiliariaId, imobiliariaId))).limit(1);
    if (!alvo) return res.status(404).json({ error: 'Perfil não encontrado' });
    if (role === 'gerente' && alvo.role !== 'corretor') return res.status(403).json({ error: 'Gerente só redefine senha de corretores' });

    const senhaTemporaria = 'vi' + Math.random().toString(36).slice(2, 8);
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10);
    await db.update(perfis).set({ senhaHash }).where(eq(perfis.id, alvo.id));
    res.json({ ok: true, senhaTemporaria });
  });

  router.delete('/:id', requireRole('dono'), async (req, res) => {
    const { imobiliariaId, sub } = req.auth!;
    if (req.params.id === sub) return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário' });

    const [alvo] = await db.select().from(perfis).where(and(eq(perfis.id, req.params.id), eq(perfis.imobiliariaId, imobiliariaId))).limit(1);
    if (!alvo) return res.status(404).json({ error: 'Perfil não encontrado' });

    await db.delete(perfis).where(eq(perfis.id, alvo.id));
    io.to('imobiliaria:' + imobiliariaId).emit('perfil:removido', { id: alvo.id });
    res.json({ ok: true });
  });

  return router;
}
