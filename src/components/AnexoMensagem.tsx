import { FileText } from 'lucide-react';
import type { AnexoTipo } from '../lib/data';

export function AnexoMensagem({ url, tipo }: { url: string; tipo: AnexoTipo | null | undefined }) {
  if (tipo === 'imagem') {
    return <img src={url} alt="Anexo" style={{ display: 'block', maxWidth: '100%', borderRadius: 8, marginBottom: 6 }} />;
  }
  if (tipo === 'video') {
    return <video src={url} controls style={{ display: 'block', maxWidth: '100%', borderRadius: 8, marginBottom: 6 }} />;
  }
  if (tipo === 'audio') {
    return <audio src={url} controls style={{ display: 'block', maxWidth: '100%', height: 36, marginBottom: 6 }} />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', border: '1px solid currentColor', opacity: 0.9, borderRadius: 8, marginBottom: 6, color: 'inherit', fontSize: 12.5 }}>
      <FileText size={14} />
      {url.split('/').pop()}
    </a>
  );
}
