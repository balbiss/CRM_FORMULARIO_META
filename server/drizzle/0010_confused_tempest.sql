CREATE TYPE "public"."modo_whatsapp" AS ENUM('central', 'corretor');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "integracoes_facebook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"nome_conta" text NOT NULL,
	"page_id" text NOT NULL,
	"form_id" text NOT NULL,
	"token_cifrado" text NOT NULL,
	"token_iv" text NOT NULL,
	"token_tag" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultima_sync_em" timestamp with time zone,
	"ultimo_erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "imobiliarias" ADD COLUMN "modo_whatsapp" "modo_whatsapp" DEFAULT 'corretor' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "integracoes_facebook" ADD CONSTRAINT "integracoes_facebook_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integracoes_facebook_imobiliaria_id_idx" ON "integracoes_facebook" USING btree ("imobiliaria_id");