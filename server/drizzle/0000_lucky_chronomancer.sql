CREATE TYPE "public"."ao_esgotar" AS ENUM('nada', 'descartar');--> statement-breakpoint
CREATE TYPE "public"."canal" AS ENUM('WhatsApp', 'Instagram', 'Facebook', 'Indicacao', 'Manual');--> statement-breakpoint
CREATE TYPE "public"."direcao" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."execucao_status" AS ENUM('ativa', 'pausada', 'encerrada');--> statement-breakpoint
CREATE TYPE "public"."mensagem_canal" AS ENUM('corretor', 'followup');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('dono', 'gerente', 'corretor');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "colunas_kanban" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"cor" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "distribuicao_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"corretor_id" uuid NOT NULL,
	"origem" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "filas_atendimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"corretor_id" uuid NOT NULL,
	"posicao" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "filas_atendimento_corretor_id_unique" UNIQUE("corretor_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "followup_execucoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"fluxo_id" uuid NOT NULL,
	"passo_atual" integer DEFAULT 0 NOT NULL,
	"status" "execucao_status" DEFAULT 'ativa' NOT NULL,
	"iniciado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "followup_fluxos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"corretor_id" uuid,
	"nome" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ao_esgotar" "ao_esgotar" DEFAULT 'nada' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "followup_passos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fluxo_id" uuid NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"atraso_texto" text NOT NULL,
	"conteudo" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "imobiliarias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "imoveis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"finalidade" text NOT NULL,
	"titulo" text NOT NULL,
	"endereco" text,
	"cidade" text,
	"estado" text,
	"preco" numeric(14, 2) DEFAULT '0' NOT NULL,
	"area" numeric(10, 2),
	"quartos" integer DEFAULT 0,
	"suites" integer DEFAULT 0,
	"banheiros" integer DEFAULT 0,
	"amenidades" jsonb DEFAULT '[]'::jsonb,
	"descricao" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"telefone" text NOT NULL,
	"email" text,
	"imovel_titulo" text,
	"imovel_sub" text,
	"valor" numeric(14, 2) DEFAULT '0',
	"canal" "canal" DEFAULT 'Manual' NOT NULL,
	"coluna_id" uuid,
	"corretor_id" uuid,
	"campanha" text,
	"segundo_cadastro" boolean DEFAULT false NOT NULL,
	"motivo_descarte" text,
	"renda_declarada" numeric(14, 2),
	"entrou_na_coluna_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "links_uteis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"categoria" text NOT NULL,
	"titulo" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mensagens_whatsapp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"direcao" "direcao" NOT NULL,
	"texto" text NOT NULL,
	"canal" "mensagem_canal" DEFAULT 'corretor' NOT NULL,
	"enviado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notificacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"perfil_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"texto" text,
	"lida" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "perfis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"role" "role" DEFAULT 'corretor' NOT NULL,
	"telefone" text,
	"bloqueado" boolean DEFAULT false NOT NULL,
	"em_plantao" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perfis_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "templates_mensagem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criado_por" uuid NOT NULL,
	"titulo" text NOT NULL,
	"texto" text NOT NULL,
	"anexo_url" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "treinamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"duracao_texto" text,
	"categoria" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "colunas_kanban" ADD CONSTRAINT "colunas_kanban_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribuicao_log" ADD CONSTRAINT "distribuicao_log_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribuicao_log" ADD CONSTRAINT "distribuicao_log_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distribuicao_log" ADD CONSTRAINT "distribuicao_log_corretor_id_perfis_id_fk" FOREIGN KEY ("corretor_id") REFERENCES "public"."perfis"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "filas_atendimento" ADD CONSTRAINT "filas_atendimento_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "filas_atendimento" ADD CONSTRAINT "filas_atendimento_corretor_id_perfis_id_fk" FOREIGN KEY ("corretor_id") REFERENCES "public"."perfis"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "followup_execucoes" ADD CONSTRAINT "followup_execucoes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "followup_execucoes" ADD CONSTRAINT "followup_execucoes_fluxo_id_followup_fluxos_id_fk" FOREIGN KEY ("fluxo_id") REFERENCES "public"."followup_fluxos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "followup_fluxos" ADD CONSTRAINT "followup_fluxos_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "followup_fluxos" ADD CONSTRAINT "followup_fluxos_corretor_id_perfis_id_fk" FOREIGN KEY ("corretor_id") REFERENCES "public"."perfis"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "followup_passos" ADD CONSTRAINT "followup_passos_fluxo_id_followup_fluxos_id_fk" FOREIGN KEY ("fluxo_id") REFERENCES "public"."followup_fluxos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_coluna_id_colunas_kanban_id_fk" FOREIGN KEY ("coluna_id") REFERENCES "public"."colunas_kanban"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_corretor_id_perfis_id_fk" FOREIGN KEY ("corretor_id") REFERENCES "public"."perfis"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "links_uteis" ADD CONSTRAINT "links_uteis_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mensagens_whatsapp" ADD CONSTRAINT "mensagens_whatsapp_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_perfil_id_perfis_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."perfis"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "perfis" ADD CONSTRAINT "perfis_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "templates_mensagem" ADD CONSTRAINT "templates_mensagem_criado_por_perfis_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."perfis"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "treinamentos" ADD CONSTRAINT "treinamentos_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
