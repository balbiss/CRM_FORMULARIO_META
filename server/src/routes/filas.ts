import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { filasAtendimento, perfis } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { isBusinessHoursOpen, horarioAtendimentoLabel } from '../lib/schedule.js';
import type { Server as SocketServer } from 'socket.io';

export function filasRouter(io: SocketServer) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const rows = await db
      .select({
        corretorId: filasAtendimento.corretorId,
        posicao: filasAtendimento.posicao,
        nome: perfis.nome,
        emPlantao: perfis.emPlantao,
        bloqueado: perfis.bloqueado,
      })
      .from(filasAtendimento)
      .innerJoin(perfis, eq(perfis.id, filasAtendimento.corretorId))
      .where(eq(filasAtendimento.imobiliariaId, req.auth!.imobiliariaId))
      .orderBy(asc(filasAtendimento.posicao));
    res.json(rows);
  });

  const toggleSchema = z.object({ corretorId: z.string().uuid() });

  router.patch('/disponibilidade', async (req, res) => {
    const parsed = toggleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'corretorId inválido' });
    const { imobiliariaId, role, sub } = req.auth!;

    // Um corretor só liga/desliga a própria disponibilidade; dono/gerente mexem em qualquer um.
    if (role === 'corretor' && parsed.data.corretorId !== sub) {
      return res.status(403).json({ error: 'Só o gerente altera a disponibilidade de outro corretor' });
    }

    const [alvo] = await db.select().from(perfis)
      .where(and(eq(perfis.id, parsed.data.corretorId), eq(perfis.imobiliariaId, imobiliariaId)))
      .limit(1);
    if (!alvo) return res.status(404).json({ error: 'Corretor não encontrado' });

    const vaiLigar = !alvo.emPlantao;
    if (vaiLigar) {
      if (alvo.bloqueado) return res.status(403).json({ error: alvo.nome + ' está com acesso bloqueado — não pode entrar na roleta' });
      if (!isBusinessHoursOpen()) return res.status(403).json({ error: horarioAtendimentoLabel() });
    }

    const [row] = await db.update(perfis)
      .set({ emPlantao: vaiLigar })
      .where(eq(perfis.id, parsed.data.corretorId))
      .returning();

    io.to('imobiliaria:' + imobiliariaId).emit('fila:atualizada', { corretorId: row.id, emPlantao: row.emPlantao });
    res.json({ corretorId: row.id, emPlantao: row.emPlantao });
  });

  router.post('/embaralhar', async (req, res) => {
    const { imobiliariaId, role } = req.auth!;
    if (role === 'corretor') return res.status(403).json({ error: 'Só dono ou gerente pode embaralhar a roleta' });

    const rows = await db.select().from(filasAtendimento).where(eq(filasAtendimento.imobiliariaId, imobiliariaId));
    const embaralhados = [...rows].sort(() => Math.random() - 0.5);
    for (let i = 0; i < embaralhados.length; i++) {
      await db.update(filasAtendimento).set({ posicao: i }).where(eq(filasAtendimento.id, embaralhados[i].id));
    }
    io.to('imobiliaria:' + imobiliariaId).emit('fila:embaralhada', {});
    res.json({ ok: true });
  });

  return router;
}
