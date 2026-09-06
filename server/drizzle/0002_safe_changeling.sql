ALTER TABLE "imoveis" ADD COLUMN "vagas" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "imoveis" ADD COLUMN "situacao" text DEFAULT 'Pronto para morar' NOT NULL;--> statement-breakpoint
ALTER TABLE "imoveis" ADD COLUMN "previsao_entrega" text;--> statement-breakpoint
ALTER TABLE "imoveis" ADD COLUMN "aceita_financiamento" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "imoveis" ADD COLUMN "valor_condominio" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "imoveis" ADD COLUMN "valor_iptu" numeric(12, 2);