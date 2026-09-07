ALTER TYPE "public"."ao_esgotar" ADD VALUE 'mover';--> statement-breakpoint
ALTER TABLE "followup_passos" ALTER COLUMN "atraso_texto" SET DEFAULT 'na hora';--> statement-breakpoint
ALTER TABLE "followup_passos" ALTER COLUMN "conteudo" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "followup_execucoes" ADD COLUMN "imobiliaria_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "followup_execucoes" ADD COLUMN "corretor_id" uuid;--> statement-breakpoint
ALTER TABLE "followup_execucoes" ADD COLUMN "proximo_envio_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "followup_execucoes" ADD COLUMN "motivo_fim" text;--> statement-breakpoint
ALTER TABLE "followup_fluxos" ADD COLUMN "dispara_em_lead_novo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "followup_fluxos" ADD COLUMN "janela_inicio_min" integer DEFAULT 480 NOT NULL;--> statement-breakpoint
ALTER TABLE "followup_fluxos" ADD COLUMN "janela_fim_min" integer DEFAULT 1200 NOT NULL;--> statement-breakpoint
ALTER TABLE "followup_fluxos" ADD COLUMN "janela_dias" jsonb DEFAULT '[false,true,true,true,true,true,false]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "followup_fluxos" ADD COLUMN "ao_esgotar_coluna_id" uuid;--> statement-breakpoint
ALTER TABLE "followup_fluxos" ADD COLUMN "criado_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "followup_passos" ADD COLUMN "tipo" text DEFAULT 'texto' NOT NULL;--> statement-breakpoint
ALTER TABLE "followup_passos" ADD COLUMN "anexo_url" text;--> statement-breakpoint
ALTER TABLE "followup_passos" ADD COLUMN "anexo_nome" text;--> statement-breakpoint
ALTER TABLE "followup_passos" ADD COLUMN "atraso_minutos" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "followup_passos" ADD COLUMN "cadencia_label" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "cadencia" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "followup_execucoes" ADD CONSTRAINT "followup_execucoes_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "followup_execucoes" ADD CONSTRAINT "followup_execucoes_corretor_id_perfis_id_fk" FOREIGN KEY ("corretor_id") REFERENCES "public"."perfis"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "followup_fluxos" ADD CONSTRAINT "followup_fluxos_ao_esgotar_coluna_id_colunas_kanban_id_fk" FOREIGN KEY ("ao_esgotar_coluna_id") REFERENCES "public"."colunas_kanban"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "followup_execucoes_lead_id_idx" ON "followup_execucoes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "followup_execucoes_corretor_id_idx" ON "followup_execucoes" USING btree ("corretor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "followup_execucoes_lead_viva_uq" ON "followup_execucoes" USING btree ("lead_id") WHERE status <> 'encerrada';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "followup_fluxos_corretor_id_idx" ON "followup_fluxos" USING btree ("corretor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "followup_passos_fluxo_id_idx" ON "followup_passos" USING btree ("fluxo_id");