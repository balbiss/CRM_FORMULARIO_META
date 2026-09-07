import { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { mapMsgs, type Lead } from '../lib/data';
import { Visto } from '../components/Visto';
import { ChatAvatar } from '../components/ChatAvatar';
import { canalPill, dayLabel } from '../lib/format';
import { css } from '../lib/css';
import { uploadArquivo, tipoDeArquivo } from '../lib/upload';
import { AnexoMensagem } from '../components/AnexoMensagem';
import { AudioRecordButton } from '../components/AudioRecordButton';
import { EmojiPicker } from '../components/EmojiPicker';

export default function Conversas() {
  const allLeads = useAppStore(s => s.leads);
  const chats = useAppStore(s => s.chats);
  const conversas = useAppStore(s => s.conversas);
  const perfis = useAppStore(s => s.perfisRemotos);
  const token = useAppStore(s => s.token);
  const enviarMensagem = useAppStore(s => s.enviarMensagem);
  const toast = useAppStore(s => s.toast);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const convId = useAppStore(s => s.convId);
  const convDraft = useAppStore(s => s.convDraft);
  const convQuery = useAppStore(s => s.convQuery);
  const convCorretor = useAppStore(s => s.convCorretor);
  const convTyping = useAppStore(s => s.convTyping);
  const setConvDraft = useAppStore(s => s.setConvDraft);
  const setConvQuery = useAppStore(s => s.setConvQuery);
  const setConvCorretor = useAppStore(s => s.setConvCorretor);
  const pickConv = useAppStore(s => s.pickConv);
  const backToList = useAppStore(s => s.backToList);
  const sendConv = useAppStore(s => s.sendConv);
  const openLead = useAppStore(s => s.openLead);
  const { isManager, meNome } = useRoleInfo();

  const thread = (l: Lead) => chats[l.id] || [];

  // Conversas com dado real (10k+ leads na base): só listar quem já teve alguma mensagem de
  // verdade, não todo mundo — senão a lista fica enorme e inútil (maioria nunca falou pelo CRM).
  const conversaPorLead = useMemo(() => new Map(conversas.map(c => [c.leadId, c])), [conversas]);

  const q = (convQuery || '').trim().toLowerCase();
  const convBase = useMemo(() => allLeads
    .filter(l => conversaPorLead.has(l.id))
    .filter(l => (isManager ? (convCorretor === 'Todos os corretores' || l.corretor === convCorretor) : l.corretor === meNome))
    .filter(l => !q || l.nome.toLowerCase().includes(q) || (q.replace(/\D/g, '') !== '' && l.tel.replace(/\D/g, '').includes(q.replace(/\D/g, ''))))
    .sort((a, b) => new Date(conversaPorLead.get(b.id)!.enviadoEm).getTime() - new Date(conversaPorLead.get(a.id)!.enviadoEm).getTime()),
    [allLeads, conversaPorLead, isManager, convCorretor, meNome, q]);

  const CL = convBase.find(l => l.id === convId);
  const convThread = mapMsgs(CL ? thread(CL) : []);
  const scrollRef = useRef<HTMLDivElement>(null);
  const paraOFim = () => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  };
  useEffect(paraOFim, [convThread.length, convId, convTyping]);
  const slashQ = (convDraft || '').startsWith('/') ? convDraft.slice(1).toLowerCase() : null;
  const SLASH_ITEMS: [string, string][] = [
    ['/tabela', 'Acabei de te enviar a tabela de valores atualizada. Qualquer dúvida, me chama.'],
    ['/visita', 'Passando para confirmar nossa visita — consegue no horário combinado?'],
    ['/docs', 'Para adiantar a análise, me envia RG, CPF e comprovante de renda?'],
    ['/proposta', 'Montei uma proposta com a condição de entrada desta semana. Posso te ligar para explicar?'],
  ];
  const slashItems = SLASH_ITEMS.filter(([cmd]) => slashQ === null || cmd.slice(1).startsWith(slashQ));

  return (
    <div className="conv-fullbleed">
      <div className="conv-grid">
        <div className="conv-col" data-hide={CL ? '1' : '0'} style={{ borderRight: '1px solid var(--line)', background: 'var(--card)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 21, margin: 0 }}>Conversas</h1>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{convBase.length}</span>
            </div>
            <input value={convQuery} onChange={e => setConvQuery(e.target.value)} placeholder="Buscar por nome ou telefone…" style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, boxSizing: 'border-box' }} />
            {isManager && (
              <select value={convCorretor} onChange={e => setConvCorretor(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, boxSizing: 'border-box' }}>
                <option>Todos os corretores</option>
                {perfis.map(p => <option key={p.id}>{p.nome}</option>)}
              </select>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {convBase.map(l => {
              const resumo = conversaPorLead.get(l.id);
              const legendaAnexo = resumo?.anexoTipo === 'imagem' ? 'Foto' : resumo?.anexoTipo === 'video' ? 'Vídeo' : resumo?.anexoTipo === 'documento' ? 'Documento' : resumo?.anexoTipo === 'audio' ? 'Áudio' : resumo?.texto;
              const dataMsg = resumo ? new Date(resumo.enviadoEm) : null;
              const horaMsg = dataMsg ? dataMsg.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
              const diasMsg = dataMsg ? Math.max(0, Math.floor((Date.now() - dataMsg.getTime()) / 86400000)) : 0;
              const on = convId === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => pickConv(l.id)}
                  style={{ width: '100%', display: 'flex', gap: 11, alignItems: 'center', padding: '13px 14px', border: 'none', borderBottom: '1px solid var(--line)', background: on ? 'var(--bg)' : 'transparent', boxShadow: 'inset 3px 0 0 ' + (on ? 'var(--terra)' : 'transparent') }}
                >
                  <ChatAvatar nome={l.nome} foto={l.foto} size={38} />
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{diasMsg === 0 ? horaMsg : dayLabel(diasMsg) + ' ' + horaMsg}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', flex: 'none', background: l.canal === 'WhatsApp' ? 'var(--olive)' : (l.canal === 'Instagram' || l.canal === 'Facebook') ? 'var(--terra)' : 'var(--muted)' }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: (resumo?.naoLidas ?? 0) > 0 ? 'var(--ink)' : 'var(--muted)', fontWeight: (resumo?.naoLidas ?? 0) > 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(resumo?.direcao === 'out' ? 'Você: ' : '') + legendaAnexo}</span>
                      {(resumo?.naoLidas ?? 0) > 0 && (
                        <span style={{ flex: 'none', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--olive)', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{resumo!.naoLidas! > 99 ? '99+' : resumo!.naoLidas}</span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
            {convBase.length === 0 && (
              <div style={{ padding: '44px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13.5, margin: '0 0 4px' }}>Nenhuma conversa encontrada.</p>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Ajuste a busca ou o filtro de corretor.</p>
              </div>
            )}
          </div>
        </div>

        <div className="conv-col" data-hide={CL ? '0' : '1'} style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          {CL ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--line)', background: 'var(--card)', flex: 'none' }}>
                <button className="conv-back" onClick={backToList} style={{ display: 'none', width: 30, height: 30, flex: 'none', border: '1px solid var(--line)', borderRadius: 8, background: 'none', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>‹</button>
                <button onClick={() => openLead(CL.id, 'chat')} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', textAlign: 'left', padding: 0 }}>
                  <ChatAvatar nome={CL.nome} foto={CL.foto} size={38} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{CL.nome}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{CL.imovel} · {CL.corretor}</span>
                  </span>
                </button>
                <span style={css(canalPill(CL.canal))}>{CL.canal}</span>
                <button onClick={() => openLead(CL.id, 'chat')} style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>Ver lead</button>
              </div>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {convThread.map(m => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {m.sep && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0' }}>
                        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>{m.sepLabel}</span>
                        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                      </div>
                    )}
                    <div style={css(m.rowStyle)}>
                      <span style={css(m.bubbleStyle)}>
                        {m.bot && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', background: 'rgba(255,255,255,.18)', padding: '3px 8px', borderRadius: 20, marginBottom: 7 }}>Follow-up automático</span>}
                        {m.anexoUrl && <AnexoMensagem url={m.anexoUrl} tipo={m.anexoTipo} nome={m.anexoNome} onLoad={paraOFim} />}
                        {m.texto && <span style={{ display: 'block' }}>{m.texto}</span>}
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, fontSize: 10.5, opacity: 0.75, marginTop: 5 }}>{m.stamp}<Visto estado={m.visto} /></span>
                      </span>
                    </div>
                  </div>
                ))}
                {convTyping && (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', animation: 'dots 1s infinite' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', animation: 'dots 1s .15s infinite' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--muted)', animation: 'dots 1s .3s infinite' }} />
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 6 }}>{CL.nome.split(' ')[0]} está digitando…</span>
                  </div>
                )}
                
              </div>
              <div style={{ borderTop: '1px solid var(--line)', padding: '14px 18px', position: 'relative', background: 'var(--card)', flex: 'none' }}>
                {slashQ !== null && slashItems.length > 0 && (
                  <div style={{ position: 'absolute', left: 18, right: 18, bottom: 64, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, padding: 6, boxShadow: '0 12px 28px rgba(28,27,26,.14)' }}>
                    <p style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '6px 10px 8px' }}>Templates rápidos</p>
                    {slashItems.map(([cmd, label]) => (
                      <button key={cmd} onClick={() => setConvDraft(label)} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', background: 'none', borderRadius: 6, fontSize: 13, display: 'flex', gap: 10 }}>
                        <span style={{ color: 'var(--terra)', fontWeight: 700, fontSize: 12.5 }}>{cmd}</span>
                        <span style={{ flex: 1, minWidth: 0, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file || !token || !CL) return;
                      setEnviandoAnexo(true);
                      try {
                        const { url, nome } = await uploadArquivo(file, token);
                        await enviarMensagem(CL.id, { anexoUrl: url, anexoTipo: tipoDeArquivo(file.type), anexoNome: nome });
                      } catch (err) {
                        toast((err as Error).message || 'Não foi possível enviar o anexo');
                      } finally {
                        setEnviandoAnexo(false);
                      }
                    }}
                  />
                  <button title="Anexar arquivo" onClick={() => fileInputRef.current?.click()} disabled={enviandoAnexo} style={{ width: 38, height: 38, border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 16, color: 'var(--muted)', flex: 'none', opacity: enviandoAnexo ? 0.5 : 1 }}>
                    <Paperclip size={16} style={{ margin: '0 auto' }} />
                  </button>
                  <EmojiPicker onPick={emoji => setConvDraft(convDraft + emoji)} />
                  <AudioRecordButton
                    disabled={enviandoAnexo}
                    onError={msg => toast(msg)}
                    onRecorded={async file => {
                      if (!token || !CL) return;
                      setEnviandoAnexo(true);
                      try {
                        const { url } = await uploadArquivo(file, token);
                        await enviarMensagem(CL.id, { anexoUrl: url, anexoTipo: "audio" });
                      } catch (err) {
                        toast((err as Error).message || 'Não foi possível enviar o áudio');
                      } finally {
                        setEnviandoAnexo(false);
                      }
                    }}
                  />
                  <input value={convDraft} onChange={e => setConvDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendConv()} placeholder="Mensagem · digite / para templates" style={{ flex: 1, minWidth: 0, padding: '11px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5 }} />
                  <button onClick={sendConv} style={{ padding: '11px 20px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, flex: 'none' }}>Enviar</button>
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 }}>
              <span style={{ width: 64, height: 64, border: '1.5px solid var(--line)', borderRadius: '16px 16px 4px 16px', marginBottom: 24, display: 'block' }} />
              <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 28, margin: '0 0 10px' }}>Conversas</h2>
              <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--muted)', margin: 0, maxWidth: '38ch' }}>Selecione uma conversa à esquerda para ver o histórico do lead, responder e abrir a ficha completa.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
