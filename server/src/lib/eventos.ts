import { db } from '../db/client.js';
import { eventosLead } from '../db/schema.js';

/** Registra um evento na linha do tempo do lead (fire-and-forget — nunca quebra o fluxo principal). */
export function registrarEvento(imobiliariaId: string, leadId: string, tipo: string, descricao: string, atorNome?: string | null) {
  db.insert(eventosLead).values({ imobiliariaId, leadId, tipo, descricao, atorNome: atorNome ?? null })
    .catch(e => console.error('evento:', (e as Error).message));
}
