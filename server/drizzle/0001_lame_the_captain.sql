ALTER TABLE "imoveis" ADD COLUMN "imagens" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "imoveis" ADD COLUMN "video_url" text;