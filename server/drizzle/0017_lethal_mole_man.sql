ALTER TYPE "public"."canal" ADD VALUE 'Site';--> statement-breakpoint
ALTER TABLE "imobiliarias" ADD COLUMN "captura_token" text;--> statement-breakpoint
ALTER TABLE "imobiliarias" ADD CONSTRAINT "imobiliarias_captura_token_unique" UNIQUE("captura_token");