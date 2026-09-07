import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { leads, colunasKanban, imobiliarias } from '../db/schema.js';
import { distribuirLead } from '../lib/roleta.js';
import { registrarEvento } from '../lib/eventos.js';
import type { Server as SocketServer } from 'socket.io';

const soDigitos = (s: string) => (s || '').replace(/[^0-9]/g, '');

async function criarLead(io: SocketServer, imobId: string, dados: {
  nome: string; telefone: string; email?: string; mensagem?: string;
  imovelTitulo?: string; campanha?: string; canal: string;
}) {
  const [colunaNova] = await db.select().from(colunasKanban)
    .where(and(eq(colunasKanban.imobiliariaId, imobId), eq(colunasKanban.titulo, 'Lead Novo'))).limit(1);

  const [row] = await db.insert(leads).values({
    imobiliariaId: imobId,
    nome: dados.nome.trim(),
    telefone: dados.telefone.trim(),
    email: dados.email?.trim() || null,
    imovelTitulo: dados.imovelTitulo?.trim() || null,
    imovelSub: dados.mensagem?.trim() || null,
    campanha: dados.campanha?.trim() || null,
    canal: dados.canal as any,
    colunaId: colunaNova?.id,
  }).returning();

  registrarEvento(imobId, row.id, 'criado', 'Lead recebido pelo formulário (' + dados.canal + (dados.campanha ? ' · ' + dados.campanha : '') + ')', row.nome);
  io.to('imobiliaria:' + imobId).emit('lead:created', row);
  distribuirLead(io, imobId, row.id).catch(e => console.error('roleta captação:', (e as Error).message));
  return row;
}

export function captacaoRouter(io: SocketServer) {
  const router = Router();

  // ---------------------------------------------------------------
  // Webhook do FORMULÁRIO DO SITE da imobiliária (landing Lovable etc.)
  // Sem header — o token vai na URL, pra facilitar em ferramenta no-code.
  // CORS liberado: a página fica num domínio de terceiro.
  // ---------------------------------------------------------------
  const cors = (_req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  };
  router.options('/site/:token', cors, (_req, res) => res.sendStatus(204));

  const siteSchema = z.object({
    nome: z.string().min(1, 'nome é obrigatório'),
    telefone: z.string().min(8, 'telefone inválido'),
    email: z.string().email().optional().or(z.literal('')),
    mensagem: z.string().max(2000).optional(),
    imovel: z.string().max(300).optional(),
    campanha: z.string().max(200).optional(),
  }).passthrough();

  router.post('/site/:token', cors, async (req, res) => {
    const token = req.params.token;
    if (!token || token.length < 12) return res.status(404).json({ error: 'Link inválido' });
    const [imob] = await db.select({ id: imobiliarias.id, status: imobiliarias.status })
      .from(imobiliarias).where(eq(imobiliarias.capturaToken, token)).limit(1);
    if (!imob) return res.status(404).json({ error: 'Link inválido' });
    if (imob.status !== 'ativa') return res.status(403).json({ error: 'Imobiliária inativa' });

    const parsed = siteSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });
    if (!soDigitos(parsed.data.telefone)) return res.status(400).json({ error: 'telefone inválido' });

    const lead = await criarLead(io, imob.id, {
      nome: parsed.data.nome,
      telefone: parsed.data.telefone,
      email: parsed.data.email || undefined,
      mensagem: parsed.data.mensagem,
      imovelTitulo: parsed.data.imovel,
      campanha: parsed.data.campanha,
      canal: 'Site',
    });
    res.status(201).json({ ok: true, id: lead.id });
  });

  // ---------------------------------------------------------------
  // Ingestão de automação (n8n) — protegido por CAPTACAO_SECRET no header.
  // ---------------------------------------------------------------
  router.use((req, res, next) => {
    const secret = req.header('x-captacao-secret');
    if (!secret || secret !== process.env.CAPTACAO_SECRET) return res.status(401).json({ error: 'Não autorizado' });
    next();
  });

  const schema = z.object({
    imobiliariaId: z.string().uuid().optional(),
    nome: z.string().min(1),
    telefone: z.string().min(8),
    email: z.string().email().optional(),
    fotoUrl: z.string().url().optional(),
    imovelTitulo: z.string().optional(),
    campanha: z.string().optional(),
    canal: z.enum(['WhatsApp', 'Instagram', 'Facebook', 'Indicacao', 'Manual', 'Site']).default('Facebook'),
  });

  router.post('/facebook', async (req, res) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });

    const [imob] = parsed.data.imobiliariaId
      ? await db.select().from(imobiliarias).where(eq(imobiliarias.id, parsed.data.imobiliariaId)).limit(1)
      : await db.select().from(imobiliarias).limit(1);
    if (!imob) return res.status(parsed.data.imobiliariaId ? 404 : 500).json({ error: 'Imobiliária não encontrada' });

    const [colunaNova] = await db.select().from(colunasKanban)
      .where(and(eq(colunasKanban.imobiliariaId, imob.id), eq(colunasKanban.titulo, 'Lead Novo'))).limit(1);

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

    registrarEvento(imob.id, row.id, 'criado', 'Lead recebido pela integração (' + row.canal + (row.campanha ? ' · ' + row.campanha : '') + ')', row.nome);
    io.to('imobiliaria:' + imob.id).emit('lead:created', row);
    res.status(201).json(row);
    distribuirLead(io, imob.id, row.id).catch(e => console.error('roleta captação:', (e as Error).message));
  });

  return router;
}
