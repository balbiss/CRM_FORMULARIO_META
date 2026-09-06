import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore, type RemoteTreinamento } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { PILL } from '../lib/format';
import { css } from '../lib/css';
import { FileUpload } from '../components/FileUpload';

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' };
const fieldInput: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 16, boxSizing: 'border-box' };

/** Aceita link direto de arquivo (MinIO) ou link do YouTube — dois jeitos de "colocar vídeo" que
 * o dono pediu. Se for YouTube, converte pra URL de embed; senão, toca como arquivo de vídeo. */
function youtubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  return m ? 'https://www.youtube.com/embed/' + m[1] : null;
}

export default function Treinamentos() {
  const treinamentos = useAppStore(s => s.treinamentos);
  const createTreinamento = useAppStore(s => s.createTreinamento);
  const updateTreinamento = useAppStore(s => s.updateTreinamento);
  const deleteTreinamento = useAppStore(s => s.deleteTreinamento);
  const { isManager } = useRoleInfo();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<RemoteTreinamento | null>(null);
  const [assistindo, setAssistindo] = useState<RemoteTreinamento | null>(null);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Capacitação</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Treinamentos</h1>
        </div>
        {isManager && <button onClick={() => setModalAberto(true)} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>+ Novo treinamento</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {treinamentos.map(t => (
          <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <span style={css(PILL + 'border:1px solid var(--line);color:var(--muted)')}>{t.categoria || 'Geral'}</span>
              {t.duracaoTexto && <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{t.duracaoTexto}</span>}
            </div>
            <p style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.3 }}>{t.titulo}</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 16px' }}>{t.descricao}</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setAssistindo(t)} style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600 }}>Assistir</button>
              {isManager && (
                <>
                  <button onClick={() => setEditando(t)} style={{ padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5 }}>Editar</button>
                  <button onClick={() => deleteTreinamento(t.id)} style={{ padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, color: 'var(--terra)' }}>Excluir</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      {treinamentos.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum treinamento cadastrado ainda.</p>}

      {assistindo && <VideoModal treinamento={assistindo} onClose={() => setAssistindo(null)} />}
      {modalAberto && <TreinamentoModal onClose={() => setModalAberto(false)} onSave={async input => (await createTreinamento(input)) && setModalAberto(false)} />}
      {editando && (
        <TreinamentoModal
          treinamento={editando}
          onClose={() => setEditando(null)}
          onSave={async input => (await updateTreinamento(editando.id, input)) && setEditando(null)}
        />
      )}
    </div>
  );
}

function VideoModal({ treinamento, onClose }: { treinamento: RemoteTreinamento; onClose: () => void }) {
  const embed = treinamento.videoUrl ? youtubeEmbedUrl(treinamento.videoUrl) : null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,26,.6)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 760, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 20, animation: 'fadeUp .14s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 19, margin: 0, flex: 1 }}>{treinamento.titulo}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000', aspectRatio: '16/9' }}>
          {embed ? (
            <iframe src={embed} title={treinamento.titulo} style={{ width: '100%', height: '100%', border: 'none' }} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          ) : treinamento.videoUrl ? (
            <video src={treinamento.videoUrl} controls style={{ width: '100%', height: '100%' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13 }}>Nenhum vídeo cadastrado ainda.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function TreinamentoModal({ treinamento, onClose, onSave }: {
  treinamento?: RemoteTreinamento;
  onClose: () => void;
  onSave: (input: { titulo: string; descricao: string | null; duracaoTexto: string | null; categoria: string | null; videoUrl: string | null }) => void;
}) {
  const [titulo, setTitulo] = useState(treinamento?.titulo ?? '');
  const [descricao, setDescricao] = useState(treinamento?.descricao ?? '');
  const [duracaoTexto, setDuracaoTexto] = useState(treinamento?.duracaoTexto ?? '');
  const [categoria, setCategoria] = useState(treinamento?.categoria ?? '');
  const [videoUrl, setVideoUrl] = useState<string | null>(treinamento?.videoUrl ?? null);
  const [linkManual, setLinkManual] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!titulo.trim()) return;
    setSaving(true);
    await onSave({
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      duracaoTexto: duracaoTexto.trim() || null,
      categoria: categoria.trim() || null,
      videoUrl,
    });
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,26,.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, animation: 'fadeUp .14s ease', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 22, margin: '0 0 18px' }}>{treinamento ? 'Editar treinamento' : 'Novo treinamento'}</h3>
        <label style={fieldLabel}>Título</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} style={fieldInput} />
        <label style={fieldLabel}>Descrição</label>
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} style={{ ...fieldInput, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Categoria</label>
            <input value={categoria} onChange={e => setCategoria(e.target.value)} style={fieldInput} placeholder="Ex: Atendimento" />
          </div>
          <div>
            <label style={fieldLabel}>Duração</label>
            <input value={duracaoTexto} onChange={e => setDuracaoTexto(e.target.value)} style={fieldInput} placeholder="Ex: 12 min" />
          </div>
        </div>
        <label style={fieldLabel}>Vídeo</label>
        <div style={{ marginBottom: 8 }}>
          <FileUpload value={videoUrl} onChange={setVideoUrl} accept="video/*" label="Enviar arquivo de vídeo" />
        </div>
        {!videoUrl && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <input value={linkManual} onChange={e => setLinkManual(e.target.value)} style={{ ...fieldInput, marginBottom: 0 }} placeholder="…ou cole um link do YouTube" />
            <button type="button" onClick={() => { if (linkManual.trim()) { setVideoUrl(linkManual.trim()); setLinkManual(''); } }} style={{ padding: '0 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 12.5, fontWeight: 600, flex: 'none' }}>Usar link</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}
