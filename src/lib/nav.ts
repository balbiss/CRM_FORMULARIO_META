export interface NavItem { path: string; label: string; short: string; mgrOnly?: boolean; group: 'menu' | 'ferramentas' }

export const NAV_ITEMS: NavItem[] = [
  { path: '/dash', label: 'Dashboard', short: 'Painel', group: 'menu' },
  { path: '/conversas', label: 'Conversas', short: 'Chats', group: 'menu' },
  { path: '/kanban', label: 'Leads', short: 'Leads', group: 'menu' },
  { path: '/clientes', label: 'Clientes', short: 'Clientes', group: 'menu' },
  { path: '/imoveis', label: 'Imóveis', short: 'Imóveis', group: 'menu' },
  { path: '/agenda', label: 'Tarefas', short: 'Tarefas', group: 'menu' },
  { path: '/roleta', label: 'Roleta', short: 'Roleta', group: 'menu' },
  { path: '/rebatidas', label: 'Rebatidas', short: 'Bolsão', group: 'menu' },
  { path: '/credito', label: 'Análise de Crédito', short: 'Crédito', group: 'menu' },

  { path: '/equipe', label: 'Equipe', short: 'Equipe', mgrOnly: true, group: 'ferramentas' },
  { path: '/relatorios', label: 'Relatórios', short: 'Relatos', group: 'ferramentas' },
  { path: '/templates', label: 'Templates', short: 'Modelos', group: 'ferramentas' },
  { path: '/followup', label: 'Follow-ups', short: 'Fluxo', group: 'ferramentas' },
  { path: '/integracoes', label: 'Integrações', short: 'Conexão', group: 'ferramentas' },
  { path: '/site', label: 'Site de Imóveis', short: 'Site', mgrOnly: true, group: 'ferramentas' },
  { path: '/links-uteis', label: 'Links Úteis', short: 'Links', group: 'ferramentas' },
  { path: '/treinamentos', label: 'Treinamentos', short: 'Cursos', group: 'ferramentas' },
  { path: '/manual', label: 'Manual do CRM', short: 'Manual', group: 'ferramentas' },
  { path: '/configuracoes', label: 'Ajustes', short: 'Ajustes', mgrOnly: true, group: 'ferramentas' },
];
