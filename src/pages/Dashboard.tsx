import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useRoleInfo, scopeLeads } from '../lib/selectors';
import { CANAIS } from '../lib/data';
import { BRL, ini } from '../lib/format';

const CARGO: Record<string, string> = { dono: 'Dono', gerente: 'Gerente', corretor: 'Corretor' };

function saudacaoAgora() {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function Dashboard() {
  const allLeads = useAppStore(s => s.leads);
  const openLead = useAppStore(s => s.openLead);
  const { isManager, meNome } = useRoleInfo();
  const nav = useNavigate();
  const toast = useAppStore(s => s.toast);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const saudacao = useMemo(saudacaoAgora, []);

  const colunas = useAppStore(s => s.colunasRemotas);
  const perfis = useAppStore(s => s.perfisRemotos);
  const leads = useMemo(() => scopeLeads(allLeads, isManager, meNome), [allLeads, isManager, meNome]);

  const counts = colunas.map(c => leads.filter(l => l.colunaId === c.id).length);
  const maxC = Math.max(...counts, 1);
  const funnel = colunas.map((c, i) => ({
    colId: c.id, title: c.titulo, label: counts[i] + ' leads',
    pct: Math.round((counts[i] / maxC) * 100),
    color: c.slug === 'venda' ? 'var(--olive)' : 'var(--terra)',
  }));

  const oCount = CANAIS.map(c => leads.filter(l => l.canal === c).length);
  const oMax = Math.max(...oCount, 1);
  const origins = CANAIS.map((c, i) => ({ label: c, n: oCount[i], h: Math.round((oCount[i] / oMax) * 130) }));

  const vendas = leads.filter(l => l.col === 'venda');
  const vgv = vendas.reduce((a, l) => a + l.valor, 0);
  const totalLeads = leads.length;
  const convPct = totalLeads ? Math.round((vendas.length / totalLeads) * 1000) / 10 : 0;

  const kpis = isManager
    ? [
        { label: 'Leads no mês', value: String(totalLeads), delta: 'todos os corretores' },
        { label: 'Taxa de conversão', value: convPct + '%', delta: vendas.length + ' vendas fechadas' },
        { label: 'Vendas fechadas', value: BRL(vgv), delta: vendas.length + ' contratos assinados' },
        { label: 'Leads sem corretor', value: String(allLeads.filter(l => l.col === 'novo' && !l.corretor).length), delta: 'aguardando distribuição' },
      ]
    : [
        { label: 'Meus leads', value: String(totalLeads), delta: 'atribuídos a você' },
        { label: 'Minha conversão', value: convPct + '%', delta: vendas.length + ' vendas fechadas' },
        { label: 'Minhas vendas', value: BRL(vgv), delta: vendas.length + ' contratos assinados' },
        { label: 'Em atendimento', value: String(leads.filter(l => l.col !== 'novo' && l.col !== 'venda' && l.col !== 'rebatida').length), delta: 'leads ativos com você' },
      ];

  const ranking = perfis
    .map(p => {
      const meus = allLeads.filter(l => l.corretor === p.nome);
      const v = meus.filter(l => l.col === 'venda');
      return { nome: p.nome, cargo: CARGO[p.role] || p.role, vgv: v.reduce((a, l) => a + l.valor, 0), conv: meus.length ? Math.round((v.length / meus.length) * 100) + '%' : '0%', leads: meus.length };
    })
    .filter(r => r.leads > 0)
    .sort((a, b) => b.vgv - a.vgv);

  // Sem tabela de tarefas ainda — mostramos os leads parados há dias na coluna atual (sinal real de atenção).
  const overdue = leads
    .filter(l => l.dias >= 3 && l.col !== 'venda' && l.col !== 'rebatida')
    .filter(l => !dismissed.has(l.id))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 7)
    .map(l => ({ id: l.id, titulo: l.nome, sub: (l.corretor || 'Sem corretor') + ' · ' + (colunas.find(c => c.id === l.colunaId)?.titulo || l.col), atraso: l.dias + (l.dias === 1 ? ' dia' : ' dias'), leadId: l.id }));

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Visão geral</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>{saudacao}, {meNome.split(' ')[0]}.</h1>
        </div>
      </div>

      <div id="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(212px,1fr))', gap: 14, marginBottom: 14 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 20 }}>
            <p style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 14px' }}>{k.label}</p>
            <p style={{ fontFamily: 'Newsreader,serif', fontSize: 38, lineHeight: 1, margin: '0 0 10px' }}>{k.value}</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>{k.delta}</p>
          </div>
        ))}
      </div>

      <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 14, marginBottom: 14 }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
            <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 22, margin: 0, lineHeight: 1.2 }}>Funil por etapa</h2>
            <button onClick={() => nav('/kanban')} style={{ background: 'none', border: 'none', color: 'var(--terra)', fontSize: 12.5, fontWeight: 600 }}>Ver Kanban →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {funnel.map(f => (
              <button
                key={f.title}
                onClick={() => nav('/kanban', { state: { scrollToCol: f.colId } })}
                style={{ display: 'block', width: '100%', border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span>{f.title}</span><span style={{ color: 'var(--muted)' }}>{f.label}</span>
                </div>
                <div style={{ height: 9, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 6, width: f.pct + '%', background: f.color }} />
                </div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 22 }}>
          <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 22, margin: '0 0 22px' }}>Origem do lead</h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 180, paddingBottom: 2 }}>
            {origins.map((o, i) => (
              <button
                key={o.label}
                onClick={() => nav('/kanban', { state: { filterCanal: o.label } })}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, height: '100%', justifyContent: 'flex-end', border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
              >
                <span style={{ fontFamily: 'Newsreader,serif', fontSize: 19 }}>{o.n}</span>
                <div style={{ width: '100%', borderRadius: '5px 5px 0 0', height: o.h, background: 'var(--terra)', opacity: i % 2 ? 1 : 0.5 }} />
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 12 }}>
            {origins.map(o => (
              <button key={o.label} onClick={() => nav('/kanban', { state: { filterCanal: o.label } })} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--muted)', lineHeight: 1.3, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}>{o.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.45fr', gap: 14 }}>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 22 }}>
          <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 22, margin: '0 0 18px' }}>Ranking de corretores</h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {ranking.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Ainda sem leads atribuídos a corretores.</p>}
            {ranking.map((r, i) => (
              <div key={r.nome} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontFamily: 'Newsreader,serif', fontSize: 17, color: 'var(--muted)', width: 20 }}>{i + 1}</span>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{ini(r.nome)}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{r.cargo} · {r.conv} conversão</span>
                </span>
                <span style={{ fontFamily: 'Newsreader,serif', fontSize: 16 }}>{BRL(r.vgv)}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
            <h2 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 22, margin: 0 }}>Leads parados</h2>
            <span style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--terra)', fontWeight: 700 }}>{overdue.length} há 3+ dias</span>
          </div>
          {overdue.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {overdue.map(t => (
                <div
                  key={t.id}
                  onClick={() => openLead(t.leadId)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                >
                  <button
                    onClick={e => { e.stopPropagation(); setDismissed(s => new Set(s).add(t.id)); toast('Escondido do painel'); }}
                    title="Esconder do painel"
                    style={{ width: 17, height: 17, border: '1.5px solid var(--line)', borderRadius: 5, background: 'none', flex: 'none' }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{t.titulo}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)' }}>{t.sub}</span>
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--terra)', background: 'var(--terraSoft)', padding: '4px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{t.atraso}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '44px 0', textAlign: 'center' }}>
              <div style={{ width: 26, height: 26, border: '1.5px solid var(--line)', borderRadius: '50%', margin: '0 auto 14px' }} />
              <p style={{ fontSize: 14, margin: '0 0 4px' }}>Nada atrasado por aqui.</p>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Sua equipe está em dia com os follow-ups.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
