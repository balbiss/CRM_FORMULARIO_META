import { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { BRL, PILL } from '../lib/format';
import { css } from '../lib/css';

export default function Credito() {
  const allLeads = useAppStore(s => s.leads);
  const openLead = useAppStore(s => s.openLead);
  const ask = useAppStore(s => s.ask);
  const toast = useAppStore(s => s.toast);
  const { isManager, meNome } = useRoleInfo();

  const rows = useMemo(() => allLeads
    .filter(l => (l.col === 'credito' || l.col === 'proposta') && (isManager || l.corretor === meNome))
    .map(l => {
      const st = l.dias > 6 ? 'Pendência devolvida' : l.dias > 3 ? 'Em análise no banco' : 'Pasta enviada';
      return { l, status: st };
    }), [allLeads, isManager, meNome]);

  const pendencias = rows.filter(r => r.status === 'Pendência devolvida').length;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Financeiro</p>
        <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Análise de Crédito</h1>
      </div>
      {pendencias > 0 && (
        <div style={{ border: '1px solid var(--terra)', background: 'var(--terraSoft)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <span style={{ width: 10, height: 10, background: 'var(--terra)', transform: 'rotate(45deg)', flex: 'none' }} />
          <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.5 }}><strong>{pendencias} pendências devolvidas</strong> pelo banco aguardam correção há mais de 48h.</span>
          <button
            onClick={() => ask('Nova pasta para análise', '2 pastas voltaram com pendência do banco e 1 nova pasta entrou na fila de análise. Deseja abrir a fila agora?', 'Abrir fila', () => toast('Fila de análise atualizada'))}
            style={{ padding: '8px 14px', border: '1px solid var(--terra)', borderRadius: 7, background: 'none', color: 'var(--terra)', fontSize: 12.5, fontWeight: 700 }}
          >
            Revisar pastas
          </button>
        </div>
      )}
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          <span style={{ flex: 1.4 }}>Lead / imóvel</span>{isManager && <span style={{ flex: 1 }}>Corretor</span>}<span style={{ width: 120 }}>Renda declarada</span><span style={{ width: 150 }}>Status da pasta</span><span style={{ width: 80 }} />
        </div>
        {rows.map(({ l, status }) => (
          <div key={l.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ flex: 1.4, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{l.nome}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{l.imovel}</span>
            </span>
            {isManager && <span style={{ flex: 1, fontSize: 13 }}>{l.corretor}</span>}
            <span style={{ width: 120, fontFamily: 'Newsreader,serif', fontSize: 16 }}>{BRL(l.renda)}</span>
            <span style={{ width: 150 }}>
              <span style={css(PILL + (status === 'Pendência devolvida' ? 'background:var(--terraSoft);color:var(--terra)' : status === 'Pasta enviada' ? 'background:var(--oliveSoft);color:var(--olive)' : 'border:1px solid var(--line);color:var(--muted)'))}>{status}</span>
            </span>
            <button onClick={() => openLead(l.id)} style={{ width: 80, padding: '7px 0', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600 }}>Abrir</button>
          </div>
        ))}
      </div>
    </div>
  );
}
