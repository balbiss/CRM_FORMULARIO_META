import { useEffect, useState } from 'react';
import { useAppStore, type IntegracaoFacebook, type ModoWhatsapp } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';

const secTitle: React.CSSProperties = { fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' };
const card: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 20 };
const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' };
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 14, boxSizing: 'border-box' };

const MODOS: { id: ModoWhatsapp; nome: string; desc: string }[] = [
  { id: 'central', nome: 'Número central da imobiliária', desc: 'Um número só. Todo corretor atende os leads dele por dentro do CRM e as mensagens saem por esse número. O histórico fica todo na imobiliária.' },
  { id: 'corretor', nome: 'WhatsApp de cada corretor', desc: 'Cada corretor usa o próprio número (o que o cliente já conhece). Menos fricção pro corretor; o CRM espelha as conversas de cada número.' },
];

export default function Integracoes() {
  const { isManager } = useRoleInfo();
  const modo = useAppStore(s => s.modoWhatsapp);
  const setModo = useAppStore(s => s.setModoWhatsapp);
  const conexoes = useAppStore(s => s.integracoesFacebook);
  const fetchIntegracoes = useAppStore(s => s.fetchIntegracoes);
  const excluir = useAppStore(s => s.excluirIntegracaoFb);
  const atualizar = useAppStore(s => s.atualizarIntegracaoFb);
  const testar = useAppStore(s => s.testarIntegracaoFb);
  const ask = useAppStore(s => s.ask);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<IntegracaoFacebook | null>(null);
  const [testando, setTestando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Record<string, { ok: boolean; msg: string }>>({});

  useEffect(() => { fetchIntegracoes(); }, [fetchIntegracoes]);

  const rodarTeste = async (id: string) => {
    setTestando(id);
    const r = await testar(id);
    setResultado(x => ({ ...x, [id]: r }));
    setTestando(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <p style={secTitle}>Integrações</p>
        <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Integrações da imobiliária</h1>
      </div>

      {/* ---- Modo de WhatsApp ---- */}
      <section style={{ marginBottom: 26 }}>
        <p style={secTitle}>Atendimento no WhatsApp</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12, marginTop: 8 }}>
          {MODOS.map(m => {
            const ativo = modo === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={!isManager}
                onClick={() => isManager && setModo(m.id)}
                style={{
                  ...card, textAlign: 'left', cursor: isManager ? 'pointer' : 'default',
                  borderColor: ativo ? 'var(--terra)' : 'var(--line)',
                  boxShadow: ativo ? '0 0 0 3px var(--terraSoft)' : 'none',
                  opacity: isManager || ativo ? 1 : 0.6,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <span style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid ' + (ativo ? 'var(--terra)' : 'var(--line)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    {ativo && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--terra)' }} />}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{m.nome}</span>
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{m.desc}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 9, background: 'var(--bg)' }}>
          <span style={{ color: 'var(--olive)', fontWeight: 700, flex: 'none' }}>✓</span>
          <p style={{ fontSize: 12.5, color: 'var(--ink)', margin: 0, lineHeight: 1.6 }}>
            <strong>Nos dois modos</strong>, Dono e Gerente veem todas as conversas em <strong>Conversas</strong>,
            com filtro por corretor. A diferença é só por onde a mensagem sai.
          </p>
        </div>
        {!isManager && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 2px 0' }}>Só Dono ou Gerente altera o modo de atendimento.</p>}
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 2px 0' }}>
          A conexão dos números (QR code) e o espelhamento entram numa próxima etapa, quando o motor de WhatsApp for plugado.
        </p>
      </section>

      {/* ---- Facebook Lead Ads ---- */}
      <section>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
          <div>
            <p style={secTitle}>Captação de leads do Facebook</p>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '4px 0 0', maxWidth: 560, lineHeight: 1.6 }}>
              Cada formulário de Lead Ads da sua imobiliária. A automação busca os leads novos a cada poucos minutos
              e joga direto na coluna "Lead Novo".
            </p>
          </div>
          {isManager && (
            <button onClick={() => { setEditando(null); setModalAberto(true); }} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, flex: 'none' }}>
              + Nova conexão
            </button>
          )}
        </div>

        {!isManager ? (
          <div style={card}><p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Só Dono ou Gerente configura as integrações.</p></div>
        ) : conexoes.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '36px 20px' }}>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
              Nenhuma conexão ainda.<br />Clique em "Nova conexão" e cole o ID da página, o ID do formulário e o token do Facebook.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {conexoes.map(c => {
              const r = resultado[c.id];
              // status: resultado do teste manual tem prioridade sobre o último erro salvo
              const statusOk = r ? r.ok : !c.ultimoErro;
              const statusMsg = r ? r.msg : (c.ultimoErro ? c.ultimoErro : (c.ultimaSyncEm ? 'Última captação OK' : 'Ainda não testada'));
              return (
                <div key={c.id} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700 }}>{c.nomeConta}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 20, background: c.ativo ? 'var(--oliveSoft)' : 'var(--line)', color: c.ativo ? 'var(--olive)' : 'var(--muted)' }}>
                      {c.ativo ? 'Ativa' : 'Pausada'}
                    </span>
                  </div>

                  <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 18, rowGap: 9, fontSize: 12.5 }}>
                    <Campo rotulo="ID da página" valor={c.pageId} mono />
                    <Campo rotulo="ID do formulário" valor={c.formId} mono />
                    <Campo rotulo="Token" valor={c.tokenFinal} mono />
                    <Campo rotulo="Última captação" valor={fmtData(c.ultimaSyncEm)} />
                    <dt style={dtStyle}>Situação</dt>
                    <dd style={{ margin: 0, display: 'flex', alignItems: 'flex-start', gap: 6, color: statusOk ? 'var(--olive)' : 'var(--terra)', fontWeight: 600 }}>
                      <span style={{ flex: 'none', marginTop: 1 }}>{statusOk ? '✓' : '⚠'}</span>
                      <span style={{ minWidth: 0, wordBreak: 'break-word', fontWeight: 500 }}>{statusMsg}</span>
                    </dd>
                  </dl>

                  <div className="row-actions" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
                    <button onClick={() => rodarTeste(c.id)} disabled={testando === c.id} style={btn}>{testando === c.id ? 'Testando…' : 'Testar conexão'}</button>
                    <button onClick={() => atualizar(c.id, { ativo: !c.ativo })} style={btn}>{c.ativo ? 'Pausar' : 'Ativar'}</button>
                    <button onClick={() => { setEditando(c); setModalAberto(true); }} style={btn}>Editar</button>
                    <button
                      onClick={() => ask('Remover conexão "' + c.nomeConta + '"?', 'A captação de leads desse formulário para de funcionar.', 'Remover', () => excluir(c.id))}
                      style={{ ...btn, color: 'var(--terra)' }}
                    >Excluir</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {modalAberto && <ConexaoModal conexao={editando} onClose={() => setModalAberto(false)} />}
    </div>
  );
}

const btn: React.CSSProperties = { padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--card)', fontSize: 12.5, fontWeight: 600 };
const dtStyle: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', alignSelf: 'start', paddingTop: 1 };

function Campo({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <>
      <dt style={dtStyle}>{rotulo}</dt>
      <dd style={{ margin: 0, wordBreak: 'break-all', fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit' }}>{valor}</dd>
    </>
  );
}

function fmtData(iso: string | null): string {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return 'há ' + min + ' min';
  if (min < 60 * 24) return 'há ' + Math.round(min / 60) + ' h';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function ConexaoModal({ conexao, onClose }: { conexao: IntegracaoFacebook | null; onClose: () => void }) {
  const criar = useAppStore(s => s.criarIntegracaoFb);
  const atualizar = useAppStore(s => s.atualizarIntegracaoFb);
  const [nomeConta, setNomeConta] = useState(conexao?.nomeConta ?? '');
  const [pageId, setPageId] = useState(conexao?.pageId ?? '');
  const [formId, setFormId] = useState(conexao?.formId ?? '');
  const [accessToken, setAccessToken] = useState('');
  const [saving, setSaving] = useState(false);
  const editando = !!conexao;

  const submit = async () => {
    if (!nomeConta.trim() || !pageId.trim() || !formId.trim()) return;
    if (!editando && accessToken.trim().length < 20) return;
    setSaving(true);
    if (editando) {
      await atualizar(conexao!.id, {
        nomeConta: nomeConta.trim(), pageId: pageId.trim(), formId: formId.trim(),
        ...(accessToken.trim() ? { accessToken: accessToken.trim() } : {}),
      });
      onClose();
    } else {
      const ok = await criar({ nomeConta: nomeConta.trim(), pageId: pageId.trim(), formId: formId.trim(), accessToken: accessToken.trim() });
      if (ok) onClose();
    }
    setSaving(false);
  };

  return (
    <div onClick={onClose} className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(8,17,31,.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={e => e.stopPropagation()} className="modal-card" style={{ width: '100%', maxWidth: 460, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, animation: 'fadeUp .14s ease' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 22, margin: '0 0 4px' }}>{editando ? 'Editar conexão' : 'Nova conexão do Facebook'}</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 18px', lineHeight: 1.6 }}>
          O ID da página e o ID do formulário ficam na Central de Leads do Meta Business Suite. O token é um
          System User token do Business Manager, com permissão de leads.
        </p>

        <label style={label}>Nome da conexão</label>
        <input value={nomeConta} onChange={e => setNomeConta(e.target.value)} style={input} placeholder="Ex: Página principal — campanha lançamento" autoFocus />

        <label style={label}>ID da página</label>
        <input value={pageId} onChange={e => setPageId(e.target.value)} style={input} placeholder="Ex: 1029384756" inputMode="numeric" />

        <label style={label}>ID do formulário (Lead Ads)</label>
        <input value={formId} onChange={e => setFormId(e.target.value)} style={input} placeholder="Ex: 5647382910" inputMode="numeric" />

        <label style={label}>{editando ? 'Novo token (deixe em branco pra manter)' : 'Token de acesso'}</label>
        <textarea
          value={accessToken}
          onChange={e => setAccessToken(e.target.value)}
          rows={3}
          style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder={editando ? '••••••••••' : 'Cole aqui o System User token'}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando…' : editando ? 'Salvar' : 'Adicionar conexão'}
          </button>
        </div>
      </div>
    </div>
  );
}
