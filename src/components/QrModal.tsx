import { useAppStore } from '../store/appStore';

export function QrModal() {
  const qrFor = useAppStore(s => s.qrFor);
  const closeQr = useAppStore(s => s.closeQr);
  const confirmQr = useAppStore(s => s.confirmQr);
  if (!qrFor) return null;
  return (
    <div onClick={closeQr} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,26,.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 28, textAlign: 'center', animation: 'fadeUp .14s ease' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: '0 0 8px' }}>Conectar WhatsApp</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 22px' }}>{qrFor}</p>
        <div style={{ width: 200, height: 200, margin: '0 auto 22px', background: 'repeating-conic-gradient(var(--ink) 0% 25%, var(--card) 0% 50%) 0 0/16px 16px', border: '8px solid var(--card)', outline: '1px solid var(--line)' }} />
        <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '0 0 22px' }}>Escaneie com o WhatsApp do seu celular — Aparelhos conectados › Conectar aparelho.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={closeQr} style={{ flex: 1, padding: 11, border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={confirmQr} style={{ flex: 1, padding: 11, border: 'none', borderRadius: 8, background: 'var(--olive)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Já escaneei</button>
        </div>
      </div>
    </div>
  );
}
