import { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo, scopeLeads } from '../lib/selectors';
import { COLS, CORRETORES } from '../lib/data';
import { BRL } from '../lib/format';

export default function Relatorios() {
  const allLeads = useAppStore(s => s.leads);
  const exportCsv = useAppStore(s => s.exportCsv);
  const toast = useAppStore(s => s.toast);
  const { isManager, meNome } = useRoleInfo();

  const leads = useMemo(() => scopeLeads(allLeads, isManager, meNome), [allLeads, isManager, meNome]);
  const counts = COLS.map(c => leads.filter(l => l.col === c.id).length);
  const maxC = Math.max(...counts, 1);
  const funnel = COLS.map((c, i) => ({
    title: c.title, label: counts[i] + ' leads',
    pct: Math.round((counts[i] / maxC) * 100),
    color: c.id === 'venda' ? 'var(--olive)' : 'var(--terra)',
  }));
  const ranking = [...CORRETORES].sort((a, b) => b.vgv - a.vgv);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Performance</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Relatórios</h1>
        </div>
        <button onClick={exportCsv} style={{ padding: '11px 18px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, fontWeight: 600 }}>Exportar CSV</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <select style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}><option>Últimos 30 dias</option><option>Último trimestre</option><option>Este ano</option></select>
        {isManager && (
          <>
            <select style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}><option>Todos os corretores</option><option>Camila Rocha</option><option>Diego Antunes</option></select>
            <select style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}><option>Todas as campanhas</option><option>Aurora — Lançamento</option><option>Vila Serena — Fase 2</option></select>
          </>
        )}
      </div>
      <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14 }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 22 }}>
          <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 21, margin: '0 0 20px' }}>Funil detalhado</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {funnel.map(f => (
              <div key={f.title}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>{f.title}</span><span style={{ color: 'var(--muted)' }}>{f.label}</span>
                </div>
                <div style={{ height: 9, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}><div style={{ height: '100%', width: f.pct + '%', background: f.color, borderRadius: 6 }} /></div>
              </div>
            ))}
          </div>
        </div>
        {isManager && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 21, margin: 0 }}>Ranking</h2>
              <select onChange={e => toast('Ranking ordenado ' + e.target.value.toLowerCase())} style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--card)', fontSize: 12.5 }}><option>Por VGV</option><option>Por conversão</option><option>Por leads</option></select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {ranking.map((r, i) => (
                <div key={r.nome} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontFamily: 'Newsreader,serif', fontSize: 17, color: 'var(--muted)', width: 20 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{r.nome}</span>
                  <span style={{ fontFamily: 'Newsreader,serif', fontSize: 16 }}>{BRL(r.vgv)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
