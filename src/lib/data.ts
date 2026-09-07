import { dayLabel, stamp, stripAccents } from './format';

export type Role = 'Dono' | 'Gerente' | 'Corretor';
/** Slugs das colunas "de sistema" — outras telas (Dashboard, Crédito, Bolsão, roleta) dependem
 *  desses nomes fixos. Colunas criadas pelo usuário não têm slug. */
export type ColId = 'novo' | 'atend' | 'credito' | 'visita' | 'proposta' | 'venda' | 'rebatida';

export interface Col {
  id: ColId;
  title: string;
  color: string;
}

/** Catálogo das colunas de sistema (título e cor padrão). O Kanban de verdade é montado a
 *  partir das colunas do banco (colunasRemotas); isto aqui é só referência/seed. */
export const COLS: Col[] = [
  { id: 'novo', title: 'Lead Novo', color: 'var(--muted)' },
  { id: 'atend', title: 'Em Atendimento', color: 'var(--terra)' },
  { id: 'credito', title: 'Análise de Crédito', color: 'var(--terra)' },
  { id: 'visita', title: 'Visita Agendada', color: 'var(--terra)' },
  { id: 'proposta', title: 'Proposta', color: 'var(--terra)' },
  { id: 'venda', title: 'Venda Concluída', color: 'var(--olive)' },
  { id: 'rebatida', title: 'Rebatida', color: 'var(--muted)' },
];

export interface Corretor {
  nome: string;
  cargo: string;
  leads: number;
  conv: string;
  resp: string;
  vgv: number;
  bloqueado: boolean;
  motivo: string;
}

export const CORRETORES: Corretor[] = [
  { nome: 'Eduardo Marins', cargo: 'Dono', leads: 12, conv: '25%', resp: '9 min', vgv: 3200000, bloqueado: false, motivo: '' },
  { nome: 'Camila Rocha', cargo: 'Gerente', leads: 68, conv: '22%', resp: '6 min', vgv: 8420000, bloqueado: false, motivo: '' },
  { nome: 'Diego Antunes', cargo: 'Corretor', leads: 74, conv: '19%', resp: '11 min', vgv: 6980000, bloqueado: false, motivo: '' },
  { nome: 'Fernanda Lopes', cargo: 'Corretora', leads: 61, conv: '24%', resp: '4 min', vgv: 6310000, bloqueado: false, motivo: '' },
  { nome: 'Marcelo Braga', cargo: 'Corretor', leads: 52, conv: '15%', resp: '18 min', vgv: 4120000, bloqueado: true, motivo: 'Férias' },
  { nome: 'Priscila Nunes', cargo: 'Corretora', leads: 47, conv: '17%', resp: '9 min', vgv: 3870000, bloqueado: false, motivo: '' },
  { nome: 'Rafael Teixeira', cargo: 'Corretor', leads: 39, conv: '12%', resp: '23 min', vgv: 2450000, bloqueado: false, motivo: '' },
];

export const IMOVEIS: [string, string, number][] = [
  ['Edifício Aurora — Cobertura 1201', 'Itaim Bibi, São Paulo · 248 m²', 4200000],
  ['Vila Serena — Casa 14', 'Cambuí, Campinas · 190 m²', 1850000],
  ['Residencial Mirante — Apto 803', 'Vila Mariana, São Paulo · 112 m²', 1290000],
  ['Praia Grande Tower — Apto 1502', 'Gonzaga, Santos · 96 m²', 980000],
  ['Aurora — Garden 102', 'Itaim Bibi, São Paulo · 165 m²', 3100000],
  ['Quinta do Bosque — Lote 27', 'Sousas, Campinas · 620 m²', 740000],
];

export const NOMES = [
  'Beatriz Aguiar', 'Henrique Sampaio', 'Lucia Ferrari', 'Tiago Meireles', 'Renata Palhares', 'Otávio Bandeira',
  'Sofia Krause', 'Danilo Vasques', 'Mariana Prado', 'Eduardo Bastos', 'Clarice Nogueira', 'Vitor Assunção',
  'Helena Cordeiro', 'Bruno Salgado', 'Larissa Cunha', 'Gustavo Peixoto', 'Isabel Camargo', 'Rodrigo Vilela',
  'Tatiana Bruno', 'Alexandre Pires', 'Juliana Moraes', 'Felipe Andrade', 'Carolina Vieira', 'Sérgio Bezerra',
  'Natália Fontes', 'Leandro Rios', 'Débora Arantes', 'Caio Monteiro',
];

export const CANAIS = ['WhatsApp', 'Instagram', 'Facebook', 'Indicação', 'Manual'];
export const MOTIVOS = ['Sem resposta', 'Fora do perfil', 'Duplicado', 'Corretor removido'];
export const MOTIVOS_DESCARTE = ['Sem Resposta', 'Não tem Interesse', 'Fora do Perfil', 'Contato Errado', 'Descadastrar', 'Já Comprou'];
export const APROVACAO = ['Descadastrar', 'Já Comprou'];
export const CADENCIAS = ['Chamada 1', 'Chamada 2', 'Chamada 3', 'Aguardando retorno', 'Sem contato'];

export interface Lead {
  id: string;
  nome: string;
  tel: string;
  email: string;
  foto: string;
  colunaId: string;
  imovel: string;
  imovelSub: string;
  valor: number;
  canal: string;
  /** slug da coluna de sistema, OU o id da coluna quando for uma coluna customizada sem slug */
  col: string;
  dias: number;
  segundo: boolean;
  cadencia: string;
  corretor: string;
  campanha: string;
  motivo: string;
  renda: number;
  entrouNaColunaEm?: string;
  tags: string[];
}

export function buildLeads(): Lead[] {
  const dist: ColId[] = [
    'novo', 'novo', 'novo', 'novo', 'novo',
    'atend', 'atend', 'atend', 'atend', 'atend', 'atend',
    'credito', 'credito', 'credito',
    'visita', 'visita', 'visita', 'visita',
    'proposta', 'proposta', 'proposta',
    'venda', 'venda', 'venda', 'venda',
    'rebatida', 'rebatida', 'rebatida',
  ];
  return NOMES.map((nome, i) => {
    const im = IMOVEIS[i % IMOVEIS.length];
    return {
      id: 'L' + (100 + i),
      nome,
      foto: '',
      tel: '(11) 9' + (8000 + i * 37) + '-' + (1000 + i * 13),
      email: stripAccents(nome.toLowerCase()).replace(/ /g, '.') + '@email.com',
      imovel: im[0], imovelSub: im[1], valor: im[2],
      canal: CANAIS[i % CANAIS.length], col: dist[i], colunaId: dist[i], dias: (i * 3) % 11,
      segundo: i % 7 === 0, cadencia: '', corretor: CORRETORES[i % CORRETORES.length].nome,
      campanha: i % 2 ? 'Aurora — Lançamento' : 'Vila Serena — Fase 2',
      motivo: MOTIVOS[i % MOTIVOS.length], renda: 9000 + (i % 6) * 4200,
      tags: [],
    };
  });
}

export type AnexoTipo = 'imagem' | 'video' | 'documento' | 'audio';

export interface ChatMsg {
  id: string;
  side: 'in' | 'out';
  texto: string;
  hora: string;
  bot?: boolean;
  off?: number;
  anexoUrl?: string | null;
  anexoTipo?: AnexoTipo | null;
  anexoNome?: string | null;
  /** "visto" do WhatsApp: 1 enviando, 2 servidor, 3 entregue, 4 lido, 5 reproduzido. */
  ack?: number;
}

export interface MappedMsg {
  id: string; texto: string; hora: string; stamp: string; sep: boolean; sepLabel: string; bot: boolean;
  rowStyle: string; bubbleStyle: string; anexoUrl?: string | null; anexoTipo?: AnexoTipo | null; anexoNome?: string | null;
  /** "visto" só nas mensagens enviadas: '' | '✓' (enviada) | '✓✓' (entregue) | '✓✓ azul' (lida). */
  visto: '' | 'enviado' | 'entregue' | 'lido';
}

export function mapMsgs(arr: ChatMsg[]): MappedMsg[] {
  let prev: string | null = null;
  return arr.map(m => {
    const off = m.off == null ? 0 : m.off;
    const lab = dayLabel(off);
    const sep = lab !== prev;
    prev = lab;
    const visto: MappedMsg['visto'] = m.side !== 'out' ? ''
      : (m.ack ?? 0) >= 4 ? 'lido' : (m.ack ?? 0) === 3 ? 'entregue' : 'enviado';
    return {
      id: m.id, texto: m.texto, hora: m.hora, stamp: stamp(off, m.hora), sep, sepLabel: lab, bot: !!m.bot,
      anexoUrl: m.anexoUrl, anexoTipo: m.anexoTipo, anexoNome: m.anexoNome, visto,
      rowStyle: 'display:flex;justify-content:' + (m.side === 'out' ? 'flex-end' : 'flex-start'),
      bubbleStyle: 'max-width:72%;padding:11px 14px;border-radius:12px;font-size:13.5px;line-height:1.55;' +
        (m.bot ? 'background:#4B3B7A;color:#fff' : m.side === 'out' ? 'background:var(--terra);color:#fff' : 'background:var(--bg);border:1px solid var(--line)'),
    };
  });
}

export const ROLETA_LOG: [string, string, string, string][] = [
  ['05 set · 09:12', 'Beatriz Aguiar', 'Camila Rocha', 'Roleta automática'],
  ['05 set · 08:47', 'Henrique Sampaio', 'Diego Antunes', 'Roleta automática'],
  ['04 set · 18:20', 'Lucia Ferrari', 'Fernanda Lopes', '+ Mais Rebatidas'],
  ['04 set · 16:05', 'Tiago Meireles', 'Priscila Nunes', 'Roleta automática'],
  ['04 set · 11:38', 'Renata Palhares', 'Diego Antunes', '+ Mais Rebatidas'],
  ['03 set · 15:51', 'Otávio Bandeira', 'Camila Rocha', 'Roleta automática'],
  ['03 set · 10:14', 'Sofia Krause', 'Rafael Teixeira', 'Roleta automática'],
  ['02 set · 17:29', 'Danilo Vasques', 'Fernanda Lopes', '+ Mais Rebatidas'],
];

export const SLASH: [string, string][] = [
  ['/tabela', 'Acabei de te enviar a tabela de valores atualizada. Qualquer dúvida, me chama.'],
  ['/visita', 'Passando para confirmar nossa visita — consegue no horário combinado?'],
  ['/docs', 'Para adiantar a análise, me envia RG, CPF e comprovante de renda?'],
  ['/proposta', 'Montei uma proposta com a condição de entrada desta semana. Posso te ligar para explicar?'],
];

