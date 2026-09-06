import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';

const CANAIS = ['Manual', 'WhatsApp', 'Instagram', 'Facebook', 'Indicacao'] as const;
const CANAL_LABEL: Record<string, string> = { Indicacao: 'Indicação' };

const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' };
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 14, boxSizing: 'border-box' };

export function NewLeadModal() {
  const open = useAppStore(s => s.newLeadOpen);
  const setOpen = useAppStore(s => s.setNewLeadOpen);
  const criar = useAppStore(s => s.criarLeadManual);
  const perfis = useAppStore(s => s.perfisRemotos);
  const { isManager } = useRoleInfo();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [canal, setCanal] = useState<string>('Manual');
  const [corretorId, setCorretorId] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => { setNome(''); setTelefone(''); setEmail(''); setCanal('Manual'); setCorretorId(''); };
  const fechar = () => { setOpen(false); reset(); };

  const submit = async () => {
    if (nome.trim().length < 1 || telefone.trim().length < 8) return;
    setSaving(true);
    const ok = await criar({ nome, telefone, email, canal, corretorId: corretorId || undefined });
    setSaving(false);
    if (ok) reset();
  };

  const corretores = perfis.filter(p => p.role === 'corretor');

  return (
    <div onClick={fechar} className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(8,17,31,.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={e => e.stopPropagation()} className="modal-card" style={{ width: '100%', maxWidth: 420, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, animation: 'fadeUp .14s ease' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 23, margin: '0 0 4px' }}>Novo lead</h3>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 20px' }}>Entra direto na coluna "Lead Novo".</p>

        <label style={label}>Nome *</label>
        <input value={nome} onChange={e => setNome(e.target.value)} style={input} placeholder="Nome do cliente" autoFocus />

        <label style={label}>Telefone *</label>
        <input value={telefone} onChange={e => setTelefone(e.target.value)} style={input} placeholder="(11) 90000-0000" inputMode="tel" />

        <label style={label}>E-mail</label>
        <input value={email} onChange={e => setEmail(e.target.value)} style={input} placeholder="opcional" inputMode="email" />

        <div data-modal-grid style={{ display: 'grid', gridTemplateColumns: isManager ? '1fr 1fr' : '1fr', gap: 12 }}>
          <div>
            <label style={label}>Canal</label>
            <select value={canal} onChange={e => setCanal(e.target.value)} style={input}>
              {CANAIS.map(c => <option key={c} value={c}>{CANAL_LABEL[c] ?? c}</option>)}
            </select>
          </div>
          {isManager && (
            <div>
              <label style={label}>Corretor</label>
              <select value={corretorId} onChange={e => setCorretorId(e.target.value)} style={input}>
                <option value="">Sem atribuição</option>
                {corretores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
          <button onClick={fechar} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button
            onClick={submit}
            disabled={saving || nome.trim().length < 1 || telefone.trim().length < 8}
            style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: saving || nome.trim().length < 1 || telefone.trim().length < 8 ? 0.55 : 1 }}
          >
            {saving ? 'Criando…' : 'Criar lead'}
          </button>
        </div>
      </div>
    </div>
  );
}
