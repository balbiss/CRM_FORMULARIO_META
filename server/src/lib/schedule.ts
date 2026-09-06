// Mesma regra do CRM original (espelha src/lib/schedule.ts do front-end): roleta nunca distribui
// aos domingos, e encerra o expediente às 18:20 na maioria dos dias, 19:20 na quinta, 15:20 no
// sábado. Sem religamento automático de manhã. Validado aqui pro caso de alguém chamar a API
// diretamente (curl/Postman) pulando a checagem do front.
export function isBusinessHoursOpen(d = new Date()): boolean {
  const day = d.getDay();
  if (day === 0) return false;
  const minutes = d.getHours() * 60 + d.getMinutes();
  const cutoff = day === 4 ? 19 * 60 + 20 : day === 6 ? 15 * 60 + 20 : 18 * 60 + 20;
  return minutes < cutoff;
}

export function horarioAtendimentoLabel(): string {
  return 'Fora do horário de atendimento (seg-qua e sex até 18:20, qui até 19:20, sáb até 15:20, domingo fechado)';
}
