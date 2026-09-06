import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { leads, colunasKanban, imobiliarias } from '../db/schema.js';
import { distribuirLead } from '../lib/roleta.js';
import type { Server as SocketServer } from 'socket.io';

/** Endpoint de ingestão de automação (n8n etc.) — sem JWT de usuário, protegido por segredo
 * compartilhado (CAPTACAO_SECRET), mesmo padrão de webhook de captação usado em outros projetos. */
export function captacaoRouter(io: SocketServer) {
  const router = Router();

  router.use((req, res, next) => {
    const secret = req.header('x-captacao-secret');
    if (!secret || secret !== process.env.CAPTACAO_SECRET) return res.status(401).json({ error: 'Não autorizado' });
    next();
  });

  const schema = z.object({
    // multi-tenant: o workflow n8n manda a imobiliária dona do lead. Sem isso, cai na primeira
    // do banco (compat com o modo single-tenant antigo — a remover quando o fluxo dinâmico entrar).
    imobiliariaId: z.string().uuid().optional(),
    nome: z.string().min(1),
    telefone: z.string().min(8),
    email: z.string().email().optional(),
    fotoUrl: z.string().url().optional(),
    imovelTitulo: z.string().optional(),
    campanha: z.string().optional(),
    canal: z.enum(['WhatsApp', 'Instagram', 'Facebook', 'Indicacao', 'Manual']).default('Facebook'),
  });

  router.post('/facebook', async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });

    const [imob] = parsed.data.imobiliariaId
      ? await db.select().from(imobiliarias).where(eq(imobiliarias.id, parsed.data.imobiliariaId)).limit(1)
      : await db.select().from(imobiliarias).limit(1);
    if (!imob) return res.status(parsed.data.imobiliariaId ? 404 : 500).json({ error: 'Imobiliária não encontrada' });

    const [colunaNova] = await db.select().from(colunasKanban)
      .where(and(eq(colunasKanban.imobiliariaId, imob.id), eq(colunasKanban.titulo, 'Lead Novo')))
      .limit(1);

    const [row] = await db.insert(leads).values({
      imobiliariaId: imob.id,
      nome: parsed.data.nome,
      telefone: parsed.data.telefone,
      email: parsed.data.email,
      fotoUrl: parsed.data.fotoUrl,
      imovelTitulo: parsed.data.imovelTitulo,
      campanha: parsed.data.campanha,
      canal: parsed.data.canal,
      colunaId: colunaNova?.id,
    }).returning();

    io.to('imobiliaria:' + imob.id).emit('lead:created', row);
    res.status(201).json(row);

    distribuirLead(io, imob.id, row.id).catch(e => console.error('roleta captação:', (e as Error).message));
  });

  return router;
}
