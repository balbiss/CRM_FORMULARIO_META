import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useRoleInfo, scopeLeads } from '../lib/selectors';
import { ini, canalPill } from '../lib/format';
import { css } from '../lib/css';

export function Topbar() {
  const theme = useAppStore(s => s.theme);
  const toggleTheme = useAppStore(s => s.toggleTheme);
  const notificacoes = useAppStore(s => s.notificacoes);
  const notifOpen = useAppStore(s => s.notifOpen);
  const toggleNotifMenu = useAppStore(s => s.toggleNotifMenu);
  const marcarNotifLida = useAppStore(s => s.marcarNotifLida);
  const marcarTodasNotifsLidas = useAppStore(s => s.marcarTodasNotifsLidas);
  const menuOpen = useAppStore(s => s.menuOpen);
  const toggleMenu = useAppStore(s => s.toggleMenu);
  const logout = useAppStore(s => s.logout);
  const allLeads = useAppStore(s => s.leads);
  const openLead = useAppStore(s => s.openLead);
  const { role, isDono, isManager, meNome } = useRoleInfo();
  const nav = useNavigate();
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const q = query.trim().toLowerCase();
  const results = q
    ? scopeLeads(allLeads, isManager, meNome).filter(l => l.nome.toLowerCase().includes(q) || l.tel.includes(q)).slice(0, 6)
    : [];
  const showResults = searchFocused && q.length > 0;
  const naoLidas = notificacoes.filter(n => !n.lida).length;

  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 28px', borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
      <div className="top-search" style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          placeholder="Buscar leads por nome ou telefone…"
          style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5 }}
        />
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 11, height: 11, border: '1.4px solid var(--muted)', borderRadius: '50%' }} />
        {showResults && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 42, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: 6, boxShadow: '0 12px 28px rgba(28,27,26,.14)', zIndex: 40, animation: 'fadeUp .12s ease' }}>
            {results.map(l => (
              <button
                key={l.id}
                onClick={() => { openLead(l.id); setQuery(''); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', border: 'none', background: 'none', borderRadius: 7, textAlign: 'left' }}
              >
                <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, flex: 'none' }}>{ini(l.nome)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{l.tel}</span>
                </span>
                <span style={css(canalPill(l.canal))}>{l.canal}</span>
              </button>
            ))}
            {results.length === 0 && <p style={{ padding: '10px 8px', fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Nenhum lead encontrado.</p>}
          </div>
        )}
      </div>
      <div style={{ flex: 1 }} />
      {!isDono && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', border: '1px solid var(--terra)', borderRadius: 20, fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: 'var(--terra)', whiteSpace: 'nowrap' }}>
          <span style={{ width: 6, height: 6, background: 'var(--terra)', transform: 'rotate(45deg)' }} />Visualizando como: {role}
        </span>
      )}
      <button onClick={toggleTheme} title="Alternar tema" style={{ width: 34, height: 34, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: theme === 'dark' ? 'var(--sideInk)' : 'var(--ink)', boxShadow: 'inset 4px 0 0 ' + (theme === 'dark' ? 'var(--card)' : 'transparent') }} />
      </button>
      <div style={{ position: 'relative' }}>
        <button onClick={toggleNotifMenu} title="Notificações" style={{ position: 'relative', width: 34, height: 34, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 12, height: 12, border: '1.4px solid var(--ink)', borderRadius: '4px 4px 2px 2px' }} />
          {naoLidas > 0 && (
            <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 17, height: 17, padding: '0 4px', background: 'var(--terra)', color: '#fff', borderRadius: 9, fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{naoLidas}</span>
          )}
        </button>
        {notifOpen && (
          <div style={{ position: 'absolute', right: 0, top: 42, width: 320, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 12px 28px rgba(28,27,26,.14)', zIndex: 40, animation: 'fadeUp .12s ease', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Notificações</span>
              {naoLidas > 0 && <button onClick={marcarTodasNotifsLidas} style={{ border: 'none', background: 'none', fontSize: 11.5, color: 'var(--terra)', fontWeight: 600 }}>Marcar todas como lidas</button>}
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {notificacoes.map(n => (
                <button
                  key={n.id}
                  onClick={() => marcarNotifLida(n.id)}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--line)', background: n.lida ? 'none' : 'var(--terraSoft)' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: n.lida ? 'transparent' : 'var(--terra)', flex: 'none', marginTop: 5 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: n.lida ? 500 : 700 }}>{n.titulo}</span>
                    {n.texto && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', margin: '2px 0' }}>{n.texto}</span>}
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--muted)' }}>{new Date(n.criadoEm).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                </button>
              ))}
              {notificacoes.length === 0 && <p style={{ padding: '16px 14px', fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Nenhuma notificação por aqui.</p>}
            </div>
          </div>
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <button onClick={toggleMenu} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', background: 'var(--card)', borderRadius: 8, padding: '5px 10px 5px 5px' }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700 }}>{ini(meNome)}</span>
          <span style={{ textAlign: 'left', lineHeight: 1.25 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>{meNome}</span>
            <span style={{ display: 'block', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{role}</span>
          </span>
        </button>
        {menuOpen && (
          <div style={{ position: 'absolute', right: 0, top: 46, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, minWidth: 184, padding: 6, boxShadow: '0 12px 28px rgba(28,27,26,.10)', animation: 'fadeUp .14s ease' }}>
            <button onClick={() => { toggleMenu(); nav('/configuracoes'); }} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: 'none', borderRadius: 6, fontSize: 13.5 }}>Ajustes</button>
            <button onClick={() => { toggleMenu(); nav('/manual'); }} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: 'none', borderRadius: 6, fontSize: 13.5 }}>Manual</button>
            <div style={{ height: 1, background: 'var(--line)', margin: '5px 0' }} />
            <button onClick={() => { toggleMenu(); logout(); nav('/login'); }} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: 'none', borderRadius: 6, fontSize: 13.5, color: 'var(--terra)' }}>Sair</button>
          </div>
        )}
      </div>
    </header>
  );
}
