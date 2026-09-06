import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { integracoesFacebook } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { cifrar, decifrar } from '../lib/crypto.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

export const integracoesRouter = Router();

// ------------------------------------------------------------------
// GET /api/integracoes/facebook/ativas
// Chamado pela automação (n8n), NÃO por usuário. Protegido por segredo compartilhado.
// Devolve TODAS as conexões ativas de TODAS as imobiliárias, com o token descriptografado.
// ------------------------------------------------------------------
integracoesRouter.get('/facebook/ativas', async (req, res) => {
  const segredo = req.header('x-integracoes-secret');
  if (!segredo || segredo !== process.env.INTEGRACOES_SECRET) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  const rows = await db.select().from(integracoesFacebook).where(eq(integracoesFacebook.ativo, true));
  const lista = rows.map(r => {
    try {
      return {
        imobiliariaId: r.imobiliariaId,
        pageId: r.pageId,
        formId: r.formId,
        accessToken: decifrar({ cifrado: r.tokenCifrado, iv: r.tokenIv, tag: r.tokenTag }),
      };
    } catch {
      return null; // token corrompido / chave trocada — ignora essa conexão
    }
  }).filter(Boolean);
  res.json(lista);
});

// ------------------------------------------------------------------
// Daqui pra baixo: só usuário autenticado (Dono/Gerente).
// ------------------------------------------------------------------
integracoesRouter.use(requireAuth);
integracoesRouter.use('/facebook', requireRole('dono', 'gerente'));

const mascarar = (r: typeof integracoesFacebook.$inferSelect) => ({
  id: r.id, nomeConta: r.nomeConta, pageId: r.pageId, formId: r.formId,
  ativo: r.ativo, ultimaSyncEm: r.ultimaSyncEm, ultimoErro: r.ultimoErro, criadoEm: r.criadoEm,
  tokenFinal: '••••' + (safeLast4(r) ?? ''),
});

function safeLast4(r: typeof integracoesFacebook.$inferSelect): string | null {
  try {
    const t = decifrar({ cifrado: r.tokenCifrado, iv: r.tokenIv, tag: r.tokenTag });
    return t.slice(-4);
  } catch { return null; }
}

integracoesRouter.get('/facebook', async (req, res) => {
  const rows = await db.select().from(integracoesFacebook)
    .where(eq(integracoesFacebook.imobiliariaId, req.auth!.imobiliariaId));
  res.json(rows.map(mascarar));
});

const createSchema = z.object({
  nomeConta: z.string().min(1).max(80),
  pageId: z.string().min(1).max(60),
  formId: z.string().min(1).max(60),
  accessToken: z.string().min(20),
});

integracoesRouter.post('/facebook', async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });
  const { cifrado, iv, tag } = cifrar(parsed.data.accessToken.trim());
  const [row] = await db.insert(integracoesFacebook).values({
    imobiliariaId: req.auth!.imobiliariaId,
    nomeConta: parsed.data.nomeConta.trim(),
    pageId: parsed.data.pageId.trim(),
    formId: parsed.data.formId.trim(),
    tokenCifrado: cifrado, tokenIv: iv, tokenTag: tag,
  }).returning();
  res.status(201).json(mascarar(row));
});

const patchSchema = z.object({
  nomeConta: z.string().min(1).max(80).optional(),
  pageId: z.string().min(1).max(60).optional(),
  formId: z.string().min(1).max(60).optional(),
  accessToken: z.string().min(20).optional(),
  ativo: z.boolean().optional(),
});

async function daImobiliaria(id: string, imobiliariaId: string) {
  const [row] = await db.select().from(integracoesFacebook)
    .where(and(eq(integracoesFacebook.id, id), eq(integracoesFacebook.imobiliariaId, imobiliariaId))).limit(1);
  return row;
}

integracoesRouter.patch('/facebook/:id', async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
  if (!(await daImobiliaria(req.params.id, req.auth!.imobiliariaId))) return res.status(404).json({ error: 'Conexão não encontrada' });

  const patch: Record<string, unknown> = {};
  if (parsed.data.nomeConta) patch.nomeConta = parsed.data.nomeConta.trim();
  if (parsed.data.pageId) patch.pageId = parsed.data.pageId.trim();
  if (parsed.data.formId) patch.formId = parsed.data.formId.trim();
  if (typeof parsed.data.ativo === 'boolean') patch.ativo = parsed.data.ativo;
  if (parsed.data.accessToken) {
    const { cifrado, iv, tag } = cifrar(parsed.data.accessToken.trim());
    patch.tokenCifrado = cifrado; patch.tokenIv = iv; patch.tokenTag = tag;
  }
  const [row] = await db.update(integracoesFacebook).set(patch).where(eq(integracoesFacebook.id, req.params.id)).returning();
  res.json(mascarar(row));
});

integracoesRouter.delete('/facebook/:id', async (req, res) => {
  if (!(await daImobiliaria(req.params.id, req.auth!.imobiliariaId))) return res.status(404).json({ error: 'Conexão não encontrada' });
  await db.delete(integracoesFacebook).where(eq(integracoesFacebook.id, req.params.id));
  res.json({ ok: true });
});

/** Testa a conexão de verdade: busca o formulário no Graph API com o token salvo. */
integracoesRouter.post('/facebook/:id/testar', async (req, res) => {
  const row = await daImobiliaria(req.params.id, req.auth!.imobiliariaId);
  if (!row) return res.status(404).json({ error: 'Conexão não encontrada' });
  let token: string;
  try { token = decifrar({ cifrado: row.tokenCifrado, iv: row.tokenIv, tag: row.tokenTag }); }
  catch { return res.status(400).json({ ok: false, erro: 'Não foi possível ler o token salvo (chave de criptografia mudou?)' }); }

  try {
    const url = `${GRAPH}/${encodeURIComponent(row.formId)}?fields=id,name&access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url);
    const body = await r.json() as { id?: string; name?: string; error?: { message?: string } };
    if (!r.ok || body.error) {
      const msg = body.error?.message || `Graph API respondeu ${r.status}`;
      await db.update(integracoesFacebook).set({ ultimoErro: msg }).where(eq(integracoesFacebook.id, row.id));
      return res.json({ ok: false, erro: msg });
    }
    await db.update(integracoesFacebook).set({ ultimoErro: null, ultimaSyncEm: new Date() }).where(eq(integracoesFacebook.id, row.id));
    res.json({ ok: true, formulario: body.name || body.id });
  } catch (e) {
    res.json({ ok: false, erro: (e as Error).message || 'Falha ao contatar o Graph API' });
  }
});
