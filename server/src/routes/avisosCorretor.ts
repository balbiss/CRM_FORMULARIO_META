import { Router } from 'express';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { avisosCorretorWhatsapp } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const secret = () => process.env.N8N_AVISO_RESULTADO_SECRET || 'sem-segredo';

const resultadoSchema = z.object({
  imobiliariaId: z.string().uuid(),
  leadId: z.string().uuid().nullable().optional(),
  leadNome: z.string().min(1),
  corretorId: z.string().uuid().nullable().optional(),
  corretorNome: z.string().min(1),
  sucesso: z.boolean(),
  erro: z.string().nullable().optional(),
});

export function avisosCorretorRouter() {
  const router = Router();

  // Chamado pelo n8n logo depois de tentar mandar a mensagem (sucesso ou erro) — sem JWT,
  // autenticado por secret na query (mesmo padrão dos outros webhooks deste backend).
  router.post('/resultado', async (req, res) => {
    if (req.query.secret !== secret()) return res.status(401).json({ error: 'secret inválido' });
    const parsed = resultadoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'payload inválido' });
    const [row] = await db.insert(avisosCorretorWhatsapp).values({
      imobiliariaId: parsed.data.imobiliariaId,
      leadId: parsed.data.leadId ?? null,
      leadNome: parsed.data.leadNome,
      corretorId: parsed.data.corretorId ?? null,
      corretorNome: parsed.data.corretorNome,
      sucesso: parsed.data.sucesso,
      erro: parsed.data.erro ?? null,
    }).returning();
    res.status(201).json(row);
  });

  // Lista os últimos avisos da imobiliária — Dono/Gerente, pra tela de acompanhamento.
  router.get('/', requireAuth, requireRole('dono', 'gerente'), async (req, res) => {
    const rows = await db.select().from(avisosCorretorWhatsapp)
      .where(eq(avisosCorretorWhatsapp.imobiliariaId, req.auth!.imobiliariaId))
      .orderBy(desc(avisosCorretorWhatsapp.criadoEm))
      .limit(300);
    res.json(rows);
  });

  return router;
}
