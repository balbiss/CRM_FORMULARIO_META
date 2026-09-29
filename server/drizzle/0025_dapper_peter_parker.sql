CREATE TABLE IF NOT EXISTS "avisos_corretor_whatsapp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imobiliaria_id" uuid NOT NULL,
	"lead_id" uuid,
	"lead_nome" text NOT NULL,
	"corretor_id" uuid,
	"corretor_nome" text NOT NULL,
	"sucesso" boolean NOT NULL,
	"erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avisos_corretor_whatsapp" ADD CONSTRAINT "avisos_corretor_whatsapp_imobiliaria_id_imobiliarias_id_fk" FOREIGN KEY ("imobiliaria_id") REFERENCES "public"."imobiliarias"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avisos_corretor_whatsapp" ADD CONSTRAINT "avisos_corretor_whatsapp_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "avisos_corretor_whatsapp" ADD CONSTRAINT "avisos_corretor_whatsapp_corretor_id_perfis_id_fk" FOREIGN KEY ("corretor_id") REFERENCES "public"."perfis"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "avisos_corretor_whatsapp_imobiliaria_id_idx" ON "avisos_corretor_whatsapp" USING btree ("imobiliaria_id");