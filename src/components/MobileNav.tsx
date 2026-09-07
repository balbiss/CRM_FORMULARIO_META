import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo, useUnreadTotal, useRebatidasTotal } from '../lib/selectors';
import { NAV_ITEMS } from '../lib/nav';
import { ini } from '../lib/format';
import Logo from './Logo';

/**
 * Menu gaveta (drawer) do mobile — abre pelo hambúrguer do header ou pelo "Mais" da barra
 * inferior. Traz a navegação COMPLETA (a barra inferior só tem os 4 atalhos principais),
 * o toggle de plantão e o logout. Fora do mobile fica inerte (a Sidebar cobre tudo).
 */
export function MobileNav() {
  const open = useAppStore(s => s.mobileNavOpen);
  const setOpen = useAppStore(s => s.setMobileNav);
  const fila = useAppStore(s => s.fila);
  const me = useAppStore(s => s.me);
  const toggleMeuPlantao = useAppStore(s => s.toggleMeuPlantao);
  const logout = useAppStore(s => s.logout);
  const { isManager, role, meNome } = useRoleInfo();
  const unread = useUnreadTotal();
  const rebatidas = useRebatidasTotal();
  const nav = useNavigate();
  const location = useLocation();

  // fecha ao trocar de rota (não no primeiro render)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setOpen(false);
  }, [location.pathname, setOpen]);
  // trava o scroll do body enquanto aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const modoWhatsapp = useAppStore(s => s.modoWhatsapp);
  const menuItems = NAV_ITEMS.filter(it => it.group === 'menu');
  const toolItems = NAV_ITEMS.filter(it => {
    if (it.group !== 'ferramentas') return false;
    if (it.mgrOnly && !isManager) return false;
    if (it.path === '/integracoes' && !isManager && modoWhatsapp !== 'corretor') return false;
    return true;
  });
  const badgeFor = (path: string) => (path === '/conversas' ? unread : path === '/rebatidas' ? rebatidas : 0);

  const minhaFila = me ? fila.find(f => f.corretorId === me.id) : undefined;
  const noPlantao = minhaFila ? minhaFila.ativo : !!me?.emPlantao;

  const row = ({ path, label }: { path: string; label: string }) => {
    const isActive = location.pathname === path;
    const badge = badgeFor(path);
    return (
      <button
        key={path}
        onClick={() => nav(path)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 14px', border: 'none', borderRadius: 10,
          background: isActive ? 'rgba(76,141,240,.16)' : 'transparent',
          color: isActive ? 'var(--side-accent)' : 'var(--sideInk)',
          fontSize: 15, fontWeight: isActive ? 700 : 500, textAlign: 'left',
        }}
      >
        <span style={{ width: 7, height: 7, flex: 'none', transform: 'rotate(45deg)', background: isActive ? 'var(--side-accent)' : '#3a4456' }} />
        <span style={{ flex: 1 }}>{label}</span>
        {badge > 0 && (
          <span style={{ minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: 'var(--side-accent)', color: '#08111F', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
        )}
      </button>
    );
  };

  return (
    <div className="mobile-nav-root" hidden={!open} style={{ position: 'fixed', inset: 0, zIndex: 90 }}>
      <div
        onClick={() => setOpen(false)}
        style={{ position: 'absolute', inset: 0, background: 'rgba(4,7,12,.55)', backdropFilter: 'blur(2px)', animation: 'fadeUp .12s ease' }}
      />
      <aside
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 'min(86vw, 320px)', background: 'var(--side)',
          display: 'flex', flexDirection: 'column', animation: 'slideInLeft .18s ease',
          paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 16px', color: 'var(--sideInk)' }}>
          <Logo markSize={26} wordSize={13} showCrm={false} gap={9} />
          <button onClick={() => setOpen(false)} aria-label="Fechar menu" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #243043', background: 'none', color: 'var(--sideMuted)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 16px', WebkitOverflowScrolling: 'touch' }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sideMuted)', margin: '8px 6px 6px' }}>Menu</p>
          {menuItems.map(row)}
          <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--sideMuted)', margin: '18px 6px 6px' }}>Ferramentas</p>
          {toolItems.map(row)}
        </div>

        <div style={{ flex: 'none', borderTop: '1px solid #1c2636', padding: 12 }}>
          <button
            role="switch"
            aria-checked={noPlantao}
            onClick={() => toggleMeuPlantao()}
            style={{ width: '100%', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, background: 'rgba(255,255,255,.05)', padding: '10px 12px', border: '1px solid #1c2636' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: noPlantao ? 'var(--plantao)' : 'var(--sideMuted)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.9)' }}>{noPlantao ? 'No Plantão' : 'Offline'}</span>
            </span>
            <span style={{ position: 'relative', width: 32, height: 18, borderRadius: 9, background: noPlantao ? 'var(--plantao)' : '#2a3446', flex: 'none' }}>
              <span style={{ position: 'absolute', top: 2, left: noPlantao ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s ease' }} />
            </span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none' }}>{ini(meNome)}</span>
            <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sideInk)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meNome}</span>
              <span style={{ display: 'block', fontSize: 10.5, color: 'var(--sideMuted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{role}</span>
            </span>
            <button onClick={() => { logout(); nav('/login'); }} aria-label="Sair" style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid #243043', background: 'none', color: 'var(--sideMuted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
