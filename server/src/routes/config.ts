import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { imobiliarias, HORARIO_ATENDIMENTO_PADRAO } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const configRouter = Router();
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
  res.json(parsed.data);
});
