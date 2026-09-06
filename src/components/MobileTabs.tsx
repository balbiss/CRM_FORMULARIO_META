import { useLocation, useNavigate } from 'react-router-dom';
import { useRoleInfo } from '../lib/selectors';
import { NAV_ITEMS } from '../lib/nav';

export function MobileTabs() {
  const { isManager } = useRoleInfo();
  const items = NAV_ITEMS.filter(it => !it.mgrOnly || isManager);
  const location = useLocation();
  const nav = useNavigate();

  return (
    <nav
      className="mobile-tabs"
      style={{ display: 'none', gap: 6, overflowX: 'auto', padding: '10px 12px', background: 'var(--card)', borderBottom: '1px solid var(--line)' }}
    >
      {items.map(it => {
        const isActive = location.pathname === it.path;
        return (
          <button
            key={it.path}
            onClick={e => { if (e.ctrlKey || e.metaKey) window.open(it.path, '_blank'); else nav(it.path); }}
            onAuxClick={e => { if (e.button === 1) window.open(it.path, '_blank'); }}
            style={{
              flex: 'none', padding: '8px 13px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
              border: '1px solid ' + (isActive ? 'var(--terra)' : 'var(--line)'),
              background: isActive ? 'var(--terraSoft)' : 'var(--bg)',
              color: isActive ? 'var(--terra)' : 'var(--muted)',
            }}
          >
            {it.short}
          </button>
        );
      })}
    </nav>
  );
}
