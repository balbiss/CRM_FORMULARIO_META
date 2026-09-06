CREATE TYPE "public"."sessao_escopo" AS ENUM('central', 'corretor');--> statement-breakpoint
CREATE TYPE "public"."sessao_status" AS ENUM('desconectada', 'conectando', 'conectada');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessoes_whatsapp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"escopo" "sessao_escopo" NOT NULL,
	"corretor_id" uuid,
	"session_name" text NOT NULL,
	"status" "sessao_status" DEFAULT 'desconectada' NOT NULL,
	"numero" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessoes_whatsapp_session_name_unique" UNIQUE("session_name")
);
--> statement-breakpoint
ALTER TABLE "mensagens_whatsapp" ADD COLUMN "wa_message_id" text;--> statement-breakpoint
ALTER TABLE "mensagens_whatsapp" ADD COLUMN "enviado_por" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessoes_whatsapp" ADD CONSTRAINT "sessoes_whatsapp_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessoes_whatsapp" ADD CONSTRAINT "sessoes_whatsapp_corretor_id_perfis_id_fk" FOREIGN KEY ("corretor_id") REFERENCES "public"."perfis"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessoes_whatsapp_imobiliaria_id_idx" ON "sessoes_whatsapp" USING btree ("imobiliaria_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mensagens_whatsapp" ADD CONSTRAINT "mensagens_whatsapp_enviado_por_perfis_id_fk" FOREIGN KEY ("enviado_por") REFERENCES "public"."perfis"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
