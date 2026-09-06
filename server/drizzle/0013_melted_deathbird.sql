ALTER TABLE "mensagens_whatsapp" ADD COLUMN "ack_status" integer;--> statement-breakpoint
ALTER TABLE "mensagens_whatsapp" ADD COLUMN "lida" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Remove duplicatas de wa_message_id (webhook processado 2x) antes de criar o índice único, mantendo a linha mais antiga.
DELETE FROM "mensagens_whatsapp" a USING "mensagens_whatsapp" b
  WHERE a."wa_message_id" IS NOT NULL AND a."wa_message_id" = b."wa_message_id"
  AND (a."enviado_em" > b."enviado_em" OR (a."enviado_em" = b."enviado_em" AND a."id" > b."id"));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mensagens_wa_message_id_uq" ON "mensagens_whatsapp" USING btree ("wa_message_id") WHERE "mensagens_whatsapp"."wa_message_id" is not null;