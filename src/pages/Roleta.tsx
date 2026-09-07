import { useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, X, Trash2 } from 'lucide-react';
import { useAppStore, type RemoteRoleta, type RoletaFinalidade } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { ini } from '../lib/format';

const CANAIS = ['WhatsApp', 'Facebook', 'Instagram', 'Site', 'Indicacao', 'Manual'];
const FINAL_LABEL: Record<RoletaFinalidade, string> = { venda: 'Só venda', locacao: 'Só locação', ambos: 'Venda e locação' };

const inp: React.CSSProperties = { padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg)', fontSize: 12.5 };
const chip = (on: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
  border: '1px solid ' + (on ? 'var(--terra)' : 'var(--line)'),
  background: on ? 'var(--terraSoft)' : 'var(--bg)', color: on ? 'var(--terra)' : 'var(--muted)',
});

export default function Roleta() {
  const roletas = useAppStore(s => s.roletas);
  const perfis = useAppStore(s => s.perfisRemotos);
  const sessoes = useAppStore(s => s.sessoesWhatsapp);
  const leads = useAppStore(s => s.leads);
  const criarRoleta = useAppStore(s => s.criarRoleta);
  const atualizarRoleta = useAppStore(s => s.atualizarRoleta);
  const excluirRoleta = useAppStore(s => s.excluirRoleta);
  const setMembros = useAppStore(s => s.setMembrosRoleta);
  const distribuir = useAppStore(s => s.distribuirPendentes);
  const shuffle = useAppStore(s => s.shuffle);
  const toggleMeuPlantao = useAppStore(s => s.toggleMeuPlantao);
  const ask = useAppStore(s => s.ask);
  const { isManager, meNome } = useRoleInfo();
  const me = useAppStore(s => s.me);

  const [novaRoleta, setNovaRoleta] = useState('');
  const [criando, setCriando] = useState(false);
  const novaRef = useRef<HTMLInputElement>(null);
  const salvarNova = () => { const n = novaRoleta.trim(); if (!n) { novaRef.current?.focus(); return; } criarRoleta(n); setNovaRoleta(''); setCriando(false); };
  const semCorretor = leads.filter(l => l.col === 'novo' && !l.corretor).length;
  const corretores = useMemo(() => perfis.filter(p => p.role === 'corretor' || p.role === 'gerente'), [perfis]);
  const nomeSessao = (id: string | null) => {
    if (!id) return null;
    const s = sessoes.find(x => x.id === id);
    return s ? (s.rotulo || s.numero || (s.escopo === 'central' ? 'Número central' : 'Número do corretor')) : null;
  };

  const minhas = isManager ? roletas : roletas.filter(r => r.membros.some(m => m.corretorId === me?.id));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Distribuição</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Roletas de Atendimento</h1>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '5px 0 0', maxWidth: 620 }}>
            Cada roleta é uma equipe. O lead entra na roleta que casa as regras (canal + finalidade + número de WhatsApp);
            se não casar nenhuma, cai na roleta padrão. Dentro dela, vai pro corretor em plantão que faz mais tempo sem receber.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!isManager && minhas.length > 0 && (
            <button onClick={toggleMeuPlantao} style={{ padding: '11px 18px', border: '1px solid var(--line)', borderRadius: 8, background: me?.emPlantao ? 'var(--plantao)' : 'var(--card)', color: me?.emPlantao ? '#fff' : 'var(--ink)', fontSize: 13, fontWeight: 600 }}>
              {me?.emPlantao ? 'No plantão — sair' : 'Entrar no plantão'}
            </button>
          )}
          {isManager && semCorretor > 0 && (
            <button onClick={distribuir} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--olive)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
              Distribuir {semCorretor} lead{semCorretor > 1 ? 's' : ''} sem corretor
            </button>
          )}
          {isManager && <button onClick={shuffle} style={{ padding: '11px 18px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, fontWeight: 600 }}>Embaralhar</button>}
        </div>
      </div>

      {isManager && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {criando ? (
            <>
              <input
                ref={novaRef} autoFocus value={novaRoleta} onChange={e => setNovaRoleta(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') salvarNova(); if (e.key === 'Escape') { setCriando(false); setNovaRoleta(''); } }}
                placeholder="Nome da roleta (ex: Equipe Locação)" style={{ ...inp, flex: 1, maxWidth: 320, padding: '10px 12px', fontSize: 13 }}
              />
              <button onClick={salvarNova} style={{ padding: '10px 16px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Criar</button>
              <button onClick={() => { setCriando(false); setNovaRoleta(''); }} style={{ padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}>Cancelar</button>
            </>
          ) : (
            <button onClick={() => setCriando(true)} style={{ padding: '10px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, fontWeight: 600 }}>+ Nova roleta</button>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, alignItems: 'start' }}>
        {minhas.map(r => (
          <RoletaCard
            key={r.id} roleta={r} isManager={isManager} meNome={meNome} corretores={corretores}
            sessoes={sessoes} nomeSessao={nomeSessao}
            onPatch={p => atualizarRoleta(r.id, p)}
            onDelete={() => ask('Excluir a roleta "' + r.nome + '"?', 'Os corretores saem dela. Leads que iam pra essa roleta passam a cair na padrão.', 'Excluir', () => excluirRoleta(r.id))}
            onMembros={ids => setMembros(r.id, ids)}
          />
        ))}
        {minhas.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{isManager ? 'Nenhuma roleta ainda.' : 'Você não está em nenhuma roleta. Fale com o gerente.'}</p>}
      </div>
    </div>
  );
}

function RoletaCard({ roleta, isManager, meNome, corretores, sessoes, nomeSessao, onPatch, onDelete, onMembros }: {
  roleta: RemoteRoleta; isManager: boolean; meNome: string;
  corretores: { id: string; nome: string }[];
  sessoes: { id: string; rotulo?: string | null; numero: string | null; escopo: string }[];
  nomeSessao: (id: string | null) => string | null;
  onPatch: (p: Partial<Pick<RemoteRoleta, 'nome' | 'ativa' | 'padrao' | 'canais' | 'finalidade' | 'sessaoWhatsappId'>>) => void;
  onDelete: () => void;
  onMembros: (ids: string[]) => void;
}) {
  const [expand, setExpand] = useState(false);
  const membros = [...roleta.membros].sort((a, b) => a.posicao - b.posicao);
  const proximoIdx = membros.findIndex(m => m.emPlantao && !m.bloqueado);
  const naoMembros = corretores.filter(c => !membros.some(m => m.corretorId === c.id));

  const mover = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= membros.length) return;
    const ids = membros.map(m => m.corretorId);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    onMembros(ids);
  };

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', opacity: roleta.ativa ? 1 : 0.6 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isManager
            ? <input
                key={roleta.nome} defaultValue={roleta.nome}
                onBlur={e => { const v = e.target.value.trim(); if (v && v !== roleta.nome) onPatch({ nome: v }); else e.target.value = roleta.nome; }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                style={{ fontSize: 15, fontWeight: 700, border: '1px solid transparent', background: 'none', flex: 1, minWidth: 0, padding: '2px 4px', borderRadius: 5 }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--line)'}
              />
            : <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{roleta.nome}</span>}
          {roleta.padrao && <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', padding: '3px 7px', borderRadius: 20, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--line)' }}>padrão</span>}
          {isManager && (
            <button onClick={() => onPatch({ ativa: !roleta.ativa })} title={roleta.ativa ? 'Ativa' : 'Pausada'} style={{ width: 34, height: 19, borderRadius: 12, border: 'none', padding: 2, display: 'flex', justifyContent: roleta.ativa ? 'flex-end' : 'flex-start', background: roleta.ativa ? 'var(--olive)' : 'var(--line)', flex: 'none' }}>
              <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff' }} />
            </button>
          )}
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '6px 0 0' }}>
          {(roleta.canais.length ? roleta.canais.join(' · ') : 'Todos os canais')}
          {roleta.finalidade !== 'ambos' && ' · ' + FINAL_LABEL[roleta.finalidade].toLowerCase()}
          {roleta.sessaoWhatsappId && ' · ' + (nomeSessao(roleta.sessaoWhatsappId) || 'número específico')}
        </p>
      </div>

      {isManager && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          <button onClick={() => setExpand(v => !v)} style={{ border: 'none', background: 'none', fontSize: 12, color: 'var(--terra)', fontWeight: 600, padding: 0 }}>{expand ? 'Fechar regras' : 'Editar regras'}</button>
          {expand && (
            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              <div>
                <p style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', margin: '0 0 6px', fontWeight: 700 }}>Canais que entram aqui</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {CANAIS.map(c => {
                    const on = roleta.canais.includes(c);
                    return <button key={c} style={chip(on)} onClick={() => onPatch({ canais: on ? roleta.canais.filter(x => x !== c) : [...roleta.canais, c] })}>{c}</button>;
                  })}
                </div>
                <p style={{ fontSize: 10.5, color: 'var(--muted)', margin: '4px 0 0' }}>nenhum marcado = todos</p>
              </div>
              <label style={{ fontSize: 12 }}>
                <span style={{ display: 'block', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 4, fontWeight: 700 }}>Finalidade</span>
                <select value={roleta.finalidade} onChange={e => onPatch({ finalidade: e.target.value as RoletaFinalidade })} style={{ ...inp, width: '100%' }}>
                  <option value="ambos">Venda e locação</option>
                  <option value="venda">Só venda (compra)</option>
                  <option value="locacao">Só locação (aluguel)</option>
                </select>
              </label>
              <label style={{ fontSize: 12 }}>
                <span style={{ display: 'block', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 4, fontWeight: 700 }}>Só leads deste número de WhatsApp</span>
                <select value={roleta.sessaoWhatsappId ?? ''} onChange={e => onPatch({ sessaoWhatsappId: e.target.value || null })} style={{ ...inp, width: '100%' }}>
                  <option value="">Qualquer número</option>
                  {sessoes.map(s => <option key={s.id} value={s.id}>{s.rotulo || s.numero || (s.escopo === 'central' ? 'Número central' : 'Corretor')}</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={roleta.padrao} onChange={e => onPatch({ padrao: e.target.checked })} /> roleta padrão (pega o que sobrar)
                </label>
                <span style={{ flex: 1 }} />
                {!roleta.padrao && <button onClick={onDelete} style={{ border: 'none', background: 'none', color: 'var(--terra)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={12} /> excluir</button>}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '8px 8px 10px' }}>
        {membros.map((m, i) => (
          <div key={m.corretorId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', borderRadius: 8, opacity: m.emPlantao ? 1 : 0.5, background: m.nome === meNome ? 'var(--bg)' : 'transparent' }}>
            <span style={{ fontFamily: 'Newsreader,serif', fontSize: 15, width: 18, color: 'var(--muted)' }}>{i + 1}</span>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, flex: 'none' }}>{ini(m.nome)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nome}</span>
            {i === proximoIdx && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--terra)', background: 'var(--terraSoft)', padding: '3px 7px', borderRadius: 20 }}>próximo</span>}
            {!m.emPlantao && <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>fora</span>}
            {isManager && (
              <>
                <button onClick={() => mover(i, -1)} disabled={i === 0} style={{ border: 'none', background: 'none', color: 'var(--muted)', opacity: i === 0 ? 0.3 : 1 }}><ArrowUp size={13} /></button>
                <button onClick={() => mover(i, 1)} disabled={i === membros.length - 1} style={{ border: 'none', background: 'none', color: 'var(--muted)', opacity: i === membros.length - 1 ? 0.3 : 1 }}><ArrowDown size={13} /></button>
                <button onClick={() => onMembros(membros.filter(x => x.corretorId !== m.corretorId).map(x => x.corretorId))} style={{ border: 'none', background: 'none', color: 'var(--terra)' }}><X size={13} /></button>
              </>
            )}
          </div>
        ))}
        {membros.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', padding: '8px' }}>Sem corretores nesta roleta.</p>}
        {isManager && naoMembros.length > 0 && (
          <div style={{ padding: '8px 8px 0' }}>
            <select value="" onChange={e => { if (e.target.value) onMembros([...membros.map(m => m.corretorId), e.target.value]); }} style={{ ...inp, width: '100%' }}>
              <option value="">+ Adicionar corretor…</option>
              {naoMembros.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
