CREATE TYPE "public"."bloqueio_motivo" AS ENUM('manual', 'inadimplencia');--> statement-breakpoint
CREATE TYPE "public"."imobiliaria_status" AS ENUM('ativa', 'bloqueada');--> statement-breakpoint
CREATE TYPE "public"."pagamento_metodo" AS ENUM('pix', 'boleto', 'cartao', 'transferencia', 'dinheiro', 'outro');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admins_plataforma" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_plataforma_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pagamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"competencia" text NOT NULL,
	"pago_em" date NOT NULL,
	"metodo" "pagamento_metodo" DEFAULT 'pix' NOT NULL,
	"observacao" text,
	"registrado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "imobiliarias" ADD COLUMN "status" "imobiliaria_status" DEFAULT 'ativa' NOT NULL;--> statement-breakpoint
ALTER TABLE "imobiliarias" ADD COLUMN "bloqueio_motivo" "bloqueio_motivo";--> statement-breakpoint
ALTER TABLE "imobiliarias" ADD COLUMN "plano" text DEFAULT 'Padrão' NOT NULL;--> statement-breakpoint
ALTER TABLE "imobiliarias" ADD COLUMN "mensalidade" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "imobiliarias" ADD COLUMN "limite_corretores" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "imobiliarias" ADD COLUMN "proximo_vencimento" date;--> statement-breakpoint
ALTER TABLE "imobiliarias" ADD COLUMN "dias_carencia" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "imobiliarias" ADD COLUMN "observacoes" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_registrado_por_admins_plataforma_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."admins_plataforma"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pagamentos_imobiliaria_id_idx" ON "pagamentos" USING btree ("imobiliaria_id");