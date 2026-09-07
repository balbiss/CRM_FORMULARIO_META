import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const chave = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const horaBR = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

export default function Agenda() {
  const { isManager } = useRoleInfo();
  const tarefas = useAppStore(s => s.tarefas);
  const fetchTarefas = useAppStore(s => s.fetchTarefas);
  const criarTarefa = useAppStore(s => s.criarTarefa);
  const toggleTarefa = useAppStore(s => s.toggleTarefa);
  const excluirTarefa = useAppStore(s => s.excluirTarefa);
  const ask = useAppStore(s => s.ask);
  const leads = useAppStore(s => s.leads);
  const perfis = useAppStore(s => s.perfisRemotos);
  const openLead = useAppStore(s => s.openLead);

  const [ref, setRef] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [filtroCorretor, setFiltroCorretor] = useState('');
  const [mostrarFeitas, setMostrarFeitas] = useState(false);
  const [form, setForm] = useState<null | { titulo: string; venceEm: string; leadId: string; corretorId: string }>(null);

  useEffect(() => { fetchTarefas(); }, [fetchTarefas]);

  const corretores = perfis.filter(p => p.role === 'corretor');

  const visiveis = useMemo(() => tarefas.filter(t => {
    if (filtroCorretor && t.corretorId !== filtroCorretor) return false;
    if (!mostrarFeitas && t.concluida) return false;
    if (diaSel && chave(new Date(t.venceEm)) !== diaSel) return false;
    return true;
  }).sort((a, b) => +new Date(a.venceEm) - +new Date(b.venceEm)), [tarefas, filtroCorretor, mostrarFeitas, diaSel]);

  const diasComTarefa = useMemo(() => {
    const set = new Set<string>();
    for (const t of tarefas) if (!t.concluida) set.add(chave(new Date(t.venceEm)));
    return set;
  }, [tarefas]);

  const primeiroDiaSemana = new Date(ref.getFullYear(), ref.getMonth(), 1).getDay();
  const diasNoMes = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const celulas = Array.from({ length: 42 }, (_, i) => {
    const n = i - primeiroDiaSemana + 1;
    if (n < 1 || n > diasNoMes) return null;
    return { n, key: chave(new Date(ref.getFullYear(), ref.getMonth(), n)) };
  });
  const hojeKey = chave(new Date());

  async function salvar() {
    if (!form || form.titulo.trim().length < 1 || !form.venceEm) return;
    const ok = await criarTarefa({
      titulo: form.titulo.trim(),
      venceEm: new Date(form.venceEm).toISOString(),
      ...(form.leadId ? { leadId: form.leadId } : {}),
      ...(form.corretorId ? { corretorId: form.corretorId } : {}),
    });
    if (ok) setForm(null);
  }

  const agora = Date.now();

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Agenda</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Agenda &amp; Tarefas</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isManager && (
            <select value={filtroCorretor} onChange={e => setFiltroCorretor(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}>
              <option value="">Todos os corretores</option>
              {corretores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
          <button
            onClick={() => setForm({ titulo: '', venceEm: '', leadId: '', corretorId: '' })}
            style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}
          >Nova tarefa</button>
        </div>
      </div>

      {form && (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 18, marginBottom: 14, display: 'grid', gap: 10 }}>
          <input
            autoFocus value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
            placeholder="O que precisa ser feito? (ex: Ligar para confirmar a visita)"
            style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5 }}
          />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              Vence em
              <input type="datetime-local" value={form.venceEm} onChange={e => setForm({ ...form, venceEm: e.target.value })}
                style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13 }} />
            </label>
            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
              Lead (opcional)
              <select value={form.leadId} onChange={e => setForm({ ...form, leadId: e.target.value })}
                style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13 }}>
                <option value="">— nenhum —</option>
                {leads.map(l => <option key={l.id} value={l.id}>{l.nome} · {l.tel}</option>)}
              </select>
            </label>
            {isManager && (
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                Responsável
                <select value={form.corretorId} onChange={e => setForm({ ...form, corretorId: e.target.value })}
                  style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13 }}>
                  <option value="">Eu mesmo</option>
                  {corretores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={salvar} disabled={form.titulo.trim().length < 1 || !form.venceEm}
              style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: form.titulo.trim().length < 1 || !form.venceEm ? 0.5 : 1 }}>Salvar</button>
            <button onClick={() => setForm(null)} style={{ padding: '9px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13 }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 14, alignItems: 'start' }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))} style={{ border: '1px solid var(--line)', background: 'none', width: 28, height: 28, borderRadius: 7 }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{MESES[ref.getMonth()]} {ref.getFullYear()}</span>
            <button onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))} style={{ border: '1px solid var(--line)', background: 'none', width: 28, height: 28, borderRadius: 7 }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6, marginBottom: 8 }}>
            {WEEKDAYS.map(d => <span key={d} style={{ textAlign: 'center', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{d}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {celulas.map((c, i) => {
              if (!c) return <span key={i} />;
              const on = c.key === diaSel;
              const has = diasComTarefa.has(c.key);
              const hoje = c.key === hojeKey;
              return (
                <button
                  key={i}
                  onClick={() => setDiaSel(on ? null : c.key)}
                  style={{ aspectRatio: '1', border: '1px solid ' + (on ? 'var(--terra)' : hoje ? 'var(--line)' : 'transparent'), borderRadius: 8, background: on ? 'var(--terraSoft)' : 'transparent', color: on ? 'var(--terra)' : 'var(--ink)', fontSize: 13, fontWeight: on || hoje ? 700 : 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}
                >
                  {c.n}
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: has ? 'var(--terra)' : 'transparent' }} />
                </button>
              );
            })}
          </div>
          {diaSel && <button onClick={() => setDiaSel(null)} style={{ marginTop: 12, border: 'none', background: 'none', fontSize: 12, color: 'var(--terra)', fontWeight: 600 }}>Ver todas as datas</button>}
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 21, margin: 0 }}>
              {diaSel ? 'Tarefas de ' + new Date(diaSel + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }) : 'Tarefas'}
            </h2>
            <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={mostrarFeitas} onChange={e => setMostrarFeitas(e.target.checked)} /> mostrar concluídas
            </label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {visiveis.map(t => {
              const atrasada = !t.concluida && +new Date(t.venceEm) < agora;
              return (
                <div key={t.id} style={{ display: 'flex', gap: 14, padding: '13px 0', borderBottom: '1px solid var(--line)', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox" checked={t.concluida} onChange={e => toggleTarefa(t.id, e.target.checked)}
                    style={{ marginTop: 3, width: 16, height: 16, flex: 'none', accentColor: 'var(--terra)' }}
                  />
                  <span style={{ width: 62, flex: 'none' }}>
                    <span style={{ display: 'block', fontFamily: 'Newsreader,serif', fontSize: 16 }}>{horaBR(t.venceEm)}</span>
                    <span style={{ display: 'block', fontSize: 11, color: atrasada ? 'var(--terra)' : 'var(--muted)' }}>{dataBR(t.venceEm)}</span>
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, textDecoration: t.concluida ? 'line-through' : 'none', color: t.concluida ? 'var(--muted)' : 'var(--ink)' }}>{t.titulo}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                      {t.corretorNome || '—'}
                      {t.leadNome && <> · <button onClick={() => t.leadId && openLead(t.leadId)} style={{ border: 'none', background: 'none', color: 'var(--terra)', fontSize: 11.5, fontWeight: 600, padding: 0 }}>{t.leadNome}</button></>}
                    </span>
                  </span>
                  {atrasada && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 20, background: 'var(--terraSoft)', color: 'var(--terra)', alignSelf: 'center' }}>Atrasada</span>}
                  <button
                    onClick={() => ask('Excluir tarefa', '"' + t.titulo + '" será removida.', 'Excluir', () => excluirTarefa(t.id))}
                    style={{ border: 'none', background: 'none', color: 'var(--muted)', fontSize: 16, flex: 'none', lineHeight: 1 }}
                  >×</button>
                </div>
              );
            })}
            {visiveis.length === 0 && (
              <p style={{ padding: '24px 0', fontSize: 13, color: 'var(--muted)', margin: 0, textAlign: 'center' }}>
                Nenhuma tarefa {diaSel ? 'nesta data' : 'por aqui'}. Crie uma em "Nova tarefa".
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
