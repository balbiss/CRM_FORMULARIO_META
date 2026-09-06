import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../store/appStore';

export function RequireAuth() {
  const token = useAppStore(s => s.token);
  const me = useAppStore(s => s.me);
  const authLoading = useAppStore(s => s.authLoading);

  if (token && !me && authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ width: 26, height: 26, border: '2px solid var(--line)', borderTopColor: 'var(--terra)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      </div>
    );
  }
  if (!token || !me) return <Navigate to="/login" replace />;
  return <Outlet />;
}
