import { useAppStore } from '../store/appStore';

const ROWS = [
  { nome: 'Vanessa Coutinho', tel: '(11) 98771-2043', imovel: 'Edifício Aurora — Cobertura 1201' },
  { nome: 'Márcio Estrela', tel: '(19) 99612-8890', imovel: 'Vila Serena — Casa 14' },
  { nome: 'Aline Piovezan', tel: '(13) 98220-4471', imovel: 'Praia Grande Tower — Apto 1502' },
  { nome: 'Rogério Salles', tel: '(11) 99034-1188', imovel: 'Residencial Mirante — Apto 803' },
];

export function ImportModal() {
  const importOpen = useAppStore(s => s.importOpen);
  const setImportOpen = useAppStore(s => s.setImportOpen);
  const confirmImport = useAppStore(s => s.confirmImport);
  if (!importOpen) return null;
  return (
    <div onClick={() => setImportOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,26,.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, animation: 'fadeUp .14s ease' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 25, margin: '0 0 6px' }}>Importar leads via planilha</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px' }}>CSV ou XLSX · até 500 linhas por importação</p>
        <div style={{ border: '1px dashed var(--line)', borderRadius: 10, padding: 22, textAlign: 'center', marginBottom: 20, background: 'var(--bg)' }}>
          <p style={{ fontSize: 13.5, margin: '0 0 4px', fontWeight: 600 }}>leads-setembro.csv</p>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>24 linhas detectadas · 3 colunas mapeadas</p>
        </div>
        <p style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 10px' }}>Prévia do mapeamento</p>
        <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ display: 'flex', gap: 12, padding: '10px 14px', background: 'var(--bg)', borderBottom: '1px solid var(--line)', fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <span style={{ flex: 1 }}>Nome → nome</span><span style={{ width: 130 }}>Fone → telefone</span><span style={{ flex: 1.2 }}>Interesse → imóvel</span>
          </div>
          {ROWS.map(r => (
            <div key={r.nome} style={{ display: 'flex', gap: 12, padding: '11px 14px', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
              <span style={{ flex: 1, fontWeight: 600 }}>{r.nome}</span>
              <span style={{ width: 130, color: 'var(--muted)' }}>{r.tel}</span>
              <span style={{ flex: 1.2, color: 'var(--muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.imovel}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setImportOpen(false)} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={confirmImport} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Confirmar importação</button>
        </div>
      </div>
    </div>
  );
}
