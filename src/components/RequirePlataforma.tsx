import { Navigate, Outlet } from 'react-router-dom';
import { usePlataformaStore } from '../store/plataformaStore';

export function RequirePlataforma() {
  const token = usePlataformaStore(s => s.token);
  const admin = usePlataformaStore(s => s.admin);

  if (token && !admin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 26, height: 26, border: '2px solid var(--line)', borderTopColor: 'var(--terra)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      </div>
    );
  }
  if (!token) return <Navigate to="/plataforma/login" replace />;
  return <Outlet />;
}
