import { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo, scopeLeads } from '../lib/selectors';
import { BRL } from '../lib/format';

export default function Relatorios() {
  const allLeads = useAppStore(s => s.leads);
  const colunas = useAppStore(s => s.colunasRemotas);
  const perfis = useAppStore(s => s.perfisRemotos);
  const exportCsv = useAppStore(s => s.exportCsv);
  const { isManager, meNome } = useRoleInfo();

  const leads = useMemo(() => scopeLeads(allLeads, isManager, meNome), [allLeads, isManager, meNome]);
  const counts = colunas.map(c => leads.filter(l => l.colunaId === c.id).length);
  const maxC = Math.max(...counts, 1);
  const funnel = colunas.map((c, i) => ({
    title: c.titulo, label: counts[i] + ' leads',
    pct: Math.round((counts[i] / maxC) * 100),
    color: c.slug === 'venda' ? 'var(--olive)' : 'var(--terra)',
  }));
  const ranking = perfis
    .map(p => {
      const meus = allLeads.filter(l => l.corretor === p.nome);
      const v = meus.filter(l => l.col === 'venda');
      return { nome: p.nome, vgv: v.reduce((a, l) => a + l.valor, 0), leads: meus.length, vendas: v.length };
    })
    .filter(r => r.leads > 0)
    .sort((a, b) => b.vgv - a.vgv);

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Performance</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Relatórios</h1>
        </div>
        <button onClick={exportCsv} style={{ padding: '11px 18px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, fontWeight: 600 }}>Exportar CSV</button>
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
            <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 21, margin: '0 0 18px' }}>Ranking por VGV</h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {ranking.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Ainda sem vendas registradas.</p>}
              {ranking.map((r, i) => (
                <div key={r.nome} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ fontFamily: 'Newsreader,serif', fontSize: 17, color: 'var(--muted)', width: 20 }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{r.nome}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{r.vendas} venda{r.vendas === 1 ? '' : 's'} · {r.leads} leads</span>
                  </span>
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
