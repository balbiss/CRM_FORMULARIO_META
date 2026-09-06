import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo, useUnreadTotal, useRebatidasTotal } from '../lib/selectors';
import { css } from '../lib/css';
import { NAV_ITEMS } from '../lib/nav';
import { ini } from '../lib/format';

export function Sidebar() {
  const open = useAppStore(s => s.sidebarOpen);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const fila = useAppStore(s => s.fila);
  const toggleFila = useAppStore(s => s.toggleFila);
  const fireAlert = useAppStore(s => s.fireAlert);
  const toast = useAppStore(s => s.toast);
  const logout = useAppStore(s => s.logout);
  const { isManager, role, meNome } = useRoleInfo();
  const unread = useUnreadTotal();
  const rebatidas = useRebatidasTotal();
  const nav = useNavigate();
  const location = useLocation();

  const menuItems = NAV_ITEMS.filter(it => it.group === 'menu');
  const toolItems = NAV_ITEMS.filter(it => it.group === 'ferramentas' && (!it.mgrOnly || isManager));

  const badgeFor = (path: string) => (path === '/conversas' ? unread : path === '/rebatidas' ? rebatidas : 0);

  const meIdx = fila.findIndex(f => f.nome === meNome);
  const noPlantao = meIdx >= 0 ? fila[meIdx].ativo : false;

  // Botão em vez de <a> de propósito: navegador nenhum mostra preview de URL ao passar o mouse
  // (o dono pediu pra tirar isso), mas Ctrl/Cmd+clique e clique do meio continuam abrindo em nova aba.
  const item = ({ path, label }: { path: string; label: string }) => {
    const isActive = location.pathname === path;
    const badge = badgeFor(path);
    const openNewTab = () => window.open(path, '_blank');
    return (
      <button
        key={path}
        onClick={e => { if (e.ctrlKey || e.metaKey) openNewTab(); else nav(path); }}
        onAuxClick={e => { if (e.button === 1) openNewTab(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: 'none', borderRadius: 8,
          fontSize: 13.5, fontWeight: isActive ? 700 : 500, textAlign: 'left',
          background: isActive ? 'rgba(181,101,47,.16)' : 'transparent',
          color: isActive ? 'var(--terra)' : 'var(--sideMuted)', width: '100%', flex: 'none',
        }}
      >
        <span style={css('width:7px;height:7px;flex:none;transform:rotate(45deg);background:' + (isActive ? 'var(--terra)' : '#4a4640'))} />
        {open && <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>}
        {open && badge > 0 && (
          <span style={{ minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9, background: 'var(--terra)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
        )}
      </button>
    );
  };

  return (
    <aside
      className="app-sidebar"
      style={{ width: open ? 248 : 68, flex: 'none', background: 'var(--side)', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'fixed', top: 0, left: 0, zIndex: 50, transition: 'width .18s ease' }}
    >
      <div style={{ flex: 'none', padding: '22px 20px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, overflow: 'hidden' }}>
          <div style={{ width: 12, height: 12, background: 'var(--terra)', transform: 'rotate(45deg)', flex: 'none' }} />
          {open && <span style={{ fontFamily: 'Newsreader,serif', fontSize: 15, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sideInk)', whiteSpace: 'nowrap' }}>Hinode Imóveis</span>}
        </div>
        <button onClick={toggleSidebar} style={{ background: 'none', border: '1px solid #37342f', color: 'var(--sideMuted)', width: 26, height: 26, borderRadius: 6, flex: 'none', fontSize: 13, lineHeight: 1 }}>
          {open ? '‹' : '›'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {open && <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sideMuted)', margin: '10px 4px 4px' }}>Menu</p>}
        {menuItems.map(item)}

        {open && <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sideMuted)', margin: '18px 4px 4px' }}>Ferramentas</p>}
        {toolItems.map(item)}
      </div>

      <div style={{ flex: 'none', borderTop: '1px solid #2c2a26', padding: 10 }}>
        <button
          role="switch"
          aria-checked={noPlantao}
          onClick={async () => { if (meIdx < 0) return; const goingOnline = !noPlantao; const ok = await toggleFila(meIdx, true); if (ok && goingOnline) fireAlert('plantao'); }}
          style={{
            width: '100%', marginBottom: 8, display: open ? 'flex' : 'none', alignItems: 'center', justifyContent: 'space-between',
            borderRadius: 6, background: 'rgba(255,255,255,.05)', padding: '7px 8px', border: '1px solid #2c2a26',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: noPlantao ? 'var(--terra)' : 'var(--sideMuted)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.9)' }}>{noPlantao ? 'No Plantão' : 'Offline'}</span>
          </span>
          <span style={{ position: 'relative', width: 28, height: 16, borderRadius: 8, background: noPlantao ? 'var(--terra)' : '#37342f', flex: 'none' }}>
            <span style={{ position: 'absolute', top: 2, left: noPlantao ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left .15s ease' }} />
          </span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: open ? 'flex-start' : 'center' }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, flex: 'none' }}>{ini(meNome)}</span>
          {open && (
            <>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.95)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meNome}</span>
                <span style={{ display: 'block', fontSize: 9, color: 'var(--sideMuted)', textTransform: 'uppercase', fontWeight: 600 }}>{role}</span>
              </span>
              <button
                onClick={() => { logout(); toast('Até logo!'); nav('/login'); }}
                title="Sair"
                style={{ border: 'none', background: 'none', color: 'var(--sideMuted)', padding: 4, borderRadius: 6, flex: 'none' }}
              >
                <LogOut size={14} strokeWidth={2} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
