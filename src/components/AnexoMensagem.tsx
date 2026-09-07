import { FileText, Download } from 'lucide-react';
import type { AnexoTipo } from '../lib/data';

export function AnexoMensagem({ url, tipo, nome, onLoad }: { url: string; tipo: AnexoTipo | null | undefined; nome?: string | null; onLoad?: () => void }) {
  if (tipo === 'imagem') {
    return (
      <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: 6 }}>
        <img src={url} alt="Anexo" onLoad={onLoad} onError={onLoad}
          style={{ display: 'block', maxWidth: 260, maxHeight: 320, width: 'auto', height: 'auto', borderRadius: 8, objectFit: 'cover', cursor: 'zoom-in' }} />
      </a>
    );
  }
  if (tipo === 'video') {
    return <video src={url} controls onLoadedData={onLoad} style={{ display: 'block', maxWidth: 280, maxHeight: 360, borderRadius: 8, marginBottom: 6, background: '#000' }} />;
  }
  if (tipo === 'audio') {
    return <audio src={url} controls onLoadedMetadata={onLoad} style={{ display: 'block', maxWidth: '100%', height: 36, marginBottom: 6 }} />;
  }
  const nomeArquivo = nome || decodeURIComponent(url.split('/').pop() || 'arquivo');
  return (
    <a href={url} download={nomeArquivo} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', border: '1px solid currentColor', opacity: 0.9, borderRadius: 8, marginBottom: 6, color: 'inherit', fontSize: 12.5, textDecoration: 'none' }}>
      <FileText size={15} style={{ flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeArquivo}</span>
      <Download size={13} style={{ flex: 'none', opacity: 0.7 }} />
    </a>
  );
}
