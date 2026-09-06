import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { PILL } from '../lib/format';
import { css } from '../lib/css';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const EVENTOS: [string, string, string, string, string][] = [
  ['09:00', '17 set', 'Visita — Edifício Aurora, Cob. 1201', 'Beatriz Aguiar · Camila Rocha', 'Confirmada'],
  ['11:30', '17 set', 'Follow-up telefônico', 'Henrique Sampaio · Diego Antunes', 'Atrasado'],
  ['14:00', '17 set', 'Assinatura de proposta', 'Lucia Ferrari · Camila Rocha', 'Confirmada'],
  ['16:30', '18 set', 'Visita — Vila Serena, Casa 14', 'Tiago Meireles · Fernanda Lopes', 'Confirmada'],
  ['10:00', '19 set', 'Entrega de documentos ao banco', 'Otávio Bandeira · Priscila Nunes', 'Pendente'],
  ['15:00', '23 set', 'Reunião de pipeline', 'Equipe comercial', 'Confirmada'],
];
const MARKED_DAYS = [4, 9, 12, 17, 18, 23, 26];

export default function Agenda() {
  const day = useAppStore(s => s.day);
  const goDay = useAppStore(s => s.goDay);
  const { isManager, meNome } = useRoleInfo();

  const eventos = EVENTOS.filter(e => isManager || e[3].includes(meNome) || e[3].includes('Equipe'));
  const days = Array.from({ length: 35 }, (_, i) => {
    const n = i - 1;
    const valid = n >= 1 && n <= 30;
    return { n, valid };
  });

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Setembro 2026</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Agenda &amp; Tarefas</h1>
        </div>
        {isManager && (
          <select style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}>
            <option>Todos os corretores</option><option>Camila Rocha</option><option>Diego Antunes</option><option>Fernanda Lopes</option>
          </select>
        )}
      </div>
      <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 14, alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 8 }}>
            {WEEKDAYS.map(d => <span key={d} style={{ textAlign: 'center', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{d}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {days.map((d, i) => {
              const on = d.n === day;
              const has = d.valid && MARKED_DAYS.includes(d.n);
              return (
                <button
                  key={i}
                  onClick={() => d.valid && goDay(d.n)}
                  style={{ aspectRatio: '1', border: '1px solid ' + (on ? 'var(--terra)' : 'transparent'), borderRadius: 8, background: on ? 'var(--terraSoft)' : 'transparent', color: !d.valid ? 'transparent' : on ? 'var(--terra)' : 'var(--ink)', fontSize: 13, fontWeight: on ? 700 : 500, cursor: d.valid ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}
                >
                  {d.valid ? d.n : ''}
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: has ? 'var(--terra)' : 'transparent' }} />
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 22 }}>
          <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 21, margin: '0 0 18px' }}>Compromissos</h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {eventos.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ width: 64, flex: 'none' }}>
                  <span style={{ display: 'block', fontFamily: 'Newsreader,serif', fontSize: 17 }}>{e[0]}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{e[1]}</span>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{e[2]}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{e[3]}</span>
                </span>
                <span style={css(PILL + 'align-self:center;' + (e[4] === 'Atrasado' ? 'background:var(--terraSoft);color:var(--terra)' : e[4] === 'Confirmada' ? 'background:var(--oliveSoft);color:var(--olive)' : 'border:1px solid var(--line);color:var(--muted)'))}>{e[4]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
