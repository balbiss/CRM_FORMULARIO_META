import { Router } from 'express';
import { z } from 'zod';
import { and, eq, gte, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { imobiliarias, perfis, leads, sessoesWhatsapp, HORARIO_ATENDIMENTO_PADRAO } from '../db/schema.js';
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

// Avisar o corretor por WhatsApp (número central) quando um lead cai pra ele pela roleta —
// ele assume o atendimento pelo PRÓPRIO celular, fora do CRM. Só faz sentido com modo 'central'.
configRouter.get('/notificar-corretor', async (req, res) => {
  const [imob] = await db.select({ v: imobiliarias.notificarCorretorWhatsapp })
    .from(imobiliarias).where(eq(imobiliarias.id, req.auth!.imobiliariaId)).limit(1);
  res.json({ notificarCorretorWhatsapp: imob?.v ?? false });
});

configRouter.put('/notificar-corretor', requireRole('dono', 'gerente'), async (req, res) => {
  const parsed = z.object({ notificarCorretorWhatsapp: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Valor inválido' });
  await db.update(imobiliarias).set({ notificarCorretorWhatsapp: parsed.data.notificarCorretorWhatsapp }).where(eq(imobiliarias.id, req.auth!.imobiliariaId));
  res.json({ notificarCorretorWhatsapp: parsed.data.notificarCorretorWhatsapp });
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

// Dados da imobiliária (Ajustes → Imobiliária). Todo mundo lê; só Dono/Gerente altera.
configRouter.get('/imobiliaria', async (req, res) => {
  const [imob] = await db.select({ nome: imobiliarias.nome, cnpj: imobiliarias.cnpj, endereco: imobiliarias.endereco })
    .from(imobiliarias).where(eq(imobiliarias.id, req.auth!.imobiliariaId)).limit(1);
  res.json(imob ?? { nome: '', cnpj: null, endereco: null });
});

configRouter.put('/imobiliaria', requireRole('dono', 'gerente'), async (req, res) => {
  const parsed = z.object({
    nome: z.string().trim().min(2, 'Informe o nome da imobiliária').max(120),
    cnpj: z.string().trim().max(30).nullable().optional(),
    endereco: z.string().trim().max(250).nullable().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });
  const dados = { nome: parsed.data.nome, cnpj: parsed.data.cnpj || null, endereco: parsed.data.endereco || null };
  await db.update(imobiliarias).set(dados).where(eq(imobiliarias.id, req.auth!.imobiliariaId));
  res.json(dados);
});

// Uso real (Ajustes → Uso): corretores ativos x limite do plano, leads do mês, números conectados.
configRouter.get('/uso', requireRole('dono', 'gerente'), async (req, res) => {
  const imobId = req.auth!.imobiliariaId;
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const [imob] = await db.select({ limite: imobiliarias.limiteCorretores }).from(imobiliarias).where(eq(imobiliarias.id, imobId)).limit(1);
  const [{ corretores }] = await db.select({ corretores: sql<number>`count(*)::int` }).from(perfis)
    .where(and(eq(perfis.imobiliariaId, imobId), eq(perfis.role, 'corretor'), eq(perfis.bloqueado, false)));
  const [{ leadsMes }] = await db.select({ leadsMes: sql<number>`count(*)::int` }).from(leads)
    .where(and(eq(leads.imobiliariaId, imobId), gte(leads.criadoEm, inicioMes)));
  const [{ numeros }] = await db.select({ numeros: sql<number>`count(*)::int` }).from(sessoesWhatsapp)
    .where(and(eq(sessoesWhatsapp.imobiliariaId, imobId), eq(sessoesWhatsapp.status, 'conectada')));
  const [{ equipe }] = await db.select({ equipe: sql<number>`count(*)::int` }).from(perfis)
    .where(and(eq(perfis.imobiliariaId, imobId), ne(perfis.role, 'corretor'), eq(perfis.bloqueado, false)));
  res.json({ corretoresAtivos: corretores, limiteCorretores: imob?.limite ?? 0, gestores: equipe, leadsMes, numerosConectados: numeros });
});

  return configRouter;
}
