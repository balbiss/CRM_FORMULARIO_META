import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { usePlataformaStore } from '../../store/plataformaStore';
import Logo from '../../components/Logo';

export default function PlataformaLogin() {
  const nav = useNavigate();
  const login = usePlataformaStore(s => s.login);
  const authLoading = usePlataformaStore(s => s.authLoading);
  const authError = usePlataformaStore(s => s.authError);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [show, setShow] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await login(email, senha);
    if (ok) nav('/plataforma');
  };

  return (
    <div className="login-grid" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr 1fr' }}>
      <div className="login-hero" style={{ background: 'var(--side)', color: 'var(--sideInk)', padding: '56px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100vh' }}>
        <Logo markSize={54} wordSize={20} />
        <div style={{ maxWidth: 440 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: 'rgba(255,255,255,.08)', fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 20 }}>
            <ShieldCheck size={14} /> Painel da plataforma
          </div>
          <p style={{ fontFamily: 'Newsreader,serif', fontSize: 42, lineHeight: 1.14, margin: '0 0 16px', fontWeight: 400 }}>
            Gestão das imobiliárias
          </p>
          <p style={{ color: 'var(--sideMuted)', fontSize: 15, lineHeight: 1.7, margin: 0 }}>
            Cadastre imobiliárias, controle acesso, mensalidade, vencimento e limites — tudo em um lugar.
          </p>
        </div>
        <div style={{ opacity: 0.5 }}><Logo markSize={16} wordSize={9} showCrm={false} gap={7} /></div>
      </div>

      <div className="login-form-col" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', minHeight: '100vh' }}>
        <form onSubmit={submit} style={{ width: '100%', maxWidth: 352 }}>
          <div className="login-mobile-logo" style={{ display: 'none', marginBottom: 30 }}><Logo markSize={40} wordSize={18} /></div>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 32, margin: '0 0 6px' }}>Acesso da plataforma</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 30px' }}>Somente para o dono do SaaS.</p>

          <label style={{ display: 'block', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>E-mail</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required
            style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 14, marginBottom: 18 }} />

          <label style={{ display: 'block', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Senha</label>
          <div style={{ position: 'relative', marginBottom: authError ? 10 : 26 }}>
            <input value={senha} onChange={e => setSenha(e.target.value)} type={show ? 'text' : 'password'} required
              style={{ width: '100%', padding: '12px 40px 12px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 14 }} />
            <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--muted)', padding: 4, display: 'flex' }}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {authError && <p style={{ color: 'var(--terra)', fontSize: 12.5, margin: '0 0 16px' }}>{authError}</p>}

          <button type="submit" disabled={authLoading}
            style={{ width: '100%', padding: 14, background: 'var(--terra)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, letterSpacing: '.04em', opacity: authLoading ? 0.7 : 1 }}>
            {authLoading ? 'Entrando…' : 'Entrar'}
          </button>
          <a href="/login" style={{ display: 'block', textAlign: 'center', marginTop: 18, color: 'var(--muted)', fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Ir para o login do CRM
          </a>
        </form>
      </div>
    </div>
  );
}
