import { useRef, useState } from 'react';
import { Paperclip, X, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { uploadArquivo } from '../lib/upload';

/** Upload real de arquivo (imagem/vídeo/PDF) — sobe pro MinIO via POST /api/uploads e devolve a
 * URL pública. Usado em qualquer campo de anexo (template, imóvel) que hoje só aceitava texto. */
export function FileUpload({ value, onChange, accept = 'image/*,video/*,application/pdf', label }: {
  value: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
  label?: string;
}) {
  const token = useAppStore(s => s.token);
  const toast = useAppStore(s => s.toast);
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !token) return;
    setLoading(true);
    try {
      const data = await uploadArquivo(file, token);
      onChange(data.url);
    } catch (e) {
      toast((e as Error).message || 'Não foi possível enviar o arquivo');
    } finally {
      setLoading(false);
    }
  };

  const nomeArquivo = value ? value.split('/').pop() : null;

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} onChange={onFile} style={{ display: 'none' }} />
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12.5 }}>
          <Paperclip size={13} style={{ flex: 'none' }} />
          <a href={value} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{nomeArquivo}</a>
          <button type="button" onClick={() => onChange(null)} title="Remover" style={{ border: 'none', background: 'none', color: 'var(--terra)', display: 'flex', flex: 'none' }}><X size={14} /></button>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px dashed var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', width: '100%', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Paperclip size={14} />}
          {loading ? 'Enviando…' : (label || 'Anexar arquivo')}
        </button>
      )}
    </div>
  );
}
