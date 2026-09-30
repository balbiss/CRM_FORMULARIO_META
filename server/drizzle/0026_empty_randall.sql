ALTER TABLE "roletas" ADD COLUMN "ultimo_corretor_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roletas" ADD CONSTRAINT "roletas_ultimo_corretor_id_perfis_id_fk" FOREIGN KEY ("ultimo_corretor_id") REFERENCES "public"."perfis"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
