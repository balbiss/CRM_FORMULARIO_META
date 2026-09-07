import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Mic, Image as ImageIcon, FileText, Trash2, ArrowUp, ArrowDown, Plus, Upload } from 'lucide-react';
import { useAppStore, type RemoteFluxo, type RemotePassoFluxo, type PassoTipo } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { uploadArquivo } from '../lib/upload';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const TIPOS: { v: PassoTipo; label: string; Icon: typeof MessageSquare }[] = [
  { v: 'texto', label: 'Texto', Icon: MessageSquare },
  { v: 'audio', label: 'Áudio', Icon: Mic },
  { v: 'imagem', label: 'Imagem', Icon: ImageIcon },
  { v: 'pdf', label: 'PDF', Icon: FileText },
];

const fmtMin = (m: number) => {
  if (m <= 0) return 'na hora';
  if (m < 60) return m + ' min';
  if (m % 1440 === 0) return (m / 1440) + (m / 1440 > 1 ? ' dias' : ' dia');
  if (m % 60 === 0) return (m / 60) + (m / 60 > 1 ? ' horas' : ' hora');
  return m + ' min';
};
const hhmm = (min: number) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
const minDe = (hhmmStr: string) => { const [h, m] = hhmmStr.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, boxSizing: 'border-box' };
const iconBtn: React.CSSProperties = { border: '1px solid var(--line)', background: 'var(--card)', width: 28, height: 28, borderRadius: 7, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' };

const ACCEPT: Record<PassoTipo, string> = { texto: '', audio: 'audio/*', imagem: 'image/*', pdf: 'application/pdf' };

function PassoAnexo({ passo, onChange }: { passo: RemotePassoFluxo; onChange: (p: Partial<RemotePassoFluxo>) => void }) {
  const token = useAppStore(s => s.token);
  const toast = useAppStore(s => s.toast);
  const ref = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function subir(file: File) {
    if (!token) return;
    setEnviando(true);
    try {
      const { url, nome } = await uploadArquivo(file, token);
      onChange({ anexoUrl: url, anexoNome: nome });
    } catch (e) {
      toast((e as Error).message || 'Falha no upload');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ marginBottom: 6 }}>
      <input ref={ref} type="file" accept={ACCEPT[passo.tipo]} hidden onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); e.currentTarget.value = ''; }} />
      {passo.anexoUrl ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)' }}>
          <FileText size={13} style={{ flex: 'none', color: 'var(--muted)' }} />
          <a href={passo.anexoUrl} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--terra)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{passo.anexoNome || 'arquivo'}</a>
          <button type="button" onClick={() => ref.current?.click()} style={{ border: '1px solid var(--line)', background: 'none', borderRadius: 6, fontSize: 11.5, padding: '4px 8px' }}>Trocar</button>
          <button type="button" onClick={() => onChange({ anexoUrl: null, anexoNome: null })} style={{ border: 'none', background: 'none', color: 'var(--terra)', fontSize: 11.5 }}>Remover</button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={enviando} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center', padding: '10px', border: '1px dashed var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
          <Upload size={13} /> {enviando ? 'Enviando…' : 'Enviar ' + (passo.tipo === 'imagem' ? 'imagem' : passo.tipo === 'audio' ? 'áudio' : 'PDF')}
        </button>
      )}
    </div>
  );
}

interface Rascunho {
  nome: string; ativo: boolean; disparaEmLeadNovo: boolean;
  janelaInicioMin: number; janelaFimMin: number; janelaDias: boolean[];
  aoEsgotar: 'nada' | 'descartar' | 'mover'; aoEsgotarColunaId: string | null;
  passos: RemotePassoFluxo[];
}
const doFluxo = (f: RemoteFluxo): Rascunho => ({
  nome: f.nome, ativo: f.ativo, disparaEmLeadNovo: f.disparaEmLeadNovo,
  janelaInicioMin: f.janelaInicioMin, janelaFimMin: f.janelaFimMin,
  janelaDias: Array.isArray(f.janelaDias) && f.janelaDias.length === 7 ? [...f.janelaDias] : [false, true, true, true, true, true, false],
  aoEsgotar: f.aoEsgotar, aoEsgotarColunaId: f.aoEsgotarColunaId,
  passos: f.passos.map(p => ({ ...p })),
});

export default function Followup() {
  const { isManager, meNome } = useRoleInfo();
  const fluxos = useAppStore(s => s.fluxos);
  const execucoes = useAppStore(s => s.execucoesFollowup);
  const perfis = useAppStore(s => s.perfisRemotos);
  const colunas = useAppStore(s => s.colunasRemotas);
  const criarFluxo = useAppStore(s => s.criarFluxo);
  const atualizarFluxo = useAppStore(s => s.atualizarFluxo);
  const salvarPassos = useAppStore(s => s.salvarPassos);
  const excluirFluxo = useAppStore(s => s.excluirFluxo);
  const mudarExecucao = useAppStore(s => s.mudarExecucao);
  const fetchFollowup = useAppStore(s => s.fetchFollowup);
  const openLead = useAppStore(s => s.openLead);
  const ask = useAppStore(s => s.ask);

  useEffect(() => { fetchFollowup(); }, [fetchFollowup]);

  const corretores = useMemo(() => perfis.filter(p => p.role === 'corretor'), [perfis]);
  const [aba, setAba] = useState<'fluxos' | 'andamento'>('fluxos');
  const [corretorSel, setCorretorSel] = useState<string>('');
  const meId = perfis.find(p => p.nome === meNome)?.id;
  const corretorAtivo = isManager ? corretorSel : (meId ?? '');

  const fluxosDoCorretor = fluxos.filter(f => (isManager ? (corretorAtivo ? f.corretorId === corretorAtivo : true) : f.corretorId === meId));
  const [fluxoIdSel, setFluxoIdSel] = useState<string | null>(null);
  const fluxo = fluxos.find(f => f.id === fluxoIdSel) ?? fluxosDoCorretor[0] ?? null;

  const [rasc, setRasc] = useState<Rascunho | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setRasc(fluxo ? doFluxo(fluxo) : null); setDirty(false); }, [fluxo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [novoNome, setNovoNome] = useState('');
  const patch = (p: Partial<Rascunho>) => { setRasc(r => (r ? { ...r, ...p } : r)); setDirty(true); };
  const patchPasso = (i: number, p: Partial<RemotePassoFluxo>) => {
    setRasc(r => (r ? { ...r, passos: r.passos.map((x, j) => (j === i ? { ...x, ...p } : x)) } : r));
    setDirty(true);
  };
  const moverPasso = (i: number, dir: -1 | 1) => {
    setRasc(r => {
      if (!r) return r;
      const j = i + dir;
      if (j < 0 || j >= r.passos.length) return r;
      const passos = [...r.passos];
      [passos[i], passos[j]] = [passos[j], passos[i]];
      return { ...r, passos };
    });
    setDirty(true);
  };
  const addPasso = () => {
    patch({
      passos: [...(rasc?.passos ?? []), {
        tipo: 'texto', conteudo: 'Oi {{primeiro_nome}}, aqui é o {{corretor}}. ',
        atrasoMinutos: rasc?.passos.length ? 1440 : 0, atrasoTexto: rasc?.passos.length ? '1 dia' : 'na hora',
        cadenciaLabel: 'Chamada ' + ((rasc?.passos.length ?? 0) + 1), anexoUrl: null, anexoNome: null,
      }],
    });
  };

  async function salvar() {
    if (!fluxo || !rasc) return;
    await atualizarFluxo(fluxo.id, {
      nome: rasc.nome, ativo: rasc.ativo, disparaEmLeadNovo: rasc.disparaEmLeadNovo,
      janelaInicioMin: rasc.janelaInicioMin, janelaFimMin: rasc.janelaFimMin, janelaDias: rasc.janelaDias,
      aoEsgotar: rasc.aoEsgotar, aoEsgotarColunaId: rasc.aoEsgotar === 'mover' ? rasc.aoEsgotarColunaId : null,
    });
    await salvarPassos(fluxo.id, rasc.passos.map(p => ({
      ...p,
      atrasoMinutos: Math.max(0, Math.round(p.atrasoMinutos)),
      atrasoTexto: fmtMin(Math.max(0, Math.round(p.atrasoMinutos))),
    })));
    setDirty(false);
  }

  async function criar() {
    if (!novoNome.trim()) return;
    const alvo = isManager ? (corretorAtivo || undefined) : meId;
    const f = await criarFluxo(novoNome.trim(), alvo);
    setNovoNome('');
    if (f) setFluxoIdSel(f.id);
  }

  const pill = (txt: string, on: boolean) => (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 20, background: on ? 'var(--terraSoft)' : 'var(--bg)', color: on ? 'var(--terra)' : 'var(--muted)', border: '1px solid ' + (on ? 'transparent' : 'var(--line)') }}>{txt}</span>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Automação</p>
        <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Follow-up Automático</h1>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '6px 0 0', maxWidth: 640, lineHeight: 1.5 }}>
          Cada corretor monta as próprias réguas. A que estiver marcada como “disparar em lead novo” começa sozinha
          quando um lead cai pra ele — checando antes se o número existe no WhatsApp. Quando o lead responde, a régua pausa.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 22, borderBottom: '1px solid var(--line)', marginBottom: 18 }}>
        {(['fluxos', 'andamento'] as const).map(t => (
          <button key={t} onClick={() => setAba(t)} style={{ padding: '0 0 12px', border: 'none', background: 'none', fontSize: 13.5, fontWeight: aba === t ? 700 : 500, color: aba === t ? 'var(--ink)' : 'var(--muted)', borderBottom: '2px solid ' + (aba === t ? 'var(--terra)' : 'transparent'), marginBottom: -1 }}>
            {t === 'fluxos' ? 'Meus fluxos' : 'Em andamento' + (execucoes.length ? ' (' + execucoes.length + ')' : '')}
          </button>
        ))}
      </div>

      {aba === 'andamento' ? (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
          {execucoes.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '13px 18px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
              <button onClick={() => openLead(e.leadId)} style={{ border: 'none', background: 'none', textAlign: 'left', padding: 0, flex: 1, minWidth: 160 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{e.leadNome}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{e.fluxoNome}{e.corretorNome ? ' · ' + e.corretorNome : ''}</span>
              </button>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>passo {Math.min(e.passoAtual + 1, e.totalPassos)}/{e.totalPassos}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)', minWidth: 130 }}>
                {e.status === 'pausada' ? (e.motivoFim || 'pausado')
                  : e.proximoEnvioEm ? 'próx. ' + new Date(e.proximoEnvioEm).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', padding: '3px 8px', borderRadius: 20, background: e.status === 'ativa' ? 'var(--oliveSoft)' : 'var(--terraSoft)', color: e.status === 'ativa' ? 'var(--olive)' : 'var(--terra)' }}>{e.status}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {e.status === 'ativa'
                  ? <button onClick={() => mudarExecucao(e.id, 'pausada')} style={{ ...iconBtn, width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 600 }}>Pausar</button>
                  : <button onClick={() => mudarExecucao(e.id, 'ativa')} style={{ ...iconBtn, width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 600, color: 'var(--olive)', borderColor: 'var(--olive)' }}>Retomar</button>}
                <button onClick={() => ask('Encerrar follow-up?', e.leadNome + ' sai da régua e não recebe mais mensagens programadas.', 'Encerrar', () => mudarExecucao(e.id, 'encerrada'))} style={{ ...iconBtn, width: 'auto', padding: '0 10px', fontSize: 12, color: 'var(--terra)' }}>Encerrar</button>
              </div>
            </div>
          ))}
          {execucoes.length === 0 && <p style={{ padding: '30px 18px', textAlign: 'center', fontSize: 13, color: 'var(--muted)', margin: 0 }}>Nenhum lead em follow-up agora.</p>}
        </div>
      ) : (
        <div className="split-pane" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14, alignItems: 'start' }}>
          <div className="split-aside" style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 78 }}>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 14 }}>
              {isManager && (
                <>
                  <label style={fieldLabel}>Corretor</label>
                  <select value={corretorAtivo} onChange={e => { setCorretorSel(e.target.value); setFluxoIdSel(null); }} style={{ ...inp, marginBottom: 12 }}>
                    <option value="">Todos</option>
                    {corretores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </>
              )}
              <p style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 8px' }}>Fluxos</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {fluxosDoCorretor.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Nenhum fluxo ainda.</p>}
                {fluxosDoCorretor.map(f => (
                  <button key={f.id} onClick={() => setFluxoIdSel(f.id)} style={{ textAlign: 'left', padding: '9px 11px', borderRadius: 8, border: '1px solid ' + (f.id === fluxo?.id ? 'var(--terra)' : 'var(--line)'), background: f.id === fluxo?.id ? 'var(--terraSoft)' : 'var(--bg)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.ativo ? 'var(--olive)' : 'var(--muted)', flex: 'none' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.nome}</span>
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{f.passos.length} passo{f.passos.length === 1 ? '' : 's'}{f.disparaEmLeadNovo ? ' · auto' : ''}</span>
                  </button>
                ))}
              </div>
              <label style={fieldLabel}>Novo fluxo</label>
              <input value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && criar()} placeholder="Ex: Boas-vindas" style={{ ...inp, marginBottom: 8 }} />
              <button onClick={criar} disabled={isManager && !corretorAtivo} style={{ width: '100%', padding: '9px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 12.5, fontWeight: 600, opacity: isManager && !corretorAtivo ? 0.5 : 1 }}>+ Criar fluxo</button>
              {isManager && !corretorAtivo && <p style={{ fontSize: 11, color: 'var(--muted)', margin: '6px 0 0' }}>Escolha um corretor pra criar.</p>}
            </div>
          </div>

          <div>
            {fluxo && rasc ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 16 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                    <input value={rasc.nome} onChange={e => patch({ nome: e.target.value })} style={{ fontFamily: 'Newsreader,serif', fontSize: 18, border: '1px solid var(--line)', background: 'var(--bg)', padding: '5px 8px', borderRadius: 7, minWidth: 160, flex: 1 }} />
                    <button onClick={() => patch({ ativo: !rasc.ativo })} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', border: '1px solid var(--line)', borderRadius: 20, background: 'var(--card)', fontSize: 12, fontWeight: 600 }}>
                      <span style={{ width: 24, height: 14, borderRadius: 8, background: rasc.ativo ? 'var(--olive)' : 'var(--line)', padding: 2, display: 'flex', justifyContent: rasc.ativo ? 'flex-end' : 'flex-start' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
                      </span>
                      {rasc.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                    <button onClick={() => ask('Excluir fluxo "' + fluxo.nome + '"?', 'Os passos e o histórico de execuções somem.', 'Excluir', () => { excluirFluxo(fluxo.id); setFluxoIdSel(null); })} style={{ ...iconBtn, color: 'var(--terra)' }}><Trash2 size={13} /></button>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14 }}>
                    <input type="checkbox" checked={rasc.disparaEmLeadNovo} onChange={e => patch({ disparaEmLeadNovo: e.target.checked })} />
                    Começar sozinho quando um lead novo cai pra este corretor
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>(só um fluxo por corretor)</span>
                  </label>

                  <p style={fieldLabel}>Janela de envio</p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Só mandar das</span>
                    <input type="time" value={hhmm(rasc.janelaInicioMin)} onChange={e => patch({ janelaInicioMin: minDe(e.target.value) })} style={{ ...inp, width: 110 }} />
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>às</span>
                    <input type="time" value={hhmm(rasc.janelaFimMin)} onChange={e => patch({ janelaFimMin: minDe(e.target.value) })} style={{ ...inp, width: 110 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    {DIAS.map((d, i) => (
                      <button key={i} onClick={() => patch({ janelaDias: rasc.janelaDias.map((v, j) => (j === i ? !v : v)) })} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid ' + (rasc.janelaDias[i] ? 'var(--terra)' : 'var(--line)'), background: rasc.janelaDias[i] ? 'var(--terraSoft)' : 'var(--bg)', color: rasc.janelaDias[i] ? 'var(--terra)' : 'var(--muted)', fontSize: 12, fontWeight: 600 }}>{d}</button>
                    ))}
                  </div>

                  <p style={fieldLabel}>Quando a régua terminar</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <select value={rasc.aoEsgotar} onChange={e => patch({ aoEsgotar: e.target.value as Rascunho['aoEsgotar'] })} style={{ ...inp, width: 200 }}>
                      <option value="nada">Não fazer nada</option>
                      <option value="descartar">Descartar o lead (rebatidas)</option>
                      <option value="mover">Mover pra uma coluna</option>
                    </select>
                    {rasc.aoEsgotar === 'mover' && (
                      <select value={rasc.aoEsgotarColunaId ?? ''} onChange={e => patch({ aoEsgotarColunaId: e.target.value || null })} style={{ ...inp, width: 200 }}>
                        <option value="">Escolha a coluna…</option>
                        {colunas.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <p style={fieldLabel}>Passos da régua</p>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Variáveis: {'{{nome}} {{primeiro_nome}} {{corretor}} {{imobiliaria}} {{imovel}}'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {rasc.passos.map((p, i) => {
                      const Icon = TIPOS.find(t => t.v === p.tipo)?.Icon ?? MessageSquare;
                      return (
                        <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--bg)' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                            <Icon size={14} color="var(--terra)" />
                            <select value={p.tipo} onChange={e => patchPasso(i, { tipo: e.target.value as PassoTipo })} style={{ ...inp, width: 110, padding: '6px 8px' }}>
                              {TIPOS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                            </select>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>enviar</span>
                            <input type="number" min={0} value={p.atrasoMinutos >= 1440 && p.atrasoMinutos % 1440 === 0 ? p.atrasoMinutos / 1440 : p.atrasoMinutos >= 60 && p.atrasoMinutos % 60 === 0 ? p.atrasoMinutos / 60 : p.atrasoMinutos}
                              onChange={e => {
                                const n = Math.max(0, Number(e.target.value) || 0);
                                const unidade = p.atrasoMinutos >= 1440 && p.atrasoMinutos % 1440 === 0 ? 1440 : p.atrasoMinutos >= 60 && p.atrasoMinutos % 60 === 0 ? 60 : 1;
                                patchPasso(i, { atrasoMinutos: n * unidade });
                              }}
                              style={{ ...inp, width: 64, padding: '6px 8px' }} />
                            <select
                              value={p.atrasoMinutos >= 1440 && p.atrasoMinutos % 1440 === 0 ? 'd' : p.atrasoMinutos >= 60 && p.atrasoMinutos % 60 === 0 ? 'h' : 'm'}
                              onChange={e => {
                                const cur = p.atrasoMinutos >= 1440 && p.atrasoMinutos % 1440 === 0 ? p.atrasoMinutos / 1440 : p.atrasoMinutos >= 60 && p.atrasoMinutos % 60 === 0 ? p.atrasoMinutos / 60 : p.atrasoMinutos;
                                const mult = e.target.value === 'd' ? 1440 : e.target.value === 'h' ? 60 : 1;
                                patchPasso(i, { atrasoMinutos: cur * mult });
                              }}
                              style={{ ...inp, width: 90, padding: '6px 8px' }}
                            >
                              <option value="m">minutos</option>
                              <option value="h">horas</option>
                              <option value="d">dias</option>
                            </select>
                            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{i === 0 ? 'após o lead cair' : 'após o passo anterior'} · {fmtMin(p.atrasoMinutos)}</span>
                            <span style={{ flex: 1 }} />
                            <button onClick={() => moverPasso(i, -1)} disabled={i === 0} style={{ ...iconBtn, opacity: i === 0 ? 0.4 : 1 }}><ArrowUp size={12} /></button>
                            <button onClick={() => moverPasso(i, 1)} disabled={i === rasc.passos.length - 1} style={{ ...iconBtn, opacity: i === rasc.passos.length - 1 ? 0.4 : 1 }}><ArrowDown size={12} /></button>
                            <button onClick={() => { patch({ passos: rasc.passos.filter((_, j) => j !== i) }); }} style={{ ...iconBtn, color: 'var(--terra)' }}><Trash2 size={12} /></button>
                          </div>
                          <input value={p.cadenciaLabel ?? ''} onChange={e => patchPasso(i, { cadenciaLabel: e.target.value || null })} placeholder="Rótulo da cadência (ex: Chamada 1) — some no card do lead" style={{ ...inp, marginBottom: 8, fontSize: 12 }} />
                          {p.tipo === 'texto' ? (
                            <textarea value={p.conteudo} onChange={e => patchPasso(i, { conteudo: e.target.value })} rows={3} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Mensagem…" />
                          ) : (
                            <>
                              <PassoAnexo passo={p} onChange={patch => patchPasso(i, patch)} />
                              <input value={p.conteudo} onChange={e => patchPasso(i, { conteudo: e.target.value })} placeholder="Legenda (opcional)" style={{ ...inp, fontSize: 12 }} />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={addPasso} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', border: '1px dashed var(--line)', borderRadius: 8, background: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', width: '100%', justifyContent: 'center' }}>
                    <Plus size={14} /> Adicionar passo
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button onClick={salvar} disabled={!dirty} style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: dirty ? 1 : 0.5 }}>Salvar fluxo</button>
                  {dirty && <span style={{ fontSize: 12, color: 'var(--muted)' }}>alterações não salvas</span>}
                  <span style={{ flex: 1 }} />
                  {pill(rasc.ativo ? 'ativo' : 'inativo', rasc.ativo)}
                  {rasc.disparaEmLeadNovo && pill('auto em lead novo', true)}
                </div>
              </div>
            ) : (
              <div style={{ border: '1px dashed var(--line)', borderRadius: 12, padding: '60px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>
                Selecione ou crie um fluxo pra montar a régua.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
