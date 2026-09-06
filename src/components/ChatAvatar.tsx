import { useState } from 'react';

const iniciais = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '?';

/** Avatar redondo de conversa: foto do WhatsApp quando tem, senão as iniciais. */
export function ChatAvatar({ nome, foto, size = 38 }: { nome: string; foto?: string | null; size?: number }) {
  const [erro, setErro] = useState(false);
  if (foto && !erro) {
    return (
      <img
        src={foto}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setErro(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none', display: 'block' }}
      />
    );
  }
  return (
    <span style={{ width: size, height: size, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, background: 'var(--terraSoft)', color: 'var(--terra)' }}>
      {iniciais(nome)}
    </span>
  );
}
