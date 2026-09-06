import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutGrid, Building2, LogOut } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { usePlataformaStore } from '../../store/plataformaStore';
import { LogoMark } from '../../components/Logo';

const nav = [
  { to: '/plataforma', end: true, label: 'Visão geral', icon: LayoutGrid },
  { to: '/plataforma/imobiliarias', end: false, label: 'Imobiliárias', icon: Building2 },
];

export default function PlataformaShell() {
  const theme = useAppStore(s => s.theme);
  const admin = usePlataformaStore(s => s.admin);
  const logout = usePlataformaStore(s => s.logout);
  const navigate = useNavigate();

  const sair = () => { logout(); navigate('/plataforma/login'); };

  return (
    <div data-theme={theme} style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', display: 'flex' }}>
      <aside style={{ width: 236, flex: 'none', background: 'var(--side)', color: 'var(--sideInk)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '22px 20px 18px', display: 'flex', alignItems: 'center', gap: 11 }}>
          <LogoMark size={34} />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: '.14em' }}>VISITA IA</div>
            <div style={{ fontSize: 10.5, letterSpacing: '.22em', color: 'var(--sideMuted)' }}>PLATAFORMA</div>
          </div>
        </div>
        <nav style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
          {nav.map(({ to, end, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 9,
                fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
                color: isActive ? '#fff' : 'var(--sideMuted)',
                background: isActive ? 'rgba(255,255,255,.09)' : 'transparent',
              })}>
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--sideInk)' }}>{admin?.nome || 'Administrador'}</div>
          <div style={{ fontSize: 11, color: 'var(--sideMuted)', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis' }}>{admin?.email}</div>
          <button onClick={sair} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'rgba(255,255,255,.06)', color: 'var(--sideMuted)', padding: '8px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, width: '100%' }}>
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: '26px 34px 56px' }}>
        <Outlet />
      </main>
    </div>
  );
}
