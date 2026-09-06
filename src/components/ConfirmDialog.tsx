import { useAppStore } from '../store/appStore';

export function ConfirmDialog() {
  const confirm = useAppStore(s => s.confirm);
  const closeConfirm = useAppStore(s => s.closeConfirm);
  const confirmOk = useAppStore(s => s.confirmOk);
  if (!confirm) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,26,.42)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, animation: 'fadeUp .14s ease' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: '0 0 10px' }}>{confirm.titulo}</h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--muted)', margin: '0 0 24px' }}>{confirm.texto}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={closeConfirm} style={{ padding: '10px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={confirmOk} style={{ padding: '10px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>{confirm.ok}</button>
        </div>
      </div>
    </div>
  );
}
