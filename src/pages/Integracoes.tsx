import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { CORRETORES } from '../lib/data';
import { ini, PILL } from '../lib/format';
import { css } from '../lib/css';

export default function Integracoes() {
  const conn = useAppStore(s => s.conn);
  const setQrFor = useAppStore(s => s.setQrFor);
  const disconnect = useAppStore(s => s.disconnect);
  const { isManager, meNome } = useRoleInfo();

  const conexoes = CORRETORES.filter(c => isManager || c.nome === meNome);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Integrações</p>
        <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Conexão de WhatsApp</h1>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
        {conexoes.map(c => {
          const on = !!conn[c.nome];
          const numero = on ? '+55 11 9' + (7000 + c.nome.length * 41) + '-' + (2000 + c.nome.length * 17) : '—';
          return (
            <div key={c.nome} style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: 'none' }}>{ini(c.nome)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{c.nome}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{c.cargo}</span>
                </span>
                <span style={css(PILL + (on ? 'background:var(--oliveSoft);color:var(--olive)' : 'background:var(--terraSoft);color:var(--terra)'))}>{on ? 'Conectado' : 'Desconectado'}</span>
              </div>
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16, marginBottom: 16 }}>
                <p style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' }}>Número conectado</p>
                <p style={{ fontFamily: 'Newsreader,serif', fontSize: 19, margin: 0 }}>{numero}</p>
              </div>
              {on
                ? <button onClick={() => disconnect(c.nome)} style={{ width: '100%', padding: 10, border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600, color: 'var(--terra)' }}>Desconectar</button>
                : <button onClick={() => setQrFor(c.nome)} style={{ width: '100%', padding: 10, border: 'none', borderRadius: 8, background: 'var(--olive)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Conectar WhatsApp</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
