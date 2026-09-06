import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { AppShell } from './components/AppShell';
import { RequireAuth } from './components/RequireAuth';
import { useAppStore } from './store/appStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Kanban from './pages/Kanban';
import Conversas from './pages/Conversas';
import Clientes from './pages/Clientes';
import Imoveis from './pages/Imoveis';
import Roleta from './pages/Roleta';
import Bolsao from './pages/Bolsao';
import Followup from './pages/Followup';
import Credito from './pages/Credito';
import Agenda from './pages/Agenda';
import Equipe from './pages/Equipe';
import Relatorios from './pages/Relatorios';
import Manual from './pages/Manual';
import Integracoes from './pages/Integracoes';
import Templates from './pages/Templates';
import LinksUteis from './pages/LinksUteis';
import Treinamentos from './pages/Treinamentos';
import Configuracoes from './pages/Configuracoes';
import Denied from './pages/Denied';

useAppStore.getState().hydrateAuth();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/dash" replace />} />
          <Route path="dash" element={<Dashboard />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="conversas" element={<Conversas />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="imoveis" element={<Imoveis />} />
          <Route path="credito" element={<Credito />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="roleta" element={<Roleta />} />
          <Route path="rebatidas" element={<Bolsao />} />
          <Route path="followup" element={<Followup />} />
          <Route path="templates" element={<Templates />} />
          <Route path="integracoes" element={<Integracoes />} />
          <Route path="links-uteis" element={<LinksUteis />} />
          <Route path="treinamentos" element={<Treinamentos />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="denied" element={<Denied />} />
          <Route path="relatorios" element={<Relatorios />} />
          <Route path="manual" element={<Manual />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dash" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
