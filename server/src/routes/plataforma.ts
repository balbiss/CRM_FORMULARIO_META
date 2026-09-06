import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { and, eq, sql, desc, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { imobiliarias, perfis, leads, colunasKanban, pagamentos, adminsPlataforma } from '../db/schema.js';
import { signPlatformToken } from '../lib/jwt.js';
import { requirePlataforma } from '../middleware/plataforma.js';

export const plataformaRouter = Router();

const COLS_SISTEMA = [
  { titulo: 'Lead Novo', cor: 'var(--muted)', slug: 'novo' },
  { titulo: 'Em Atendimento', cor: 'var(--terra)', slug: 'atend' },
  { titulo: 'Análise de Crédito', cor: 'var(--terra)', slug: 'credito' },
  { titulo: 'Visita Agendada', cor: 'var(--terra)', slug: 'visita' },
  { titulo: 'Proposta', cor: 'var(--terra)', slug: 'proposta' },
  { titulo: 'Venda Concluída', cor: 'var(--olive)', slug: 'venda' },
  { titulo: 'Rebatida', cor: 'var(--muted)', slug: 'rebatida' },
];

/** Soma meses a uma data YYYY-MM-DD preservando o dia (clamped ao último dia do mês). */
function addMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, ultimoDia));
  return base.toISOString().slice(0, 10);
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function senhaTemp(): string {
  return 'vi' + Math.random().toString(36).slice(2, 8) + Math.floor(10 + Math.random() * 89);
}

// --- login ---

plataformaRouter.post('/login', async (req, res) => {
  const parsed = z.object({ email: z.string().email(), senha: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'E-mail ou senha inválidos' });
  const [admin] = await db.select().from(adminsPlataforma).where(eq(adminsPlataforma.email, parsed.data.email.toLowerCase())).limit(1);
  if (!admin) return res.status(401).json({ error: 'E-mail ou senha incorretos' });
  const ok = await bcrypt.compare(parsed.data.senha, admin.senhaHash);
  if (!ok) return res.status(401).json({ error: 'E-mail ou senha incorretos' });
  const token = signPlatformToken({ sub: admin.id, nome: admin.nome });
  res.json({ token, admin: { id: admin.id, nome: admin.nome, email: admin.email } });
});

plataformaRouter.use(requirePlataforma);

plataformaRouter.get('/me', async (req, res) => {
  const [admin] = await db.select().from(adminsPlataforma).where(eq(adminsPlataforma.id, req.plataforma!.sub)).limit(1);
  if (!admin) return res.status(404).json({ error: 'Admin não encontrado' });
  res.json({ id: admin.id, nome: admin.nome, email: admin.email });
});

// --- resumo (visão geral) ---

plataformaRouter.get('/resumo', async (_req, res) => {
  const imobs = await db.select().from(imobiliarias);
  const hoje = hojeISO();
  const em7 = addMeses(hoje, 0);
  const limite7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const ativas = imobs.filter(i => i.status === 'ativa');
  const bloqueadas = imobs.filter(i => i.status !== 'ativa');
  const vencendo = ativas.filter(i => i.proximoVencimento && i.proximoVencimento >= em7 && i.proximoVencimento <= limite7);
  const vencidas = ativas.filter(i => i.proximoVencimento && i.proximoVencimento < hoje);
  const mrr = ativas.reduce((s, i) => s + Number(i.mensalidade || 0), 0);

  const [{ totalCorretores }] = await db
    .select({ totalCorretores: sql<number>`count(*)::int` })
    .from(perfis).where(eq(perfis.role, 'corretor'));
  const [{ totalLeads }] = await db.select({ totalLeads: sql<number>`count(*)::int` }).from(leads);

  res.json({
    totalImobiliarias: imobs.length,
    ativas: ativas.length,
    bloqueadas: bloqueadas.length,
    vencendo7Dias: vencendo.length,
    vencidas: vencidas.length,
    mrr,
    totalCorretores,
    totalLeads,
  });
});

// --- listar imobiliárias ---

plataformaRouter.get('/imobiliarias', async (_req, res) => {
  const imobs = await db.select().from(imobiliarias).orderBy(desc(imobiliarias.criadoEm));
  if (imobs.length === 0) return res.json([]);
  const ids = imobs.map(i => i.id);

  const corretoresPorImob = await db
    .select({ imobiliariaId: perfis.imobiliariaId, n: sql<number>`count(*)::int` })
    .from(perfis).where(and(inArray(perfis.imobiliariaId, ids), eq(perfis.role, 'corretor')))
    .groupBy(perfis.imobiliariaId);
  const leadsPorImob = await db
    .select({ imobiliariaId: leads.imobiliariaId, n: sql<number>`count(*)::int` })
    .from(leads).where(inArray(leads.imobiliariaId, ids))
    .groupBy(leads.imobiliariaId);
  const ultimoPagto = await db
    .select({ imobiliariaId: pagamentos.imobiliariaId, pagoEm: sql<string>`max(${pagamentos.pagoEm})` })
    .from(pagamentos).where(inArray(pagamentos.imobiliariaId, ids))
    .groupBy(pagamentos.imobiliariaId);

  const cMap = new Map(corretoresPorImob.map(r => [r.imobiliariaId, r.n]));
  const lMap = new Map(leadsPorImob.map(r => [r.imobiliariaId, r.n]));
  const pMap = new Map(ultimoPagto.map(r => [r.imobiliariaId, r.pagoEm]));
  const hoje = hojeISO();

  res.json(imobs.map(i => ({
    id: i.id,
    nome: i.nome,
    status: i.status,
    bloqueioMotivo: i.bloqueioMotivo,
    plano: i.plano,
    mensalidade: Number(i.mensalidade || 0),
    limiteCorretores: i.limiteCorretores,
    corretoresUsados: cMap.get(i.id) || 0,
    leads: lMap.get(i.id) || 0,
    proximoVencimento: i.proximoVencimento,
    diasCarencia: i.diasCarencia,
    diasParaVencer: i.proximoVencimento
      ? Math.round((Date.parse(i.proximoVencimento) - Date.parse(hoje)) / 86400000)
      : null,
    ultimoPagamento: pMap.get(i.id) || null,
    criadoEm: i.criadoEm,
  })));
});

// --- criar imobiliária + dono ---

const criarSchema = z.object({
  nome: z.string().min(2),
  plano: z.string().min(1).default('Padrão'),
  mensalidade: z.number().min(0).default(0),
  limiteCorretores: z.number().int().min(0).default(0),
  diasCarencia: z.number().int().min(0).max(60).default(5),
  primeiroVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  donoNome: z.string().min(2),
  donoEmail: z.string().email(),
});

plataformaRouter.post('/imobiliarias', async (req, res) => {
  const parsed = criarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Confira os dados da imobiliária e do dono' });
  const d = parsed.data;
  const donoEmail = d.donoEmail.toLowerCase();

  const [emailEmUso] = await db.select({ id: perfis.id }).from(perfis).where(eq(perfis.email, donoEmail)).limit(1);
  if (emailEmUso) return res.status(409).json({ error: 'Já existe um usuário com esse e-mail' });

  const [imob] = await db.insert(imobiliarias).values({
    nome: d.nome,
    plano: d.plano,
    mensalidade: String(d.mensalidade),
    limiteCorretores: d.limiteCorretores,
    diasCarencia: d.diasCarencia,
    proximoVencimento: d.primeiroVencimento ?? addMeses(hojeISO(), 1),
  }).returning();

  await db.insert(colunasKanban).values(
    COLS_SISTEMA.map((c, i) => ({ imobiliariaId: imob.id, titulo: c.titulo, ordem: i, cor: c.cor, slug: c.slug })),
  );

  const senha = senhaTemp();
  const senhaHash = await bcrypt.hash(senha, 10);
  const [dono] = await db.insert(perfis).values({
    imobiliariaId: imob.id, nome: d.donoNome, email: donoEmail, senhaHash, role: 'dono',
  }).returning();

  res.status(201).json({
    imobiliaria: { id: imob.id, nome: imob.nome, status: imob.status, proximoVencimento: imob.proximoVencimento },
    dono: { id: dono.id, nome: dono.nome, email: dono.email, senhaTemporaria: senha },
  });
});

// --- detalhe ---

plataformaRouter.get('/imobiliarias/:id', async (req, res) => {
  const [imob] = await db.select().from(imobiliarias).where(eq(imobiliarias.id, req.params.id)).limit(1);
  if (!imob) return res.status(404).json({ error: 'Imobiliária não encontrada' });

  const equipe = await db
    .select({ id: perfis.id, nome: perfis.nome, email: perfis.email, role: perfis.role, bloqueado: perfis.bloqueado })
    .from(perfis).where(eq(perfis.imobiliariaId, imob.id));
  const pagtos = await db.select().from(pagamentos).where(eq(pagamentos.imobiliariaId, imob.id)).orderBy(desc(pagamentos.pagoEm));
  const [{ nLeads }] = await db.select({ nLeads: sql<number>`count(*)::int` }).from(leads).where(eq(leads.imobiliariaId, imob.id));

  res.json({
    id: imob.id,
    nome: imob.nome,
    status: imob.status,
    bloqueioMotivo: imob.bloqueioMotivo,
    plano: imob.plano,
    mensalidade: Number(imob.mensalidade || 0),
    limiteCorretores: imob.limiteCorretores,
    diasCarencia: imob.diasCarencia,
    proximoVencimento: imob.proximoVencimento,
    observacoes: imob.observacoes,
    criadoEm: imob.criadoEm,
    equipe,
    corretores: equipe.filter(e => e.role === 'corretor').length,
    leads: nLeads,
    pagamentos: pagtos.map(p => ({
      id: p.id, valor: Number(p.valor), competencia: p.competencia, pagoEm: p.pagoEm,
      metodo: p.metodo, observacao: p.observacao, criadoEm: p.criadoEm,
    })),
  });
});

// --- editar ---

const editarSchema = z.object({
  nome: z.string().min(2).optional(),
  plano: z.string().min(1).optional(),
  mensalidade: z.number().min(0).optional(),
  limiteCorretores: z.number().int().min(0).optional(),
  diasCarencia: z.number().int().min(0).max(60).optional(),
  proximoVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

plataformaRouter.patch('/imobiliarias/:id', async (req, res) => {
  const parsed = editarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  const [imob] = await db.select({ id: imobiliarias.id }).from(imobiliarias).where(eq(imobiliarias.id, req.params.id)).limit(1);
  if (!imob) return res.status(404).json({ error: 'Imobiliária não encontrada' });

  const patch: Record<string, unknown> = {};
  const p = parsed.data;
  if (p.nome !== undefined) patch.nome = p.nome;
  if (p.plano !== undefined) patch.plano = p.plano;
  if (p.mensalidade !== undefined) patch.mensalidade = String(p.mensalidade);
  if (p.limiteCorretores !== undefined) patch.limiteCorretores = p.limiteCorretores;
  if (p.diasCarencia !== undefined) patch.diasCarencia = p.diasCarencia;
  if (p.proximoVencimento !== undefined) patch.proximoVencimento = p.proximoVencimento;
  if (p.observacoes !== undefined) patch.observacoes = p.observacoes;

  const [row] = await db.update(imobiliarias).set(patch).where(eq(imobiliarias.id, req.params.id)).returning();
  res.json({ id: row.id, nome: row.nome, plano: row.plano, mensalidade: Number(row.mensalidade), limiteCorretores: row.limiteCorretores, diasCarencia: row.diasCarencia, proximoVencimento: row.proximoVencimento, observacoes: row.observacoes });
});

// --- bloquear / liberar (manual) ---

plataformaRouter.post('/imobiliarias/:id/bloquear', async (req, res) => {
  const [imob] = await db.select({ id: imobiliarias.id }).from(imobiliarias).where(eq(imobiliarias.id, req.params.id)).limit(1);
  if (!imob) return res.status(404).json({ error: 'Imobiliária não encontrada' });
  await db.update(imobiliarias).set({ status: 'bloqueada', bloqueioMotivo: 'manual' }).where(eq(imobiliarias.id, req.params.id));
  res.json({ ok: true, status: 'bloqueada' });
});

plataformaRouter.post('/imobiliarias/:id/liberar', async (req, res) => {
  const [imob] = await db.select({ id: imobiliarias.id }).from(imobiliarias).where(eq(imobiliarias.id, req.params.id)).limit(1);
  if (!imob) return res.status(404).json({ error: 'Imobiliária não encontrada' });
  await db.update(imobiliarias).set({ status: 'ativa', bloqueioMotivo: null }).where(eq(imobiliarias.id, req.params.id));
  res.json({ ok: true, status: 'ativa' });
});

// --- registrar pagamento ---

const pagtoSchema = z.object({
  valor: z.number().min(0),
  competencia: z.string().regex(/^\d{4}-\d{2}$/),
  pagoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  metodo: z.enum(['pix', 'boleto', 'cartao', 'transferencia', 'dinheiro', 'outro']).default('pix'),
  observacao: z.string().optional(),
});

plataformaRouter.post('/imobiliarias/:id/pagamentos', async (req, res) => {
  const parsed = pagtoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Confira valor e competência (AAAA-MM)' });
  const [imob] = await db.select().from(imobiliarias).where(eq(imobiliarias.id, req.params.id)).limit(1);
  if (!imob) return res.status(404).json({ error: 'Imobiliária não encontrada' });

  const [pg] = await db.insert(pagamentos).values({
    imobiliariaId: imob.id,
    valor: String(parsed.data.valor),
    competencia: parsed.data.competencia,
    pagoEm: parsed.data.pagoEm ?? hojeISO(),
    metodo: parsed.data.metodo,
    observacao: parsed.data.observacao,
    registradoPor: req.plataforma!.sub,
  }).returning();

  // Empurra o vencimento +1 mês (a partir do vencimento atual, ou de hoje se não havia).
  const base = imob.proximoVencimento && imob.proximoVencimento >= hojeISO() ? imob.proximoVencimento : hojeISO();
  const novoVenc = addMeses(base, 1);
  const reativar = imob.status !== 'ativa' && imob.bloqueioMotivo === 'inadimplencia';
  await db.update(imobiliarias).set({
    proximoVencimento: novoVenc,
    ...(reativar ? { status: 'ativa' as const, bloqueioMotivo: null } : {}),
  }).where(eq(imobiliarias.id, imob.id));

  res.status(201).json({
    pagamento: { id: pg.id, valor: Number(pg.valor), competencia: pg.competencia, pagoEm: pg.pagoEm, metodo: pg.metodo },
    proximoVencimento: novoVenc,
    reativada: reativar,
  });
});

plataformaRouter.delete('/imobiliarias/:id/pagamentos/:pid', async (req, res) => {
  const [pg] = await db.select().from(pagamentos)
    .where(and(eq(pagamentos.id, req.params.pid), eq(pagamentos.imobiliariaId, req.params.id))).limit(1);
  if (!pg) return res.status(404).json({ error: 'Pagamento não encontrado' });
  await db.delete(pagamentos).where(eq(pagamentos.id, pg.id));
  res.json({ ok: true });
});

// --- reset senha do dono ---

plataformaRouter.post('/imobiliarias/:id/reset-senha-dono', async (req, res) => {
  const [dono] = await db.select().from(perfis)
    .where(and(eq(perfis.imobiliariaId, req.params.id), eq(perfis.role, 'dono'))).limit(1);
  if (!dono) return res.status(404).json({ error: 'Dono não encontrado' });
  const senha = senhaTemp();
  await db.update(perfis).set({ senhaHash: await bcrypt.hash(senha, 10), bloqueado: false }).where(eq(perfis.id, dono.id));
  res.json({ ok: true, email: dono.email, senhaTemporaria: senha });
});
