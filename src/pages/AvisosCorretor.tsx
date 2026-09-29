import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { apiFetch } from '../lib/api';

type Aviso = {
  id: string;
  leadId: string | null;
  leadNome: string;
  corretorId: string | null;
  corretorNome: string;
  sucesso: boolean;
  erro: string | null;
  criadoEm: string;
};

const formatarData = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function AvisosCorretor() {
  const token = useAppStore(s => s.token);
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'sucesso' | 'erro'>('todos');

  const buscar = () => {
    apiFetch<Aviso[]>('/api/avisos-corretor', token).then(setAvisos).catch(() => setAvisos([]));
  };

  useEffect(() => {
    buscar();
    const t = setInterval(buscar, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lista = (avisos ?? []).filter(a => filtro === 'todos' || (filtro === 'sucesso') === a.sucesso);
  const totalSucesso = (avisos ?? []).filter(a => a.sucesso).length;
  const totalErro = (avisos ?? []).filter(a => !a.sucesso).length;

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Ferramentas</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Avisos por WhatsApp</h1>
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 16px', lineHeight: 1.6, maxWidth: 640 }}>
        Toda vez que a roleta atribui um lead e o CRM tenta avisar o corretor pelo WhatsApp pessoal dele, o resultado
        (chegou ou não) aparece aqui — mesmo quando falha, o lead já foi atribuído normalmente por dentro do CRM.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {([
          ['todos', 'Todos (' + (avisos?.length ?? 0) + ')'],
          ['sucesso', 'Enviados (' + totalSucesso + ')'],
          ['erro', 'Falharam (' + totalErro + ')'],
        ] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFiltro(v)}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
              border: '1px solid ' + (filtro === v ? 'var(--terra)' : 'var(--line)'),
              background: filtro === v ? 'var(--terraSoft)' : 'var(--card)',
              color: filtro === v ? 'var(--terra)' : 'var(--ink)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
        <div className="data-row" style={{ display: 'flex', gap: 14, padding: '11px 20px', borderBottom: '1px solid var(--line)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
          <span style={{ width: 100 }}>Quando</span>
          <span style={{ flex: 1.3 }}>Lead</span>
          <span style={{ flex: 1 }}>Corretor</span>
          <span style={{ flex: 1.6 }}>Status</span>
        </div>
        {avisos === null && <p style={{ padding: 20, fontSize: 13, color: 'var(--muted)' }}>Carregando…</p>}
        {avisos !== null && lista.length === 0 && <p style={{ padding: 20, fontSize: 13, color: 'var(--muted)' }}>Nenhum aviso ainda.</p>}
        {lista.map(a => (
          <div key={a.id} className="data-row" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ width: 100, fontSize: 12, color: 'var(--muted)' }}>{formatarData(a.criadoEm)}</span>
            <span style={{ flex: 1.3, fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>{a.leadNome}</span>
            <span style={{ flex: 1, fontSize: 13 }}>{a.corretorNome}</span>
            <span style={{ flex: 1.6, fontSize: 12.5 }}>
              {a.sucesso ? (
                <span style={{ color: 'var(--olive)', fontWeight: 600 }}>✓ Enviado</span>
              ) : (
                <span style={{ color: 'var(--terra)' }}>
                  <span style={{ fontWeight: 600 }}>✗ Falhou</span>{a.erro ? ' — ' + a.erro : ''}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
