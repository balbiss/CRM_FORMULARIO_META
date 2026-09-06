import { useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo, scopeLeads } from '../lib/selectors';
import { BRL, ini } from '../lib/format';

function statusOf(col: string) {
  if (col === 'venda') return { label: 'Fidelizado', bg: 'var(--oliveSoft)', color: 'var(--olive)' };
  if (col === 'novo') return { label: 'Lead Novo', bg: 'border', color: 'var(--muted)' };
  return { label: 'Em Atendimento', bg: 'var(--terraSoft)', color: 'var(--terra)' };
}

export default function Clientes() {
  const allLeads = useAppStore(s => s.leads);
  const openLead = useAppStore(s => s.openLead);
  const setImportOpen = useAppStore(s => s.setImportOpen);
  const { isManager, meNome } = useRoleInfo();
  const [query, setQuery] = useState('');

  const leads = useMemo(() => {
    const scoped = scopeLeads(allLeads, isManager, meNome);
    const q = query.trim().toLowerCase();
    return q ? scoped.filter(l => l.nome.toLowerCase().includes(q) || l.tel.includes(q)) : scoped;
  }, [allLeads, isManager, meNome, query]);

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Contatos</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Clientes</h1>
        </div>
        <div className="page-toolbar" style={{ display: 'flex', gap: 8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome ou telefone…" style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, width: 220 }} />
          <button onClick={() => setImportOpen(true)} style={{ padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, fontWeight: 600 }}>Importar clientes</button>
        </div>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
        <div className="data-table-head" style={{ display: 'flex', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          <span style={{ flex: 1.6 }}>Cliente</span>
          <span style={{ flex: 1 }}>Contato</span>
          <span style={{ width: 150 }}>Status</span>
          <span style={{ width: 120 }}>Valor</span>
          <span style={{ width: 80 }} />
        </div>
        {leads.map(l => {
          const st = statusOf(l.col);
          return (
            <div key={l.id} className="data-row" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ flex: 1.6, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{ini(l.nome)}</span>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nome}</span>
              </span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>{l.tel}</span>
              <span style={{ width: 150 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 20, background: st.bg === 'border' ? 'none' : st.bg, border: st.bg === 'border' ? '1px solid var(--line)' : 'none', color: st.color }}>{st.label}</span>
              </span>
              <span style={{ width: 120, fontFamily: 'Newsreader,serif', fontSize: 15 }}>{BRL(l.valor)}</span>
              <button onClick={() => openLead(l.id)} style={{ width: 80, padding: '7px 0', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600 }}>Abrir</button>
            </div>
          );
        })}
        {leads.length === 0 && (
          <div style={{ padding: '44px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: 0 }}>Nenhum cliente encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
