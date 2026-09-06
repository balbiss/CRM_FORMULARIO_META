import { create } from 'zustand';
import {
  type Role, type ColId, type Lead, type ChatMsg, type AnexoTipo,
} from '../lib/data';
import { apiFetch, type ApiError } from '../lib/api';
import { isBusinessHoursOpen, HORARIO_ATENDIMENTO_PADRAO, type DiaAtendimento } from '../lib/schedule';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { mapRemoteLead, slugToColunaId, type RemoteColuna, type RemotePerfil, type RemoteLead } from '../lib/remoteLeads';

interface RemoteFilaRow { corretorId: string; posicao: number; nome: string; emPlantao: boolean; bloqueado: boolean }
export interface RemoteTag { id: string; nome: string; cor: string; ordem: number }
export type ModoWhatsapp = 'central' | 'corretor';
export interface IntegracaoFacebook {
  id: string; nomeConta: string; pageId: string; formId: string;
  ativo: boolean; ultimaSyncEm: string | null; ultimoErro: string | null; criadoEm: string; tokenFinal: string;
}
export interface IntegracaoFacebookInput { nomeConta: string; pageId: string; formId: string; accessToken: string }
export interface SessaoWhatsapp { id: string; escopo: 'central' | 'corretor'; corretorId: string | null; status: 'desconectada' | 'conectando' | 'conectada'; numero: string | null }
export interface RemoteTemplate { id: string; titulo: string; texto: string; anexoUrl: string | null }
export type SituacaoImovel = 'Pronto para morar' | 'Em obras' | 'Lançamento';
export interface RemoteImovel {
  id: string; tipo: string; finalidade: string; titulo: string;
  endereco: string | null; cidade: string | null; estado: string | null;
  preco: string; area: string | null; quartos: number | null; suites: number | null; banheiros: number | null; vagas: number | null;
  amenidades: string[]; descricao: string | null; imagens: string[]; videoUrl: string | null;
  situacao: SituacaoImovel; previsaoEntrega: string | null; aceitaFinanciamento: boolean;
  valorCondominio: string | null; valorIptu: string | null;
}
export interface ImovelInput {
  tipo: string; finalidade: string; titulo: string;
  endereco?: string | null; cidade?: string | null; estado?: string | null;
  preco: number; area?: number | null; quartos?: number; suites?: number; banheiros?: number; vagas?: number;
  amenidades?: string[]; descricao?: string | null; imagens?: string[]; videoUrl?: string | null;
  situacao?: SituacaoImovel; previsaoEntrega?: string | null; aceitaFinanciamento?: boolean;
  valorCondominio?: number | null; valorIptu?: number | null;
}

export interface RemoteLinkUtil { id: string; categoria: string; titulo: string; url: string }
export interface LinkUtilInput { categoria: string; titulo: string; url: string }
export interface RemoteTreinamento { id: string; titulo: string; descricao: string | null; duracaoTexto: string | null; categoria: string | null; videoUrl: string | null }
export interface TreinamentoInput { titulo: string; descricao?: string | null; duracaoTexto?: string | null; categoria?: string | null; videoUrl?: string | null }

export interface RemoteNotificacao { id: string; tipo: string; titulo: string; texto: string | null; lida: boolean; criadoEm: string }

export interface RemoteMensagem {
  id: string; leadId: string; direcao: 'in' | 'out'; texto: string | null;
  anexoUrl: string | null; anexoTipo: AnexoTipo | null; canal: 'corretor' | 'followup'; enviadoEm: string;
  ackStatus?: number | null;
}

/** Resumo da última mensagem de um lead — usado só pra saber QUAIS leads já tiveram interação
 * de verdade (Conversas não pode listar todo mundo da base, com 10k+ leads isso é inviável). */
export interface RemoteConversa {
  leadId: string; texto: string | null; anexoTipo: AnexoTipo | null; direcao: 'in' | 'out'; enviadoEm: string;
  naoLidas?: number;
}

function mapRemoteMensagem(r: RemoteMensagem): ChatMsg {
  const dt = new Date(r.enviadoEm);
  const off = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 86400000));
  return {
    id: r.id, side: r.direcao, texto: r.texto ?? '', hora: dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    bot: r.canal === 'followup', off, anexoUrl: r.anexoUrl, anexoTipo: r.anexoTipo, ack: r.ackStatus ?? undefined,
  };
}

export interface AuthUser { id: string; nome: string; email: string; role: 'dono' | 'gerente' | 'corretor'; telefone?: string | null; emPlantao: boolean }

export const roleLabel: Record<AuthUser['role'], Role> = { dono: 'Dono', gerente: 'Gerente', corretor: 'Corretor' };

export type LeadTab = 'detalhes' | 'chat' | 'followup' | 'historico';
export type BolsaoTab = 'novos' | 'rebatidas' | 'descartados' | 'descadastrar' | 'roletalog';
export type AlertKind = 'lead' | 'visita' | 'credito' | 'plantao' | 'tarefa' | 'fora-horario' | null;

export interface FollowupStep { delay: string; texto: string }
export interface ConfirmState { titulo: string; texto: string; ok: string; fn: () => void }

// Construtor visual de fluxos (estilo ManyChat) da aba Follow-up — só visual/mock por enquanto,
// sem backend nem envio real (isso vai plugar no WAHA mais pra frente). Cada corretor tem os
// próprios fluxos; um fluxo dispara quando um lead é atribuído a ele, com blocos em sequência.
export type BlocoTipo = 'texto' | 'audio' | 'imagem' | 'pdf' | 'espera';
export interface FlowBloco { id: string; tipo: BlocoTipo; texto?: string; arquivo?: string; delay?: string }
export interface FlowDef { id: string; corretor: string; nome: string; gatilho: string; ativo: boolean; blocos: FlowBloco[] }

export const GATILHOS_FLOW = ['Lead atribuído (novo)', 'Lead rebatido', 'Pós-visita agendada', 'Análise de crédito parada'] as const;
export interface Toast { id: number; msg: string }

interface AppState {
  token: string | null;
  me: AuthUser | null;
  authLoading: boolean;
  authError: string | null;

  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  menuOpen: boolean;
  mobileNavOpen: boolean;

  colunasRemotas: RemoteColuna[];
  perfisRemotos: RemotePerfil[];
  kanbanLoading: boolean;

  tags: RemoteTag[];
  kbTag: string | null;
  horarioAtendimento: DiaAtendimento[];
  modoWhatsapp: ModoWhatsapp;
  integracoesFacebook: IntegracaoFacebook[];
  sessoesWhatsapp: SessaoWhatsapp[];
  wahaConfigurado: boolean;

  leads: Lead[];
  leadId: string | null;
  leadTab: LeadTab;
  chats: Record<string, ChatMsg[]>;
  conversas: RemoteConversa[];
  draft: string;
  typing: boolean;

  fila: { corretorId: string; nome: string; ativo: boolean }[];
  steps: FollowupStep[];
  autoDiscard: boolean;
  flows: FlowDef[];

  kbCorretor: string;
  bolsaoTab: BolsaoTab;

  convId: string | null;
  convDraft: string;
  convQuery: string;
  convCorretor: string;
  convTyping: boolean;

  cadencia: Record<string, string>;
  discardOpen: boolean;
  discardWarn: string | null;
  seqState: Record<string, 'ativa' | 'pausada' | 'encerrada'>;

  conn: Record<string, boolean>;
  qrFor: string | null;
  importOpen: boolean;
  newLeadOpen: boolean;
  templates: RemoteTemplate[];
  imoveis: RemoteImovel[];
  linksUteis: RemoteLinkUtil[];
  treinamentos: RemoteTreinamento[];

  alert: AlertKind;
  alertCount: number;
  alertMenu: boolean;
  faqOpen: string | null;
  confirm: ConfirmState | null;
  toasts: Toast[];
  notificacoes: RemoteNotificacao[];
  notifOpen: boolean;
  day: number;

  // actions
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => void;
  hydrateAuth: () => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  toggleMenu: () => void;
  setMobileNav: (open: boolean) => void;

  toast: (msg: string) => void;
  ask: (titulo: string, texto: string, ok: string, fn: () => void) => void;
  closeConfirm: () => void;
  confirmOk: () => void;

  fetchHorario: () => Promise<void>;
  salvarHorario: (dias: DiaAtendimento[]) => Promise<boolean>;
  fetchIntegracoes: () => Promise<void>;
  setModoWhatsapp: (modo: ModoWhatsapp) => Promise<void>;
  criarIntegracaoFb: (input: IntegracaoFacebookInput) => Promise<boolean>;
  atualizarIntegracaoFb: (id: string, patch: Partial<IntegracaoFacebookInput> & { ativo?: boolean }) => Promise<void>;
  excluirIntegracaoFb: (id: string) => Promise<void>;
  testarIntegracaoFb: (id: string) => Promise<{ ok: boolean; msg: string }>;
  fetchSessoesWhatsapp: () => Promise<void>;
  conectarWhatsapp: (escopo: 'central' | 'corretor', corretorId?: string) => Promise<string | null>;
  qrWhatsapp: (id: string) => Promise<{ status: string; numero: string | null; qr: string | null }>;
  desconectarWhatsapp: (id: string) => Promise<void>;
  setKbTag: (tagId: string | null) => void;
  fetchTags: () => Promise<void>;
  createTag: (nome: string, cor?: string) => Promise<RemoteTag | null>;
  renameTag: (id: string, patch: { nome?: string; cor?: string }) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  toggleLeadTag: (leadId: string, tagId: string) => Promise<void>;

  move: (id: string, colunaId: string) => void;
  moverPorSlug: (id: string, slug: ColId) => void;
  criarColuna: (titulo: string) => Promise<void>;
  renomearColuna: (id: string, titulo: string) => Promise<void>;
  excluirColuna: (id: string) => Promise<void>;
  reordenarColunas: (ids: string[]) => Promise<void>;
  fetchColunas: () => Promise<void>;
  openLead: (id: string, tab?: LeadTab) => void;
  closeLead: () => void;
  setLeadTab: (tab: LeadTab) => void;
  setDraft: (v: string) => void;
  sendMsg: () => void;
  fetchMensagens: (leadId: string) => void;
  enviarMensagem: (leadId: string, input: { texto?: string; anexoUrl?: string; anexoTipo?: AnexoTipo }) => Promise<void>;
  fetchConversas: () => void;

  pickConv: (id: string) => void;
  sendConv: () => void;
  setConvDraft: (v: string) => void;
  setConvQuery: (v: string) => void;
  setConvCorretor: (v: string) => void;
  backToList: () => void;

  setKbCorretor: (v: string) => void;
  toggleFila: (index: number, canToggle: boolean) => Promise<boolean>;
  toggleMeuPlantao: () => Promise<void>;
  enforceHorarioComercial: (meNome: string) => void;
  connectRealtime: () => void;
  fetchKanbanData: () => Promise<void>;

  setBolsaoTab: (t: BolsaoTab) => void;
  bolsaoAssume: (id: string) => void;
  bolsaoDiscard: (id: string, nome: string) => void;
  shuffle: () => void;
  pull: () => void;

  addStep: () => void;
  moveStepUp: (i: number) => void;
  moveStepDown: (i: number) => void;
  removeStep: (i: number) => void;
  toggleAutoDiscard: () => void;
  saveFlow: () => void;

  createFlow: (corretor: string, nome: string) => string;
  renameFlow: (id: string, nome: string) => void;
  setFlowGatilho: (id: string, gatilho: string) => void;
  toggleFlowAtivo: (id: string) => void;
  deleteFlow: (id: string) => void;
  addBloco: (flowId: string, tipo: BlocoTipo) => string;
  updateBloco: (flowId: string, blocoId: string, patch: Partial<FlowBloco>) => void;
  removeBloco: (flowId: string, blocoId: string) => void;
  moveBloco: (flowId: string, blocoId: string, dir: 'up' | 'down') => void;

  setCadencia: (leadId: string, value: string) => void;
  setColByTitle: (leadId: string, title: string) => void;
  openDiscard: () => void;
  closeDiscard: () => void;
  pickMotivoDescarte: (motivo: string) => void;
  requestApproval: () => void;

  pauseSeq: (leadId: string) => void;
  resumeSeq: (leadId: string) => void;
  endSeq: (leadId: string) => void;

  setQrFor: (nome: string) => void;
  closeQr: () => void;
  confirmQr: () => void;
  disconnect: (nome: string) => void;

  fetchTemplates: () => void;
  newTpl: () => void;
  updateTpl: (id: string, patch: { titulo?: string; texto?: string; anexoUrl?: string | null }) => void;
  delTpl: (id: string) => void;

  fetchImoveis: () => void;
  createImovel: (input: ImovelInput) => Promise<boolean>;
  updateImovel: (id: string, input: ImovelInput) => Promise<boolean>;
  deleteImovel: (id: string) => void;

  fetchLinksUteis: () => void;
  createLinkUtil: (input: LinkUtilInput) => Promise<boolean>;
  updateLinkUtil: (id: string, input: LinkUtilInput) => Promise<boolean>;
  deleteLinkUtil: (id: string) => void;

  fetchTreinamentos: () => void;
  createTreinamento: (input: TreinamentoInput) => Promise<boolean>;
  updateTreinamento: (id: string, input: TreinamentoInput) => Promise<boolean>;
  deleteTreinamento: (id: string) => void;

  setImportOpen: (v: boolean) => void;
  confirmImport: () => void;

  setAlertMenu: (v: boolean) => void;
  fireAlert: (kind: AlertKind) => void;
  closeAlert: () => void;
  alertOk: () => void;
  alertAlt: () => void;

  blockMember: (id: string) => void;
  revokeMember: (nome: string) => void;
  removeMember: (id: string, nome: string) => void;
  createMember: (input: { nome: string; email: string; telefone?: string; role: 'gerente' | 'corretor' }) => Promise<boolean>;
  updateMember: (id: string, patch: { nome: string; telefone: string }) => Promise<boolean>;

  setFaqOpen: (id: string | null) => void;
  toggleNotifMenu: () => void;
  fetchNotificacoes: () => void;
  marcarNotifLida: (id: string) => void;
  marcarTodasNotifsLidas: () => void;
  savePerfil: () => void;
  invite: () => void;
  exportCsv: () => void;
  addColumn: () => void;
  newLead: () => void;
  setNewLeadOpen: (v: boolean) => void;
  criarLeadManual: (input: { nome: string; telefone: string; email?: string; canal: string; corretorId?: string }) => Promise<boolean>;
  excluirLead: (id: string) => Promise<boolean>;
  limparConversa: (id: string) => Promise<boolean>;
  advance: (id: string) => void;
  askDiscard: (id: string, nome: string) => void;
  goDay: (n: number) => void;
}

let alertTimer: ReturnType<typeof setInterval> | undefined;

function beep() {
  try {
    const C = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!C) return;
    const ctx = new C();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.09;
    o.connect(g); g.connect(ctx.destination); o.start();
    setTimeout(() => { o.frequency.value = 660; }, 160);
    setTimeout(() => { o.stop(); ctx.close(); }, 340);
  } catch { /* audio not available */ }
}

export const useAppStore = create<AppState>((set, get) => ({
  token: null,
  me: null,
  authLoading: false,
  authError: null,

  theme: 'light',
  sidebarOpen: true,
  menuOpen: false,
  mobileNavOpen: false,
  tags: [],
  kbTag: null,
  horarioAtendimento: HORARIO_ATENDIMENTO_PADRAO,
  modoWhatsapp: 'corretor',
  integracoesFacebook: [],
  sessoesWhatsapp: [],
  wahaConfigurado: false,

  colunasRemotas: [],
  perfisRemotos: [],
  kanbanLoading: false,

  leads: [],
  leadId: null,
  leadTab: 'detalhes',
  chats: {},
  conversas: [],
  draft: '',
  typing: false,

  // Ninguém entra "No Plantão" sozinho — igual ao CRM original, cada um liga manualmente ao começar a trabalhar.
  fila: [],
  steps: [
    { delay: 'logo após inscrição', texto: 'Olá {nome}! Aqui é o {corretor}. Recebi seu interesse no {imovel} — posso te mandar a tabela de valores?' },
    { delay: '+1 dia', texto: '{nome}, separei duas plantas que combinam com o que você buscava. Quer receber por aqui?' },
    { delay: '+3 dias', texto: 'Estamos com condição especial de entrada nesta semana. Vale uma conversa rápida, {nome}?' },
    { delay: '+7 dias', texto: 'Se preferir, deixo sua ficha guardada e te chamo no próximo lançamento. Tudo bem, {nome}?' },
  ],
  autoDiscard: true,

  flows: [
    {
      id: 'flow-1', corretor: 'Diego Antunes', nome: 'Primeira vez', gatilho: 'Lead atribuído (novo)', ativo: true,
      blocos: [
        { id: 'b1', tipo: 'texto', texto: 'Olá {nome}! Aqui é o {corretor} 👋 Vi que você se interessou pelo {imovel} — posso te contar mais?' },
        { id: 'b2', tipo: 'espera', delay: '+10 min' },
        { id: 'b3', tipo: 'audio', arquivo: 'audio-boas-vindas.ogg' },
        { id: 'b4', tipo: 'espera', delay: '+1 dia' },
        { id: 'b5', tipo: 'imagem', arquivo: 'fachada-aurora.jpg' },
        { id: 'b6', tipo: 'texto', texto: 'Separei essa foto pra você já visualizar o empreendimento. Quer agendar uma visita essa semana?' },
      ],
    },
    {
      id: 'flow-2', corretor: 'Diego Antunes', nome: 'Rebatida', gatilho: 'Lead rebatido', ativo: false,
      blocos: [
        { id: 'b7', tipo: 'texto', texto: '{nome}, tudo bem? Notei que faz um tempo que não conversamos sobre o {imovel}. Ainda tem interesse?' },
        { id: 'b8', tipo: 'espera', delay: '+2 dias' },
        { id: 'b9', tipo: 'pdf', arquivo: 'tabela-valores-aurora.pdf' },
      ],
    },
    {
      id: 'flow-3', corretor: 'Fernanda Lopes', nome: 'Pós-visita', gatilho: 'Pós-visita agendada', ativo: true,
      blocos: [
        { id: 'b10', tipo: 'texto', texto: 'Oi {nome}! Foi um prazer te receber hoje. O que achou do {imovel}?' },
        { id: 'b11', tipo: 'espera', delay: '+1 dia' },
        { id: 'b12', tipo: 'texto', texto: 'Separei as condições de pagamento que conversamos. Posso te enviar?' },
        { id: 'b13', tipo: 'pdf', arquivo: 'condicoes-pagamento.pdf' },
      ],
    },
  ],

  kbCorretor: 'Todos os corretores',
  bolsaoTab: 'rebatidas',

  convId: null, convDraft: '', convQuery: '', convCorretor: 'Todos os corretores', convTyping: false,

  cadencia: {}, discardOpen: false, discardWarn: null, seqState: {},

  conn: { 'Camila Rocha': true, 'Diego Antunes': true, 'Fernanda Lopes': false, 'Marcelo Braga': false, 'Priscila Nunes': true, 'Rafael Teixeira': false },
  qrFor: null, importOpen: false, newLeadOpen: false, templates: [], imoveis: [], linksUteis: [], treinamentos: [],

  alert: null, alertCount: 20, alertMenu: false, faqOpen: 'kanban', confirm: null, toasts: [], notificacoes: [], notifOpen: false, day: 17,

  login: async (email, senha) => {
    set({ authLoading: true, authError: null });
    try {
      const data = await apiFetch<{ token: string; perfil: AuthUser }>('/api/auth/login', null, {
        method: 'POST',
        body: JSON.stringify({ email, senha }),
      });
      localStorage.setItem('nova_token', data.token);
      set({ token: data.token, me: data.perfil, authLoading: false });
      get().connectRealtime();
      get().fetchKanbanData();
      get().fetchTemplates();
      get().fetchImoveis();
      get().fetchLinksUteis();
      get().fetchTreinamentos();
      get().fetchNotificacoes();
      get().fetchConversas();
      return true;
    } catch (e) {
      set({ authError: (e as ApiError).message || 'Não foi possível entrar', authLoading: false });
      return false;
    }
  },
  logout: () => {
    localStorage.removeItem('nova_token');
    disconnectSocket();
    set({ token: null, me: null, leads: [], colunasRemotas: [], perfisRemotos: [], tags: [], kbTag: null, horarioAtendimento: HORARIO_ATENDIMENTO_PADRAO, modoWhatsapp: 'corretor', integracoesFacebook: [], sessoesWhatsapp: [], wahaConfigurado: false, templates: [], imoveis: [], linksUteis: [], treinamentos: [], notificacoes: [], conversas: [] });
  },
  hydrateAuth: () => {
    const token = localStorage.getItem('nova_token');
    if (!token) return;
    set({ token, authLoading: true });
    apiFetch<Omit<AuthUser, 'emPlantao'> & { emPlantao: boolean }>('/api/auth/me', token)
      .then(perfil => {
        set({ me: perfil as AuthUser, authLoading: false });
        get().connectRealtime();
        get().fetchKanbanData();
        get().fetchTemplates();
        get().fetchImoveis();
        get().fetchLinksUteis();
        get().fetchTreinamentos();
      get().fetchNotificacoes();
      get().fetchConversas();
      get().fetchHorario();
      get().fetchIntegracoes();
      })
      .catch((e: ApiError) => {
        localStorage.removeItem('nova_token');
        const suspenso = /ACESSO_SUSPENSO|suspenso/i.test(e?.message || '');
        set({
          token: null, me: null, authLoading: false,
          authError: suspenso ? 'Acesso suspenso. Fale com o suporte da Visita IA.' : null,
        });
      });
  },
  connectRealtime: () => {
    const token = get().token;
    if (!token) return;
    const socket = connectSocket(token);
    const upsert = (raw: RemoteLead) => {
      const { colunasRemotas, perfisRemotos } = get();
      if (!colunasRemotas.length) return; // ainda carregando colunas/perfis — o fetch inicial já vai trazer esse lead
      set(s => {
        const anterior = s.leads.find(l => l.id === raw.id);
        // o payload do socket não traz etiquetas — preserva as que já estão em memória
        const mapped = { ...mapRemoteLead(raw, colunasRemotas, perfisRemotos), tags: raw.tagIds ?? anterior?.tags ?? [] };
        return { leads: anterior ? s.leads.map(l => (l.id === mapped.id ? mapped : l)) : [...s.leads, mapped] };
      });
    };
    socket.off('lead:created').on('lead:created', upsert);
    socket.off('lead:updated').on('lead:updated', upsert);
    socket.off('lead:tags').on('lead:tags', (msg: { leadId: string; tagIds: string[] }) => {
      set(s => ({ leads: s.leads.map(l => (l.id === msg.leadId ? { ...l, tags: msg.tagIds } : l)) }));
    });
    socket.off('tag:changed').on('tag:changed', () => { get().fetchTags(); });
    socket.off('colunas:mudou').on('colunas:mudou', () => { get().fetchColunas(); });
    socket.off('fila:atualizada').on('fila:atualizada', (msg: { corretorId: string; emPlantao: boolean }) => {
      set(s => ({ fila: s.fila.map(f => (f.corretorId === msg.corretorId ? { ...f, ativo: msg.emPlantao } : f)) }));
    });
    socket.off('fila:embaralhada').on('fila:embaralhada', () => {
      apiFetch<RemoteFilaRow[]>('/api/filas', token)
        .then(rows => set({ fila: rows.map(f => ({ corretorId: f.corretorId, nome: f.nome, ativo: f.emPlantao })) }))
        .catch(() => {});
    });
    socket.off('perfil:criado').on('perfil:criado', (row: RemotePerfil) => {
      set(s => (s.perfisRemotos.some(p => p.id === row.id) ? s : { perfisRemotos: [...s.perfisRemotos, row] }));
    });
    socket.off('perfil:atualizado').on('perfil:atualizado', (row: RemotePerfil) => {
      set(s => ({ perfisRemotos: s.perfisRemotos.map(p => (p.id === row.id ? row : p)) }));
    });
    socket.off('perfil:removido').on('perfil:removido', (msg: { id: string }) => {
      set(s => ({ perfisRemotos: s.perfisRemotos.filter(p => p.id !== msg.id), fila: s.fila.filter(f => f.corretorId !== msg.id) }));
    });
    socket.off('mensagem:created').on('mensagem:created', (row: RemoteMensagem) => {
      set(s => {
        const abertaAgora = s.leadId === row.leadId;
        const anterior = s.conversas.find(c => c.leadId === row.leadId);
        const naoLidas = row.direcao === 'in' && !abertaAgora ? (anterior?.naoLidas ?? 0) + 1 : (abertaAgora ? 0 : anterior?.naoLidas ?? 0);
        const resumo: RemoteConversa = { leadId: row.leadId, texto: row.texto, anexoTipo: row.anexoTipo, direcao: row.direcao, enviadoEm: row.enviadoEm, naoLidas };
        const semEsse = s.conversas.filter(c => c.leadId !== row.leadId);
        const conversas = [resumo, ...semEsse];

        const lista = s.chats[row.leadId];
        if (!lista) return { conversas }; // conversa não está aberta agora — não precisa manter em memória
        if (lista.some(m => m.id === row.id)) return { conversas };
        return { conversas, chats: { ...s.chats, [row.leadId]: [...lista, mapRemoteMensagem(row)] } };
      });
    });
    socket.off('conversa:lida').on('conversa:lida', (msg: { leadId: string }) => {
      set(s => ({ conversas: s.conversas.map(c => (c.leadId === msg.leadId ? { ...c, naoLidas: 0 } : c)) }));
    });
    socket.off('mensagem:ack').on('mensagem:ack', (msg: { id: string; ackStatus: number }) => {
      set(s => {
        const next: typeof s.chats = {};
        let mudou = false;
        for (const [lid, lista] of Object.entries(s.chats)) {
          next[lid] = lista.map(m => {
            if (m.id !== msg.id) return m;
            mudou = true;
            return { ...m, ack: msg.ackStatus };
          });
        }
        return mudou ? { chats: next } : {};
      });
    });
    socket.off('lead:removido').on('lead:removido', (msg: { id: string }) => {
      set(s => {
        const chats = { ...s.chats }; delete chats[msg.id];
        return {
          leads: s.leads.filter(l => l.id !== msg.id),
          conversas: s.conversas.filter(c => c.leadId !== msg.id),
          chats,
          leadId: s.leadId === msg.id ? null : s.leadId,
        };
      });
    });
    socket.off('conversa:limpa').on('conversa:limpa', (msg: { leadId: string }) => {
      set(s => {
        const chats = { ...s.chats }; delete chats[msg.leadId];
        return { chats, conversas: s.conversas.filter(c => c.leadId !== msg.leadId) };
      });
    });
  },
  fetchKanbanData: async () => {
    const token = get().token;
    if (!token) return;
    set({ kanbanLoading: true });
    try {
      const [colunas, perfis, leadsRaw, filaRaw, tagsRaw] = await Promise.all([
        apiFetch<RemoteColuna[]>('/api/colunas', token),
        apiFetch<RemotePerfil[]>('/api/perfis', token),
        apiFetch<RemoteLead[]>('/api/leads', token),
        apiFetch<RemoteFilaRow[]>('/api/filas', token),
        apiFetch<RemoteTag[]>('/api/tags', token),
      ]);
      const leads = leadsRaw.map(r => mapRemoteLead(r, colunas, perfis));
      const fila = filaRaw.map(f => ({ corretorId: f.corretorId, nome: f.nome, ativo: f.emPlantao }));
      set({ colunasRemotas: colunas, perfisRemotos: perfis, leads, fila, tags: tagsRaw, kanbanLoading: false });
    } catch (e) {
      get().toast('Não foi possível carregar os leads do servidor');
      set({ kanbanLoading: false });
    }
  },

  setKbTag: tagId => set(s => ({ kbTag: s.kbTag === tagId ? null : tagId })),
  fetchTags: async () => {
    const token = get().token;
    if (!token) return;
    try { set({ tags: await apiFetch<RemoteTag[]>('/api/tags', token) }); } catch { /* ignore */ }
  },
  createTag: async (nome, cor) => {
    const token = get().token;
    if (!token) return null;
    try {
      const row = await apiFetch<RemoteTag>('/api/tags', token, { method: 'POST', body: JSON.stringify({ nome, ...(cor ? { cor } : {}) }) });
      set(s => ({ tags: [...s.tags, row] }));
      return row;
    } catch (e) {
      get().toast((e as ApiError).message || 'Não foi possível criar a etiqueta');
      return null;
    }
  },
  renameTag: async (id, patch) => {
    const token = get().token;
    if (!token) return;
    try {
      const row = await apiFetch<RemoteTag>('/api/tags/' + id, token, { method: 'PATCH', body: JSON.stringify(patch) });
      set(s => ({ tags: s.tags.map(t => (t.id === id ? row : t)) }));
    } catch (e) { get().toast((e as ApiError).message || 'Não foi possível editar a etiqueta'); }
  },
  deleteTag: async id => {
    const token = get().token;
    if (!token) return;
    try {
      await apiFetch('/api/tags/' + id, token, { method: 'DELETE' });
      set(s => ({
        tags: s.tags.filter(t => t.id !== id),
        kbTag: s.kbTag === id ? null : s.kbTag,
        leads: s.leads.map(l => (l.tags.includes(id) ? { ...l, tags: l.tags.filter(x => x !== id) } : l)),
      }));
    } catch (e) { get().toast((e as ApiError).message || 'Não foi possível excluir a etiqueta'); }
  },
  toggleLeadTag: async (leadId, tagId) => {
    const token = get().token;
    if (!token) return;
    const lead = get().leads.find(l => l.id === leadId);
    if (!lead) return;
    const tinha = lead.tags.includes(tagId);
    // otimista
    set(s => ({ leads: s.leads.map(l => (l.id === leadId ? { ...l, tags: tinha ? l.tags.filter(x => x !== tagId) : [...l.tags, tagId] } : l)) }));
    try {
      const url = '/api/tags/' + tagId + '/lead/' + leadId;
      const { tagIds } = await apiFetch<{ tagIds: string[] }>(url, token, { method: tinha ? 'DELETE' : 'POST' });
      set(s => ({ leads: s.leads.map(l => (l.id === leadId ? { ...l, tags: tagIds } : l)) }));
    } catch (e) {
      // reverte
      set(s => ({ leads: s.leads.map(l => (l.id === leadId ? { ...l, tags: lead.tags } : l)) }));
      get().toast((e as ApiError).message || 'Não foi possível atualizar a etiqueta');
    }
  },

  toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  toggleMenu: () => set(s => ({ menuOpen: !s.menuOpen })),
  setMobileNav: (open: boolean) => set({ mobileNavOpen: open }),

  toast: msg => {
    const id = Date.now() + Math.random();
    set(s => ({ toasts: [...s.toasts, { id, msg }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3200);
  },
  ask: (titulo, texto, ok, fn) => set({ confirm: { titulo, texto, ok, fn } }),
  closeConfirm: () => set({ confirm: null }),
  confirmOk: () => { const c = get().confirm; set({ confirm: null }); c?.fn(); },

  // move(leadId, colunaId) — colunaId é o id REAL da coluna do banco.
  move: (id, colunaId) => {
    const { leads, colunasRemotas, token } = get();
    const l = leads.find(x => x.id === id);
    const destino = colunasRemotas.find(c => c.id === colunaId);
    if (!l || !destino || l.colunaId === colunaId) return;
    const antes = { colunaId: l.colunaId, col: l.col };
    const semantico = destino.slug ?? destino.id;
    set(s => ({ leads: s.leads.map(x => (x.id === id ? { ...x, colunaId, col: semantico, dias: 0 } : x)) }));
    get().toast(l.nome + ' → ' + destino.titulo);
    if (!token) return;
    apiFetch('/api/leads/' + id + '/mover', token, { method: 'PATCH', body: JSON.stringify({ colunaId }) })
      .catch(() => {
        set(s => ({ leads: s.leads.map(x => (x.id === id ? { ...x, ...antes } : x)) }));
        get().toast('Não deu pra salvar — ' + l.nome + ' voltou pra coluna anterior');
      });
  },
  moverPorSlug: (id, slug) => {
    const cid = slugToColunaId(slug, get().colunasRemotas);
    if (cid) get().move(id, cid);
  },

  openLead: (id, tab = 'detalhes') => {
    const l = get().leads.find(x => x.id === id);
    set({ leadId: id, leadTab: tab, typing: false });
    if (l && !get().chats[id]) get().fetchMensagens(id);
  },
  closeLead: () => set({ leadId: null, discardOpen: false, discardWarn: null }),
  setLeadTab: tab => set({ leadTab: tab }),
  setDraft: v => set({ draft: v }),
  fetchMensagens: leadId => {
    const token = get().token;
    if (!token) return;
    apiFetch<RemoteMensagem[]>('/api/mensagens/' + leadId, token)
      .then(rows => set(s => ({
        chats: { ...s.chats, [leadId]: rows.map(mapRemoteMensagem) },
        // abrir a conversa zera o contador de não lidas (o backend também marca no banco)
        conversas: s.conversas.map(c => (c.leadId === leadId ? { ...c, naoLidas: 0 } : c)),
      })))
      .catch(() => get().toast('Não foi possível carregar a conversa'));
  },
  fetchConversas: () => {
    const token = get().token;
    if (!token) return;
    apiFetch<RemoteConversa[]>('/api/mensagens', token)
      .then(conversas => set({ conversas }))
      .catch(() => {});
  },
  enviarMensagem: async (leadId, input) => {
    const token = get().token;
    if (!token) return;
    const tempId = 'temp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const otimista: ChatMsg = { id: tempId, side: 'out', texto: input.texto ?? '', hora, off: 0, anexoUrl: input.anexoUrl ?? null, anexoTipo: input.anexoTipo ?? null };
    set(s => ({ chats: { ...s.chats, [leadId]: [...(s.chats[leadId] || []), otimista] } }));
    try {
      const row = await apiFetch<RemoteMensagem>('/api/mensagens/' + leadId, token, { method: 'POST', body: JSON.stringify(input) });
      set(s => {
        const lista = s.chats[leadId] || [];
        const jaVeio = lista.some(m => m.id === row.id);
        const semTemp = lista.filter(m => m.id !== tempId);
        return { chats: { ...s.chats, [leadId]: jaVeio ? semTemp : [...semTemp, mapRemoteMensagem(row)] } };
      });
    } catch (e) {
      set(s => ({ chats: { ...s.chats, [leadId]: (s.chats[leadId] || []).filter(m => m.id !== tempId) } }));
      get().toast((e as ApiError).message || 'Não foi possível enviar a mensagem');
    }
  },
  sendMsg: () => {
    const t = get().draft.trim();
    const id = get().leadId;
    if (!t || !id) return;
    set({ draft: '' });
    get().enviarMensagem(id, { texto: t });
  },

  pickConv: id => {
    set({ convId: id, convDraft: '', convTyping: false });
    if (!get().chats[id]) get().fetchMensagens(id);
  },
  sendConv: () => {
    const t = (get().convDraft || '').trim();
    const id = get().convId;
    if (!t || !id || t === '/') return;
    set({ convDraft: '' });
    get().enviarMensagem(id, { texto: t });
  },
  setConvDraft: v => set({ convDraft: v }),
  setConvQuery: v => set({ convQuery: v }),
  setConvCorretor: v => set({ convCorretor: v, convId: null }),
  backToList: () => set({ convId: null }),

  setKbCorretor: v => { set({ kbCorretor: v }); get().toast('Kanban filtrado: ' + v); },
  toggleFila: async (index, canToggle) => {
    if (!canToggle) { get().toast('Só o gerente altera a disponibilidade de outro corretor'); return false; }
    const f = get().fila[index];
    if (!f) return false;
    // Checagem otimista local (feedback instantâneo) — o backend valida de novo e manda de verdade.
    const bloqueado = get().perfisRemotos.find(p => p.id === f.corretorId)?.bloqueado ?? false;
    if (bloqueado) { get().toast(f.nome + ' está com acesso bloqueado — não pode entrar na roleta'); return false; }
    if (!f.ativo && !isBusinessHoursOpen(get().horarioAtendimento)) { get().fireAlert('fora-horario'); return false; }

    const token = get().token;
    if (!token) return false;
    try {
      const res = await apiFetch<{ corretorId: string; emPlantao: boolean }>('/api/filas/disponibilidade', token, {
        method: 'PATCH',
        body: JSON.stringify({ corretorId: f.corretorId }),
      });
      set(s => ({ fila: s.fila.map((x, i) => (i === index ? { ...x, ativo: res.emPlantao } : x)) }));
      get().toast(f.nome + (res.emPlantao ? ' entrou na roleta' : ' saiu da roleta'));
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Não foi possível alterar a disponibilidade');
      return false;
    }
  },

  // Liga/desliga o MEU plantão — funciona pra qualquer papel. Dono/gerente não estão na fila
  // por padrão; o backend cria a posição deles ao ligar (aí passam a receber leads da roleta).
  toggleMeuPlantao: async () => {
    const { token, me } = get();
    if (!token || !me) return;
    const naFila = get().fila.find(f => f.corretorId === me.id);
    const ativoAgora = naFila ? naFila.ativo : !!me.emPlantao;
    if (!ativoAgora && !isBusinessHoursOpen(get().horarioAtendimento)) { get().fireAlert('fora-horario'); return; }
    try {
      const res = await apiFetch<{ corretorId: string; emPlantao: boolean }>('/api/filas/disponibilidade', token, {
        method: 'PATCH',
        body: JSON.stringify({ corretorId: me.id }),
      });
      set(s => ({
        me: s.me ? { ...s.me, emPlantao: res.emPlantao } : s.me,
        fila: s.fila.some(f => f.corretorId === me.id)
          ? s.fila.map(f => (f.corretorId === me.id ? { ...f, ativo: res.emPlantao } : f))
          : s.fila,
      }));
      if (res.emPlantao && !get().fila.some(f => f.corretorId === me.id)) {
        // o backend acabou de criar a posição na fila — recarrega pra refletir
        apiFetch<RemoteFilaRow[]>('/api/filas', token)
          .then(rows => set({ fila: rows.map(r => ({ corretorId: r.corretorId, nome: r.nome, ativo: r.emPlantao })) }))
          .catch(() => {});
      }
      if (res.emPlantao) get().fireAlert('plantao');
      else get().toast('Você saiu do plantão');
    } catch (e) {
      get().toast((e as ApiError).message || 'Não foi possível alterar seu plantão');
    }
  },

  // Espelha o cron `auto-offline-fim-de-expediente` do CRM original: fora do horário, todo
  // mundo que estava "No Plantão" é desligado automaticamente (sem religamento sozinho de manhã).
  // O backend só recusa LIGAR fora do horário — desligar sempre é permitido — então aqui é seguro
  // desligar "eu mesmo" de verdade no servidor; os outros corretores são atualizados via realtime
  // quando o próprio cliente deles rodar essa mesma checagem.
  fetchHorario: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const dias = await apiFetch<DiaAtendimento[]>('/api/config/horario', token);
      if (Array.isArray(dias) && dias.length === 7) set({ horarioAtendimento: dias });
    } catch { /* mantém o padrão */ }
  },
  salvarHorario: async dias => {
    const token = get().token;
    if (!token) return false;
    try {
      const salvo = await apiFetch<DiaAtendimento[]>('/api/config/horario', token, { method: 'PUT', body: JSON.stringify(dias) });
      set({ horarioAtendimento: salvo });
      get().toast('Horário de atendimento atualizado');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Não foi possível salvar o horário');
      return false;
    }
  },

  fetchIntegracoes: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const [{ modo }, lista] = await Promise.all([
        apiFetch<{ modo: ModoWhatsapp }>('/api/config/whatsapp', token),
        apiFetch<IntegracaoFacebook[]>('/api/integracoes/facebook', token).catch(() => [] as IntegracaoFacebook[]),
      ]);
      set({ modoWhatsapp: modo, integracoesFacebook: lista });
      get().fetchSessoesWhatsapp();
    } catch { /* provável corretor sem permissão — mantém o padrão */ }
  },
  setModoWhatsapp: async modo => {
    const token = get().token;
    if (!token) return;
    const anterior = get().modoWhatsapp;
    set({ modoWhatsapp: modo });
    try {
      await apiFetch('/api/config/whatsapp', token, { method: 'PUT', body: JSON.stringify({ modo }) });
      get().toast(modo === 'central' ? 'Modo: número central da imobiliária' : 'Modo: WhatsApp de cada corretor');
    } catch (e) {
      set({ modoWhatsapp: anterior });
      get().toast((e as ApiError).message || 'Não foi possível trocar o modo');
    }
  },
  criarIntegracaoFb: async input => {
    const token = get().token;
    if (!token) return false;
    try {
      const row = await apiFetch<IntegracaoFacebook>('/api/integracoes/facebook', token, { method: 'POST', body: JSON.stringify(input) });
      set(s => ({ integracoesFacebook: [...s.integracoesFacebook, row] }));
      get().toast('Conexão do Facebook adicionada');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Não foi possível salvar a conexão');
      return false;
    }
  },
  atualizarIntegracaoFb: async (id, patch) => {
    const token = get().token;
    if (!token) return;
    try {
      const row = await apiFetch<IntegracaoFacebook>('/api/integracoes/facebook/' + id, token, { method: 'PATCH', body: JSON.stringify(patch) });
      set(s => ({ integracoesFacebook: s.integracoesFacebook.map(x => (x.id === id ? row : x)) }));
    } catch (e) { get().toast((e as ApiError).message || 'Não foi possível atualizar a conexão'); }
  },
  excluirIntegracaoFb: async id => {
    const token = get().token;
    if (!token) return;
    try {
      await apiFetch('/api/integracoes/facebook/' + id, token, { method: 'DELETE' });
      set(s => ({ integracoesFacebook: s.integracoesFacebook.filter(x => x.id !== id) }));
      get().toast('Conexão removida');
    } catch (e) { get().toast((e as ApiError).message || 'Não foi possível remover a conexão'); }
  },
  testarIntegracaoFb: async id => {
    const token = get().token;
    if (!token) return { ok: false, msg: 'Sem sessão' };
    try {
      const r = await apiFetch<{ ok: boolean; formulario?: string; erro?: string }>('/api/integracoes/facebook/' + id + '/testar', token, { method: 'POST' });
      get().fetchIntegracoes();
      return r.ok ? { ok: true, msg: 'OK — formulário "' + (r.formulario || '') + '"' } : { ok: false, msg: r.erro || 'Falhou' };
    } catch (e) {
      return { ok: false, msg: (e as ApiError).message || 'Falhou' };
    }
  },

  fetchSessoesWhatsapp: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const r = await apiFetch<{ wahaConfigurado: boolean; sessoes: SessaoWhatsapp[] }>('/api/whatsapp/sessoes', token);
      set({ wahaConfigurado: r.wahaConfigurado, sessoesWhatsapp: r.sessoes });
    } catch { /* provável corretor sem permissão */ }
  },
  conectarWhatsapp: async (escopo, corretorId) => {
    const token = get().token;
    if (!token) return null;
    try {
      const row = await apiFetch<SessaoWhatsapp>('/api/whatsapp/sessoes', token, { method: 'POST', body: JSON.stringify({ escopo, ...(corretorId ? { corretorId } : {}) }) });
      await get().fetchSessoesWhatsapp();
      return row.id;
    } catch (e) {
      get().toast((e as ApiError).message || 'Não foi possível iniciar a conexão');
      return null;
    }
  },
  qrWhatsapp: async id => {
    const token = get().token;
    if (!token) return { status: 'desconectada', numero: null, qr: null };
    try {
      const r = await apiFetch<{ status: string; numero: string | null; qr: string | null }>('/api/whatsapp/sessoes/' + id + '/qr', token);
      if (r.status === 'conectada') get().fetchSessoesWhatsapp();
      return r;
    } catch {
      return { status: 'desconectada', numero: null, qr: null };
    }
  },
  desconectarWhatsapp: async id => {
    const token = get().token;
    if (!token) return;
    try {
      await apiFetch('/api/whatsapp/sessoes/' + id, token, { method: 'DELETE' });
      set(s => ({ sessoesWhatsapp: s.sessoesWhatsapp.filter(x => x.id !== id) }));
      get().toast('WhatsApp desconectado');
    } catch (e) { get().toast((e as ApiError).message || 'Não foi possível desconectar'); }
  },
  enforceHorarioComercial: meNome => {
    if (isBusinessHoursOpen(get().horarioAtendimento)) return;
    const me = get().fila.find(f => f.nome === meNome);
    const algumOnline = get().fila.some(f => f.ativo);
    if (!algumOnline) return;
    set(s => ({ fila: s.fila.map(f => (f.ativo ? { ...f, ativo: false } : f)) }));
    if (me?.ativo) {
      get().toast('Você saiu da roleta automaticamente — fim do expediente');
      const token = get().token;
      if (token) apiFetch('/api/filas/disponibilidade', token, { method: 'PATCH', body: JSON.stringify({ corretorId: me.corretorId }) }).catch(() => {});
    }
  },

  setBolsaoTab: t => set({ bolsaoTab: t }),
  bolsaoAssume: id => get().moverPorSlug(id, 'novo'),
  bolsaoDiscard: (id, nome) => get().ask(
    'Descartar ' + nome + '?',
    'O lead sai do bolsão e vai para a base de descadastrados. Esta ação não pode ser desfeita.',
    'Descartar',
    () => { set(s => ({ leads: s.leads.map(x => (x.id === id ? { ...x, motivo: 'Duplicado' } : x)) })); get().toast(nome + ' foi descartado'); },
  ),
  shuffle: () => {
    const token = get().token;
    if (!token) return;
    apiFetch('/api/filas/embaralhar', token, { method: 'POST' })
      .then(() => apiFetch<RemoteFilaRow[]>('/api/filas', token))
      .then(rows => set({ fila: rows.map(f => ({ corretorId: f.corretorId, nome: f.nome, ativo: f.emPlantao })) }))
      .then(() => get().toast('Roleta embaralhada'))
      .catch(() => get().toast('Não foi possível embaralhar a roleta'));
  },
  pull: () => get().toast('3 rebatidas puxadas para o seu atendimento'),

  addStep: () => set(s => ({ steps: [...s.steps, { delay: '+14 dias', texto: 'Nova mensagem — edite o conteúdo e use {nome} ou {corretor}.' }] })),
  moveStepUp: i => set(s => { if (!i) return s; const a = [...s.steps]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return { steps: a }; }),
  moveStepDown: i => set(s => { if (i === s.steps.length - 1) return s; const a = [...s.steps]; [a[i + 1], a[i]] = [a[i], a[i + 1]]; return { steps: a }; }),
  removeStep: i => get().ask(
    'Remover passo ' + (i + 1) + '?',
    'A mensagem sai da sequência para todos os leads que ainda não a receberam.',
    'Remover',
    () => { set(s => ({ steps: s.steps.filter((_, x) => x !== i) })); get().toast('Passo removido da sequência'); },
  ),
  toggleAutoDiscard: () => set(s => ({ autoDiscard: !s.autoDiscard })),
  saveFlow: () => get().toast('Sequência salva e ativada para novos leads'),

  createFlow: (corretor, nome) => {
    const id = 'flow-' + Date.now();
    set(s => ({ flows: [...s.flows, { id, corretor, nome, gatilho: GATILHOS_FLOW[0], ativo: false, blocos: [] }] }));
    return id;
  },
  renameFlow: (id, nome) => set(s => ({ flows: s.flows.map(f => (f.id === id ? { ...f, nome } : f)) })),
  setFlowGatilho: (id, gatilho) => set(s => ({ flows: s.flows.map(f => (f.id === id ? { ...f, gatilho } : f)) })),
  toggleFlowAtivo: id => set(s => ({ flows: s.flows.map(f => (f.id === id ? { ...f, ativo: !f.ativo } : f)) })),
  deleteFlow: id => set(s => ({ flows: s.flows.filter(f => f.id !== id) })),

  addBloco: (flowId, tipo) => {
    const id = 'bloco-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const base: FlowBloco =
      tipo === 'texto' ? { id, tipo, texto: 'Nova mensagem — edite o conteúdo e use {nome}, {corretor} ou {imovel}.' } :
      tipo === 'espera' ? { id, tipo, delay: '+1 dia' } :
      tipo === 'audio' ? { id, tipo, arquivo: 'novo-audio.ogg' } :
      tipo === 'imagem' ? { id, tipo, arquivo: 'nova-imagem.jpg' } :
      { id, tipo, arquivo: 'novo-documento.pdf' };
    set(s => ({ flows: s.flows.map(f => (f.id === flowId ? { ...f, blocos: [...f.blocos, base] } : f)) }));
    return id;
  },
  updateBloco: (flowId, blocoId, patch) => set(s => ({
    flows: s.flows.map(f => (f.id === flowId ? { ...f, blocos: f.blocos.map(b => (b.id === blocoId ? { ...b, ...patch } : b)) } : f)),
  })),
  removeBloco: (flowId, blocoId) => set(s => ({
    flows: s.flows.map(f => (f.id === flowId ? { ...f, blocos: f.blocos.filter(b => b.id !== blocoId) } : f)),
  })),
  moveBloco: (flowId, blocoId, dir) => set(s => ({
    flows: s.flows.map(f => {
      if (f.id !== flowId) return f;
      const i = f.blocos.findIndex(b => b.id === blocoId);
      const j = dir === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= f.blocos.length) return f;
      const blocos = [...f.blocos];
      [blocos[i], blocos[j]] = [blocos[j], blocos[i]];
      return { ...f, blocos };
    }),
  })),

  setCadencia: (leadId, value) => { set(s => ({ cadencia: { ...s.cadencia, [leadId]: value } })); get().toast(get().leads.find(l => l.id === leadId)?.nome + ': ' + value); },
  setColByTitle: (leadId, title) => { const c = get().colunasRemotas.find(x => x.titulo === title); if (c) get().move(leadId, c.id); },
  openDiscard: () => set(s => ({ discardOpen: !s.discardOpen, discardWarn: null })),
  closeDiscard: () => set({ discardOpen: false, discardWarn: null }),
  pickMotivoDescarte: motivo => {
    const APROVACAO = ['Descadastrar', 'Já Comprou'];
    const leadId = get().leadId;
    const l = get().leads.find(x => x.id === leadId);
    if (APROVACAO.includes(motivo)) { set({ discardWarn: motivo }); return; }
    set({ discardOpen: false, discardWarn: null });
    get().ask(
      'Descartar ' + (l ? l.nome : 'lead') + '?',
      'Motivo: ' + motivo + '. O lead vai para o bolsão de rebatidas e a sequência de follow-up é interrompida.',
      'Descartar',
      () => { if (l) { get().moverPorSlug(l.id, 'rebatida'); set({ leadId: null }); } },
    );
  },
  requestApproval: () => { set({ discardOpen: false, discardWarn: null }); get().toast('Solicitação enviada ao gerente para aprovação'); },

  pauseSeq: leadId => { set(s => ({ seqState: { ...s.seqState, [leadId]: 'pausada' } })); get().toast('Follow-up pausado'); },
  resumeSeq: leadId => { set(s => ({ seqState: { ...s.seqState, [leadId]: 'ativa' } })); get().toast('Follow-up retomado'); },
  endSeq: leadId => get().ask(
    'Encerrar sequência?',
    'O lead sai do follow-up automático e não recebe mais mensagens programadas.',
    'Encerrar',
    () => { set(s => ({ seqState: { ...s.seqState, [leadId]: 'encerrada' } })); get().toast('Sequência encerrada'); },
  ),

  setQrFor: nome => set({ qrFor: nome }),
  closeQr: () => set({ qrFor: null }),
  confirmQr: () => { const n = get().qrFor; set(s => ({ qrFor: null, conn: { ...s.conn, [n as string]: true } })); get().toast(n + ' conectado ao WhatsApp'); },
  disconnect: nome => get().ask(
    'Desconectar ' + nome + '?',
    'As mensagens automáticas e o chat deste número param até uma nova conexão.',
    'Desconectar',
    () => { set(s => ({ conn: { ...s.conn, [nome]: false } })); get().toast(nome + ' desconectado do WhatsApp'); },
  ),

  fetchTemplates: () => {
    const token = get().token;
    if (!token) return;
    apiFetch<RemoteTemplate[]>('/api/templates', token)
      .then(templates => set({ templates }))
      .catch(() => get().toast('Nao foi possivel carregar os templates'));
  },
  newTpl: () => {
    const token = get().token;
    if (!token) return;
    apiFetch<RemoteTemplate>('/api/templates', token, {
      method: 'POST',
      body: JSON.stringify({ titulo: 'Novo template', texto: 'Ola {nome}, aqui e {corretor} sobre o {imovel}.' }),
    })
      .then(row => { set(s => ({ templates: [...s.templates, row] })); get().toast('Template criado'); })
      .catch(e => get().toast((e as ApiError).message || 'Nao foi possivel criar o template'));
  },
  updateTpl: (id, patch) => {
    const token = get().token;
    if (!token) return;
    apiFetch<RemoteTemplate>('/api/templates/' + id, token, { method: 'PATCH', body: JSON.stringify(patch) })
      .then(row => set(s => ({ templates: s.templates.map(t => (t.id === id ? row : t)) })))
      .catch(e => get().toast((e as ApiError).message || 'Nao foi possivel salvar'));
  },
  delTpl: id => {
    const t = get().templates.find(x => x.id === id);
    if (!t) return;
    get().ask('Excluir "' + t.titulo + '"?', 'O template sai da sua biblioteca pessoal.', 'Excluir', () => {
      const token = get().token;
      if (!token) return;
      apiFetch('/api/templates/' + id, token, { method: 'DELETE' })
        .then(() => { set(s => ({ templates: s.templates.filter(x => x.id !== id) })); get().toast('Template excluido'); })
        .catch(e => get().toast((e as ApiError).message || 'Nao foi possivel excluir'));
    });
  },

  fetchImoveis: () => {
    const token = get().token;
    if (!token) return;
    apiFetch<RemoteImovel[]>('/api/imoveis', token)
      .then(imoveis => set({ imoveis }))
      .catch(() => get().toast('Nao foi possivel carregar os imoveis'));
  },
  createImovel: async input => {
    const token = get().token;
    if (!token) return false;
    try {
      const row = await apiFetch<RemoteImovel>('/api/imoveis', token, { method: 'POST', body: JSON.stringify(input) });
      set(s => ({ imoveis: [...s.imoveis, row] }));
      get().toast('Imovel cadastrado');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Nao foi possivel cadastrar');
      return false;
    }
  },
  updateImovel: async (id, input) => {
    const token = get().token;
    if (!token) return false;
    try {
      const row = await apiFetch<RemoteImovel>('/api/imoveis/' + id, token, { method: 'PATCH', body: JSON.stringify(input) });
      set(s => ({ imoveis: s.imoveis.map(i => (i.id === id ? row : i)) }));
      get().toast('Imovel atualizado');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Nao foi possivel salvar');
      return false;
    }
  },
  deleteImovel: id => {
    const im = get().imoveis.find(x => x.id === id);
    if (!im) return;
    get().ask('Excluir "' + im.titulo + '"?', 'O imóvel sai do catálogo da imobiliária. Esta ação não pode ser desfeita.', 'Excluir', () => {
      const token = get().token;
      if (!token) return;
      apiFetch('/api/imoveis/' + id, token, { method: 'DELETE' })
        .then(() => { set(s => ({ imoveis: s.imoveis.filter(x => x.id !== id) })); get().toast('Imovel excluido'); })
        .catch(e => get().toast((e as ApiError).message || 'Nao foi possivel excluir'));
    });
  },

  fetchLinksUteis: () => {
    const token = get().token;
    if (!token) return;
    apiFetch<RemoteLinkUtil[]>('/api/links-uteis', token)
      .then(linksUteis => set({ linksUteis }))
      .catch(() => get().toast('Nao foi possivel carregar os links uteis'));
  },
  createLinkUtil: async input => {
    const token = get().token;
    if (!token) return false;
    try {
      const row = await apiFetch<RemoteLinkUtil>('/api/links-uteis', token, { method: 'POST', body: JSON.stringify(input) });
      set(s => ({ linksUteis: [...s.linksUteis, row] }));
      get().toast('Link adicionado');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Nao foi possivel adicionar');
      return false;
    }
  },
  updateLinkUtil: async (id, input) => {
    const token = get().token;
    if (!token) return false;
    try {
      const row = await apiFetch<RemoteLinkUtil>('/api/links-uteis/' + id, token, { method: 'PATCH', body: JSON.stringify(input) });
      set(s => ({ linksUteis: s.linksUteis.map(l => (l.id === id ? row : l)) }));
      get().toast('Link atualizado');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Nao foi possivel salvar');
      return false;
    }
  },
  deleteLinkUtil: id => {
    const l = get().linksUteis.find(x => x.id === id);
    if (!l) return;
    get().ask('Excluir "' + l.titulo + '"?', 'O link sai da biblioteca da imobiliária.', 'Excluir', () => {
      const token = get().token;
      if (!token) return;
      apiFetch('/api/links-uteis/' + id, token, { method: 'DELETE' })
        .then(() => { set(s => ({ linksUteis: s.linksUteis.filter(x => x.id !== id) })); get().toast('Link excluido'); })
        .catch(e => get().toast((e as ApiError).message || 'Nao foi possivel excluir'));
    });
  },

  fetchTreinamentos: () => {
    const token = get().token;
    if (!token) return;
    apiFetch<RemoteTreinamento[]>('/api/treinamentos', token)
      .then(treinamentos => set({ treinamentos }))
      .catch(() => get().toast('Nao foi possivel carregar os treinamentos'));
  },
  createTreinamento: async input => {
    const token = get().token;
    if (!token) return false;
    try {
      const row = await apiFetch<RemoteTreinamento>('/api/treinamentos', token, { method: 'POST', body: JSON.stringify(input) });
      set(s => ({ treinamentos: [...s.treinamentos, row] }));
      get().toast('Treinamento adicionado');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Nao foi possivel adicionar');
      return false;
    }
  },
  updateTreinamento: async (id, input) => {
    const token = get().token;
    if (!token) return false;
    try {
      const row = await apiFetch<RemoteTreinamento>('/api/treinamentos/' + id, token, { method: 'PATCH', body: JSON.stringify(input) });
      set(s => ({ treinamentos: s.treinamentos.map(t => (t.id === id ? row : t)) }));
      get().toast('Treinamento atualizado');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Nao foi possivel salvar');
      return false;
    }
  },
  deleteTreinamento: id => {
    const t = get().treinamentos.find(x => x.id === id);
    if (!t) return;
    get().ask('Excluir "' + t.titulo + '"?', 'O treinamento sai da biblioteca da imobiliária.', 'Excluir', () => {
      const token = get().token;
      if (!token) return;
      apiFetch('/api/treinamentos/' + id, token, { method: 'DELETE' })
        .then(() => { set(s => ({ treinamentos: s.treinamentos.filter(x => x.id !== id) })); get().toast('Treinamento excluido'); })
        .catch(e => get().toast((e as ApiError).message || 'Nao foi possivel excluir'));
    });
  },

  setImportOpen: v => set({ importOpen: v }),
  confirmImport: () => { set({ importOpen: false }); get().toast('24 leads importados para "Lead Novo"'); },

  setAlertMenu: v => set({ alertMenu: v }),
  fireAlert: kind => {
    clearInterval(alertTimer);
    set({ alert: kind, alertCount: 20, alertMenu: false });
    beep();
    if (kind === 'lead') {
      alertTimer = setInterval(() => {
        const c = get().alertCount;
        if (c <= 1) { clearInterval(alertTimer); get().toast('Tempo esgotado — lead devolvido à roleta'); set({ alert: null, alertCount: 20 }); return; }
        set({ alertCount: c - 1 });
      }, 1000);
    }
  },
  closeAlert: () => { clearInterval(alertTimer); set({ alert: null, alertCount: 20 }); },
  alertOk: () => {
    const k = get().alert;
    get().closeAlert();
    if (k === 'lead') get().toast('Atendimento aceito — lead atribuído a você');
    else if (k === 'visita') get().toast('Lembrete enviado no WhatsApp');
    else if (k === 'credito') get().toast('Fila de crédito aberta');
    else if (k === 'tarefa') get().toast('Agenda aberta');
  },
  alertAlt: () => {
    const k = get().alert;
    get().closeAlert();
    if (k === 'lead') get().toast('Lead recusado — devolvido à roleta');
    else if (k === 'visita') get().toast('Visita marcada como confirmada');
    else if (k === 'credito') get().toast('Lembrete adiado por 1 hora');
    else if (k === 'tarefa') get().toast('Lembrete adiado por 30 minutos');
  },

  blockMember: id => {
    const perfil = get().perfisRemotos.find(p => p.id === id);
    if (!perfil) return;
    const token = get().token;
    if (!token) return;
    const executar = () =>
      apiFetch<RemotePerfil>('/api/perfis/' + id + '/bloquear', token, { method: 'PATCH' })
        .then(row => {
          set(s => ({
            perfisRemotos: s.perfisRemotos.map(p => (p.id === id ? row : p)),
            fila: s.fila.map(f => (f.corretorId === id ? { ...f, ativo: row.emPlantao } : f)),
          }));
          get().toast(row.nome + (row.bloqueado ? ' bloqueado (férias/afastado) — saiu da roleta' : ' desbloqueado'));
        })
        .catch(e => get().toast((e as ApiError).message || 'Não foi possível alterar o acesso'));

    if (perfil.bloqueado) { executar(); return; }
    get().ask(
      'Bloquear ' + perfil.nome + '?',
      'O acesso é suspenso e o corretor sai da roleta até ser desbloqueado. Os leads seguem atribuídos a ele.',
      'Bloquear acesso',
      executar,
    );
  },
  revokeMember: nome => get().ask(
    'Remover acesso de ' + nome + '?',
    'O login é revogado, mas o histórico e os leads permanecem no CRM. Ação reversível pelo Dono.',
    'Remover acesso',
    () => get().toast('Acesso de ' + nome + ' removido'),
  ),
  removeMember: (id, nome) => get().ask(
    'Excluir ' + nome + ' definitivamente?',
    'Todo o cadastro é apagado e os leads em atendimento ficam sem corretor atribuído. Esta ação não pode ser desfeita.',
    'Excluir definitivamente',
    () => {
      const token = get().token;
      if (!token) return;
      apiFetch('/api/perfis/' + id, token, { method: 'DELETE' })
        .then(() => {
          set(s => ({ perfisRemotos: s.perfisRemotos.filter(p => p.id !== id), fila: s.fila.filter(f => f.corretorId !== id) }));
          get().toast(nome + ' excluído definitivamente');
        })
        .catch(e => get().toast((e as ApiError).message || 'Não foi possível excluir'));
    },
  ),
  createMember: async input => {
    const token = get().token;
    if (!token) return false;
    try {
      const row = await apiFetch<RemotePerfil>('/api/perfis', token, { method: 'POST', body: JSON.stringify(input) });
      // O próprio socket já pode ter adicionado esse perfil (o servidor emite antes de responder o POST) —
      // por isso os dois lados checam se o id já existe antes de inserir, pra não duplicar.
      set(s => ({
        perfisRemotos: s.perfisRemotos.some(p => p.id === row.id) ? s.perfisRemotos : [...s.perfisRemotos, row],
        fila: row.role === 'corretor' && !s.fila.some(f => f.corretorId === row.id) ? [...s.fila, { corretorId: row.id, nome: row.nome, ativo: false }] : s.fila,
      }));
      get().toast(row.nome + ' convidado — senha padrão 123456');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Não foi possível convidar');
      return false;
    }
  },
  updateMember: async (id, patch) => {
    const token = get().token;
    if (!token) return false;
    try {
      const row = await apiFetch<RemotePerfil>('/api/perfis/' + id, token, { method: 'PATCH', body: JSON.stringify(patch) });
      set(s => ({
        perfisRemotos: s.perfisRemotos.map(p => (p.id === id ? row : p)),
        fila: s.fila.map(f => (f.corretorId === id ? { ...f, nome: row.nome } : f)),
      }));
      get().toast(row.nome + ' atualizado');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Não foi possível atualizar');
      return false;
    }
  },

  setFaqOpen: id => set(s => ({ faqOpen: s.faqOpen === id ? null : id })),
  toggleNotifMenu: () => set(s => ({ notifOpen: !s.notifOpen })),
  fetchNotificacoes: () => {
    const token = get().token;
    if (!token) return;
    apiFetch<RemoteNotificacao[]>('/api/notificacoes', token)
      .then(notificacoes => set({ notificacoes }))
      .catch(() => {});
  },
  marcarNotifLida: id => {
    const token = get().token;
    if (!token) return;
    set(s => ({ notificacoes: s.notificacoes.map(n => (n.id === id ? { ...n, lida: true } : n)) }));
    apiFetch('/api/notificacoes/' + id, token, { method: 'PATCH' }).catch(() => {});
  },
  marcarTodasNotifsLidas: () => {
    const token = get().token;
    if (!token) return;
    set(s => ({ notificacoes: s.notificacoes.map(n => ({ ...n, lida: true })) }));
    apiFetch('/api/notificacoes/marcar-todas', token, { method: 'PATCH' }).catch(() => {});
  },
  savePerfil: () => get().toast('Perfil atualizado'),
  invite: () => get().toast('Convite enviado por e-mail'),
  exportCsv: () => get().toast('Relatório exportado — relatorio-nova-set-2026.csv'),
  addColumn: () => get().toast('Use o botão "Nova coluna" no Kanban'),
  fetchColunas: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const colunas = await apiFetch<RemoteColuna[]>('/api/colunas', token);
      set(s => ({
        colunasRemotas: colunas,
        // reavalia o slug/id de cada lead com as colunas novas
        leads: s.leads.map(l => {
          const c = colunas.find(x => x.id === l.colunaId);
          return c ? { ...l, col: c.slug ?? c.id } : l;
        }),
      }));
    } catch { /* ignore */ }
  },
  criarColuna: async titulo => {
    const token = get().token;
    if (!token || !titulo.trim()) return;
    try {
      const row = await apiFetch<RemoteColuna>('/api/colunas', token, { method: 'POST', body: JSON.stringify({ titulo: titulo.trim() }) });
      set(s => ({ colunasRemotas: [...s.colunasRemotas, row] }));
      get().toast('Coluna "' + row.titulo + '" criada');
    } catch (e) { get().toast((e as ApiError).message || 'Não foi possível criar a coluna'); }
  },
  renomearColuna: async (id, titulo) => {
    const token = get().token;
    if (!token || !titulo.trim()) return;
    try {
      const row = await apiFetch<RemoteColuna>('/api/colunas/' + id, token, { method: 'PATCH', body: JSON.stringify({ titulo: titulo.trim() }) });
      set(s => ({ colunasRemotas: s.colunasRemotas.map(c => (c.id === id ? row : c)) }));
    } catch (e) { get().toast((e as ApiError).message || 'Não foi possível renomear'); }
  },
  excluirColuna: async id => {
    const token = get().token;
    if (!token) return;
    try {
      await apiFetch('/api/colunas/' + id, token, { method: 'DELETE' });
      await get().fetchColunas();
      await get().fetchKanbanData();
      get().toast('Coluna removida — os leads foram pra primeira coluna');
    } catch (e) { get().toast((e as ApiError).message || 'Não foi possível excluir a coluna'); }
  },
  reordenarColunas: async ids => {
    const token = get().token;
    if (!token) return;
    const antes = get().colunasRemotas;
    set({ colunasRemotas: ids.map(id => antes.find(c => c.id === id)).filter(Boolean) as RemoteColuna[] });
    try {
      await apiFetch('/api/colunas', token, { method: 'PATCH', body: JSON.stringify({ ordem: ids }) });
    } catch (e) {
      set({ colunasRemotas: antes });
      get().toast((e as ApiError).message || 'Não foi possível reordenar');
    }
  },
  newLead: () => set({ newLeadOpen: true }),
  setNewLeadOpen: v => set({ newLeadOpen: v }),
  criarLeadManual: async input => {
    const token = get().token;
    if (!token) return false;
    try {
      const colunaId = slugToColunaId('novo', get().colunasRemotas);
      const raw = await apiFetch<RemoteLead>('/api/leads', token, {
        method: 'POST',
        body: JSON.stringify({
          nome: input.nome.trim(),
          telefone: input.telefone.trim(),
          ...(input.email?.trim() ? { email: input.email.trim() } : {}),
          canal: input.canal,
          ...(colunaId ? { colunaId } : {}),
          ...(input.corretorId ? { corretorId: input.corretorId } : {}),
        }),
      });
      const mapped = mapRemoteLead(raw, get().colunasRemotas, get().perfisRemotos);
      set(s => ({ leads: s.leads.some(l => l.id === mapped.id) ? s.leads : [...s.leads, mapped], newLeadOpen: false }));
      get().toast(input.nome.trim() + ' adicionado em "Lead Novo"');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Não foi possível criar o lead');
      return false;
    }
  },
  excluirLead: async id => {
    const token = get().token;
    if (!token) return false;
    const nome = get().leads.find(l => l.id === id)?.nome || 'Lead';
    try {
      await apiFetch('/api/leads/' + id, token, { method: 'DELETE' });
      set(s => ({
        leads: s.leads.filter(l => l.id !== id),
        conversas: s.conversas.filter(c => c.leadId !== id),
        leadId: s.leadId === id ? null : s.leadId,
      }));
      get().toast(nome + ' excluído do CRM');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Não foi possível excluir');
      return false;
    }
  },
  limparConversa: async id => {
    const token = get().token;
    if (!token) return false;
    try {
      await apiFetch('/api/leads/' + id + '/conversa', token, { method: 'DELETE' });
      set(s => {
        const chats = { ...s.chats }; delete chats[id];
        return { chats, conversas: s.conversas.filter(c => c.leadId !== id) };
      });
      get().toast('Conversa apagada');
      return true;
    } catch (e) {
      get().toast((e as ApiError).message || 'Não foi possível apagar a conversa');
      return false;
    }
  },
  advance: id => {
    const { leads, colunasRemotas } = get();
    const l = leads.find(x => x.id === id);
    if (!l) return;
    const i = colunasRemotas.findIndex(c => c.id === l.colunaId);
    const proxima = colunasRemotas[i + 1];
    // não avança pra "rebatida" automaticamente (é descarte, não progresso)
    if (proxima && proxima.slug !== 'rebatida') get().move(id, proxima.id);
  },
  askDiscard: (id, nome) => get().ask(
    'Descartar ' + nome + '?',
    'O lead vai para o bolsão de rebatidas e a sequência de follow-up é interrompida.',
    'Descartar lead',
    () => { get().moverPorSlug(id, 'rebatida'); set({ leadId: null }); },
  ),
  goDay: n => set({ day: n }),
}));
