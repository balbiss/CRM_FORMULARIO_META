import { Check, CheckCheck } from 'lucide-react';

/** "Visto" do WhatsApp numa mensagem enviada: ✓ enviada · ✓✓ entregue · ✓✓ azul lida. */
export function Visto({ estado }: { estado: '' | 'enviado' | 'entregue' | 'lido' }) {
  if (!estado) return null;
  if (estado === 'enviado') return <Check size={13} style={{ opacity: 0.7 }} strokeWidth={2.5} />;
  return <CheckCheck size={13} strokeWidth={2.5} style={{ color: estado === 'lido' ? '#53BDEB' : 'currentColor', opacity: estado === 'lido' ? 1 : 0.7 }} />;
}
