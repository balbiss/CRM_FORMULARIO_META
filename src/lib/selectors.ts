import { useAppStore, roleLabel } from '../store/appStore';
import type { Lead } from './data';

export function useRoleInfo() {
  const me = useAppStore(s => s.me);
  const role = me ? roleLabel[me.role] : 'Corretor';
  const isManager = role !== 'Corretor';
  const isDono = role === 'Dono';
  const meNome = me?.nome || '';
  return { role, isManager, isDono, meNome };
}

/** Corretor only ever sees their own leads; Dono/Gerente see everyone's. */
export function scopeLeads(leads: Lead[], isManager: boolean, meNome: string): Lead[] {
  return isManager ? leads : leads.filter(l => l.corretor === meNome);
}

export const CORRETOR_NOMES = ['Camila Rocha', 'Diego Antunes', 'Fernanda Lopes', 'Marcelo Braga', 'Priscila Nunes', 'Rafael Teixeira'];

/** Total de conversas com mensagem recebida ainda não lida (badge da sidebar). */
export function useUnreadTotal() {
  const conversas = useAppStore(s => s.conversas);
  return conversas.reduce((n, c) => n + (c.naoLidas ?? 0), 0);
}

/** Rebatidas pool count visible to the current role (badge count for the sidebar). */
export function useRebatidasTotal() {
  const leads = useAppStore(s => s.leads);
  return leads.filter(l => l.col === 'rebatida' && l.motivo !== 'Duplicado').length;
}
