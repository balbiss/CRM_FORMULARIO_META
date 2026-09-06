import { create } from 'zustand';
import { apiFetch, type ApiError } from '../lib/api';

const TOKEN_KEY = 'vi_plat_token';

export type ImobStatus = 'ativa' | 'bloqueada';
export type PagamentoMetodo = 'pix' | 'boleto' | 'cartao' | 'transferencia' | 'dinheiro' | 'outro';

export interface AdminPlataforma { id: string; nome: string; email: string }

export interface ImobiliariaRow {
  id: string;
  nome: string;
  status: ImobStatus;
  bloqueioMotivo: 'manual' | 'inadimplencia' | null;
  plano: string;
  mensalidade: number;
  limiteCorretores: number;
  corretoresUsados: number;
  leads: number;
  proximoVencimento: string | null;
  diasCarencia: number;
  diasParaVencer: number | null;
  ultimoPagamento: string | null;
  criadoEm: string;
}

export interface Resumo {
  totalImobiliarias: number;
  ativas: number;
  bloqueadas: number;
  vencendo7Dias: number;
  vencidas: number;
  mrr: number;
  totalCorretores: number;
  totalLeads: number;
}

export interface PagamentoRow {
  id: string; valor: number; competencia: string; pagoEm: string;
  metodo: PagamentoMetodo; observacao: string | null; criadoEm: string;
}

export interface ImobiliariaDetalhe extends Omit<ImobiliariaRow, 'corretoresUsados' | 'diasParaVencer' | 'ultimoPagamento' | 'bloqueioMotivo'> {
  bloqueioMotivo: 'manual' | 'inadimplencia' | null;
  observacoes: string | null;
  corretores: number;
  equipe: Array<{ id: string; nome: string; email: string; role: string; bloqueado: boolean }>;
  pagamentos: PagamentoRow[];
}

export interface NovaImobiliariaInput {
  nome: string;
  plano: string;
  mensalidade: number;
  limiteCorretores: number;
  diasCarencia: number;
  primeiroVencimento?: string;
  donoNome: string;
  donoEmail: string;
}

interface PlataformaState {
  token: string | null;
  admin: AdminPlataforma | null;
  authLoading: boolean;
  authError: string | null;

  resumo: Resumo | null;
  imobiliarias: ImobiliariaRow[];
  loading: boolean;

  hydrate: () => void;
  login: (email: string, senha: string) => Promise<boolean>;
  logout: () => void;

  carregar: () => Promise<void>;
  criarImobiliaria: (input: NovaImobiliariaInput) => Promise<{ nome: string; email: string; senhaTemporaria: string }>;
  detalhe: (id: string) => Promise<ImobiliariaDetalhe>;
  editar: (id: string, patch: Partial<NovaImobiliariaInput> & { proximoVencimento?: string | null; observacoes?: string | null }) => Promise<void>;
  bloquear: (id: string) => Promise<void>;
  liberar: (id: string) => Promise<void>;
  registrarPagamento: (id: string, p: { valor: number; competencia: string; pagoEm?: string; metodo: PagamentoMetodo; observacao?: string }) => Promise<{ reativada: boolean; proximoVencimento: string }>;
  excluirPagamento: (id: string, pid: string) => Promise<void>;
  resetSenhaDono: (id: string) => Promise<{ email: string; senhaTemporaria: string }>;
}

export const usePlataformaStore = create<PlataformaState>((set, get) => ({
  token: null,
  admin: null,
  authLoading: false,
  authError: null,
  resumo: null,
  imobiliarias: [],
  loading: false,

  hydrate: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    set({ token });
    apiFetch<AdminPlataforma>('/api/plataforma/me', token)
      .then(admin => { set({ admin }); get().carregar(); })
      .catch(() => { localStorage.removeItem(TOKEN_KEY); set({ token: null, admin: null }); });
  },

  login: async (email, senha) => {
    set({ authLoading: true, authError: null });
    try {
      const data = await apiFetch<{ token: string; admin: AdminPlataforma }>('/api/plataforma/login', null, {
        method: 'POST', body: JSON.stringify({ email, senha }),
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      set({ token: data.token, admin: data.admin, authLoading: false });
      get().carregar();
      return true;
    } catch (e) {
      set({ authError: (e as ApiError).message || 'Não foi possível entrar', authLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, admin: null, resumo: null, imobiliarias: [] });
  },

  carregar: async () => {
    const { token } = get();
    if (!token) return;
    set({ loading: true });
    try {
      const [resumo, imobiliarias] = await Promise.all([
        apiFetch<Resumo>('/api/plataforma/resumo', token),
        apiFetch<ImobiliariaRow[]>('/api/plataforma/imobiliarias', token),
      ]);
      set({ resumo, imobiliarias, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  criarImobiliaria: async (input) => {
    const { token } = get();
    const r = await apiFetch<{ dono: { nome: string; email: string; senhaTemporaria: string } }>(
      '/api/plataforma/imobiliarias', token, { method: 'POST', body: JSON.stringify(input) },
    );
    await get().carregar();
    return { nome: r.dono.nome, email: r.dono.email, senhaTemporaria: r.dono.senhaTemporaria };
  },

  detalhe: async (id) => apiFetch<ImobiliariaDetalhe>('/api/plataforma/imobiliarias/' + id, get().token),

  editar: async (id, patch) => {
    await apiFetch('/api/plataforma/imobiliarias/' + id, get().token, { method: 'PATCH', body: JSON.stringify(patch) });
    await get().carregar();
  },

  bloquear: async (id) => {
    await apiFetch('/api/plataforma/imobiliarias/' + id + '/bloquear', get().token, { method: 'POST' });
    await get().carregar();
  },

  liberar: async (id) => {
    await apiFetch('/api/plataforma/imobiliarias/' + id + '/liberar', get().token, { method: 'POST' });
    await get().carregar();
  },

  registrarPagamento: async (id, p) => {
    const r = await apiFetch<{ reativada: boolean; proximoVencimento: string }>(
      '/api/plataforma/imobiliarias/' + id + '/pagamentos', get().token, { method: 'POST', body: JSON.stringify(p) },
    );
    await get().carregar();
    return r;
  },

  excluirPagamento: async (id, pid) => {
    await apiFetch('/api/plataforma/imobiliarias/' + id + '/pagamentos/' + pid, get().token, { method: 'DELETE' });
    await get().carregar();
  },

  resetSenhaDono: async (id) => {
    const r = await apiFetch<{ email: string; senhaTemporaria: string }>(
      '/api/plataforma/imobiliarias/' + id + '/reset-senha-dono', get().token, { method: 'POST' },
    );
    return r;
  },
}));
