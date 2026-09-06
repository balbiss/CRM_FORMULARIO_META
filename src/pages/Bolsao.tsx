import { useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { ROLETA_LOG } from '../lib/data';
import { canalPill, thumb, PILL } from '../lib/format';
import { css } from '../lib/css';
import type { BolsaoTab } from '../store/appStore';

const MOTIVOS_EXTREMOS = ['Descadastrar', 'Já Comprou'];

function cidadeDe(imovelSub: string): string {
  // "Itaim Bibi, São Paulo · 248 m²" -> "São Paulo"
  const antesDoM2 = imovelSub.split('·')[0] || '';
  const partes = antesDoM2.split(',').map(p => p.trim());
  return partes[1] || partes[0] || '';
}

export default function Bolsao() {
  const allLeads = useAppStore(s => s.leads);
  const bolsaoTab = useAppStore(s => s.bolsaoTab);
  const setBolsaoTab = useAppStore(s => s.setBolsaoTab);
  const bolsaoAssume = useAppStore(s => s.bolsaoAssume);
  const bolsaoDiscard = useAppStore(s => s.bolsaoDiscard);
  const pull = useAppStore(s => s.pull);
  const openLead = useAppStore(s => s.openLead);
  const toast = useAppStore(s => s.toast);
  const { isManager, meNome } = useRoleInfo();
  const [query, setQuery] = useState('');
  const [cidade, setCidade] = useState('Todas as Cidades');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const gerenciaisTabs: [BolsaoTab, string][] = [
    ['novos', 'Leads Novos'], ['rebatidas', 'Rebatidas Geral'],
    ['descartados', 'Leads Descartados'], ['descadastrar', 'Lead Descadastrar'], ['roletalog', 'Histórico da Roleta'],
  ];
  const corretorTabs: [BolsaoTab, string][] = [['rebatidas', 'Rebatidas'], ['roletalog', 'Histórico da Roleta']];
  const tabs = isManager ? gerenciaisTabs : corretorTabs;
  const bTab: BolsaoTab = tabs.some(([id]) => id === bolsaoTab) ? bolsaoTab : 'rebatidas';

  const cidades = useMemo(() => Array.from(new Set(allLeads.map(l => cidadeDe(l.imovelSub)).filter(Boolean))), [allLeads]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allLeads.filter(l => {
      if (q && !(l.nome.toLowerCase().includes(q) || l.tel.includes(q) || l.corretor.toLowerCase().includes(q))) return false;
      if (cidade !== 'Todas as Cidades' && cidadeDe(l.imovelSub) !== cidade) return false;
      return true;
    });
  }, [allLeads, query, cidade]);

  const leadsNovos = filtrados.filter(l => l.col === 'novo');
  const rebatidasGeral = filtrados.filter(l => l.col === 'rebatida' && !MOTIVOS_EXTREMOS.includes(l.motivo));
  const descadastrar = filtrados.filter(l => l.col === 'rebatida' && MOTIVOS_EXTREMOS.includes(l.motivo));
  const roletaLog = ROLETA_LOG.filter(r => isManager || r[2] === meNome);

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Recuperação</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Bolsão de Leads</h1>
        </div>
        <button onClick={pull} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Puxar mais rebatidas</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nome, telefone ou corretor…"
          style={{ flex: '1 1 220px', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}
        />
        <select value={cidade} onChange={e => setCidade(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}>
          <option>Todas as Cidades</option>
          {cidades.map(c => <option key={c}>{c}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" value={de} onChange={e => setDe(e.target.value)} style={{ padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }} />
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>até</span>
          <input type="date" value={ate} onChange={e => setAte(e.target.value)} style={{ padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--line)', marginBottom: 18, overflowX: 'auto' }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setBolsaoTab(id)} style={{ padding: '0 0 12px', border: 'none', background: 'none', fontSize: 13.5, fontWeight: bTab === id ? 700 : 500, whiteSpace: 'nowrap', color: bTab === id ? 'var(--ink)' : 'var(--muted)', borderBottom: '2px solid ' + (bTab === id ? 'var(--terra)' : 'transparent'), marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      {bTab === 'novos' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
          {leadsNovos.map((l, i) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
              <span style={css(thumb(i, 34))} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{l.nome}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{l.imovelSub} · {l.tel}</span>
              </span>
              <span style={css(canalPill(l.canal))}>{l.canal}</span>
              <span style={{ fontSize: 12.5, width: 140 }}>{l.corretor || '— sem corretor —'}</span>
              <button onClick={() => openLead(l.id)} style={{ padding: '7px 13px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600 }}>Abrir</button>
            </div>
          ))}
          {leadsNovos.length === 0 && <div style={{ padding: '44px 20px', textAlign: 'center' }}><p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0 }}>Nenhum lead novo no momento.</p></div>}
        </div>
      )}

      {bTab === 'rebatidas' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
          {rebatidasGeral.map((l, i) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
              <span style={css(thumb(i, 34))} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{l.nome}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{l.imovelSub} · {l.tel}</span>
              </span>
              <span style={css(canalPill(l.canal))}>{l.canal}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)', width: 110, textAlign: 'right' }}>{l.motivo}</span>
              <button onClick={() => bolsaoAssume(l.id)} style={{ padding: '7px 13px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600 }}>Assumir</button>
              <button onClick={() => bolsaoDiscard(l.id, l.nome)} style={{ padding: '7px 11px', border: 'none', borderRadius: 7, background: 'none', fontSize: 12.5, color: 'var(--muted)' }}>Descartar</button>
            </div>
          ))}
          {rebatidasGeral.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: 28, height: 28, border: '1.5px solid var(--line)', transform: 'rotate(45deg)', margin: '0 auto 16px' }} />
              <p style={{ fontSize: 14.5, margin: '0 0 4px' }}>Bolsão vazio.</p>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Todo lead rebatido já foi redistribuído.</p>
            </div>
          )}
        </div>
      )}

      {bTab === 'descartados' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
          <div className="data-table-head" style={{ display: 'flex', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <span style={{ flex: 1 }}>Lead</span><span style={{ flex: 1 }}>Motivo</span><span style={{ width: 140 }}>Último corretor</span><span style={{ width: 90 }}>Há</span>
          </div>
          {rebatidasGeral.map(l => (
            <div key={l.id} className="data-row" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{l.nome}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>{l.motivo}</span>
              <span style={{ width: 140, fontSize: 13 }}>{l.corretor}</span>
              <span style={{ width: 90, fontSize: 11.5, color: 'var(--muted)' }}>{l.dias === 0 ? 'hoje' : l.dias + 'd'}</span>
            </div>
          ))}
          {rebatidasGeral.length === 0 && <div style={{ padding: '44px 20px', textAlign: 'center' }}><p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0 }}>Nenhum lead descartado registrado.</p></div>}
        </div>
      )}

      {bTab === 'descadastrar' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
          {descadastrar.map(l => (
            <div key={l.id} className="data-row" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{l.nome}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{l.tel}</span>
              </span>
              <span style={css(PILL + 'background:var(--terraSoft);color:var(--terra)')}>{l.motivo}</span>
              <button onClick={() => toast(l.nome + ' aprovado — saiu definitivamente da base')} style={{ padding: '7px 13px', border: 'none', borderRadius: 7, background: 'var(--terra)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>Aprovar</button>
              <button onClick={() => toast('Descarte de ' + l.nome + ' recusado — volta pro corretor')} style={{ padding: '7px 13px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600 }}>Recusar</button>
            </div>
          ))}
          {descadastrar.length === 0 && <div style={{ padding: '44px 20px', textAlign: 'center' }}><p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0 }}>Nenhuma solicitação de descadastro pendente.</p></div>}
        </div>
      )}

      {bTab === 'roletalog' && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
          <div className="data-table-head" style={{ display: 'flex', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <span style={{ width: 130 }}>Data / hora</span><span style={{ flex: 1 }}>Lead</span><span style={{ flex: 1 }}>Recebido por</span><span style={{ width: 170 }}>Origem</span>
          </div>
          {roletaLog.map((r, i) => (
            <div key={i} className="data-row" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: 130, fontSize: 12.5, color: 'var(--muted)' }}>{r[0]}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{r[1]}</span>
              <span style={{ flex: 1, fontSize: 13 }}>{r[2]}</span>
              <span style={{ width: 170 }}><span style={css(PILL + (r[3] === 'Roleta automática' ? 'background:var(--oliveSoft);color:var(--olive)' : 'background:var(--terraSoft);color:var(--terra)'))}>{r[3]}</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
