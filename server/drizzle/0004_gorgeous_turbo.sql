ALTER TABLE "mensagens_whatsapp" ALTER COLUMN "texto" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mensagens_whatsapp" ADD COLUMN "anexo_url" text;--> statement-breakpoint
ALTER TABLE "mensagens_whatsapp" ADD COLUMN "anexo_tipo" text;