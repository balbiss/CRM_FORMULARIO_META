import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Copy, Check, X, Ban, Unlock, KeyRound, Trash2 } from 'lucide-react';
import { usePlataformaStore, type ImobiliariaRow, type ImobiliariaDetalhe, type PagamentoMetodo } from '../../store/plataformaStore';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');
const hojeISO = () => new Date().toISOString().slice(0, 10);
const compAtual = () => new Date().toISOString().slice(0, 7);

const METODOS: { v: PagamentoMetodo; l: string }[] = [
  { v: 'pix', l: 'Pix' }, { v: 'boleto', l: 'Boleto' }, { v: 'cartao', l: 'Cartão' },
  { v: 'transferencia', l: 'Transferência' }, { v: 'dinheiro', l: 'Dinheiro' }, { v: 'outro', l: 'Outro' },
];

function StatusChip({ row }: { row: Pick<ImobiliariaRow, 'status' | 'bloqueioMotivo'> }) {
  if (row.status === 'ativa') return <span style={chip('#0E7C66', '#D7F0EA')}>Ativa</span>;
  return <span style={chip('#C0392B', '#FBE3E0')}>{row.bloqueioMotivo === 'inadimplencia' ? 'Inadimplente' : 'Bloqueada'}</span>;
}
const chip = (fg: string, bg: string): React.CSSProperties => ({
  fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, color: fg, background: bg, whiteSpace: 'nowrap',
});

function Credenciais({ email, senha, onClose }: { email: string; senha: string; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = () => {
    navigator.clipboard?.writeText(`E-mail: ${email}\nSenha temporária: ${senha}`);
    setCopiado(true); setTimeout(() => setCopiado(false), 1800);
  };
  return (
    <div style={{ background: 'var(--terraSoft)', border: '1px solid var(--terra)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--terra)' }}>Credenciais do Dono — mostre só uma vez</div>
      <div style={{ fontSize: 13, lineHeight: 1.7 }}>
        <div><b>E-mail:</b> {email}</div>
        <div><b>Senha temporária:</b> <code style={{ background: 'var(--card)', padding: '2px 6px', borderRadius: 4 }}>{senha}</code></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={copiar} style={btn('sec')}>{copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? 'Copiado' : 'Copiar'}</button>
        <button onClick={onClose} style={btn('sec')}>Fechar</button>
      </div>
    </div>
  );
}

const btn = (kind: 'pri' | 'sec' | 'danger'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--line)',
  cursor: 'pointer',
  ...(kind === 'pri' ? { background: 'var(--terra)', color: '#fff', border: 'none' } : {}),
  ...(kind === 'danger' ? { background: '#C0392B', color: '#fff', border: 'none' } : {}),
  ...(kind === 'sec' ? { background: 'var(--card)', color: 'var(--ink)' } : {}),
});
const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13.5 };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 };

// --- Modal: nova imobiliária ---
function NovaModal({ onClose }: { onClose: () => void }) {
  const criar = usePlataformaStore(s => s.criarImobiliaria);
  const [f, setF] = useState({ nome: '', donoNome: '', donoEmail: '', plano: 'Padrão', mensalidade: '297', limiteCorretores: '0', diasCarencia: '5', primeiroVencimento: '' });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cred, setCred] = useState<{ email: string; senha: string } | null>(null);

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErro(null);
    try {
      const r = await criar({
        nome: f.nome.trim(), donoNome: f.donoNome.trim(), donoEmail: f.donoEmail.trim().toLowerCase(),
        plano: f.plano.trim() || 'Padrão', mensalidade: Number(f.mensalidade) || 0,
        limiteCorretores: Number(f.limiteCorretores) || 0, diasCarencia: Number(f.diasCarencia) || 0,
        ...(f.primeiroVencimento ? { primeiroVencimento: f.primeiroVencimento } : {}),
      });
      setCred({ email: r.email, senha: r.senhaTemporaria });
    } catch (err) { setErro((err as Error).message); }
    setBusy(false);
  };

  return (
    <Overlay onClose={onClose}>
      <div className="modal-card" style={{ maxWidth: 480 }}>
        <ModalHead title={cred ? 'Imobiliária criada' : 'Nova imobiliária'} onClose={onClose} />
        {cred ? (
          <div style={{ padding: 20 }}>
            <Credenciais email={cred.email} senha={cred.senha} onClose={onClose} />
          </div>
        ) : (
          <form onSubmit={salvar} style={{ padding: 20, display: 'grid', gap: 14 }}>
            <div><label style={lbl}>Nome da imobiliária</label><input style={inp} value={f.nome} onChange={e => set('nome', e.target.value)} required autoFocus /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Nome do dono</label><input style={inp} value={f.donoNome} onChange={e => set('donoNome', e.target.value)} required /></div>
              <div><label style={lbl}>E-mail do dono</label><input style={inp} type="email" value={f.donoEmail} onChange={e => set('donoEmail', e.target.value)} required /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Plano</label><input style={inp} value={f.plano} onChange={e => set('plano', e.target.value)} /></div>
              <div><label style={lbl}>Mensalidade (R$)</label><input style={inp} type="number" min="0" step="0.01" value={f.mensalidade} onChange={e => set('mensalidade', e.target.value)} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Limite corretores</label><input style={inp} type="number" min="0" value={f.limiteCorretores} onChange={e => set('limiteCorretores', e.target.value)} /><span style={{ fontSize: 10.5, color: 'var(--muted)' }}>0 = ilimitado</span></div>
              <div><label style={lbl}>Carência (dias)</label><input style={inp} type="number" min="0" value={f.diasCarencia} onChange={e => set('diasCarencia', e.target.value)} /></div>
              <div><label style={lbl}>1º vencimento</label><input style={inp} type="date" value={f.primeiroVencimento} onChange={e => set('primeiroVencimento', e.target.value)} /></div>
            </div>
            {erro && <p style={{ color: 'var(--terra)', fontSize: 12.5, margin: 0 }}>{erro}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" style={btn('sec')} onClick={onClose}>Cancelar</button>
              <button type="submit" style={btn('pri')} disabled={busy}>{busy ? 'Criando…' : 'Criar imobiliária'}</button>
            </div>
          </form>
        )}
      </div>
    </Overlay>
  );
}

// --- Modal: detalhe ---
function DetalheModal({ id, onClose }: { id: string; onClose: () => void }) {
  const st = usePlataformaStore();
  const [d, setD] = useState<ImobiliariaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState<{ email: string; senha: string } | null>(null);
  const [pg, setPg] = useState({ valor: '', competencia: compAtual(), pagoEm: hojeISO(), metodo: 'pix' as PagamentoMetodo, observacao: '' });
  const [edit, setEdit] = useState({ plano: '', mensalidade: '', limiteCorretores: '', diasCarencia: '', proximoVencimento: '', observacoes: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const recarregar = useCallback(async () => {
    const det = await st.detalhe(id);
    setD(det);
    setEdit({
      plano: det.plano, mensalidade: String(det.mensalidade), limiteCorretores: String(det.limiteCorretores),
      diasCarencia: String(det.diasCarencia), proximoVencimento: det.proximoVencimento || '', observacoes: det.observacoes || '',
    });
    if (!pg.valor) setPg(p => ({ ...p, valor: String(det.mensalidade || '') }));
  }, [id, st, pg.valor]);

  useEffect(() => { recarregar().catch(e => setErro((e as Error).message)); }, [recarregar]);

  if (!d) {
    return <Overlay onClose={onClose}><div className="modal-card" style={{ maxWidth: 560, padding: 30 }}>{erro || 'Carregando…'}</div></Overlay>;
  }

  const salvarEdit = async () => {
    setSavingEdit(true); setErro(null);
    try {
      await st.editar(id, {
        plano: edit.plano, mensalidade: Number(edit.mensalidade) || 0,
        limiteCorretores: Number(edit.limiteCorretores) || 0, diasCarencia: Number(edit.diasCarencia) || 0,
        proximoVencimento: edit.proximoVencimento || null, observacoes: edit.observacoes || null,
      });
      await recarregar();
    } catch (e) { setErro((e as Error).message); }
    setSavingEdit(false);
  };

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault(); setErro(null);
    try {
      await st.registrarPagamento(id, {
        valor: Number(pg.valor) || 0, competencia: pg.competencia, pagoEm: pg.pagoEm, metodo: pg.metodo,
        ...(pg.observacao ? { observacao: pg.observacao } : {}),
      });
      await recarregar();
      setPg(p => ({ ...p, observacao: '' }));
    } catch (err) { setErro((err as Error).message); }
  };

  return (
    <Overlay onClose={onClose}>
      <div className="modal-card" style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
        <ModalHead title={d.nome} onClose={onClose} extra={<StatusChip row={d} />} />
        <div style={{ padding: 20, display: 'grid', gap: 20 }}>
          {erro && <p style={{ color: 'var(--terra)', fontSize: 12.5, margin: 0 }}>{erro}</p>}
          {novaSenha && <Credenciais email={novaSenha.email} senha={novaSenha.senha} onClose={() => setNovaSenha(null)} />}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {d.status === 'ativa' ? (
              <button style={btn('danger')} onClick={() => st.bloquear(id).then(recarregar)}><Ban size={14} /> Bloquear acesso</button>
            ) : (
              <button style={btn('pri')} onClick={() => st.liberar(id).then(recarregar)}><Unlock size={14} /> Liberar acesso</button>
            )}
            <button style={btn('sec')} onClick={() => st.resetSenhaDono(id).then(r => setNovaSenha({ email: r.email, senha: r.senhaTemporaria }))}>
              <KeyRound size={14} /> Redefinir senha do dono
            </button>
          </div>

          <section>
            <h3 style={sec}>Assinatura</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={lbl}>Plano</label><input style={inp} value={edit.plano} onChange={e => setEdit(p => ({ ...p, plano: e.target.value }))} /></div>
              <div><label style={lbl}>Mensalidade (R$)</label><input style={inp} type="number" min="0" step="0.01" value={edit.mensalidade} onChange={e => setEdit(p => ({ ...p, mensalidade: e.target.value }))} /></div>
              <div><label style={lbl}>Limite corretores ({d.corretores} em uso)</label><input style={inp} type="number" min="0" value={edit.limiteCorretores} onChange={e => setEdit(p => ({ ...p, limiteCorretores: e.target.value }))} /></div>
              <div><label style={lbl}>Carência (dias)</label><input style={inp} type="number" min="0" value={edit.diasCarencia} onChange={e => setEdit(p => ({ ...p, diasCarencia: e.target.value }))} /></div>
              <div><label style={lbl}>Próximo vencimento</label><input style={inp} type="date" value={edit.proximoVencimento} onChange={e => setEdit(p => ({ ...p, proximoVencimento: e.target.value }))} /></div>
            </div>
            <div style={{ marginTop: 12 }}><label style={lbl}>Observações</label><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={edit.observacoes} onChange={e => setEdit(p => ({ ...p, observacoes: e.target.value }))} /></div>
            <button style={{ ...btn('sec'), marginTop: 12 }} onClick={salvarEdit} disabled={savingEdit}>{savingEdit ? 'Salvando…' : 'Salvar assinatura'}</button>
          </section>

          <section>
            <h3 style={sec}>Registrar pagamento</h3>
            <form onSubmit={registrar} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
              <div><label style={lbl}>Valor (R$)</label><input style={inp} type="number" min="0" step="0.01" value={pg.valor} onChange={e => setPg(p => ({ ...p, valor: e.target.value }))} required /></div>
              <div><label style={lbl}>Competência</label><input style={inp} type="month" value={pg.competencia} onChange={e => setPg(p => ({ ...p, competencia: e.target.value }))} required /></div>
              <div><label style={lbl}>Pago em</label><input style={inp} type="date" value={pg.pagoEm} onChange={e => setPg(p => ({ ...p, pagoEm: e.target.value }))} required /></div>
              <div><label style={lbl}>Método</label><select style={inp} value={pg.metodo} onChange={e => setPg(p => ({ ...p, metodo: e.target.value as PagamentoMetodo }))}>{METODOS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}</select></div>
              <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Observação (opcional)</label><input style={inp} value={pg.observacao} onChange={e => setPg(p => ({ ...p, observacao: e.target.value }))} /></div>
              <button type="submit" style={{ ...btn('pri'), gridColumn: 'span 3', justifyContent: 'center' }}>Registrar e empurrar vencimento +1 mês</button>
            </form>
          </section>

          <section>
            <h3 style={sec}>Histórico de pagamentos</h3>
            {d.pagamentos.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum pagamento registrado.</p>
            ) : (
              <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
                {d.pagamentos.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderTop: '1px solid var(--line)', fontSize: 13 }}>
                    <div>
                      <b>{brl(p.valor)}</b> · {p.competencia} · {METODOS.find(m => m.v === p.metodo)?.l}
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Pago em {dataBR(p.pagoEm)}{p.observacao ? ` — ${p.observacao}` : ''}</div>
                    </div>
                    <button onClick={() => st.excluirPagamento(id, p.id).then(recarregar)} title="Excluir pagamento" style={{ border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 style={sec}>Equipe ({d.equipe.length})</h3>
            <div style={{ display: 'grid', gap: 6 }}>
              {d.equipe.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <span>{m.nome} <span style={{ color: 'var(--muted)' }}>· {m.email}</span></span>
                  <span style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{m.role}{m.bloqueado ? ' (bloqueado)' : ''}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Overlay>
  );
}

const sec: React.CSSProperties = { fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 10px' };

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,26,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}
function ModalHead({ title, onClose, extra }: { title: string; onClose: () => void; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 21, margin: 0 }}>{title}</h2>
        {extra}
      </div>
      <button onClick={onClose} style={{ border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
    </div>
  );
}

export default function PlataformaImobiliarias() {
  const imobiliarias = usePlataformaStore(s => s.imobiliarias);
  const carregar = usePlataformaStore(s => s.carregar);
  const [nova, setNova] = useState(false);
  const [params, setParams] = useSearchParams();
  const abrir = params.get('abrir');

  useEffect(() => { carregar(); }, [carregar]);

  const fecharDetalhe = () => { params.delete('abrir'); setParams(params, { replace: true }); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 30, margin: '0 0 4px' }}>Imobiliárias</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>{imobiliarias.length} cadastrada{imobiliarias.length === 1 ? '' : 's'}</p>
        </div>
        <button style={btn('pri')} onClick={() => setNova(true)}><Plus size={15} /> Nova imobiliária</button>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        <div className="data-table-head" style={{ display: 'grid', gridTemplateColumns: '1.6fr .8fr .9fr .8fr 1fr .9fr', gap: 12, padding: '11px 18px', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--line)' }}>
          <span>Imobiliária</span><span>Situação</span><span>Plano</span><span>Corretores</span><span>Vencimento</span><span>Mensalidade</span>
        </div>
        {imobiliarias.length === 0 && <div style={{ padding: 26, color: 'var(--muted)', fontSize: 13.5 }}>Nenhuma imobiliária ainda. Clique em "Nova imobiliária".</div>}
        {imobiliarias.map(i => (
          <button key={i.id} className="data-row" onClick={() => setParams({ abrir: i.id })}
            style={{ display: 'grid', gridTemplateColumns: '1.6fr .8fr .9fr .8fr 1fr .9fr', gap: 12, width: '100%', padding: '13px 18px', border: 'none', borderTop: '1px solid var(--line)', background: 'transparent', textAlign: 'left', cursor: 'pointer', alignItems: 'center', fontSize: 13.5 }}>
            <span style={{ fontWeight: 600 }}>{i.nome}</span>
            <span><StatusChip row={i} /></span>
            <span style={{ color: 'var(--muted)' }}>{i.plano}</span>
            <span style={{ color: i.limiteCorretores > 0 && i.corretoresUsados >= i.limiteCorretores ? '#C0392B' : 'var(--muted)' }}>
              {i.corretoresUsados}{i.limiteCorretores > 0 ? `/${i.limiteCorretores}` : ''}
            </span>
            <span style={{ color: 'var(--muted)' }}>
              {dataBR(i.proximoVencimento)}
              {i.diasParaVencer !== null && i.status === 'ativa' && (i.diasParaVencer < 0
                ? <b style={{ color: '#C0392B' }}> · venceu</b>
                : i.diasParaVencer <= 7 ? <b style={{ color: '#B7791F' }}> · {i.diasParaVencer}d</b> : null)}
            </span>
            <span>{brl(i.mensalidade)}</span>
          </button>
        ))}
      </div>

      {nova && <NovaModal onClose={() => setNova(false)} />}
      {abrir && <DetalheModal id={abrir} onClose={fecharDetalhe} />}
    </div>
  );
}
