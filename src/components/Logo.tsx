/**
 * Logomarca Visita IA — marca vetorial (SVG) recriada a partir da arte oficial
 * (public/brand/visitaia-*.jpg). Vetor em vez de bitmap: nítido em qualquer DPI, ~2KB,
 * fundo transparente e o wordmark acompanha a cor do contexto (tema claro/escuro).
 *
 * - <LogoMark/>  → só o símbolo (casa + balão de conversa)
 * - <Logo/>      → símbolo + wordmark "VISITA IA" (+ linha CRM, + tagline opcionais)
 */

let gid = 0;

const BLUE = '#2160C9';

export function LogoMark({ size = 40, chip = true }: { size?: number; chip?: boolean }) {
  // id único por instância — evita colisão de <linearGradient> quando a marca aparece 2x na tela.
  const id = 'via-grad-' + gid++;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
      <defs>
        <linearGradient id={id} x1="24" y1="24" x2="70" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#45C1F2" />
          <stop offset="0.5" stopColor="#1E77E2" />
          <stop offset="1" stopColor="#0E49BE" />
        </linearGradient>
      </defs>
      {/* tile escuro arredondado — igual à arte oficial; faz a marca "fechar" sobre fundo claro */}
      {chip && <rect x="1" y="1" width="98" height="98" rx="24" fill="#0A0F1A" stroke="rgba(255,255,255,.07)" strokeWidth="1.5" />}
      {/* contorno da casa: telhado baixo, lado direito aberto terminando em ponto; traço único */}
      <path
        d="M80 49 L54 30 Q50 27 46 30 L31 45 L31 63.5 Q31 67 34.5 67 L55 67"
        stroke={`url(#${id})`}
        strokeWidth="5.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* cauda do balão de conversa (canto inferior direito) */}
      <path d="M50 63 L63 63 L60 78 Z" fill={`url(#${id})`} />
      {/* janela 2x2 */}
      <g fill={`url(#${id})`}>
        <rect x="36.5" y="39.5" width="5.6" height="5.6" rx="1.3" />
        <rect x="43.7" y="39.5" width="5.6" height="5.6" rx="1.3" />
        <rect x="36.5" y="46.7" width="5.6" height="5.6" rx="1.3" />
        <rect x="43.7" y="46.7" width="5.6" height="5.6" rx="1.3" />
      </g>
      {/* três pontos (conversa) */}
      <g fill={`url(#${id})`}>
        <circle cx="56" cy="56.5" r="2.8" />
        <circle cx="64.5" cy="56.5" r="2.8" />
        <circle cx="73" cy="56.5" r="2.8" />
      </g>
    </svg>
  );
}

export default function Logo({
  markSize = 34,
  wordSize = 17,
  showCrm = true,
  showTagline = false,
  gap = 13,
}: {
  markSize?: number;
  wordSize?: number;
  showCrm?: boolean;
  showTagline?: boolean;
  gap?: number;
}) {
  const sans = 'Manrope, system-ui, sans-serif';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap, whiteSpace: 'nowrap' }}>
      <LogoMark size={markSize} />
      <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontFamily: sans, fontWeight: 800, fontSize: wordSize, letterSpacing: '.15em', textTransform: 'uppercase' }}>
          Visita<span style={{ color: BLUE }}>&nbsp;IA</span>
        </span>
        {showCrm && (
          <span style={{ display: 'flex', alignItems: 'center', gap: wordSize * 0.4, marginTop: wordSize * 0.34 }}>
            <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.35 }} />
            <span style={{ fontFamily: sans, fontWeight: 700, fontSize: wordSize * 0.44, letterSpacing: '.4em', textTransform: 'uppercase', color: BLUE, marginRight: '-.4em' }}>
              CRM
            </span>
            <span style={{ flex: 1, height: 1, background: 'currentColor', opacity: 0.35 }} />
          </span>
        )}
        {showTagline && (
          <span style={{ fontFamily: sans, fontWeight: 500, fontSize: wordSize * 0.34, letterSpacing: '.06em', textTransform: 'uppercase', marginTop: wordSize * 0.4, opacity: 0.85 }}>
            <b style={{ color: BLUE }}>Leads</b> inteligentes. <b style={{ color: BLUE }}>Visitas</b> agendadas. <b style={{ color: BLUE }}>Negócios</b> fechados.
          </span>
        )}
      </span>
    </span>
  );
}
