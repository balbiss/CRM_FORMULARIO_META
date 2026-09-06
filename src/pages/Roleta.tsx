import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { ini } from '../lib/format';

export default function Roleta() {
  const fila = useAppStore(s => s.fila);
  const toggleFila = useAppStore(s => s.toggleFila);
  const shuffle = useAppStore(s => s.shuffle);
  const { isManager, meNome } = useRoleInfo();
  const nextIdx = fila.findIndex(f => f.ativo);
  const ativos = fila.filter(f => f.ativo).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Distribuição</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Roleta de Atendimento</h1>
        </div>
        {isManager && <button onClick={shuffle} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Embaralhar roleta</button>}
      </div>
      <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
          {fila.map((f, i) => {
            const canToggle = isManager || f.nome === meNome;
            return (
              <div key={f.nome} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 20px', borderBottom: '1px solid var(--line)', opacity: f.ativo ? 1 : 0.5, background: !isManager && f.nome === meNome ? 'var(--bg)' : 'transparent' }}>
                <span style={{ fontFamily: 'Newsreader,serif', fontSize: 19, width: 26, color: 'var(--muted)' }}>{i + 1}</span>
                <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none' }}>{ini(f.nome)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{f.nome}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{f.ativo ? 'Disponível · última entrega 12 min atrás' : 'Fora da roleta'}</span>
                </span>
                {i === nextIdx && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--terra)', background: 'var(--terraSoft)', padding: '5px 10px', borderRadius: 20 }}>Próximo</span>}
                <button
                  onClick={() => toggleFila(i, canToggle)}
                  title="Disponível na roleta"
                  style={{ width: 40, height: 23, borderRadius: 14, border: 'none', flex: 'none', padding: 3, display: 'flex', justifyContent: f.ativo ? 'flex-end' : 'flex-start', background: f.ativo ? 'var(--olive)' : 'var(--line)', cursor: canToggle ? 'pointer' : 'not-allowed', opacity: canToggle ? 1 : 0.45 }}
                >
                  <span style={{ width: 17, height: 17, borderRadius: '50%', background: '#fff', display: 'block' }} />
                </button>
              </div>
            );
          })}
        </div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 22 }}>
          <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 20, margin: '0 0 16px' }}>Como funciona</h2>
          <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--muted)', margin: '0 0 18px' }}>Cada lead novo cai no próximo corretor disponível da fila. Quem está indisponível é pulado sem perder a posição.</p>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--muted)' }}>Disponíveis agora</span><span style={{ fontWeight: 700 }}>{ativos}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--muted)' }}>Leads distribuídos hoje</span><span style={{ fontWeight: 700 }}>37</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: 'var(--muted)' }}>Tempo médio de aceite</span><span style={{ fontWeight: 700 }}>4 min</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
