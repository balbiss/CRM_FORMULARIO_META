CREATE TYPE "public"."lead_finalidade" AS ENUM('venda', 'locacao');--> statement-breakpoint
CREATE TYPE "public"."roleta_finalidade" AS ENUM('venda', 'locacao', 'ambos');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roletas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"padrao" boolean DEFAULT false NOT NULL,
	"canais" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"finalidade" "roleta_finalidade" DEFAULT 'ambos' NOT NULL,
	"sessao_whatsapp_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "filas_atendimento" DROP CONSTRAINT "filas_atendimento_corretor_id_unique";--> statement-breakpoint
ALTER TABLE "distribuicao_log" ADD COLUMN "roleta_id" uuid;--> statement-breakpoint
ALTER TABLE "filas_atendimento" ADD COLUMN "roleta_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "finalidade" "lead_finalidade";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "sessao_whatsapp_id" uuid;--> statement-breakpoint
ALTER TABLE "sessoes_whatsapp" ADD COLUMN "rotulo" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roletas" ADD CONSTRAINT "roletas_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roletas" ADD CONSTRAINT "roletas_sessao_whatsapp_id_sessoes_whatsapp_id_fk" FOREIGN KEY ("sessao_whatsapp_id") REFERENCES "public"."sessoes_whatsapp"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roletas_imobiliaria_id_idx" ON "roletas" USING btree ("imobiliaria_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "filas_atendimento" ADD CONSTRAINT "filas_atendimento_roleta_id_roletas_id_fk" FOREIGN KEY ("roleta_id") REFERENCES "public"."roletas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "roletas" ("imobiliaria_id", "nome", "padrao", "ordem")
SELECT "id", 'Geral', true, 0 FROM "imobiliarias"
WHERE "id" NOT IN (SELECT "imobiliaria_id" FROM "roletas");--> statement-breakpoint
UPDATE "filas_atendimento" f SET "roleta_id" = r."id"
FROM "roletas" r
WHERE r."imobiliaria_id" = f."imobiliaria_id" AND r."padrao" = true AND f."roleta_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "filas_roleta_corretor_uq" ON "filas_atendimento" USING btree ("roleta_id","corretor_id");