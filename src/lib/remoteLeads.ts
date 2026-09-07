import { COLS, type ColId, type Lead } from './data';

export interface RemoteColuna { id: string; titulo: string; ordem: number; cor: string | null; slug: string | null }
export interface RemotePerfil { id: string; nome: string; email: string; role: string; telefone: string | null; bloqueado: boolean; emPlantao: boolean; roletaIds?: string[] }
export interface RemoteLead {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  fotoUrl: string | null;
  imovelTitulo: string | null;
  imovelSub: string | null;
  valor: string | null;
  canal: string;
  colunaId: string | null;
  corretorId: string | null;
  campanha: string | null;
  segundoCadastro: boolean;
  cadencia: string | null;
  motivoDescarte: string | null;
  rendaDeclarada: string | null;
  entrouNaColunaEm: string;
  criadoEm: string;
  tagIds?: string[];
}

const CANAL_LABEL: Record<string, string> = { Indicacao: 'Indicação' };

/** slug da coluna de sistema, ou o próprio id quando a coluna é customizada (sem slug). */
export function colToSemantico(colunaId: string | null, colunas: RemoteColuna[]): string {
  const c = colunas.find(x => x.id === colunaId);
  return c?.slug ?? colunaId ?? 'novo';
}

/** id real da coluna que tem esse slug de sistema (pra ações tipo "descartar" = mandar pra 'rebatida'). */
export function slugToColunaId(slug: ColId, colunas: RemoteColuna[]): string | undefined {
  return colunas.find(c => c.slug === slug)?.id
    ?? colunas.find(c => c.titulo === COLS.find(x => x.id === slug)?.title)?.id;
}

export function mapRemoteLead(r: RemoteLead, colunas: RemoteColuna[], perfis: RemotePerfil[]): Lead {
  const dias = Math.max(0, Math.floor((Date.now() - new Date(r.entrouNaColunaEm).getTime()) / 86400000));
  return {
    id: r.id,
    nome: r.nome,
    tel: r.telefone,
    email: r.email ?? '',
    foto: r.fotoUrl ?? '',
    imovel: r.imovelTitulo ?? '',
    imovelSub: r.imovelSub ?? '',
    valor: r.valor ? Number(r.valor) : 0,
    canal: CANAL_LABEL[r.canal] ?? r.canal,
    colunaId: r.colunaId ?? '',
    col: colToSemantico(r.colunaId, colunas),
    dias,
    segundo: r.segundoCadastro,
    cadencia: r.cadencia ?? '',
    corretor: perfis.find(p => p.id === r.corretorId)?.nome ?? '',
    campanha: r.campanha ?? '',
    motivo: r.motivoDescarte ?? '',
    renda: r.rendaDeclarada ? Number(r.rendaDeclarada) : 0,
    entrouNaColunaEm: r.entrouNaColunaEm,
    tags: r.tagIds ?? [],
  };
}
