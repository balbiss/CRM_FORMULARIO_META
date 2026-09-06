import { useState } from 'react';
import { useAppStore, type RemoteTemplate } from '../store/appStore';
import { FileUpload } from '../components/FileUpload';

export default function Templates() {
  const templates = useAppStore(s => s.templates);
  const newTpl = useAppStore(s => s.newTpl);
  const updateTpl = useAppStore(s => s.updateTpl);
  const delTpl = useAppStore(s => s.delTpl);
  const toast = useAppStore(s => s.toast);
  const [editando, setEditando] = useState<RemoteTemplate | null>(null);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Mensagens</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Templates de Mensagem</h1>
        </div>
        <button onClick={newTpl} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Novo template</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {templates.map(t => (
          <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 20 }}>
            <p style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 8px' }}>{t.titulo}</p>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--muted)', margin: '0 0 14px' }}>{t.texto}</p>
            {t.anexoUrl && (
              <a href={t.anexoUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 14, fontSize: 12, color: 'var(--ink)' }}>
                <span style={{ width: 6, height: 6, background: 'var(--terra)', transform: 'rotate(45deg)', flex: 'none' }} />
                {t.anexoUrl.split('/').pop()}
              </a>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => toast('Template "' + t.titulo + '" pronto para usar no chat')} style={{ flex: 1, padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12, fontWeight: 600 }}>Usar no chat</button>
              <button onClick={() => setEditando(t)} style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12 }}>Editar</button>
              <button onClick={() => delTpl(t.id)} style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12, color: 'var(--terra)' }}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
      {templates.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum template ainda — clique em "Novo template" pra criar o primeiro.</p>}
      <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '18px 0 0' }}>Variáveis disponíveis: {'{nome}'}, {'{corretor}'}, {'{imovel}'} · cada corretor vê apenas os próprios templates.</p>

      {editando && (
        <EditModal
          template={editando}
          onClose={() => setEditando(null)}
          onSave={patch => { updateTpl(editando.id, patch); setEditando(null); }}
        />
      )}
    </div>
  );
}

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' };
const fieldInput: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 16, boxSizing: 'border-box' };

function EditModal({ template, onClose, onSave }: {
  template: RemoteTemplate;
  onClose: () => void;
  onSave: (patch: { titulo: string; texto: string; anexoUrl: string | null }) => void;
}) {
  const [titulo, setTitulo] = useState(template.titulo);
  const [texto, setTexto] = useState(template.texto);
  const [anexoUrl, setAnexoUrl] = useState<string | null>(template.anexoUrl);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,26,.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, animation: 'fadeUp .14s ease' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 22, margin: '0 0 18px' }}>Editar template</h3>
        <label style={fieldLabel}>Título</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} style={fieldInput} />
        <label style={fieldLabel}>Texto</label>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={5} style={{ ...fieldInput, resize: 'vertical', fontFamily: 'inherit' }} />
        <label style={fieldLabel}>Anexo (opcional)</label>
        <div style={{ marginBottom: 16 }}>
          <FileUpload value={anexoUrl} onChange={setAnexoUrl} label="Anexar arquivo (PDF, imagem…)" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button
            onClick={() => onSave({ titulo: titulo.trim() || template.titulo, texto: texto.trim() || template.texto, anexoUrl })}
            style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
