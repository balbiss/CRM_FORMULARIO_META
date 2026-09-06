import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { LeadModal } from './LeadModal';
import { ConfirmDialog } from './ConfirmDialog';
import { AlertModal } from './AlertModal';
import { QrModal } from './QrModal';
import { ImportModal } from './ImportModal';
import { NewLeadModal } from './NewLeadModal';
import { AlertTester } from './AlertTester';
import { Toasts } from './Toasts';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';

export function AppShell() {
  const theme = useAppStore(s => s.theme);
  const sidebarOpen = useAppStore(s => s.sidebarOpen);
  const enforceHorarioComercial = useAppStore(s => s.enforceHorarioComercial);
  const { meNome } = useRoleInfo();

  useEffect(() => {
    enforceHorarioComercial(meNome);
    const t = setInterval(() => enforceHorarioComercial(meNome), 60_000);
    return () => clearInterval(t);
  }, [meNome, enforceHorarioComercial]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const s = useAppStore.getState();
      if (s.alert) return;
      if (s.qrFor) { s.closeQr(); return; }
      if (s.importOpen) { s.setImportOpen(false); return; }
      if (s.confirm) { s.closeConfirm(); return; }
      if (s.discardOpen) { s.closeDiscard(); return; }
      if (s.leadId) { s.closeLead(); return; }
      if (s.menuOpen) { s.toggleMenu(); return; }
      if (s.notifOpen) { s.toggleNotifMenu(); return; }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  return (
    <div data-theme={theme} style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{ minHeight: '100vh' }}>
        <Sidebar />
        <div className="content-col" style={{ marginLeft: sidebarOpen ? 248 : 68, minWidth: 0, display: 'flex', flexDirection: 'column', transition: 'margin-left .18s ease' }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
            <Topbar />
          </div>
          <main className="app-main" style={{ flex: 1, padding: '22px 34px 48px', minWidth: 0 }}>
            <Outlet />
          </main>
        </div>
      </div>

      <MobileNav />
      <LeadModal />
      <ConfirmDialog />
      <AlertModal />
      <QrModal />
      <ImportModal />
      <NewLeadModal />
      <AlertTester />
      <Toasts />
    </div>
  );
}
