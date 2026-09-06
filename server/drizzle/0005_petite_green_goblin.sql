CREATE INDEX IF NOT EXISTS "colunas_kanban_imobiliaria_id_idx" ON "colunas_kanban" USING btree ("imobiliaria_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_imobiliaria_id_idx" ON "leads" USING btree ("imobiliaria_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_corretor_id_idx" ON "leads" USING btree ("corretor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_coluna_id_idx" ON "leads" USING btree ("coluna_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mensagens_lead_id_idx" ON "mensagens_whatsapp" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "perfis_imobiliaria_id_idx" ON "perfis" USING btree ("imobiliaria_id");