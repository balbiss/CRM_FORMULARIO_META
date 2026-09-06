import { useAppStore } from '../store/appStore';

export function Toasts() {
  const toasts = useAppStore(s => s.toasts);
  return (
    <div style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 90, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: 'var(--side)', color: 'var(--sideInk)', padding: '13px 18px', borderRadius: 10, fontSize: 13, maxWidth: 340, boxShadow: '0 12px 30px rgba(28,27,26,.22)', animation: 'fadeUp .16s ease', display: 'flex', gap: 11, alignItems: 'center' }}>
          <span style={{ width: 7, height: 7, background: 'var(--terra)', transform: 'rotate(45deg)', flex: 'none' }} />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
