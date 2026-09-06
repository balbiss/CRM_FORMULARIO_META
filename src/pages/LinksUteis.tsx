import { useMemo, useState } from 'react';
import { useAppStore, type RemoteLinkUtil } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' };
const fieldInput: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 16, boxSizing: 'border-box' };

function normalizarUrl(url: string) {
  return /^https?:\/\//.test(url) ? url : 'https://' + url;
}

export default function LinksUteis() {
  const linksUteis = useAppStore(s => s.linksUteis);
  const createLinkUtil = useAppStore(s => s.createLinkUtil);
  const updateLinkUtil = useAppStore(s => s.updateLinkUtil);
  const deleteLinkUtil = useAppStore(s => s.deleteLinkUtil);
  const { isManager } = useRoleInfo();
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<RemoteLinkUtil | null>(null);

  const grupos = useMemo(() => {
    const map = new Map<string, RemoteLinkUtil[]>();
    for (const l of linksUteis) {
      if (!map.has(l.categoria)) map.set(l.categoria, []);
      map.get(l.categoria)!.push(l);
    }
    return Array.from(map.entries());
  }, [linksUteis]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Referência</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Links Úteis</h1>
        </div>
        {isManager && <button onClick={() => setModalAberto(true)} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>+ Novo link</button>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {grupos.map(([categoria, links]) => (
          <div key={categoria}>
            <p style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 8px' }}>{categoria}</p>
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
              {links.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ width: 8, height: 8, background: 'var(--terra)', transform: 'rotate(45deg)', flex: 'none' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{l.titulo}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{l.url}</span>
                  </span>
                  <a href={normalizarUrl(l.url)} target="_blank" rel="noreferrer" style={{ padding: '7px 13px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>Abrir</a>
                  {isManager && (
                    <>
                      <button onClick={() => setEditando(l)} style={{ padding: '7px 13px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5 }}>Editar</button>
                      <button onClick={() => deleteLinkUtil(l.id)} style={{ padding: '7px 13px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12.5, color: 'var(--terra)' }}>Excluir</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {linksUteis.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum link cadastrado ainda.</p>}
      </div>

      {modalAberto && <LinkModal onClose={() => setModalAberto(false)} onSave={async input => (await createLinkUtil(input)) && setModalAberto(false)} />}
      {editando && (
        <LinkModal
          link={editando}
          onClose={() => setEditando(null)}
          onSave={async input => (await updateLinkUtil(editando.id, input)) && setEditando(null)}
        />
      )}
    </div>
  );
}

function LinkModal({ link, onClose, onSave }: {
  link?: RemoteLinkUtil;
  onClose: () => void;
  onSave: (input: { categoria: string; titulo: string; url: string }) => void;
}) {
  const [categoria, setCategoria] = useState(link?.categoria ?? '');
  const [titulo, setTitulo] = useState(link?.titulo ?? '');
  const [url, setUrl] = useState(link?.url ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!categoria.trim() || !titulo.trim() || !url.trim()) return;
    setSaving(true);
    await onSave({ categoria: categoria.trim(), titulo: titulo.trim(), url: url.trim() });
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(28,27,26,.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, animation: 'fadeUp .14s ease' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 22, margin: '0 0 18px' }}>{link ? 'Editar link' : 'Novo link'}</h3>
        <label style={fieldLabel}>Categoria</label>
        <input value={categoria} onChange={e => setCategoria(e.target.value)} style={fieldInput} placeholder="Ex: Bancos parceiros" list="categorias-links" />
        <datalist id="categorias-links">
          <option>Bancos parceiros</option><option>Documentos</option><option>Comercial</option>
        </datalist>
        <label style={fieldLabel}>Título</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} style={fieldInput} />
        <label style={fieldLabel}>URL</label>
        <input value={url} onChange={e => setUrl(e.target.value)} style={fieldInput} placeholder="exemplo.com.br/pagina" />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}
