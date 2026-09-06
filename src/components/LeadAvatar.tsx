import { useState } from 'react';
import { css } from '../lib/css';
import { thumb } from '../lib/format';

/** Foto de perfil do lead (ex.: avatar do WhatsApp) — cai no placeholder listrado
 *  quando não há foto ou a URL quebra. */
export function LeadAvatar({ foto, seedIndex = 0, size = 34 }: { foto?: string; seedIndex?: number; size?: number }) {
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
        style={{ width: size, height: size, borderRadius: 7, objectFit: 'cover', flex: 'none', display: 'block', border: '1px solid var(--line)' }}
      />
    );
  }
  return <span style={css(thumb(seedIndex, size))} />;
}
