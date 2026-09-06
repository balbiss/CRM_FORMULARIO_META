import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, Ban, CalendarClock, AlertTriangle, Users, DollarSign } from 'lucide-react';
import { usePlataformaStore } from '../../store/plataformaStore';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Card({ icon, label, valor, cor }: { icon: React.ReactNode; label: string; valor: string; cor?: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: cor || 'var(--muted)', marginBottom: 10 }}>
        {icon}
        <span style={{ fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Newsreader,serif' }}>{valor}</div>
    </div>
  );
}

export default function PlataformaResumo() {
  const resumo = usePlataformaStore(s => s.resumo);
  const imobiliarias = usePlataformaStore(s => s.imobiliarias);
  const carregar = usePlataformaStore(s => s.carregar);
  const nav = useNavigate();

  useEffect(() => { carregar(); }, [carregar]);

  const atencao = imobiliarias.filter(i =>
    i.status !== 'ativa' || (i.diasParaVencer !== null && i.diasParaVencer <= 7),
  );

  return (
    <div>
      <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 30, margin: '0 0 4px' }}>Visão geral</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 24px' }}>Situação das imobiliárias na plataforma.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 26 }}>
        <Card icon={<Building2 size={16} />} label="Imobiliárias" valor={String(resumo?.totalImobiliarias ?? '—')} />
        <Card icon={<CheckCircle2 size={16} />} label="Ativas" valor={String(resumo?.ativas ?? '—')} cor="#0E7C66" />
        <Card icon={<Ban size={16} />} label="Bloqueadas" valor={String(resumo?.bloqueadas ?? '—')} cor="#C0392B" />
        <Card icon={<CalendarClock size={16} />} label="Vencendo em 7 dias" valor={String(resumo?.vencendo7Dias ?? '—')} cor="#B7791F" />
        <Card icon={<AlertTriangle size={16} />} label="Vencidas" valor={String(resumo?.vencidas ?? '—')} cor="#C0392B" />
        <Card icon={<DollarSign size={16} />} label="Receita mensal (MRR)" valor={resumo ? brl(resumo.mrr) : '—'} />
        <Card icon={<Users size={16} />} label="Corretores no total" valor={String(resumo?.totalCorretores ?? '—')} />
        <Card icon={<Users size={16} />} label="Leads no total" valor={String(resumo?.totalLeads ?? '—')} />
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 700, fontSize: 14 }}>
          Precisa de atenção
        </div>
        {atencao.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--muted)', fontSize: 13.5 }}>Nada pendente. Todas as imobiliárias em dia.</div>
        ) : (
          atencao.map(i => (
            <button key={i.id} onClick={() => nav('/plataforma/imobiliarias?abrir=' + i.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 18px', border: 'none', borderTop: '1px solid var(--line)', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{i.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{i.plano} · {brl(i.mensalidade)}/mês</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: i.status !== 'ativa' ? '#C0392B' : '#B7791F' }}>
                {i.status !== 'ativa'
                  ? (i.bloqueioMotivo === 'inadimplencia' ? 'Bloqueada · inadimplência' : 'Bloqueada')
                  : i.diasParaVencer !== null && i.diasParaVencer < 0 ? `Venceu há ${-i.diasParaVencer}d`
                  : `Vence em ${i.diasParaVencer}d`}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
