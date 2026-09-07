import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { imobiliarias, HORARIO_ATENDIMENTO_PADRAO } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import type { Server as SocketServer } from 'socket.io';

export function configRouter(io: SocketServer) {
const configRouter = Router();
configRouter.use(requireAuth);

/** Horário de atendimento da equipe — controla quando o corretor pode ficar "No Plantão".
 *  Todo mundo lê (o front precisa saber); só Dono/Gerente altera. */
configRouter.get('/horario', async (req, res) => {
  const [imob] = await db.select({ h: imobiliarias.horarioAtendimento })
    .from(imobiliarias).where(eq(imobiliarias.id, req.auth!.imobiliariaId)).limit(1);
  res.json(imob?.h && imob.h.length === 7 ? imob.h : HORARIO_ATENDIMENTO_PADRAO);
});

const diaSchema = z.object({
  ativo: z.boolean(),
  abreMin: z.number().int().min(0).max(1439),
  fechaMin: z.number().int().min(1).max(1440),
}).refine(d => d.fechaMin > d.abreMin, { message: 'O horário de fechamento tem que ser depois do de abertura' });

const bodySchema = z.array(diaSchema).length(7);

configRouter.put('/horario', requireRole('dono', 'gerente'), async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Configuração inválida (7 dias, minutos 0–1440)' });
  await db.update(imobiliarias).set({ horarioAtendimento: parsed.data }).where(eq(imobiliarias.id, req.auth!.imobiliariaId));
  // avisa a equipe conectada pra atualizar o horário na hora (senão o corretor fica com o antigo até recarregar)
  io.to('imobiliaria:' + req.auth!.imobiliariaId).emit('horario:mudou', parsed.data);
  res.json(parsed.data);
});

/** Modo de atendimento no WhatsApp: 'central' (número único da imobiliária, todo mundo
 *  atende pelo CRM) ou 'corretor' (cada corretor usa o próprio número). */
configRouter.get('/whatsapp', async (req, res) => {
  const [imob] = await db.select({ modo: imobiliarias.modoWhatsapp })
    .from(imobiliarias).where(eq(imobiliarias.id, req.auth!.imobiliariaId)).limit(1);
  res.json({ modo: imob?.modo ?? 'corretor' });
});

configRouter.put('/whatsapp', requireRole('dono', 'gerente'), async (req, res) => {
  const parsed = z.object({ modo: z.enum(['central', 'corretor']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Modo inválido' });
  await db.update(imobiliarias).set({ modoWhatsapp: parsed.data.modo }).where(eq(imobiliarias.id, req.auth!.imobiliariaId));
  res.json({ modo: parsed.data.modo });
});

// Limite de rebatidas que cada corretor pode puxar do bolsão por dia (0 = ilimitado).
configRouter.get('/rebatidas', async (req, res) => {
  const [imob] = await db.select({ limite: imobiliarias.limiteRebatidasDia })
    .from(imobiliarias).where(eq(imobiliarias.id, req.auth!.imobiliariaId)).limit(1);
  res.json({ limiteRebatidasDia: imob?.limite ?? 0 });
});

configRouter.put('/rebatidas', requireRole('dono', 'gerente'), async (req, res) => {
  const parsed = z.object({ limiteRebatidasDia: z.number().int().min(0).max(200) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Valor inválido' });
  await db.update(imobiliarias).set({ limiteRebatidasDia: parsed.data.limiteRebatidasDia }).where(eq(imobiliarias.id, req.auth!.imobiliariaId));
  io.to('imobiliaria:' + req.auth!.imobiliariaId).emit('config:rebatidas', { limiteRebatidasDia: parsed.data.limiteRebatidasDia });
  res.json({ limiteRebatidasDia: parsed.data.limiteRebatidasDia });
});

  return configRouter;
}
