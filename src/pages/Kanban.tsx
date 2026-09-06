import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutGrid, List as ListIcon, X } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { COLS, CORRETORES, type ColId } from '../lib/data';
import { canalPill, thumb } from '../lib/format';
import { css } from '../lib/css';

type ViewMode = 'kanban' | 'lista';

export default function Kanban() {
  const allLeads = useAppStore(s => s.leads);
  const move = useAppStore(s => s.move);
  const openLead = useAppStore(s => s.openLead);
  const kbCorretor = useAppStore(s => s.kbCorretor);
  const setKbCorretor = useAppStore(s => s.setKbCorretor);
  const addColumn = useAppStore(s => s.addColumn);
  const newLead = useAppStore(s => s.newLead);
  const setImportOpen = useAppStore(s => s.setImportOpen);
  const { isManager, meNome } = useRoleInfo();
  const location = useLocation();
  const navState = location.state as { scrollToCol?: ColId; filterCanal?: string } | null;
  const [mobileCol, setMobileCol] = useState<ColId>('novo');
  const [dragId, setDragId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('kanban');
  const [filterCanal, setFilterCanal] = useState<string | null>(navState?.filterCanal ?? null);
  const [highlightCol, setHighlightCol] = useState<ColId | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (navState?.scrollToCol) {
      setView('kanban');
      const el = document.querySelector('[data-col-id="' + navState.scrollToCol + '"]');
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      setHighlightCol(navState.scrollToCol);
      const t = setTimeout(() => setHighlightCol(null), 1600);
      return () => clearTimeout(t);
    }
    if (navState?.filterCanal) setView('lista');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leads = useMemo(() => {
    let base = isManager
      ? (kbCorretor !== 'Todos os corretores' ? allLeads.filter(l => l.corretor === kbCorretor) : allLeads)
      : allLeads.filter(l => l.corretor === meNome);
    if (filterCanal) base = base.filter(l => l.canal === filterCanal);
    const q = query.trim().toLowerCase();
    if (q) base = base.filter(l => l.nome.toLowerCase().includes(q) || l.tel.includes(q));
    return base;
  }, [allLeads, isManager, kbCorretor, meNome, filterCanal, query]);

  const active = leads.filter(l => l.col !== 'rebatida');
  const counts = COLS.map(c => leads.filter(l => l.col === c.id).length);

  const onDrop = (col: ColId) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragId) move(dragId, col);
    setDragId(null);
  };

  const toggleBtn = (mode: ViewMode, Icon: typeof LayoutGrid, label: string) => (
    <button
      onClick={() => setView(mode)}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', border: '1px solid ' + (view === mode ? 'var(--terra)' : 'var(--line)'),
        borderRadius: 8, background: view === mode ? 'var(--terraSoft)' : 'var(--card)', color: view === mode ? 'var(--terra)' : 'var(--muted)',
        fontSize: 13, fontWeight: 600,
      }}
    >
      <Icon size={14} strokeWidth={2} />{label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Pipeline</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Kanban de Leads</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{active.length} leads ativos</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, width: 200 }}
          />
          {filterCanal && (
            <button
              onClick={() => setFilterCanal(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', border: '1px solid var(--terra)', borderRadius: 20, background: 'var(--terraSoft)', color: 'var(--terra)', fontSize: 12.5, fontWeight: 600 }}
            >
              Canal: {filterCanal} <X size={12} strokeWidth={2.5} />
            </button>
          )}
          {isManager && (
            <select value={kbCorretor} onChange={e => setKbCorretor(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}>
              <option>Todos os corretores</option>{CORRETORES.map(c => <option key={c.nome}>{c.nome}</option>)}
            </select>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            {toggleBtn('kanban', LayoutGrid, 'Kanban')}
            {toggleBtn('lista', ListIcon, 'Lista')}
          </div>
          <button onClick={addColumn} style={{ padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, fontWeight: 600 }}>+ Coluna</button>
          <button onClick={() => setImportOpen(true)} style={{ padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, fontWeight: 600 }}>Importar planilha</button>
          <button onClick={newLead} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Novo lead</button>
        </div>
      </div>

      {view === 'lista' ? (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <span style={{ flex: 1.6 }}>Lead / imóvel</span>
            <span style={{ width: 110 }}>Canal</span>
            {isManager && <span style={{ flex: 1 }}>Corretor</span>}
            <span style={{ width: 180 }}>Coluna</span>
            <span style={{ width: 90 }}>Tempo</span>
          </div>
          {leads.map((l, i) => (
            <div key={l.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--line)' }}>
              <button onClick={() => openLead(l.id)} style={{ flex: 1.6, minWidth: 0, display: 'flex', gap: 11, alignItems: 'center', background: 'none', border: 'none', textAlign: 'left', padding: 0 }}>
                <span style={css(thumb(i, 32))} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.imovel}</span>
                </span>
              </button>
              <span style={{ width: 110 }}><span style={css(canalPill(l.canal))}>{l.canal}</span></span>
              {isManager && <span style={{ flex: 1, fontSize: 13 }}>{l.corretor}</span>}
              <span style={{ width: 180 }}>
                <select
                  value={l.col}
                  onChange={e => move(l.id, e.target.value as ColId)}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg)', fontSize: 12.5 }}
                >
                  {COLS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </span>
              <span style={{ width: 90, fontSize: 11, color: 'var(--muted)' }}>{l.dias === 0 ? 'hoje' : l.dias + 'd'}</span>
            </div>
          ))}
          {leads.length === 0 && (
            <div style={{ padding: '44px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0 }}>Nenhum lead encontrado.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="kb-tabs" style={{ display: 'none', gap: 6, overflowX: 'auto', paddingBottom: 14 }}>
            {COLS.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setMobileCol(c.id)}
                style={{ flex: 'none', padding: '8px 13px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', border: '1px solid ' + (mobileCol === c.id ? 'var(--terra)' : 'var(--line)'), background: mobileCol === c.id ? 'var(--terraSoft)' : 'var(--card)', color: mobileCol === c.id ? 'var(--terra)' : 'var(--muted)' }}
              >
                {c.title} · {counts[i]}
              </button>
            ))}
          </div>

          <div className="kb-cols" style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 14, alignItems: 'flex-start' }}>
            {COLS.map((c, ci) => {
              const colLeads = leads.filter(l => l.col === c.id);
              const isMobileActive = mobileCol === c.id;
              return (
                <div
                  key={c.id}
                  data-col-id={c.id}
                  data-active={isMobileActive ? '1' : '0'}
                  onDragOver={e => e.preventDefault()}
                  onDrop={onDrop(c.id)}
                  style={{
                    width: 274, flex: 'none', borderRadius: 12, background: 'var(--card)', padding: 12,
                    border: '1px solid ' + (highlightCol === c.id ? 'var(--terra)' : 'var(--line)'),
                    boxShadow: highlightCol === c.id ? '0 0 0 3px var(--terraSoft)' : 'none',
                    transition: 'box-shadow .3s ease, border-color .3s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 4px 14px' }}>
                    <span style={{ width: 7, height: 7, transform: 'rotate(45deg)', background: c.color }} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.04em', flex: 1 }}>{c.title}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{counts[ci]}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minHeight: 60 }}>
                    {colLeads.map((l, i) => (
                      <div
                        key={l.id}
                        draggable
                        onDragStart={e => { setDragId(l.id); e.currentTarget.style.opacity = '.45'; }}
                        onDragEnd={e => { e.currentTarget.style.opacity = '1'; }}
                        onClick={() => openLead(l.id)}
                        className="hoverable"
                        style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: 13, cursor: 'grab' }}
                      >
                        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                          <span style={css(thumb(i, 34))} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</span>
                            <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{l.imovel}</span>
                            {l.campanha && <span style={{ display: 'block', fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }} title={l.campanha}>📢 {l.campanha}</span>}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 11 }}>
                          <span style={css(canalPill(l.canal))}>{l.canal}</span>
                          {l.segundo && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 7px', border: '1px solid var(--terra)', color: 'var(--terra)', borderRadius: 20 }}>2º cadastro</span>}
                          {l.corretor && <span style={{ fontSize: 11, color: 'var(--terra)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.corretor}</span>}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 6 }}>
                          {l.entrouNaColunaEm
                            ? new Date(l.entrouNaColunaEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : (l.dias === 0 ? 'hoje' : l.dias + 'd na coluna')}
                        </div>
                      </div>
                    ))}
                    {colLeads.length === 0 && (
                      <div style={{ border: '1px dashed var(--line)', borderRadius: 10, padding: '26px 14px', textAlign: 'center' }}>
                        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>Nenhum lead nesta coluna ainda.<br />Arraste um card para cá.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
