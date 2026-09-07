import { Router } from 'express';
import { z } from 'zod';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { filasAtendimento, roletas, perfis, imobiliarias, distribuicaoLog, leads } from '../db/schema.js';
import { desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { isBusinessHoursOpen, horarioAtendimentoLabel } from '../lib/schedule.js';
import { distribuirPendentes, garantirRoletaPadrao } from '../lib/roleta.js';
import type { Server as SocketServer } from 'socket.io';

export function filasRouter(io: SocketServer) {
  const router = Router();
  router.use(requireAuth);

  // Corretores que participam de ALGUMA roleta (deduplicado) — usado pra saber quem vê o toggle
  // de plantão e pra tela da Roleta. A posição por roleta fica em /api/roletas.
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

    const vistos = new Set<string>();
    const unico = rows.filter(r => (vistos.has(r.corretorId) ? false : vistos.add(r.corretorId)));
    res.json(unico);
  });

  // Histórico de distribuição da roleta (últimas 100). Corretor vê só as dele.
  router.get('/log', async (req, res) => {
    const { imobiliariaId, role, sub } = req.auth!;
    const base = eq(distribuicaoLog.imobiliariaId, imobiliariaId);
    const rows = await db
      .select({
        criadoEm: distribuicaoLog.criadoEm,
        origem: distribuicaoLog.origem,
        roletaNome: roletas.nome,
        leadNome: leads.nome,
        corretorNome: perfis.nome,
        corretorId: distribuicaoLog.corretorId,
      })
      .from(distribuicaoLog)
      .innerJoin(leads, eq(leads.id, distribuicaoLog.leadId))
      .innerJoin(perfis, eq(perfis.id, distribuicaoLog.corretorId))
      .leftJoin(roletas, eq(roletas.id, distribuicaoLog.roletaId))
      .where(role === 'corretor' ? and(base, eq(distribuicaoLog.corretorId, sub)) : base)
      .orderBy(desc(distribuicaoLog.criadoEm))
      .limit(100);
    res.json(rows);
  });

  const toggleSchema = z.object({ corretorId: z.string().uuid() });

  router.patch('/disponibilidade', async (req, res) => {
    const parsed = toggleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'corretorId inválido' });
    const { imobiliariaId, role, sub } = req.auth!;

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
      const [imob] = await db.select({ h: imobiliarias.horarioAtendimento }).from(imobiliarias).where(eq(imobiliarias.id, imobiliariaId)).limit(1);
      if (!isBusinessHoursOpen(imob?.h)) return res.status(403).json({ error: horarioAtendimentoLabel(imob?.h) });

      // Se o corretor não participa de NENHUMA roleta, entra na padrão (senão ficar online não
      // adianta nada). Se já é membro de alguma, respeita o que o gerente configurou.
      const [jaTem] = await db.select({ id: filasAtendimento.id }).from(filasAtendimento)
        .where(eq(filasAtendimento.corretorId, parsed.data.corretorId)).limit(1);
      if (!jaTem) {
        const roletaId = await garantirRoletaPadrao(imobiliariaId);
        const existentes = await db.select({ posicao: filasAtendimento.posicao }).from(filasAtendimento)
          .where(eq(filasAtendimento.roletaId, roletaId));
        const proxima = existentes.reduce((m, r) => Math.max(m, r.posicao), -1) + 1;
        await db.insert(filasAtendimento).values({ imobiliariaId, roletaId, corretorId: parsed.data.corretorId, posicao: proxima });
      }
    }

    const [row] = await db.update(perfis)
      .set({ emPlantao: vaiLigar })
      .where(eq(perfis.id, parsed.data.corretorId))
      .returning();

    io.to('imobiliaria:' + imobiliariaId).emit('fila:atualizada', { corretorId: row.id, emPlantao: row.emPlantao });
    io.to('imobiliaria:' + imobiliariaId).emit('roletas:mudou', {});
    res.json({ corretorId: row.id, emPlantao: row.emPlantao });

    if (vaiLigar) distribuirPendentes(io, imobiliariaId).catch(e => console.error('roleta pendentes:', (e as Error).message));
  });

  router.post('/distribuir', async (req, res) => {
    const { imobiliariaId, role } = req.auth!;
    if (role === 'corretor') return res.status(403).json({ error: 'Só dono ou gerente pode distribuir a roleta' });
    const n = await distribuirPendentes(io, imobiliariaId);
    res.json({ distribuidos: n });
  });

  // Embaralha a ordem dos membros de TODAS as roletas.
  router.post('/embaralhar', async (req, res) => {
    const { imobiliariaId, role } = req.auth!;
    if (role === 'corretor') return res.status(403).json({ error: 'Só dono ou gerente pode embaralhar a roleta' });

    const lista = await db.select({ id: roletas.id }).from(roletas).where(eq(roletas.imobiliariaId, imobiliariaId));
    for (const r of lista) {
      const membros = await db.select().from(filasAtendimento).where(eq(filasAtendimento.roletaId, r.id));
      const shuffled = [...membros].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shuffled.length; i++) {
        await db.update(filasAtendimento).set({ posicao: i }).where(eq(filasAtendimento.id, shuffled[i].id));
      }
    }
    io.to('imobiliaria:' + imobiliariaId).emit('fila:embaralhada', {});
    io.to('imobiliaria:' + imobiliariaId).emit('roletas:mudou', {});
    res.json({ ok: true });
  });

  return router;
}
