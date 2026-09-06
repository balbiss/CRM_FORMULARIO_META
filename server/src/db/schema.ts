import { pgTable, uuid, text, boolean, integer, numeric, timestamp, date, pgEnum, jsonb, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['dono', 'gerente', 'corretor']);
// Situação da imobiliária no SaaS. 'bloqueada' = sem acesso ao CRM (manual ou por inadimplência).
export const imobiliariaStatusEnum = pgEnum('imobiliaria_status', ['ativa', 'bloqueada']);
export const bloqueioMotivoEnum = pgEnum('bloqueio_motivo', ['manual', 'inadimplencia']);
export const pagamentoMetodoEnum = pgEnum('pagamento_metodo', ['pix', 'boleto', 'cartao', 'transferencia', 'dinheiro', 'outro']);
export const modoWhatsappEnum = pgEnum('modo_whatsapp', ['central', 'corretor']);
export const sessaoEscopoEnum = pgEnum('sessao_escopo', ['central', 'corretor']);
export const sessaoStatusEnum = pgEnum('sessao_status', ['desconectada', 'conectando', 'conectada']);
export const canalEnum = pgEnum('canal', ['WhatsApp', 'Instagram', 'Facebook', 'Indicacao', 'Manual']);
export const direcaoEnum = pgEnum('direcao', ['in', 'out']);
export const mensagemCanalEnum = pgEnum('mensagem_canal', ['corretor', 'followup']);
export const aoEsgotarEnum = pgEnum('ao_esgotar', ['nada', 'descartar']);
export const execucaoStatusEnum = pgEnum('execucao_status', ['ativa', 'pausada', 'encerrada']);

/** Janela de atendimento de um dia da semana (minutos desde a meia-noite, fuso São Paulo).
 *  Índice 0 = domingo … 6 = sábado. Controla quando o corretor pode ficar "No Plantão". */
export interface DiaAtendimento { ativo: boolean; abreMin: number; fechaMin: number }

export const HORARIO_ATENDIMENTO_PADRAO: DiaAtendimento[] = [
  { ativo: false, abreMin: 8 * 60, fechaMin: 18 * 60 },       // Dom
  { ativo: true, abreMin: 8 * 60, fechaMin: 18 * 60 + 20 },   // Seg
  { ativo: true, abreMin: 8 * 60, fechaMin: 18 * 60 + 20 },   // Ter
  { ativo: true, abreMin: 8 * 60, fechaMin: 18 * 60 + 20 },   // Qua
  { ativo: true, abreMin: 8 * 60, fechaMin: 19 * 60 + 20 },   // Qui
  { ativo: true, abreMin: 8 * 60, fechaMin: 18 * 60 + 20 },   // Sex
  { ativo: true, abreMin: 8 * 60, fechaMin: 15 * 60 + 20 },   // Sáb
];

export const imobiliarias = pgTable('imobiliarias', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  // Configurável pelo Dono/Gerente no painel — antes era hardcoded em lib/schedule.
  horarioAtendimento: jsonb('horario_atendimento').$type<DiaAtendimento[]>().notNull().default(HORARIO_ATENDIMENTO_PADRAO),
  // 'corretor' = cada corretor usa o próprio WhatsApp (padrão atual);
  // 'central'  = um número da imobiliária, todo mundo atende pelo CRM, dono/gerente veem tudo.
  modoWhatsapp: modoWhatsappEnum('modo_whatsapp').notNull().default('corretor'),

  // --- Gestão da assinatura (painel Dono do SaaS) ---
  status: imobiliariaStatusEnum('status').notNull().default('ativa'),
  bloqueioMotivo: bloqueioMotivoEnum('bloqueio_motivo'),
  plano: text('plano').notNull().default('Padrão'),
  mensalidade: numeric('mensalidade', { precision: 12, scale: 2 }).notNull().default('0'),
  // Teto de corretores (perfil 'corretor'). 0 = ilimitado.
  limiteCorretores: integer('limite_corretores').notNull().default(0),
  // Data do próximo vencimento da mensalidade (YYYY-MM-DD). null = sem cobrança configurada.
  proximoVencimento: date('proximo_vencimento', { mode: 'string' }),
  // Dias de tolerância após o vencimento antes do bloqueio automático.
  diasCarencia: integer('dias_carencia').notNull().default(5),
  observacoes: text('observacoes'),

  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

/** Administrador da plataforma (dono do SaaS) — NÃO pertence a nenhuma imobiliária.
 *  Acessa só o painel /plataforma. Bootstrap via env PLATFORM_ADMIN_EMAIL/PASSWORD. */
export const adminsPlataforma = pgTable('admins_plataforma', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

/** Pagamento de mensalidade registrado manualmente pelo dono do SaaS.
 *  Registrar um pagamento empurra imobiliarias.proximoVencimento em +1 mês e reativa
 *  a imobiliária se ela estava bloqueada por inadimplência. */
export const pagamentos = pgTable('pagamentos', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  valor: numeric('valor', { precision: 12, scale: 2 }).notNull(),
  // Mês de competência a que o pagamento se refere (YYYY-MM).
  competencia: text('competencia').notNull(),
  pagoEm: date('pago_em', { mode: 'string' }).notNull(),
  metodo: pagamentoMetodoEnum('metodo').notNull().default('pix'),
  observacao: text('observacao'),
  registradoPor: uuid('registrado_por').references(() => adminsPlataforma.id, { onDelete: 'set null' }),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  imobiliariaIdx: index('pagamentos_imobiliaria_id_idx').on(table.imobiliariaId),
}));

/** Conexão do Facebook Lead Ads de uma imobiliária — o workflow n8n dinâmico lê a lista de
 *  conexões ativas de TODAS as imobiliárias e busca leads de cada uma com o token dela.
 *  O access_token é cifrado em repouso (AES-256-GCM, ver lib/crypto). */
export const integracoesFacebook = pgTable('integracoes_facebook', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  nomeConta: text('nome_conta').notNull(),
  pageId: text('page_id').notNull(),
  formId: text('form_id').notNull(),
  tokenCifrado: text('token_cifrado').notNull(),
  tokenIv: text('token_iv').notNull(),
  tokenTag: text('token_tag').notNull(),
  ativo: boolean('ativo').notNull().default(true),
  ultimaSyncEm: timestamp('ultima_sync_em', { withTimezone: true }),
  ultimoErro: text('ultimo_erro'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  imobiliariaIdx: index('integracoes_facebook_imobiliaria_id_idx').on(table.imobiliariaId),
}));

export const perfis = pgTable('perfis', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  role: roleEnum('role').notNull().default('corretor'),
  telefone: text('telefone'),
  bloqueado: boolean('bloqueado').notNull().default(false),
  emPlantao: boolean('em_plantao').notNull().default(false),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  imobiliariaIdx: index('perfis_imobiliaria_id_idx').on(table.imobiliariaId),
}));

export const colunasKanban = pgTable('colunas_kanban', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  titulo: text('titulo').notNull(),
  ordem: integer('ordem').notNull().default(0),
  cor: text('cor'),
  // Colunas "de sistema" têm slug (novo, credito, venda, rebatida...) — outras telas (Dashboard,
  // Análise de Crédito, Bolsão, roleta) dependem dele. Colunas criadas pelo usuário têm slug null.
  slug: text('slug'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  imobiliariaIdx: index('colunas_kanban_imobiliaria_id_idx').on(table.imobiliariaId),
}));

export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  telefone: text('telefone').notNull(),
  email: text('email'),
  // Foto de perfil do WhatsApp (URL) — preenchida pela automação de captação quando disponível.
  fotoUrl: text('foto_url'),
  imovelTitulo: text('imovel_titulo'),
  imovelSub: text('imovel_sub'),
  valor: numeric('valor', { precision: 14, scale: 2 }).default('0'),
  canal: canalEnum('canal').notNull().default('Manual'),
  colunaId: uuid('coluna_id').references(() => colunasKanban.id, { onDelete: 'set null' }),
  corretorId: uuid('corretor_id').references(() => perfis.id, { onDelete: 'set null' }),
  campanha: text('campanha'),
  segundoCadastro: boolean('segundo_cadastro').notNull().default(false),
  motivoDescarte: text('motivo_descarte'),
  rendaDeclarada: numeric('renda_declarada', { precision: 14, scale: 2 }),
  entrouNaColunaEm: timestamp('entrou_na_coluna_em', { withTimezone: true }).notNull().defaultNow(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  // Postgres não indexa FK automaticamente — sem isso, toda listagem de leads (a query mais
  // comum do app) fazia sequential scan na tabela inteira (ficou visível só depois que a tabela
  // passou a ter 10k+ linhas reais, nunca doeu com o seed de demonstração de 10 linhas).
  imobiliariaIdx: index('leads_imobiliaria_id_idx').on(table.imobiliariaId),
  corretorIdx: index('leads_corretor_id_idx').on(table.corretorId),
  colunaIdx: index('leads_coluna_id_idx').on(table.colunaId),
}));

// Etiquetas coloridas por imobiliária (multi-tenant) — atribuídas a leads via lead_tags.
export const tags = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  cor: text('cor').notNull().default('#123C87'),
  ordem: integer('ordem').notNull().default(0),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  imobiliariaIdx: index('tags_imobiliaria_id_idx').on(table.imobiliariaId),
}));

export const leadTags = pgTable('lead_tags', {
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, table => ({
  pk: primaryKey({ columns: [table.leadId, table.tagId] }),
  leadIdx: index('lead_tags_lead_id_idx').on(table.leadId),
  tagIdx: index('lead_tags_tag_id_idx').on(table.tagId),
}));

// A disponibilidade em si mora em perfis.emPlantao — esta tabela guarda só a ordem da fila.
export const filasAtendimento = pgTable('filas_atendimento', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  corretorId: uuid('corretor_id').notNull().references(() => perfis.id, { onDelete: 'cascade' }).unique(),
  posicao: integer('posicao').notNull().default(0),
});

/** Sessão de WhatsApp (WAHA). 'central' = número único da imobiliária;
 *  'corretor' = espelho do WhatsApp de um corretor específico. */
export const sessoesWhatsapp = pgTable('sessoes_whatsapp', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  escopo: sessaoEscopoEnum('escopo').notNull(),
  corretorId: uuid('corretor_id').references(() => perfis.id, { onDelete: 'cascade' }),
  sessionName: text('session_name').notNull().unique(),
  status: sessaoStatusEnum('status').notNull().default('desconectada'),
  numero: text('numero'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  imobiliariaIdx: index('sessoes_whatsapp_imobiliaria_id_idx').on(table.imobiliariaId),
}));

export const mensagensWhatsapp = pgTable('mensagens_whatsapp', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  direcao: direcaoEnum('direcao').notNull(),
  // id da mensagem no WhatsApp (WAHA) — evita duplicar ao processar o webhook 2x.
  waMessageId: text('wa_message_id'),
  // "visto" do WhatsApp (evento message.ack): 1=enviando, 2=no servidor, 3=entregue, 4=lido, 5=reproduzido.
  ackStatus: integer('ack_status'),
  // Mensagem recebida já foi vista por alguém do CRM? (pro contador de não lidas em Conversas)
  lida: boolean('lida').notNull().default(false),
  // quem enviou (corretor), quando a mensagem sai pelo número central.
  enviadoPor: uuid('enviado_por').references(() => perfis.id, { onDelete: 'set null' }),
  // Mensagem pode ser só texto, só anexo, ou os dois — por isso texto virou opcional.
  texto: text('texto'),
  // Arquivo em si mora no MinIO (mesmo padrão de imóveis/templates/treinamentos) — aqui só a URL.
  anexoUrl: text('anexo_url'),
  anexoTipo: text('anexo_tipo'), // 'imagem' | 'video' | 'documento'
  canal: mensagemCanalEnum('canal').notNull().default('corretor'),
  enviadoEm: timestamp('enviado_em', { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  leadIdx: index('mensagens_lead_id_idx').on(table.leadId),
  // Trava de duplicidade: o webhook do WAHA pode chegar 2x (retry, múltiplos eventos).
  waMsgIdx: uniqueIndex('mensagens_wa_message_id_uq').on(table.waMessageId).where(sql`${table.waMessageId} is not null`),
}));

export const followupFluxos = pgTable('followup_fluxos', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  corretorId: uuid('corretor_id').references(() => perfis.id, { onDelete: 'cascade' }),
  nome: text('nome').notNull(),
  ativo: boolean('ativo').notNull().default(true),
  aoEsgotar: aoEsgotarEnum('ao_esgotar').notNull().default('nada'),
});

export const followupPassos = pgTable('followup_passos', {
  id: uuid('id').primaryKey().defaultRandom(),
  fluxoId: uuid('fluxo_id').notNull().references(() => followupFluxos.id, { onDelete: 'cascade' }),
  ordem: integer('ordem').notNull().default(0),
  atrasoTexto: text('atraso_texto').notNull(),
  conteudo: text('conteudo').notNull(),
});

export const followupExecucoes = pgTable('followup_execucoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  fluxoId: uuid('fluxo_id').notNull().references(() => followupFluxos.id, { onDelete: 'cascade' }),
  passoAtual: integer('passo_atual').notNull().default(0),
  status: execucaoStatusEnum('status').notNull().default('ativa'),
  iniciadoEm: timestamp('iniciado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const templatesMensagem = pgTable('templates_mensagem', {
  id: uuid('id').primaryKey().defaultRandom(),
  criadoPor: uuid('criado_por').notNull().references(() => perfis.id, { onDelete: 'cascade' }),
  titulo: text('titulo').notNull(),
  texto: text('texto').notNull(),
  anexoUrl: text('anexo_url'),
});

export const imoveis = pgTable('imoveis', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(),
  finalidade: text('finalidade').notNull(),
  titulo: text('titulo').notNull(),
  endereco: text('endereco'),
  cidade: text('cidade'),
  estado: text('estado'),
  preco: numeric('preco', { precision: 14, scale: 2 }).notNull().default('0'),
  area: numeric('area', { precision: 10, scale: 2 }),
  quartos: integer('quartos').default(0),
  suites: integer('suites').default(0),
  banheiros: integer('banheiros').default(0),
  vagas: integer('vagas').default(0),
  amenidades: jsonb('amenidades').$type<string[]>().default([]),
  descricao: text('descricao'),
  // Pronto para morar | Em obras | Lançamento — "previsaoEntrega" só faz sentido pros dois últimos.
  situacao: text('situacao').notNull().default('Pronto para morar'),
  previsaoEntrega: text('previsao_entrega'),
  aceitaFinanciamento: boolean('aceita_financiamento').notNull().default(true),
  valorCondominio: numeric('valor_condominio', { precision: 12, scale: 2 }),
  valorIptu: numeric('valor_iptu', { precision: 12, scale: 2 }),
  // URLs — os arquivos em si moram no MinIO (S3-compatible), o Postgres só guarda a referência.
  imagens: jsonb('imagens').$type<string[]>().default([]),
  videoUrl: text('video_url'),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const linksUteis = pgTable('links_uteis', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  categoria: text('categoria').notNull(),
  titulo: text('titulo').notNull(),
  url: text('url').notNull(),
});

export const treinamentos = pgTable('treinamentos', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  duracaoTexto: text('duracao_texto'),
  categoria: text('categoria'),
  // Vídeo em si mora no MinIO (mesmo padrão de imóveis) — aqui só a URL.
  videoUrl: text('video_url'),
});

export const notificacoes = pgTable('notificacoes', {
  id: uuid('id').primaryKey().defaultRandom(),
  perfilId: uuid('perfil_id').notNull().references(() => perfis.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(),
  titulo: text('titulo').notNull(),
  texto: text('texto'),
  lida: boolean('lida').notNull().default(false),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

export const distribuicaoLog = pgTable('distribuicao_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  corretorId: uuid('corretor_id').notNull().references(() => perfis.id, { onDelete: 'cascade' }),
  origem: text('origem').notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

// --- relations (for query-builder convenience) ---

export const imobiliariasRelations = relations(imobiliarias, ({ many }) => ({
  perfis: many(perfis),
  leads: many(leads),
  colunas: many(colunasKanban),
}));

export const perfisRelations = relations(perfis, ({ one, many }) => ({
  imobiliaria: one(imobiliarias, { fields: [perfis.imobiliariaId], references: [imobiliarias.id] }),
  leads: many(leads),
}));

export const colunasKanbanRelations = relations(colunasKanban, ({ one, many }) => ({
  imobiliaria: one(imobiliarias, { fields: [colunasKanban.imobiliariaId], references: [imobiliarias.id] }),
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  imobiliaria: one(imobiliarias, { fields: [leads.imobiliariaId], references: [imobiliarias.id] }),
  coluna: one(colunasKanban, { fields: [leads.colunaId], references: [colunasKanban.id] }),
  corretor: one(perfis, { fields: [leads.corretorId], references: [perfis.id] }),
  mensagens: many(mensagensWhatsapp),
}));

export const mensagensRelations = relations(mensagensWhatsapp, ({ one }) => ({
  lead: one(leads, { fields: [mensagensWhatsapp.leadId], references: [leads.id] }),
}));
