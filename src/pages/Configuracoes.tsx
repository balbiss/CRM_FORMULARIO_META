import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { ini } from '../lib/format';
import { apiFetch } from '../lib/api';
import { HorarioAtendimento } from '../components/HorarioAtendimento';

type Tab = 'perfil' | 'seguranca' | 'imobiliaria' | 'atendimento' | 'uso';

const card: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 24 };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 };
const inp: React.CSSProperties = { width: '100%', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 16, boxSizing: 'border-box' };
const btn = (ativo: boolean): React.CSSProperties => ({ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: ativo ? 1 : 0.6 });

export default function Configuracoes() {
  const { role, isManager } = useRoleInfo();
  const [tab, setTab] = useState<Tab>('perfil');

  const tabs: [Tab, string][] = [
    ['perfil', 'Perfil'], ['seguranca', 'Segurança'],
    ...(isManager ? ([['imobiliaria', 'Imobiliária'], ['atendimento', 'Atendimento'], ['uso', 'Uso']] as [Tab, string][]) : []),
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Conta</p>
        <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Ajustes</h1>
      </div>

      <div style={{ display: 'flex', gap: 20, borderBottom: '1px solid var(--line)', marginBottom: 20, overflowX: 'auto' }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '0 0 12px', border: 'none', background: 'none', fontSize: 13.5, fontWeight: tab === id ? 700 : 500, color: tab === id ? 'var(--ink)' : 'var(--muted)', borderBottom: '2px solid ' + (tab === id ? 'var(--terra)' : 'transparent'), marginBottom: -1, whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'perfil' && <Perfil role={role} />}
      {tab === 'seguranca' && <Seguranca />}
      {tab === 'imobiliaria' && <Imobiliaria />}
      {tab === 'atendimento' && <HorarioAtendimento />}
      {tab === 'uso' && <Uso />}
    </div>
  );
}

function Perfil({ role }: { role: string }) {
  const me = useAppStore(s => s.me);
  const savePerfil = useAppStore(s => s.savePerfil);
  const [nome, setNome] = useState(me?.nome ?? '');
  const [email, setEmail] = useState(me?.email ?? '');
  const [telefone, setTelefone] = useState(me?.telefone ?? '');
  const [salvando, setSalvando] = useState(false);
  // o "me" chega depois do primeiro render quando a página abre direto (F5)
  useEffect(() => { setNome(me?.nome ?? ''); setEmail(me?.email ?? ''); setTelefone(me?.telefone ?? ''); }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    setSalvando(true);
    await savePerfil({ nome: nome.trim(), email: email.trim(), telefone: telefone.trim() });
    setSalvando(false);
  };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--terraSoft)', color: 'var(--terra)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>{ini(me?.nome ?? '')}</span>
        <span>
          <span style={{ display: 'block', fontFamily: 'Newsreader,serif', fontSize: 24 }}>{me?.nome}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 3 }}>{role} · Visita IA</span>
        </span>
      </div>
      <label style={lbl}>Nome</label>
      <input value={nome} onChange={e => setNome(e.target.value)} style={inp} />
      <label style={lbl}>E-mail (usado para entrar no CRM)</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} />
      <label style={lbl}>Telefone (WhatsApp)</label>
      <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" style={{ ...inp, marginBottom: 22 }} />
      <button onClick={salvar} disabled={salvando} style={btn(!salvando)}>{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
    </div>
  );
}

function Seguranca() {
  const token = useAppStore(s => s.token);
  const toast = useAppStore(s => s.toast);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [salvando, setSalvando] = useState(false);

  const trocar = async () => {
    if (!atual || nova.length < 6) { toast('Preencha a senha atual e uma nova com pelo menos 6 caracteres'); return; }
    setSalvando(true);
    try {
      await apiFetch('/api/auth/senha', token, { method: 'PATCH', body: JSON.stringify({ senhaAtual: atual, senhaNova: nova }) });
      toast('Senha atualizada');
      setAtual(''); setNova('');
    } catch (e) {
      toast((e as Error).message || 'Não foi possível trocar a senha');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={card}>
      <p style={{ fontSize: 13.5, fontWeight: 700, margin: '0 0 6px' }}>Alterar senha</p>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px' }}>Recomendamos trocar sua senha a cada 90 dias.</p>
      <input type="password" autoComplete="current-password" value={atual} onChange={e => setAtual(e.target.value)} placeholder="Senha atual" style={{ ...inp, marginBottom: 10 }} />
      <input type="password" autoComplete="new-password" value={nova} onChange={e => setNova(e.target.value)} placeholder="Nova senha (mínimo 6 caracteres)" style={{ ...inp, marginBottom: 18 }} />
      <button onClick={trocar} disabled={salvando} style={btn(!salvando)}>{salvando ? 'Salvando…' : 'Atualizar senha'}</button>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '16px 0 0', lineHeight: 1.5 }}>
        Esqueceu a senha? Na tela de entrada, use "Esqueci minha senha": o dono ou gerente recebe o pedido e redefine em Equipe.
      </p>
    </div>
  );
}

function Imobiliaria() {
  const token = useAppStore(s => s.token);
  const toast = useAppStore(s => s.toast);
  const [dados, setDados] = useState<{ nome: string; cnpj: string; endereco: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    apiFetch<{ nome: string; cnpj: string | null; endereco: string | null }>('/api/config/imobiliaria', token)
      .then(d => setDados({ nome: d.nome ?? '', cnpj: d.cnpj ?? '', endereco: d.endereco ?? '' }))
      .catch(() => toast('Não foi possível carregar os dados da imobiliária'));
  }, [token, toast]);

  const salvar = async () => {
    if (!dados) return;
    setSalvando(true);
    try {
      await apiFetch('/api/config/imobiliaria', token, { method: 'PUT', body: JSON.stringify(dados) });
      toast('Dados da imobiliária atualizados');
    } catch (e) {
      toast((e as Error).message || 'Não foi possível salvar');
    } finally {
      setSalvando(false);
    }
  };

  if (!dados) return <div style={card}><p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Carregando…</p></div>;
  return (
    <div style={card}>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 18px' }}>Dados cadastrais da imobiliária.</p>
      <label style={lbl}>Nome da imobiliária</label>
      <input value={dados.nome} onChange={e => setDados({ ...dados, nome: e.target.value })} style={inp} />
      <label style={lbl}>CNPJ</label>
      <input value={dados.cnpj} onChange={e => setDados({ ...dados, cnpj: e.target.value })} placeholder="00.000.000/0000-00" style={inp} />
      <label style={lbl}>Endereço</label>
      <input value={dados.endereco} onChange={e => setDados({ ...dados, endereco: e.target.value })} placeholder="Rua, número — cidade, UF" style={{ ...inp, marginBottom: 22 }} />
      <button onClick={salvar} disabled={salvando} style={btn(!salvando)}>{salvando ? 'Salvando…' : 'Salvar alterações'}</button>
    </div>
  );
}

function Uso() {
  const token = useAppStore(s => s.token);
  const [u, setU] = useState<{ corretoresAtivos: number; limiteCorretores: number; gestores: number; leadsMes: number; numerosConectados: number } | null>(null);
  useEffect(() => { apiFetch<typeof u>('/api/config/uso', token).then(setU).catch(() => {}); }, [token]);

  const linhas: [string, string][] = u ? [
    ['Corretores ativos', u.limiteCorretores ? `${u.corretoresAtivos} de ${u.limiteCorretores}` : String(u.corretoresAtivos)],
    ['Dono e gerentes', String(u.gestores)],
    ['Leads que entraram este mês', String(u.leadsMes)],
    ['Números de WhatsApp conectados', String(u.numerosConectados)],
  ] : [];
  return (
    <div style={card}>
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 18px' }}>Uso atual da plataforma.</p>
      {!u && <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Carregando…</p>}
      {linhas.map(([label, val]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--line)', fontSize: 13.5 }}>
          <span style={{ color: 'var(--muted)' }}>{label}</span><span style={{ fontWeight: 600 }}>{val}</span>
        </div>
      ))}
    </div>
  );
}
