import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutGrid, List as ListIcon, X, FileText, MoreVertical, ChevronLeft, ChevronRight, Plus, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { canalPill } from '../lib/format';
import { css } from '../lib/css';
import { CardTagBar } from '../components/CardTagBar';
import { LeadAvatar } from '../components/LeadAvatar';

type ViewMode = 'kanban' | 'lista';
const corDaColuna = (slug: string | null) => (slug === 'venda' ? 'var(--olive)' : slug === 'novo' || slug === 'rebatida' ? 'var(--muted)' : 'var(--terra)');

interface VisaoSalva { nome: string; corretor: string; tag: string | null; canal: string | null }
const VIEWS_KEY = 'nova_kanban_views';
function lerVisoes(): VisaoSalva[] {
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]'); } catch { return []; }
}
function gravarVisoes(v: VisaoSalva[]) {
  try { localStorage.setItem(VIEWS_KEY, JSON.stringify(v)); } catch { /* ignora */ }
}

export default function Kanban() {
  const allLeads = useAppStore(s => s.leads);
  const colunas = useAppStore(s => s.colunasRemotas);
  const perfis = useAppStore(s => s.perfisRemotos);
  const move = useAppStore(s => s.move);
  const openLead = useAppStore(s => s.openLead);
  const kbCorretor = useAppStore(s => s.kbCorretor);
  const setKbCorretor = useAppStore(s => s.setKbCorretor);
  const allTags = useAppStore(s => s.tags);
  const kbTag = useAppStore(s => s.kbTag);
  const setKbTag = useAppStore(s => s.setKbTag);
  const criarColuna = useAppStore(s => s.criarColuna);
  const renomearColuna = useAppStore(s => s.renomearColuna);
  const excluirColuna = useAppStore(s => s.excluirColuna);
  const reordenarColunas = useAppStore(s => s.reordenarColunas);
  const ask = useAppStore(s => s.ask);
  const newLead = useAppStore(s => s.newLead);
  const setImportOpen = useAppStore(s => s.setImportOpen);
  const { isManager, meNome } = useRoleInfo();
  const location = useLocation();
  const navState = location.state as { scrollToCol?: string; filterCanal?: string } | null;
  const [mobileCol, setMobileCol] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('kanban');
  const [filterCanal, setFilterCanal] = useState<string | null>(navState?.filterCanal ?? null);
  const [highlightCol, setHighlightCol] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [novaColuna, setNovaColuna] = useState(false);
  const [nomeNova, setNomeNova] = useState('');
  const [editandoCol, setEditandoCol] = useState<string | null>(null);
  const [menuCol, setMenuCol] = useState<string | null>(null);
  const [visoes, setVisoes] = useState<VisaoSalva[]>(() => lerVisoes());

  const canais = useMemo(() => [...new Set(allLeads.map(l => l.canal).filter(Boolean))].sort(), [allLeads]);
  const filtroAtivo = (isManager && kbCorretor !== 'Todos os corretores') || !!kbTag || !!filterCanal;

  const aplicarVisao = (v: VisaoSalva) => {
    if (isManager) setKbCorretor(v.corretor || 'Todos os corretores');
    if ((v.tag ?? null) !== kbTag) setKbTag(v.tag ?? null);
    setFilterCanal(v.canal ?? null);
  };
  const salvarVisao = () => {
    const nome = window.prompt('Nome da visão (ex: "Meus leads do Instagram")');
    if (!nome?.trim()) return;
    const nova: VisaoSalva = {
      nome: nome.trim(),
      corretor: isManager ? kbCorretor : '',
      tag: kbTag,
      canal: filterCanal,
    };
    const próx = [...visoes.filter(v => v.nome !== nova.nome), nova];
    setVisoes(próx); gravarVisoes(próx);
  };
  const removerVisao = (nome: string) => {
    const próx = visoes.filter(v => v.nome !== nome);
    setVisoes(próx); gravarVisoes(próx);
  };
  const limparFiltros = () => {
    if (isManager) setKbCorretor('Todos os corretores');
    if (kbTag) setKbTag(null);
    setFilterCanal(null);
  };

  useEffect(() => {
    if (!mobileCol && colunas.length) setMobileCol(colunas[0].id);
  }, [colunas, mobileCol]);

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
    if (kbTag) base = base.filter(l => l.tags.includes(kbTag));
    const q = query.trim().toLowerCase();
    if (q) base = base.filter(l => l.nome.toLowerCase().includes(q) || l.tel.includes(q));
    return base;
  }, [allLeads, isManager, kbCorretor, meNome, filterCanal, kbTag, query]);

  const active = leads.filter(l => l.col !== 'rebatida');
  const countPorColuna = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of leads) m[l.colunaId] = (m[l.colunaId] || 0) + 1;
    return m;
  }, [leads]);

  const onDrop = (colunaId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragId) move(dragId, colunaId);
    setDragId(null);
  };

  const salvarNova = async () => {
    if (!nomeNova.trim()) { setNovaColuna(false); return; }
    await criarColuna(nomeNova.trim());
    setNomeNova('');
    setNovaColuna(false);
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
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Pipeline</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Kanban de Leads</h1>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '5px 0 0' }}>{active.length} leads ativos</p>
        </div>
        <div className="kb-toolbar" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="kb-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, width: 200 }}
          />
          <div className="kb-toolbar-row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {isManager && (
              <select className="kb-corretor" value={kbCorretor} onChange={e => setKbCorretor(e.target.value)} style={{ padding: '9px 12px', border: '1px solid ' + (kbCorretor !== 'Todos os corretores' ? 'var(--terra)' : 'var(--line)'), borderRadius: 8, background: kbCorretor !== 'Todos os corretores' ? 'var(--terraSoft)' : 'var(--card)', color: kbCorretor !== 'Todos os corretores' ? 'var(--terra)' : 'var(--ink)', fontSize: 13 }}>
                <option>Todos os corretores</option>{perfis.map(p => <option key={p.id}>{p.nome}</option>)}
              </select>
            )}
            {allTags.length > 0 && (
              <select
                value={kbTag ?? ''}
                onChange={e => setKbTag(e.target.value || null)}
                style={{ padding: '9px 12px', border: '1px solid ' + (kbTag ? 'var(--terra)' : 'var(--line)'), borderRadius: 8, background: kbTag ? 'var(--terraSoft)' : 'var(--card)', color: kbTag ? 'var(--terra)' : 'var(--ink)', fontSize: 13, fontWeight: kbTag ? 600 : 400 }}
              >
                <option value="">Todas as etiquetas</option>
                {allTags.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            )}
            {canais.length > 0 && (
              <select
                value={filterCanal ?? ''}
                onChange={e => setFilterCanal(e.target.value || null)}
                style={{ padding: '9px 12px', border: '1px solid ' + (filterCanal ? 'var(--terra)' : 'var(--line)'), borderRadius: 8, background: filterCanal ? 'var(--terraSoft)' : 'var(--card)', color: filterCanal ? 'var(--terra)' : 'var(--ink)', fontSize: 13, fontWeight: filterCanal ? 600 : 400 }}
              >
                <option value="">Todos os canais</option>
                {canais.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select
              value=""
              onChange={e => {
                const v = e.target.value;
                if (v === '__salvar') salvarVisao();
                else { const alvo = visoes.find(x => x.nome === v); if (alvo) aplicarVisao(alvo); }
              }}
              style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}
            >
              <option value="">Visões salvas…</option>
              {visoes.map(v => <option key={v.nome} value={v.nome}>{v.nome}</option>)}
              {filtroAtivo && <option value="__salvar">＋ Salvar filtros atuais</option>}
            </select>
            {filtroAtivo && (
              <button onClick={limparFiltros} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 12.5, color: 'var(--muted)' }}>
                Limpar <X size={12} strokeWidth={2.5} />
              </button>
            )}
            {visoes.length > 0 && (
              <details style={{ position: 'relative' }}>
                <summary style={{ listStyle: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', padding: '9px 4px' }}>gerenciar visões</summary>
                <div style={{ position: 'absolute', right: 0, top: 34, width: 220, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 9, padding: 6, boxShadow: '0 12px 28px rgba(8,17,31,.16)', zIndex: 30 }}>
                  {visoes.map(v => (
                    <div key={v.nome} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 6px' }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.nome}</span>
                      <button onClick={() => removerVisao(v.nome)} style={{ border: 'none', background: 'none', color: 'var(--terra)', fontSize: 12 }}>excluir</button>
                    </div>
                  ))}
                </div>
              </details>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              {toggleBtn('kanban', LayoutGrid, 'Kanban')}
              {toggleBtn('lista', ListIcon, 'Lista')}
            </div>
          </div>
          <div className="kb-toolbar-row" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {isManager && <button onClick={() => { setNovaColuna(true); setNomeNova(''); }} style={{ padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, fontWeight: 600 }}>+ Coluna</button>}
            <button onClick={() => setImportOpen(true)} style={{ padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, fontWeight: 600 }}>Importar planilha</button>
            <button onClick={newLead} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Novo lead</button>
          </div>
        </div>
      </div>

      {view === 'lista' ? (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
          <div className="data-table-head" style={{ display: 'flex', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <span style={{ flex: 1.6 }}>Lead / imóvel</span>
            <span style={{ width: 110 }}>Canal</span>
            {isManager && <span style={{ flex: 1 }}>Corretor</span>}
            <span style={{ width: 180 }}>Coluna</span>
            <span style={{ width: 90 }}>Tempo</span>
          </div>
          {leads.map((l, i) => (
            <div key={l.id} className="data-row" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--line)' }}>
              <button onClick={() => openLead(l.id)} style={{ flex: 1.6, minWidth: 0, display: 'flex', gap: 11, alignItems: 'center', background: 'none', border: 'none', textAlign: 'left', padding: 0 }}>
                <LeadAvatar foto={l.foto} seedIndex={i} size={32} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.imovel}</span>
                </span>
              </button>
              <span style={{ width: 110 }}><span style={css(canalPill(l.canal))}>{l.canal}</span></span>
              {isManager && <span style={{ flex: 1, fontSize: 13 }}>{l.corretor}</span>}
              <span style={{ width: 180 }}>
                <select
                  value={l.colunaId}
                  onChange={e => move(l.id, e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg)', fontSize: 12.5 }}
                >
                  {colunas.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
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
            {colunas.map(c => (
              <button
                key={c.id}
                onClick={() => setMobileCol(c.id)}
                style={{ flex: 'none', padding: '8px 13px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', border: '1px solid ' + (mobileCol === c.id ? 'var(--terra)' : 'var(--line)'), background: mobileCol === c.id ? 'var(--terraSoft)' : 'var(--card)', color: mobileCol === c.id ? 'var(--terra)' : 'var(--muted)' }}
              >
                {c.titulo} · {countPorColuna[c.id] || 0}
              </button>
            ))}
          </div>

          <div className="kb-cols" style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 14, alignItems: 'flex-start' }}>
            {colunas.map((c, ci) => {
              const colLeads = leads.filter(l => l.colunaId === c.id);
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px 14px', position: 'relative' }}>
                    <span style={{ width: 7, height: 7, transform: 'rotate(45deg)', background: c.cor || corDaColuna(c.slug), flex: 'none' }} />
                    {editandoCol === c.id ? (
                      <input
                        autoFocus
                        defaultValue={c.titulo}
                        onBlur={e => { const v = e.target.value.trim(); if (v && v !== c.titulo) renomearColuna(c.id, v); setEditandoCol(null); }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditandoCol(null); }}
                        style={{ flex: 1, minWidth: 0, padding: '4px 6px', border: '1px solid var(--terra)', borderRadius: 6, background: 'var(--bg)', fontSize: 12.5, fontWeight: 700 }}
                      />
                    ) : (
                      <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '.04em', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.titulo}</span>
                    )}
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', flex: 'none' }}>{countPorColuna[c.id] || 0}</span>
                    {isManager && editandoCol !== c.id && (
                      <button onClick={() => setMenuCol(menuCol === c.id ? null : c.id)} aria-label="Opções da coluna" style={{ flex: 'none', width: 22, height: 22, border: 'none', background: 'none', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5 }}>
                        <MoreVertical size={14} strokeWidth={2} />
                      </button>
                    )}
                    {menuCol === c.id && (
                      <div style={{ position: 'absolute', right: 0, top: 26, width: 180, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 9, boxShadow: '0 12px 28px rgba(8,17,31,.18)', zIndex: 30, padding: 5, animation: 'fadeUp .12s ease' }} onMouseLeave={() => setMenuCol(null)}>
                        <button onClick={() => { setEditandoCol(c.id); setMenuCol(null); }} style={menuItem}>Renomear</button>
                        <button onClick={() => { reordenarColunas(mover(colunas.map(x => x.id), ci, -1)); setMenuCol(null); }} disabled={ci === 0} style={{ ...menuItem, opacity: ci === 0 ? 0.4 : 1 }}><ChevronLeft size={13} /> Mover pra esquerda</button>
                        <button onClick={() => { reordenarColunas(mover(colunas.map(x => x.id), ci, 1)); setMenuCol(null); }} disabled={ci === colunas.length - 1} style={{ ...menuItem, opacity: ci === colunas.length - 1 ? 0.4 : 1 }}><ChevronRight size={13} /> Mover pra direita</button>
                        {!c.slug && (
                          <button
                            onClick={() => { setMenuCol(null); ask('Excluir coluna "' + c.titulo + '"?', 'Os leads dessa coluna vão pra primeira coluna do funil.', 'Excluir', () => excluirColuna(c.id)); }}
                            style={{ ...menuItem, color: 'var(--terra)' }}
                          >Excluir coluna</button>
                        )}
                        {c.slug && <p style={{ fontSize: 10.5, color: 'var(--muted)', margin: '4px 8px 2px', lineHeight: 1.4 }}>Coluna do sistema — só dá pra renomear.</p>}
                      </div>
                    )}
                  </div>
                  <div className="kb-col-body" style={{ display: 'flex', flexDirection: 'column', gap: 9, minHeight: 60, maxHeight: 'calc(100vh - 265px)', overflowY: 'auto', overflowX: 'hidden', paddingRight: 2 }}>
                    {colLeads.map((l, i) => (
                      <div
                        key={l.id}
                        draggable
                        onDragStart={e => { setDragId(l.id); e.currentTarget.style.opacity = '.45'; }}
                        onDragEnd={e => { e.currentTarget.style.opacity = '1'; }}
                        onClick={() => openLead(l.id)}
                        className="hoverable"
                        style={{ background: 'var(--card-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 11, cursor: 'grab' }}
                      >
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <LeadAvatar foto={l.foto} seedIndex={i} size={34} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', marginTop: 2, minWidth: 0 }}>
                              <FileText size={11} strokeWidth={2} style={{ flex: 'none' }} />
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.corretor || 'Sem corretor'}</span>
                            </span>
                          </span>
                        </div>
                        <CardTagBar lead={l} />
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

            {isManager && (
              <div className="kb-nova-col" style={{ width: 240, flex: 'none' }}>
                {novaColuna ? (
                  <div style={{ borderRadius: 12, background: 'var(--card)', border: '1px solid var(--terra)', padding: 12 }}>
                    <input
                      autoFocus
                      value={nomeNova}
                      onChange={e => setNomeNova(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') salvarNova(); if (e.key === 'Escape') setNovaColuna(false); }}
                      placeholder="Nome da coluna"
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg)', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={salvarNova} style={{ flex: 1, padding: '7px 0', border: 'none', borderRadius: 7, background: 'var(--terra)', color: '#fff', fontSize: 12.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Check size={13} /> Criar</button>
                      <button onClick={() => setNovaColuna(false)} style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5 }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setNovaColuna(true); setNomeNova(''); }} style={{ width: '100%', padding: '14px 12px', border: '1px dashed var(--line)', borderRadius: 12, background: 'none', color: 'var(--muted)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Plus size={15} strokeWidth={2.4} /> Nova coluna
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const menuItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'left', padding: '8px 9px', border: 'none', background: 'none', borderRadius: 6, fontSize: 12.5 };

function mover(ids: string[], from: number, dir: number): string[] {
  const to = from + dir;
  if (to < 0 || to >= ids.length) return ids;
  const copia = [...ids];
  [copia[from], copia[to]] = [copia[to], copia[from]];
  return copia;
}
