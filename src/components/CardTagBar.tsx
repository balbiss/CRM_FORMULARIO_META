import { useEffect, useRef, useState } from 'react';
import { FileText, CalendarClock, MessageCircle, History, Flag, Plus, Check } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import type { Lead } from '../lib/data';

const ICON = 15;
const CORES = ['#123C87', '#0E7C66', '#B5652F', '#7A3E9D', '#B02E4A', '#2C7A8C', '#6B7280', '#C08A00'];

/** Barra de ações rápidas + etiquetas no rodapé do card do Kanban (padrão Kommo/RD).
 *  Ícones reais (lucide), não emoji. Cada botão é um atalho pra uma aba da ficha; o de
 *  etiqueta abre o seletor de tags. */
export function CardTagBar({ lead }: { lead: Lead }) {
  const openLead = useAppStore(s => s.openLead);
  const tags = useAppStore(s => s.tags);
  const toggleLeadTag = useAppStore(s => s.toggleLeadTag);
  const createTag = useAppStore(s => s.createTag);
  const { isManager } = useRoleInfo();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [novo, setNovo] = useState('');
  const [novaCor, setNovaCor] = useState(CORES[0]);
  const ref = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  const abrir = () => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (r) {
      const W = 220, H = 280;
      const left = Math.min(Math.max(8, r.right - W), window.innerWidth - W - 8);
      const top = r.top > H + 16 ? r.top - H - 6 : Math.min(r.bottom + 6, window.innerHeight - H - 8);
      setPos({ left, top });
    }
    setOpen(v => !v);
  };

  const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };

  const iconBtn = (title: string, Icon: typeof FileText, onClick: () => void) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={stop(onClick)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 26,
        border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--terra)', borderRadius: 7,
      }}
    >
      <Icon size={ICON} strokeWidth={2} />
    </button>
  );

  // etiquetas do lead, na ordem em que foram cadastradas
  const minhas = tags.filter(t => lead.tags.includes(t.id));
  const nomes = minhas.map(t => t.nome).join(', ');

  const criar = async () => {
    const nome = novo.trim();
    if (!nome) return;
    const t = await createTag(nome, novaCor);
    setNovo('');
    if (t) toggleLeadTag(lead.id, t.id);
  };

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}
      onClick={e => e.stopPropagation()}
    >
      {iconBtn('Abrir ficha', FileText, () => openLead(lead.id, 'detalhes'))}
      {iconBtn('Follow-up', CalendarClock, () => openLead(lead.id, 'followup'))}
      {iconBtn('Conversa no WhatsApp', MessageCircle, () => openLead(lead.id, 'chat'))}
      {iconBtn('Histórico', History, () => openLead(lead.id, 'historico'))}

      <div style={{ marginLeft: 'auto', display: 'flex' }}>
        <button
          type="button"
          ref={anchorRef}
          title={minhas.length ? 'Etiquetas: ' + nomes : 'Adicionar etiqueta'}
          aria-label={minhas.length ? 'Etiquetas: ' + nomes : 'Adicionar etiqueta'}
          onClick={stop(abrir)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, minWidth: 28, height: 26, padding: '0 5px',
            border: '1px solid ' + (minhas.length || open ? 'var(--terra)' : 'var(--line)'),
            background: minhas.length || open ? 'var(--terraSoft)' : 'var(--card)', borderRadius: 7,
          }}
        >
          {minhas.length === 0 ? (
            <Flag size={ICON} strokeWidth={2} color="var(--muted)" />
          ) : (
            <>
              {minhas.slice(0, 3).map(t => (
                <Flag key={t.id} size={ICON} strokeWidth={0} fill={t.cor} color={t.cor} />
              ))}
              {minhas.length > 3 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--terra)', marginLeft: 1 }}>+{minhas.length - 3}</span>}
            </>
          )}
        </button>
        {open && pos && (
          <div
            ref={ref}
            style={{
              position: 'fixed', left: pos.left, top: pos.top, width: 220, background: 'var(--card)', border: '1px solid var(--line)',
              borderRadius: 10, boxShadow: '0 12px 30px rgba(8,17,31,.22)', zIndex: 200, padding: 6, animation: 'fadeUp .12s ease',
            }}
          >
            <p style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: '4px 6px 6px' }}>Etiquetas</p>
            <div style={{ maxHeight: 190, overflowY: 'auto' }}>
              {tags.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 6px 8px' }}>Nenhuma etiqueta ainda.</p>}
              {tags.map(t => {
                const on = lead.tags.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={stop(() => toggleLeadTag(lead.id, t.id))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 6px', border: 'none', background: on ? 'var(--bg)' : 'none', borderRadius: 6, textAlign: 'left' }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: t.cor, flex: 'none' }} />
                    <span style={{ flex: 1, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nome}</span>
                    {on && <Check size={13} strokeWidth={2.5} color="var(--terra)" />}
                  </button>
                );
              })}
            </div>
            {isManager && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', gap: 5, marginBottom: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                  {CORES.map(c => (
                    <button key={c} type="button" onClick={() => setNovaCor(c)} aria-label={'cor ' + c}
                      style={{ width: 18, height: 18, borderRadius: 5, background: c, flex: 'none', border: '2px solid ' + (novaCor === c ? 'var(--ink)' : 'transparent'), cursor: 'pointer' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={novo}
                    onChange={e => setNovo(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criar(); } }}
                    onClick={e => e.stopPropagation()}
                    placeholder="Nome da etiqueta"
                    style={{ flex: 1, minWidth: 0, padding: '7px 8px', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--bg)', fontSize: 12 }}
                  />
                  <button type="button" onClick={stop(criar)} aria-label="Criar etiqueta" style={{ width: 30, flex: 'none', border: '1px solid var(--line)', borderRadius: 6, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={14} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { CORES };
