import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LayoutGrid, List as ListIcon } from 'lucide-react';
import { useAppStore, roleLabel, type AuthUser } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { ini } from '../lib/format';
import type { RemotePerfil } from '../lib/remoteLeads';

type ViewMode = 'cards' | 'lista';

export default function Equipe() {
  const perfis = useAppStore(s => s.perfisRemotos);
  const leads = useAppStore(s => s.leads);
  const blockMember = useAppStore(s => s.blockMember);
  const revokeMember = useAppStore(s => s.revokeMember);
  const removeMember = useAppStore(s => s.removeMember);
  const createMember = useAppStore(s => s.createMember);
  const updateMember = useAppStore(s => s.updateMember);
  const { isManager, isDono } = useRoleInfo();
  const [view, setView] = useState<ViewMode>('cards');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<RemotePerfil | null>(null);

  if (!isManager) return <Navigate to="/denied" replace />;

  const leadsDe = (nome: string) => leads.filter(l => l.corretor === nome).length;
  const cargo = (role: string) => roleLabel[role as AuthUser['role']] ?? role;

  const toggleBtn = (mode: ViewMode, Icon: typeof LayoutGrid, label: string) => (
    <button
      onClick={() => setView(mode)}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', border: '1px solid ' + (view === mode ? 'var(--terra)' : 'var(--line)'),
        borderRadius: 8, background: view === mode ? 'var(--terraSoft)' : 'var(--card)', color: view === mode ? 'var(--terra)' : 'var(--muted)',
        fontSize: 13, fontWeight: 600,
      }}
    >
      <Icon size={15} />{label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Pessoas</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Equipe</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {toggleBtn('cards', LayoutGrid, 'Cards')}
            {toggleBtn('lista', ListIcon, 'Lista')}
          </div>
          <button onClick={() => setInviteOpen(true)} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Convidar membro</button>
        </div>
      </div>

      {view === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {perfis.map(p => {
            const isCorretorRow = p.role === 'corretor';
            const canAct = isDono || isCorretorRow;
            return (
              <div key={p.id} style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <span style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: 'none' }}>{ini(p.nome)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{p.nome}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{cargo(p.role)}</span>
                  </span>
                  {p.bloqueado
                    ? <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#fff', background: '#A3341F', padding: '4px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>Bloqueado</span>
                    : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--olive)', background: 'var(--oliveSoft)', padding: '4px 9px', borderRadius: 20 }}>Ativo</span>}
                </div>
                <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', marginBottom: 16 }}>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontFamily: 'Newsreader,serif', fontSize: 22 }}>{leadsDe(p.nome)}</span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 3 }}>Leads</span>
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontFamily: 'Newsreader,serif', fontSize: 22, color: 'var(--muted)' }}>—</span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 3 }}>Conversão</span>
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontFamily: 'Newsreader,serif', fontSize: 22, color: 'var(--muted)' }}>—</span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 3 }}>Resposta</span>
                  </span>
                </div>
                {canAct ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => setEditing(p)} style={{ flex: 1, minWidth: 88, padding: 8, border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600 }}>Editar</button>
                    <button onClick={() => blockMember(p.id)} style={{ flex: 1, minWidth: 120, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600 }}>{p.bloqueado ? 'Desbloquear' : 'Bloquear Acesso (Férias)'}</button>
                    {isDono && (
                      <>
                        <button onClick={() => revokeMember(p.nome)} style={{ flex: 1, minWidth: 150, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, color: 'var(--muted)' }}>Remover Acesso (Seguro)</button>
                        <button onClick={() => removeMember(p.id, p.nome)} style={{ flex: 1, minWidth: 150, padding: '8px 10px', border: '1px solid #A3341F', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600, color: '#A3341F' }}>Excluir Definitivamente</button>
                      </>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>Sem ações disponíveis — {cargo(p.role)} só pode ser alterado pelo Dono.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            <span style={{ flex: 1.6 }}>Nome</span><span style={{ flex: 1 }}>Cargo</span><span style={{ width: 70, textAlign: 'right' }}>Leads</span><span style={{ width: 100 }}>Status</span><span style={{ width: 260 }}>Ações</span>
          </div>
          {perfis.map(p => {
            const isCorretorRow = p.role === 'corretor';
            const canAct = isDono || isCorretorRow;
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 20px', borderBottom: '1px solid var(--line)' }}>
                <span style={{ flex: 1.6, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{ini(p.nome)}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                </span>
                <span style={{ flex: 1, fontSize: 12.5, color: 'var(--muted)' }}>{cargo(p.role)}</span>
                <span style={{ width: 70, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{leadsDe(p.nome)}</span>
                <span style={{ width: 100 }}>
                  {p.bloqueado
                    ? <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff', background: '#A3341F', padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>Bloqueado</span>
                    : <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--olive)', background: 'var(--oliveSoft)', padding: '3px 8px', borderRadius: 20 }}>Ativo</span>}
                </span>
                <span style={{ width: 260, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {canAct ? (
                    <>
                      <button onClick={() => setEditing(p)} style={{ padding: '6px 9px', border: '1px solid var(--line)', borderRadius: 6, background: 'none', fontSize: 11.5, fontWeight: 600 }}>Editar</button>
                      <button onClick={() => blockMember(p.id)} style={{ padding: '6px 9px', border: '1px solid var(--line)', borderRadius: 6, background: 'none', fontSize: 11.5, fontWeight: 600 }}>{p.bloqueado ? 'Desbloquear' : 'Bloquear'}</button>
                      {isDono && <button onClick={() => removeMember(p.id, p.nome)} style={{ padding: '6px 9px', border: '1px solid #A3341F', borderRadius: 6, background: 'none', fontSize: 11.5, fontWeight: 600, color: '#A3341F' }}>Excluir</button>}
                    </>
                  ) : <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Só o Dono altera</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {inviteOpen && <InviteModal isDono={isDono} onClose={() => setInviteOpen(false)} onSubmit={createMember} />}
      {editing && <EditModal perfil={editing} onClose={() => setEditing(null)} onSubmit={updateMember} />}
    </div>
  );
}

function InviteModal({ isDono, onClose, onSubmit }: {
  isDono: boolean;
  onClose: () => void;
  onSubmit: (input: { nome: string; email: string; telefone?: string; role: 'gerente' | 'corretor' }) => Promise<boolean>;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [role, setRole] = useState<'gerente' | 'corretor'>('corretor');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!nome.trim() || !email.trim()) return;
    setSaving(true);
    const ok = await onSubmit({ nome: nome.trim(), email: email.trim(), telefone: telefone.trim() || undefined, role });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,26,.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, animation: 'fadeUp .14s ease' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 22, margin: '0 0 18px' }}>Convidar membro</h3>
        <label style={fieldLabel}>Nome</label>
        <input value={nome} onChange={e => setNome(e.target.value)} style={fieldInput} placeholder="Nome completo" />
        <label style={fieldLabel}>E-mail</label>
        <input value={email} onChange={e => setEmail(e.target.value)} style={fieldInput} placeholder="email@exemplo.com" type="email" />
        <label style={fieldLabel}>Telefone</label>
        <input value={telefone} onChange={e => setTelefone(e.target.value)} style={fieldInput} placeholder="(11) 90000-0000" />
        <label style={fieldLabel}>Cargo</label>
        <select value={role} onChange={e => setRole(e.target.value as 'gerente' | 'corretor')} style={{ ...fieldInput, marginBottom: 8 }}>
          <option value="corretor">Corretor</option>
          {isDono && <option value="gerente">Gerente</option>}
        </select>
        <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: '0 0 20px' }}>Senha padrão de acesso: 123456 (o membro pode trocar depois).</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? 'Enviando…' : 'Convidar'}</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ perfil, onClose, onSubmit }: {
  perfil: RemotePerfil;
  onClose: () => void;
  onSubmit: (id: string, patch: { nome: string; telefone: string }) => Promise<boolean>;
}) {
  const [nome, setNome] = useState(perfil.nome);
  const [telefone, setTelefone] = useState(perfil.telefone ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    const ok = await onSubmit(perfil.id, { nome: nome.trim(), telefone: telefone.trim() });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,26,.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, animation: 'fadeUp .14s ease' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 22, margin: '0 0 18px' }}>Editar {perfil.nome}</h3>
        <label style={fieldLabel}>Nome</label>
        <input value={nome} onChange={e => setNome(e.target.value)} style={fieldInput} />
        <label style={fieldLabel}>Telefone</label>
        <input value={telefone} onChange={e => setTelefone(e.target.value)} style={{ ...fieldInput, marginBottom: 20 }} placeholder="(11) 90000-0000" />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' };
const fieldInput: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 16, boxSizing: 'border-box' };
