import { HORARIO_ATENDIMENTO_PADRAO, type DiaAtendimento } from '../db/schema.js';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const fmt = (min: number) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

/** O corretor só pode ficar "No Plantão" dentro da janela de atendimento do dia — janela
 * configurada pelo Dono/Gerente (imobiliarias.horario_atendimento), sempre no fuso de São Paulo. */
export function isBusinessHoursOpen(dias: DiaAtendimento[] | null | undefined, agora = new Date()): boolean {
  const cfg = (dias && dias.length === 7 ? dias : HORARIO_ATENDIMENTO_PADRAO);
  const d = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hoje = cfg[d.getDay()];
  if (!hoje || !hoje.ativo) return false;
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes >= hoje.abreMin && minutes < hoje.fechaMin;
}

export function horarioAtendimentoLabel(dias?: DiaAtendimento[] | null): string {
  const cfg = (dias && dias.length === 7 ? dias : HORARIO_ATENDIMENTO_PADRAO);
  const partes = cfg
    .map((c, i) => (c.ativo ? DIAS[i] + ' ' + fmt(c.abreMin) + '–' + fmt(c.fechaMin) : null))
    .filter(Boolean);
  return 'Fora do horário de atendimento. Janela da equipe: ' + (partes.length ? partes.join('; ') : 'nenhum dia liberado') + '.';
}
