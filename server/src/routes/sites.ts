import { Router } from 'express';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import type { Server as SocketServer } from 'socket.io';
import { db } from '../db/client.js';
import { sites, imoveis, imobiliarias } from '../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { criarLead } from './captacao.js';

const slugify = (s: string) => {
  const semAcento = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return semAcento.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'imobiliaria';
};

const depoimentoSchema = z.object({ nome: z.string().max(120), texto: z.string().max(600), cargo: z.string().max(120).optional().default('') });
const destaqueSchema = z.object({ titulo: z.string().max(120), texto: z.string().max(400) });

const configSchema = z.object({
  nomeExibicao: z.string().max(120).optional().default(''),
  logoUrl: z.string().optional().default(''),
  corPrimaria: z.string().max(9).optional().default('#123C87'),
  heroTitulo: z.string().max(160).optional().default(''),
  heroSubtitulo: z.string().max(300).optional().default(''),
  heroImagemUrl: z.string().optional().default(''),
  sobreTitulo: z.string().max(160).optional().default(''),
  sobreTexto: z.string().max(2000).optional().default(''),
  sobreImagemUrl: z.string().optional().default(''),
  telefone: z.string().max(40).optional().default(''),
  whatsapp: z.string().max(40).optional().default(''),
  email: z.string().max(160).optional().default(''),
  endereco: z.string().max(240).optional().default(''),
  instagram: z.string().max(200).optional().default(''),
  facebook: z.string().max(200).optional().default(''),
  destaques: z.array(destaqueSchema).max(8).optional().default([]),
  depoimentos: z.array(depoimentoSchema).max(12).optional().default([]),
  rodapeTexto: z.string().max(400).optional().default(''),
}).strip();

type Config = z.infer<typeof configSchema>;

async function pegarOuCriarSite(imobiliariaId: string) {
  const [existe] = await db.select().from(sites).where(eq(sites.imobiliariaId, imobiliariaId)).limit(1);
  if (existe) return existe;
  const [imob] = await db.select({ nome: imobiliarias.nome }).from(imobiliarias).where(eq(imobiliarias.id, imobiliariaId)).limit(1);
  let base = slugify(imob?.nome || 'imobiliaria');
  // garante slug único
  for (let i = 0; i < 50; i++) {
    const cand = i === 0 ? base : base + '-' + i;
    const [colide] = await db.select({ id: sites.id }).from(sites).where(eq(sites.slug, cand)).limit(1);
    if (!colide) { base = cand; break; }
  }
  const [novo] = await db.insert(sites).values({
    imobiliariaId, slug: base, publicado: false,
    config: configSchema.parse({ nomeExibicao: imob?.nome || '' }),
  }).returning();
  return novo;
}

export function sitesRouter(io: SocketServer) {
  const router = Router();

  // ---------- PÚBLICO (sem auth) ----------
  router.get('/publico/:slug', async (req, res) => {
    const [site] = await db.select().from(sites).where(eq(sites.slug, req.params.slug.toLowerCase())).limit(1);
    if (!site || !site.publicado) return res.status(404).json({ error: 'Site não encontrado' });
    const [imob] = await db.select({ status: imobiliarias.status }).from(imobiliarias).where(eq(imobiliarias.id, site.imobiliariaId)).limit(1);
    if (imob?.status !== 'ativa') return res.status(404).json({ error: 'Site indisponível' });

    const lista = await db.select().from(imoveis)
      .where(and(eq(imoveis.imobiliariaId, site.imobiliariaId), eq(imoveis.publicarNoSite, true)));
    res.json({
      slug: site.slug,
      config: configSchema.parse((site.config as Config) || {}),
      imoveis: lista.map(im => ({
        id: im.id, tipo: im.tipo, finalidade: im.finalidade, titulo: im.titulo,
        endereco: im.endereco, cidade: im.cidade, estado: im.estado,
        preco: Number(im.preco), area: im.area ? Number(im.area) : null,
        quartos: im.quartos, suites: im.suites, banheiros: im.banheiros, vagas: im.vagas,
        amenidades: im.amenidades ?? [], descricao: im.descricao, situacao: im.situacao,
        imagens: im.imagens ?? [], videoUrl: im.videoUrl,
        valorCondominio: im.valorCondominio ? Number(im.valorCondominio) : null,
        aceitaFinanciamento: im.aceitaFinanciamento,
      })),
    });
  });

  router.options('/publico/:slug/contato', (_req, res) => res.sendStatus(204));
  router.post('/publico/:slug/contato', async (req, res) => {
    const parsed = z.object({
      nome: z.string().min(1).max(160),
      telefone: z.string().min(8).max(40),
      email: z.string().email().max(160).optional().or(z.literal('')),
      mensagem: z.string().max(1200).optional(),
      imovel: z.string().max(200).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Preencha nome e telefone.' });

    const [site] = await db.select().from(sites).where(eq(sites.slug, req.params.slug.toLowerCase())).limit(1);
    if (!site || !site.publicado) return res.status(404).json({ error: 'Site não encontrado' });

    await criarLead(io, site.imobiliariaId, {
      nome: parsed.data.nome, telefone: parsed.data.telefone,
      email: parsed.data.email || undefined, mensagem: parsed.data.mensagem,
      imovelTitulo: parsed.data.imovel, campanha: 'Site', canal: 'Site',
    });
    res.status(201).json({ ok: true });
  });

  // ---------- PAINEL (dono/gerente) ----------
  router.use(requireAuth, requireRole('dono', 'gerente'));

  router.get('/', async (req, res) => {
    const site = await pegarOuCriarSite(req.auth!.imobiliariaId);
    res.json({ slug: site.slug, publicado: site.publicado, config: configSchema.parse((site.config as Config) || {}) });
  });

  router.put('/', async (req, res) => {
    const parsed = z.object({ publicado: z.boolean().optional(), config: configSchema }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos' });
    const site = await pegarOuCriarSite(req.auth!.imobiliariaId);
    const [row] = await db.update(sites).set({
      config: parsed.data.config,
      ...(parsed.data.publicado !== undefined ? { publicado: parsed.data.publicado } : {}),
      atualizadoEm: new Date(),
    }).where(eq(sites.id, site.id)).returning();
    res.json({ slug: row.slug, publicado: row.publicado, config: configSchema.parse(row.config as Config) });
  });

  router.post('/slug', async (req, res) => {
    const parsed = z.object({ slug: z.string().min(3).max(48) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Slug precisa ter de 3 a 48 caracteres' });
    const novo = slugify(parsed.data.slug);
    const site = await pegarOuCriarSite(req.auth!.imobiliariaId);
    const [colide] = await db.select({ id: sites.id }).from(sites).where(eq(sites.slug, novo)).limit(1);
    if (colide && colide.id !== site.id) return res.status(409).json({ error: 'Esse endereço já está em uso' });
    const [row] = await db.update(sites).set({ slug: novo, atualizadoEm: new Date() }).where(eq(sites.id, site.id)).returning();
    res.json({ slug: row.slug });
  });

  // Marcar/desmarcar um imóvel pra aparecer no site.
  router.patch('/imoveis/:id', async (req, res) => {
    const parsed = z.object({ publicarNoSite: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Dados inválidos' });
    const [row] = await db.update(imoveis).set({ publicarNoSite: parsed.data.publicarNoSite })
      .where(and(eq(imoveis.id, req.params.id), eq(imoveis.imobiliariaId, req.auth!.imobiliariaId))).returning();
    if (!row) return res.status(404).json({ error: 'Imóvel não encontrado' });
    res.json({ ok: true });
  });

  return router;
}
