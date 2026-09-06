import { pgTable, uuid, text, boolean, integer, numeric, timestamp, pgEnum, jsonb, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['dono', 'gerente', 'corretor']);
export const canalEnum = pgEnum('canal', ['WhatsApp', 'Instagram', 'Facebook', 'Indicacao', 'Manual']);
export const direcaoEnum = pgEnum('direcao', ['in', 'out']);
export const mensagemCanalEnum = pgEnum('mensagem_canal', ['corretor', 'followup']);
export const aoEsgotarEnum = pgEnum('ao_esgotar', ['nada', 'descartar']);
export const execucaoStatusEnum = pgEnum('execucao_status', ['ativa', 'pausada', 'encerrada']);

export const imobiliarias = pgTable('imobiliarias', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
});

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

// A disponibilidade em si mora em perfis.emPlantao — esta tabela guarda só a ordem da fila.
export const filasAtendimento = pgTable('filas_atendimento', {
  id: uuid('id').primaryKey().defaultRandom(),
  imobiliariaId: uuid('imobiliaria_id').notNull().references(() => imobiliarias.id, { onDelete: 'cascade' }),
  corretorId: uuid('corretor_id').notNull().references(() => perfis.id, { onDelete: 'cascade' }).unique(),
  posicao: integer('posicao').notNull().default(0),
});

export const mensagensWhatsapp = pgTable('mensagens_whatsapp', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  direcao: direcaoEnum('direcao').notNull(),
  // Mensagem pode ser só texto, só anexo, ou os dois — por isso texto virou opcional.
  texto: text('texto'),
  // Arquivo em si mora no MinIO (mesmo padrão de imóveis/templates/treinamentos) — aqui só a URL.
  anexoUrl: text('anexo_url'),
  anexoTipo: text('anexo_tipo'), // 'imagem' | 'video' | 'documento'
  canal: mensagemCanalEnum('canal').notNull().default('corretor'),
  enviadoEm: timestamp('enviado_em', { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  leadIdx: index('mensagens_lead_id_idx').on(table.leadId),
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
