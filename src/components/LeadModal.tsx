import { useEffect, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { CADENCIAS, MOTIVOS_DESCARTE, APROVACAO, mapMsgs } from '../lib/data';
import { BRL, canalPill, thumb } from '../lib/format';
import { css } from '../lib/css';
import { uploadArquivo, tipoDeArquivo } from '../lib/upload';
import { AnexoMensagem } from './AnexoMensagem';
import { Visto } from './Visto';
import { ChatAvatar } from './ChatAvatar';
import { AudioRecordButton } from './AudioRecordButton';
import { EmojiPicker } from './EmojiPicker';

const TABS: Array<[string, string]> = [
  ['detalhes', 'Detalhes'], ['chat', 'Chat WhatsApp'], ['followup', 'Follow-up'], ['historico', 'Histórico'],
];

export function LeadModal() {
  const leadId = useAppStore(s => s.leadId);
  const leads = useAppStore(s => s.leads);
  const leadTab = useAppStore(s => s.leadTab);
  const setLeadTab = useAppStore(s => s.setLeadTab);
  const closeLead = useAppStore(s => s.closeLead);
  const chats = useAppStore(s => s.chats);
  const typing = useAppStore(s => s.typing);
  const draft = useAppStore(s => s.draft);
  const setDraft = useAppStore(s => s.setDraft);
  const sendMsg = useAppStore(s => s.sendMsg);
  const enviarMensagem = useAppStore(s => s.enviarMensagem);
  const token = useAppStore(s => s.token);
  const toast = useAppStore(s => s.toast);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cadencia = useAppStore(s => s.cadencia);
  const setCadencia = useAppStore(s => s.setCadencia);
  const move = useAppStore(s => s.move);
  const colunas = useAppStore(s => s.colunasRemotas);
  const advance = useAppStore(s => s.advance);
  const ask = useAppStore(s => s.ask);
  const excluirLead = useAppStore(s => s.excluirLead);
  const limparConversa = useAppStore(s => s.limparConversa);
  const [excluirOpen, setExcluirOpen] = useState(false);
  const discardOpen = useAppStore(s => s.discardOpen);
  const discardWarn = useAppStore(s => s.discardWarn);
  const openDiscard = useAppStore(s => s.openDiscard);
  const closeDiscard = useAppStore(s => s.closeDiscard);
  const pickMotivoDescarte = useAppStore(s => s.pickMotivoDescarte);
  const requestApproval = useAppStore(s => s.requestApproval);
  const steps = useAppStore(s => s.steps);
  const seqState = useAppStore(s => s.seqState);
  const pauseSeq = useAppStore(s => s.pauseSeq);
  const resumeSeq = useAppStore(s => s.resumeSeq);
  const endSeq = useAppStore(s => s.endSeq);
  const eventosLead = useAppStore(s => s.eventosLead);
  const fetchEventosLead = useAppStore(s => s.fetchEventosLead);
  const addNotaLead = useAppStore(s => s.addNotaLead);
  const tarefas = useAppStore(s => s.tarefas);
  const criarTarefa = useAppStore(s => s.criarTarefa);
  const toggleTarefa = useAppStore(s => s.toggleTarefa);
  const [nota, setNota] = useState('');
  const [tarefaTitulo, setTarefaTitulo] = useState('');
  const [tarefaQuando, setTarefaQuando] = useState('');

  const L = leads.find(l => l.id === leadId);
  const chatMsgs = mapMsgs((leadId && chats[leadId]) || []);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const paraOFimChat = () => {
    const el = chatScrollRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  };
  useEffect(() => { if (leadTab === 'chat') paraOFimChat(); }, [chatMsgs.length, leadTab, typing]);
  useEffect(() => { if (leadTab === 'historico' && leadId) fetchEventosLead(leadId); }, [leadTab, leadId, fetchEventosLead]);

  if (!L) return null;

  const colAtual = colunas.find(c => c.id === L.colunaId)?.titulo ?? '—';
  const cad = cadencia[L.id] || 'Chamada 1';
  const seqSt = seqState[L.id] || 'ativa';

  const fields = [
    { label: 'Nome completo', value: L.nome }, { label: 'Telefone', value: L.tel },
    { label: 'E-mail', value: L.email }, { label: 'Corretor responsável', value: L.corretor },
    { label: 'Campanha', value: L.campanha }, { label: 'Renda declarada', value: BRL(L.renda) },
  ];

  const eventos = (leadId && eventosLead[leadId]) || [];
  const tarefasDoLead = tarefas.filter(t => t.leadId === leadId).sort((a, b) => +new Date(a.venceEm) - +new Date(b.venceEm));
  const quandoRelativo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return 'agora';
    if (min < 60) return 'há ' + min + ' min';
    const h = Math.round(min / 60);
    if (h < 24) return 'há ' + h + ' h';
    const d = Math.round(h / 24);
    if (d < 30) return 'há ' + d + (d > 1 ? ' dias' : ' dia');
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };
  async function salvarNota() {
    if (!leadId || nota.trim().length < 1) return;
    if (await addNotaLead(leadId, nota.trim())) setNota('');
  }
  async function salvarTarefaRapida() {
    if (!leadId || tarefaTitulo.trim().length < 1 || !tarefaQuando) return;
    const ok = await criarTarefa({ titulo: tarefaTitulo.trim(), venceEm: new Date(tarefaQuando).toISOString(), leadId });
    if (ok) { setTarefaTitulo(''); setTarefaQuando(''); fetchEventosLead(leadId); }
  }

  const seqSteps = steps.map((st, i) => {
    const done = i < 2, now = i === 2;
    return { ...st, tag: done ? 'Enviado' : now ? 'Agendado' : 'Na fila', done, now };
  });

  const quickTemplates = [
    { label: 'Enviar tabela de valores', texto: 'Acabei de te enviar a tabela de valores atualizada. Qualquer dúvida, me chama.' },
    { label: 'Confirmar visita', texto: 'Passando para confirmar nossa visita — consegue no horário combinado?' },
    { label: 'Pedir documentos', texto: 'Para adiantar a análise, me envia RG, CPF e comprovante de renda?' },
  ];

  return (
    <div onClick={closeLead} className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(8,17,31,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <div onClick={e => e.stopPropagation()} className="modal-card modal-card-full" style={{ width: '100%', maxWidth: 760, maxHeight: '88vh', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'fadeUp .16s ease' }}>
        <div style={{ padding: '22px 24px 0', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <ChatAvatar nome={L.nome} foto={L.foto} size={46} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: 'Newsreader,serif', fontSize: 26, lineHeight: 1.15 }}>{L.nome}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{L.tel} · {L.corretor} · {colAtual}</span>
          </span>
          <span style={css(canalPill(L.canal) + ';align-self:center')}>{L.canal}</span>
          <button onClick={closeLead} style={{ border: '1px solid var(--line)', background: 'none', width: 30, height: 30, borderRadius: 8, flex: 'none' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 22, padding: '20px 24px 0', borderBottom: '1px solid var(--line)' }}>
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setLeadTab(id as any)}
              style={{ padding: '0 0 13px', border: 'none', background: 'none', fontSize: 13.5, fontWeight: leadTab === id ? 700 : 500, color: leadTab === id ? 'var(--ink)' : 'var(--muted)', borderBottom: '2px solid ' + (leadTab === id ? 'var(--terra)' : 'transparent'), marginBottom: -1 }}
            >
              {label}
            </button>
          ))}
        </div>

        <div ref={chatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {leadTab === 'detalhes' && (
            <>
              <div data-modal-grid style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
                {fields.map(f => (
                  <div key={f.label}>
                    <label style={{ display: 'block', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>{f.label}</label>
                    <input defaultValue={f.value} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5 }} />
                  </div>
                ))}
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 16, background: 'var(--bg)', marginBottom: 20 }}>
                <p style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 10px' }}>Imóvel de interesse</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={css(thumb(5, 56))} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{L.imovel}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{L.imovelSub}</span>
                  </span>
                  <span style={{ fontFamily: 'Newsreader,serif', fontSize: 22 }}>{BRL(L.valor)}</span>
                </div>
              </div>
              <div data-modal-grid style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>Cadência de chamada</label>
                  <select value={cad} onChange={e => setCadencia(L.id, e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5 }}>
                    {CADENCIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>Coluna do Kanban</label>
                  <select value={L.colunaId} onChange={e => move(L.id, e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5 }}>
                    {colunas.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <button onClick={closeLead} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Salvar alterações</button>
                <button onClick={() => advance(L.id)} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Avançar etapa</button>
                <span style={{ flex: 1 }} />
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setExcluirOpen(v => !v)} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, color: '#C0392B' }}>Excluir ▾</button>
                  {excluirOpen && (
                    <div style={{ position: 'absolute', right: 0, bottom: 52, width: 250, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: 6, boxShadow: '0 14px 30px rgba(28,27,26,.16)', zIndex: 5 }}>
                      <button
                        onClick={() => { setExcluirOpen(false); ask('Apagar a conversa?', 'Todas as mensagens de WhatsApp deste lead serão apagadas. O lead continua no CRM.', 'Apagar conversa', () => limparConversa(L.id)); }}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 11px', border: 'none', background: 'none', borderRadius: 6, fontSize: 13 }}
                      >
                        Apagar só a conversa
                      </button>
                      <button
                        onClick={() => { setExcluirOpen(false); ask('Excluir "' + L.nome + '" do CRM?', 'O lead, a conversa, as etiquetas e o histórico são apagados de vez. Não tem como desfazer.', 'Excluir do CRM', () => excluirLead(L.id)); }}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 11px', border: 'none', background: 'none', borderRadius: 6, fontSize: 13, color: '#C0392B', fontWeight: 600 }}
                      >
                        Excluir lead do CRM
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <button onClick={openDiscard} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, color: 'var(--terra)' }}>Descartar lead ▾</button>
                  {discardOpen && (
                    <div style={{ position: 'absolute', right: 0, bottom: 52, width: 262, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: 6, boxShadow: '0 14px 30px rgba(28,27,26,.16)', zIndex: 5 }}>
                      <p style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '6px 10px 8px' }}>Motivo do descarte</p>
                      {MOTIVOS_DESCARTE.map(m => (
                        <button
                          key={m}
                          onClick={() => pickMotivoDescarte(m)}
                          style={{ width: '100%', textAlign: 'left', padding: '9px 11px', border: 'none', background: 'none', borderRadius: 6, fontSize: 13, color: APROVACAO.includes(m) ? 'var(--terra)' : 'var(--ink)' }}
                        >
                          {m}
                        </button>
                      ))}
                      {discardWarn && (
                        <div style={{ borderTop: '1px solid var(--line)', marginTop: 6, padding: '12px 10px 8px' }}>
                          <p style={{ fontSize: 12.5, lineHeight: 1.55, margin: '0 0 10px', color: 'var(--terra)', fontWeight: 600 }}>"{discardWarn}" requer aprovação do gerente.</p>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={requestApproval} style={{ flex: 1, padding: 8, border: 'none', borderRadius: 7, background: 'var(--terra)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>Solicitar aprovação</button>
                            <button onClick={closeDiscard} style={{ padding: '8px 11px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5 }}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {leadTab === 'chat' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {chatMsgs.map(m => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {m.sep && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0' }}>
                        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>{m.sepLabel}</span>
                        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                      </div>
                    )}
                    <div style={css(m.rowStyle)}>
                      <span style={css(m.bubbleStyle)}>
                        {m.bot && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', background: 'rgba(255,255,255,.18)', padding: '3px 8px', borderRadius: 20, marginBottom: 7 }}>Follow-up automático</span>}
                        {m.anexoUrl && <AnexoMensagem url={m.anexoUrl} tipo={m.anexoTipo} nome={m.anexoNome} onLoad={paraOFimChat} />}
                        {m.texto && <span style={{ display: 'block' }}>{m.texto}</span>}
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, fontSize: 10.5, opacity: 0.75, marginTop: 5 }}>{m.stamp}<Visto estado={m.visto} /></span>
                      </span>
                    </div>
                  </div>
                ))}
                {typing && (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 0' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', animation: 'dots 1s infinite' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', animation: 'dots 1s .15s infinite' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', animation: 'dots 1s .3s infinite' }} />
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 6 }}>{L.nome.split(' ')[0]} está digitando…</span>
                  </div>
                )}
                
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {quickTemplates.map(q => (
                  <button key={q.label} onClick={() => setDraft(q.texto)} style={{ padding: '6px 11px', border: '1px solid var(--line)', borderRadius: 20, background: 'none', fontSize: 12 }}>{q.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  style={{ display: 'none' }}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file || !token) return;
                    setEnviandoAnexo(true);
                    try {
                      const { url, nome } = await uploadArquivo(file, token);
                      await enviarMensagem(L.id, { anexoUrl: url, anexoTipo: tipoDeArquivo(file.type), anexoNome: nome });
                    } catch (err) {
                      toast((err as Error).message || 'Não foi possível enviar o anexo');
                    } finally {
                      setEnviandoAnexo(false);
                    }
                  }}
                />
                <button title="Anexar arquivo" onClick={() => fileInputRef.current?.click()} disabled={enviandoAnexo} style={{ width: 44, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', color: 'var(--muted)', flex: 'none', opacity: enviandoAnexo ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Paperclip size={16} />
                </button>
                <EmojiPicker onPick={emoji => setDraft(draft + emoji)} />
                <AudioRecordButton
                  disabled={enviandoAnexo}
                  onError={msg => toast(msg)}
                  onRecorded={async file => {
                    if (!token) return;
                    setEnviandoAnexo(true);
                    try {
                      const { url } = await uploadArquivo(file, token);
                      await enviarMensagem(L.id, { anexoUrl: url, anexoTipo: "audio" });
                    } catch (err) {
                      toast((err as Error).message || 'Não foi possível enviar o áudio');
                    } finally {
                      setEnviandoAnexo(false);
                    }
                  }}
                />
                <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} placeholder="Escreva uma mensagem…" style={{ flex: 1, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5 }} />
                <button onClick={sendMsg} style={{ padding: '12px 20px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Enviar</button>
              </div>
            </>
          )}

          {leadTab === 'followup' && (
            <>
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: seqSt === 'ativa' ? 'var(--olive)' : seqSt === 'pausada' ? 'var(--terra)' : 'var(--muted)' }} />
                <span style={{ flex: 1, minWidth: 190 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{seqSt === 'ativa' ? 'Sequência ativa' : seqSt === 'pausada' ? 'Sequência pausada' : 'Sequência encerrada'} — "Lead novo — Aurora"</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>Próximo envio: amanhã, 09:00 · passo 3 de 5</span>
                </span>
                {seqSt === 'ativa' && <button onClick={() => pauseSeq(L.id)} style={{ padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600 }}>Pausar</button>}
                {seqSt === 'pausada' && <button onClick={() => resumeSeq(L.id)} style={{ padding: '8px 14px', border: '1px solid var(--olive)', borderRadius: 7, background: 'none', color: 'var(--olive)', fontSize: 12.5, fontWeight: 600 }}>Retomar</button>}
                {seqSt === 'encerrada' && <button onClick={() => resumeSeq(L.id)} style={{ padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600 }}>Reinscrever</button>}
                <button onClick={() => endSeq(L.id)} style={{ padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, color: 'var(--terra)' }}>Encerrar</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {seqSteps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', marginTop: 5, flex: 'none', background: s.done ? 'var(--olive)' : s.now ? 'var(--terra)' : 'var(--line)' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{s.delay}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>{s.texto}</span>
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 20, alignSelf: 'center', ...(s.done ? { background: 'var(--oliveSoft)', color: 'var(--olive)' } : s.now ? { background: 'var(--terraSoft)', color: 'var(--terra)' } : { border: '1px solid var(--line)', color: 'var(--muted)' }) }}>{s.tag}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {leadTab === 'historico' && (
            <>
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 14, background: 'var(--bg)', marginBottom: 18 }}>
                <p style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 10px' }}>Tarefas deste lead</p>
                {tarefasDoLead.map(t => {
                  const atrasada = !t.concluida && +new Date(t.venceEm) < Date.now();
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                      <input type="checkbox" checked={t.concluida} onChange={e => toggleTarefa(t.id, e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--terra)' }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, textDecoration: t.concluida ? 'line-through' : 'none', color: t.concluida ? 'var(--muted)' : 'var(--ink)' }}>{t.titulo}</span>
                      <span style={{ fontSize: 11.5, color: atrasada ? 'var(--terra)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {new Date(t.venceEm).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
                {tarefasDoLead.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 10px' }}>Nenhuma tarefa aberta.</p>}
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <input
                    value={tarefaTitulo} onChange={e => setTarefaTitulo(e.target.value)}
                    placeholder="Nova tarefa (ex: Ligar amanhã)"
                    style={{ flex: 1, minWidth: 160, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--card)', fontSize: 13 }}
                  />
                  <input
                    type="datetime-local" value={tarefaQuando} onChange={e => setTarefaQuando(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--card)', fontSize: 13 }}
                  />
                  <button
                    onClick={salvarTarefaRapida} disabled={tarefaTitulo.trim().length < 1 || !tarefaQuando}
                    style={{ padding: '8px 14px', border: 'none', borderRadius: 7, background: 'var(--terra)', color: '#fff', fontSize: 12.5, fontWeight: 600, opacity: tarefaTitulo.trim().length < 1 || !tarefaQuando ? 0.5 : 1 }}
                  >Criar</button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                <input
                  value={nota} onChange={e => setNota(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') salvarNota(); }}
                  placeholder="Anotar algo na linha do tempo…"
                  style={{ flex: 1, padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13 }}
                />
                <button onClick={salvarNota} disabled={nota.trim().length < 1} style={{ padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600, opacity: nota.trim().length < 1 ? 0.5 : 1 }}>Anotar</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {eventos.map((ev, i) => (
                  <div key={ev.id} style={{ display: 'flex', gap: 16 }}>
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: ev.tipo === 'nota' ? 'var(--line)' : 'var(--terra)', marginTop: 5 }} />
                      {i < eventos.length - 1 && <span style={{ width: 1, flex: 1, background: 'var(--line)' }} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, paddingBottom: 20 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{ev.descricao}</span>
                      {ev.atorNome && <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>por {ev.atorNome}</span>}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{quandoRelativo(ev.criadoEm)}</span>
                  </div>
                ))}
                {eventos.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Sem eventos ainda. As ações no lead (mudança de coluna, mensagens, distribuição, tarefas) aparecem aqui.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
