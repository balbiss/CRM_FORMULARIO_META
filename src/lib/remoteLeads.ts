import { COLS, type ColId, type Lead } from './data';

export interface RemoteColuna { id: string; titulo: string; ordem: number; cor: string | null }
export interface RemotePerfil { id: string; nome: string; email: string; role: string; telefone: string | null; bloqueado: boolean; emPlantao: boolean }
export interface RemoteLead {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  imovelTitulo: string | null;
  imovelSub: string | null;
  valor: string | null;
  canal: string;
  colunaId: string | null;
  corretorId: string | null;
  campanha: string | null;
  segundoCadastro: boolean;
  motivoDescarte: string | null;
  rendaDeclarada: string | null;
  entrouNaColunaEm: string;
  criadoEm: string;
}

const CANAL_LABEL: Record<string, string> = { Indicacao: 'Indicação' };

/** Colunas do backend são criadas com os MESMOS títulos de COLS (ver seed) — casamos por título
 * pra manter o resto do app (Kanban, Dashboard, Bolsão etc.) funcionando com o mesmo ColId de sempre. */
export function colIdToSlug(colunaId: string | null, colunas: RemoteColuna[]): ColId {
  const titulo = colunas.find(c => c.id === colunaId)?.titulo;
  return (COLS.find(c => c.title === titulo)?.id ?? 'novo') as ColId;
}

export function slugToColunaId(slug: ColId, colunas: RemoteColuna[]): string | undefined {
  const titulo = COLS.find(c => c.id === slug)?.title;
  return colunas.find(c => c.titulo === titulo)?.id;
}

export function mapRemoteLead(r: RemoteLead, colunas: RemoteColuna[], perfis: RemotePerfil[]): Lead {
  const dias = Math.max(0, Math.floor((Date.now() - new Date(r.entrouNaColunaEm).getTime()) / 86400000));
  return {
    id: r.id,
    nome: r.nome,
    tel: r.telefone,
    email: r.email ?? '',
    imovel: r.imovelTitulo ?? '',
    imovelSub: r.imovelSub ?? '',
    valor: r.valor ? Number(r.valor) : 0,
    canal: CANAL_LABEL[r.canal] ?? r.canal,
    col: colIdToSlug(r.colunaId, colunas),
    dias,
    segundo: r.segundoCadastro,
    corretor: perfis.find(p => p.id === r.corretorId)?.nome ?? '',
    campanha: r.campanha ?? '',
    motivo: r.motivoDescarte ?? '',
    renda: r.rendaDeclarada ? Number(r.rendaDeclarada) : 0,
    entrouNaColunaEm: r.entrouNaColunaEm,
  };
}
