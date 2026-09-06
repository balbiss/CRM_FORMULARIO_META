import { useAppStore } from '../store/appStore';

const FAQ = [
  { id: 'kanban', q: 'Kanban de Leads', a: 'Cada coluna é uma etapa real do seu processo comercial. Arraste o card para mover o lead — o tempo na coluna reinicia e o histórico registra a mudança. Colunas podem ser criadas, renomeadas e reordenadas pelo Dono.' },
  { id: 'roleta', q: 'Roleta de Atendimento', a: 'A roleta distribui leads novos na ordem da fila, pulando quem estiver indisponível. Embaralhar reordena a fila mantendo apenas os corretores ativos.' },
  { id: 'bolsao', q: 'Bolsão e Rebatidas', a: 'Leads sem corretor, descartados ou sem resposta caem no bolsão. Qualquer corretor pode puxar rebatidas dentro do limite definido pelo gerente.' },
  { id: 'followup', q: 'Follow-up Automático', a: 'Sequências de mensagens com atraso configurável e variáveis. Se o lead responde, a sequência pausa automaticamente.' },
  { id: 'credito', q: 'Análise de Crédito', a: 'Pastas enviadas ao banco aparecem com status. Pendências devolvidas geram alerta no topo do módulo e tarefa para o corretor responsável.' },
  { id: 'relatorios', q: 'Relatórios', a: 'Funil por etapa real do Kanban, ranking configurável e exportação CSV. Filtros de período, corretor e campanha valem para todos os blocos.' },
];

export default function Manual() {
  const faqOpen = useAppStore(s => s.faqOpen);
  const setFaqOpen = useAppStore(s => s.setFaqOpen);
  return (
    <div style={{ maxWidth: 760 }}>
      <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Ajuda</p>
      <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: '0 0 16px', lineHeight: 1.2 }}>Manual da plataforma</h1>
      <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
        {FAQ.map(f => {
          const open = faqOpen === f.id;
          return (
            <div key={f.id} style={{ borderBottom: '1px solid var(--line)' }}>
              <button onClick={() => setFaqOpen(f.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', background: 'none', border: 'none', textAlign: 'left' }}>
                <span style={{ width: 8, height: 8, transform: 'rotate(45deg)', flex: 'none', background: open ? 'var(--terra)' : 'var(--line)' }} />
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{f.q}</span>
                <span style={{ color: 'var(--muted)', fontSize: 15 }}>{open ? '–' : '+'}</span>
              </button>
              {open && <p style={{ margin: 0, padding: '0 20px 20px 48px', fontSize: 13.5, lineHeight: 1.75, color: 'var(--muted)' }}>{f.a}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
