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

/** Total de mensagens não lidas — ainda não existe um campo "lida" real pra mensagem de
 * WhatsApp no banco (diferente de notificações, que já tem), então não fabricamos um número
 * falso aqui. Fica em 0 (sem badge) até esse dado existir de verdade. */
export function useUnreadTotal() {
  return 0;
}

/** Rebatidas pool count visible to the current role (badge count for the sidebar). */
export function useRebatidasTotal() {
  const leads = useAppStore(s => s.leads);
  return leads.filter(l => l.col === 'rebatida' && l.motivo !== 'Duplicado').length;
}
