import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { PILL } from '../lib/format';
import { css } from '../lib/css';
import { DIAS_SEMANA, minToHHMM } from '../lib/schedule';

const ALERT_LIST_CREDITO = [
  { nome: 'Henrique Sampaio', motivo: 'Comprovante de renda ilegível', atraso: '3 dias' },
  { nome: 'Otávio Bandeira', motivo: 'Falta certidão de estado civil', atraso: '5 dias' },
  { nome: 'Sofia Krause', motivo: 'Score reprovado — aguardando 2º banco', atraso: '2 dias' },
];

const ALERT_LIST_TAREFA = [
  { nome: 'Retornar ligação — Henrique Sampaio', motivo: 'Diego Antunes · Análise de Crédito', atraso: '3 dias' },
  { nome: 'Confirmar visita — Renata Palhares', motivo: 'Fernanda Lopes · Visita Agendada', atraso: '1 dia' },
  { nome: 'Documentos pendentes — Otávio Bandeira', motivo: 'Priscila Nunes · Análise de Crédito', atraso: '5 dias' },
];

export function AlertModal() {
  const alert = useAppStore(s => s.alert);
  const alertCount = useAppStore(s => s.alertCount);
  const leadPendente = useAppStore(s => s.leadPendente);
  const alertOk = useAppStore(s => s.alertOk);
  const alertAlt = useAppStore(s => s.alertAlt);
  const horario = useAppStore(s => s.horarioAtendimento);
  const nav = useNavigate();
  if (!alert) return null;

  const janela = horario
    .map((c, i) => (c.ativo ? DIAS_SEMANA[i] + ' das ' + minToHHMM(c.abreMin) + ' às ' + minToHHMM(c.fechaMin) : null))
    .filter(Boolean)
    .join(' · ');

  const handleOk = () => {
    const target = alert === 'credito' ? '/credito' : alert === 'tarefa' ? '/agenda' : null;
    alertOk();
    if (target) nav(target);
  };

  const data = alert === 'lead'
    ? {
        titulo: 'Novo lead pra você',
        texto: (leadPendente?.nome || 'Um lead') + ' chegou pelo ' + (leadPendente?.canal || 'WhatsApp') + '. Aceite em ' + alertCount + 's ou ele volta para a roleta.',
        ok: 'Aceitar atendimento', alt: 'Recusar', showCount: true,
      }
    : alert === 'visita'
    ? {
        titulo: 'Visita agendada em breve',
        texto: 'Visita ao Edifício Aurora — Cobertura 1201 com Beatriz Aguiar hoje às 15h. Confirme a presença do cliente.',
        ok: 'Enviar lembrete no WhatsApp', alt: 'Já confirmei por ligação/pessoalmente', showCount: false,
      }
    : alert === 'credito'
    ? {
        titulo: 'Pendências de Análise de Crédito',
        texto: 'Lembrete horário: 3 pastas seguem com pendência devolvida pelo banco há mais de 48h.',
        ok: 'Abrir fila de crédito', alt: 'Lembrar em 1 hora', showCount: false,
      }
    : alert === 'tarefa'
    ? {
        titulo: 'Você tem tarefas atrasadas',
        texto: '3 tarefas passaram do prazo e ainda não foram concluídas. Dá uma olhada antes que o cliente esfrie.',
        ok: 'Abrir agenda', alt: 'Lembrar em 30 min', showCount: false,
      }
    : alert === 'fora-horario'
    ? {
        titulo: 'Fora do horário de atendimento',
        texto: 'Você só pode ficar "No Plantão" dentro do horário definido pela sua equipe: ' + (janela || 'nenhum dia liberado') + '. Fale com o gerente se precisar atender fora disso.',
        ok: 'Entendi', alt: '', showCount: false,
      }
    : {
        titulo: 'Você está no plantão',
        texto: 'Enquanto estiver no plantão, novos leads da roleta podem cair pra você a qualquer momento. Responda em até 5 minutos pra não perder a posição na fila — depois disso o lead volta pro próximo corretor disponível.',
        ok: 'Entendi', alt: '', showCount: false,
      };
  const list = alert === 'credito' ? ALERT_LIST_CREDITO : alert === 'tarefa' ? ALERT_LIST_TAREFA : [];

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(8,17,31,.62)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div className="modal-card" style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--terra)', borderRadius: 14, padding: 28, animation: 'fadeUp .14s ease', boxShadow: '0 24px 60px rgba(8,17,31,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ width: 11, height: 11, background: 'var(--terra)', transform: 'rotate(45deg)', flex: 'none' }} />
          <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 25, margin: 0, lineHeight: 1.15, flex: 1 }}>{data.titulo}</h3>
          {data.showCount && <span style={{ fontFamily: 'Newsreader,serif', fontSize: 30, color: 'var(--terra)' }}>{alertCount}s</span>}
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--muted)', margin: '0 0 22px' }}>{data.texto}</p>
        {list.map(a => (
          <div key={a.nome} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 0', borderTop: '1px solid var(--line)' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{a.nome}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{a.motivo}</span>
            </span>
            <span style={css(PILL + 'background:var(--terraSoft);color:var(--terra)')}>{a.atraso}</span>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 22 }}>
          <button onClick={handleOk} style={{ width: '100%', padding: 13, border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13.5, fontWeight: 700 }}>{data.ok}</button>
          {data.alt && <button onClick={alertAlt} style={{ width: '100%', padding: 12, border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>{data.alt}</button>}
        </div>
      </div>
    </div>
  );
}
