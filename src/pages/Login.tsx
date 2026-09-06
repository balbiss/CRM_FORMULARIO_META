import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../store/appStore';

const fadeUp = (delayMs: number): React.CSSProperties => ({
  opacity: 0,
  animation: 'fadeUp .5s ease forwards',
  animationDelay: delayMs + 'ms',
});

export default function Login() {
  const nav = useNavigate();
  const login = useAppStore(s => s.login);
  const authLoading = useAppStore(s => s.authLoading);
  const authError = useAppStore(s => s.authError);
  const [email, setEmail] = useState('camila.rocha@novaimob.com.br');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(email, senha);
    if (ok) nav('/dash');
  };

  const contasTeste = [
    { label: 'Dono', email: 'hinodeimoveis.crm@gmail.com', senha: '280896Ab@' },
    { label: 'Gerente', email: 'camila.rocha@novaimob.com.br', senha: '123456' },
    { label: 'Corretor', email: 'diego.antunes@novaimob.com.br', senha: '123456' },
  ];
  const quickLogin = async (e: string, s: string) => {
    setEmail(e);
    setSenha(s);
    const ok = await login(e, s);
    if (ok) nav('/dash');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr 1fr' }}>
      <div style={{ background: 'var(--side)', color: 'var(--sideInk)', padding: '56px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100vh', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...fadeUp(0) }}>
          <div style={{ width: 14, height: 14, background: 'var(--terra)', transform: 'rotate(45deg)', animation: 'pulse 2.6s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'Newsreader,serif', fontSize: 24, letterSpacing: '.18em', textTransform: 'uppercase' }}>Hinode Imóveis</span>
        </div>
        <div style={{ maxWidth: 460 }}>
          <p style={{ fontFamily: 'Newsreader,serif', fontSize: 46, lineHeight: 1.1, margin: '0 0 20px', fontWeight: 400, ...fadeUp(120) }}>Nenhum lead esquecido. Nenhum corretor sobrecarregado.</p>
          <p style={{ color: 'var(--sideMuted)', fontSize: 15, lineHeight: 1.7, margin: 0, ...fadeUp(260) }}>Sistema interno da Hinode Imóveis: do primeiro "oi" no WhatsApp até a venda fechada, com roleta de atendimento, follow-up automático e análise de crédito no mesmo fluxo.</p>
        </div>
        <p style={{ color: 'var(--sideMuted)', fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', margin: 0, ...fadeUp(380) }}>Hinode Imóveis</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 352, ...fadeUp(180) }}>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 34, margin: '0 0 6px' }}>Acessar a plataforma</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 32px' }}>Bem-vindo de volta.</p>
          <label style={{ display: 'block', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>E-mail</label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            required
            style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 14, marginBottom: 18 }}
          />
          <label style={{ display: 'block', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Senha</label>
          <div style={{ position: 'relative', marginBottom: authError ? 10 : 26 }}>
            <input
              value={senha}
              onChange={e => setSenha(e.target.value)}
              type={showSenha ? 'text' : 'password'}
              required
              style={{ width: '100%', padding: '12px 40px 12px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 14 }}
            />
            <button
              type="button"
              onClick={() => setShowSenha(v => !v)}
              tabIndex={-1}
              title={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--muted)', padding: 4, display: 'flex' }}
            >
              {showSenha ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
            </button>
          </div>
          {authError && <p style={{ color: 'var(--terra)', fontSize: 12.5, margin: '0 0 16px' }}>{authError}</p>}
          <button
            type="submit"
            disabled={authLoading}
            style={{ width: '100%', padding: 14, background: 'var(--terra)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, letterSpacing: '.04em', opacity: authLoading ? 0.7 : 1 }}
          >
            {authLoading ? 'Entrando…' : 'Entrar'}
          </button>

          <div style={{ marginTop: 26, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
            <p style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 10px' }}>Contas de teste</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {contasTeste.map(c => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => quickLogin(c.email, c.senha)}
                  title={c.email + ' · ' + c.senha}
                  style={{ flex: 1, padding: '8px 6px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--card)', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
