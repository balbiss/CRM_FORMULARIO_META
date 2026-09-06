import { useAppStore } from '../store/appStore';

export function AlertTester() {
  const alertMenu = useAppStore(s => s.alertMenu);
  const setAlertMenu = useAppStore(s => s.setAlertMenu);
  const fireAlert = useAppStore(s => s.fireAlert);
  const sidebarOpen = useAppStore(s => s.sidebarOpen);

  return (
    <div className="alert-tester" style={{ position: 'fixed', left: (sidebarOpen ? 248 : 68) + 22, bottom: 22, zIndex: 70, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
      {alertMenu && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: 6, width: 250, boxShadow: '0 14px 30px rgba(28,27,26,.16)' }}>
          <p style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '6px 10px 8px' }}>Disparar alerta (demo)</p>
          <button onClick={() => fireAlert('lead')} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: 'none', borderRadius: 6, fontSize: 13 }}>Novo lead atribuído (20s)</button>
          <button onClick={() => fireAlert('visita')} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: 'none', borderRadius: 6, fontSize: 13 }}>Visita agendada em breve</button>
          <button onClick={() => fireAlert('credito')} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: 'none', borderRadius: 6, fontSize: 13 }}>Pendências de crédito</button>
          <button onClick={() => fireAlert('tarefa')} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: 'none', borderRadius: 6, fontSize: 13 }}>Tarefa atrasada</button>
        </div>
      )}
      <button onClick={() => setAlertMenu(!alertMenu)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 15px', border: '1px solid var(--line)', borderRadius: 24, background: 'var(--card)', fontSize: 12.5, fontWeight: 600, boxShadow: '0 8px 20px rgba(28,27,26,.10)' }}>
        <span style={{ width: 7, height: 7, background: 'var(--terra)', transform: 'rotate(45deg)' }} />Testar alertas
      </button>
    </div>
  );
}
