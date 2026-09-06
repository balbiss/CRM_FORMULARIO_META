import { useNavigate } from 'react-router-dom';

export default function Denied() {
  const nav = useNavigate();
  return (
    <div style={{ maxWidth: 460, margin: '80px auto', textAlign: 'center' }}>
      <div style={{ width: 34, height: 34, border: '1.5px solid var(--terra)', transform: 'rotate(45deg)', margin: '0 auto 26px' }} />
      <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 34, margin: '0 0 12px', lineHeight: 1.1 }}>Acesso restrito</h1>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--muted)', margin: '0 0 26px' }}>A página <strong>Equipe</strong> é visível apenas para Dono e Gerente. Você está visualizando como Corretor.</p>
      <button onClick={() => nav('/dash')} style={{ padding: '11px 20px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Voltar ao Dashboard</button>
    </div>
  );
}
