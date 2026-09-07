import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, ExternalLink, Plus } from 'lucide-react';
import { useAppStore, type SiteConfig } from '../store/appStore';
import { uploadArquivo } from '../lib/upload';
import { API_URL } from '../lib/api';

const VAZIO: SiteConfig = {
  nomeExibicao: '', logoUrl: '', corPrimaria: '#123C87',
  heroTitulo: '', heroSubtitulo: '', heroImagemUrl: '',
  sobreTitulo: '', sobreTexto: '', sobreImagemUrl: '',
  telefone: '', whatsapp: '', email: '', endereco: '', instagram: '', facebook: '',
  destaques: [], depoimentos: [], rodapeTexto: '',
};

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' };
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, boxSizing: 'border-box' };
const card: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 18, marginBottom: 14 };

function UploadImagem({ url, onChange, label, dica, previewLogo }: { url: string; onChange: (u: string) => void; label: string; dica: string; previewLogo?: boolean }) {
  const token = useAppStore(s => s.token);
  const toast = useAppStore(s => s.toast);
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function subir(f: File) {
    if (!token) return;
    setBusy(true);
    try { const { url } = await uploadArquivo(f, token); onChange(url); }
    catch (e) { toast((e as Error).message || 'Falha no upload'); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input ref={ref} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); e.currentTarget.value = ''; }} />
      {url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={url} alt=""
            style={previewLogo
              ? { height: 44, maxWidth: 160, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--line)', background: '#fff', padding: 4 }
              : { height: 48, width: 72, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }}
          />
          <button type="button" onClick={() => ref.current?.click()} style={{ ...inp, width: 'auto', padding: '7px 12px', cursor: 'pointer' }}>Trocar</button>
          <button type="button" onClick={() => onChange('')} style={{ border: 'none', background: 'none', color: 'var(--terra)', fontSize: 12.5 }}>Remover</button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', border: '1px dashed var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)' }}>
          <Upload size={13} /> {busy ? 'Enviando…' : 'Enviar imagem'}
        </button>
      )}
      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '5px 0 0', lineHeight: 1.4 }}>{dica}</p>
    </div>
  );
}

export default function SiteImoveis() {
  const site = useAppStore(s => s.site);
  const fetchSite = useAppStore(s => s.fetchSite);
  const salvarSite = useAppStore(s => s.salvarSite);
  const mudarSlugSite = useAppStore(s => s.mudarSlugSite);
  const imoveis = useAppStore(s => s.imoveis);
  const fetchImoveis = useAppStore(s => s.fetchImoveis);
  const toggleImovelNoSite = useAppStore(s => s.toggleImovelNoSite);

  const [cfg, setCfg] = useState<SiteConfig>(VAZIO);
  const [dirty, setDirty] = useState(false);
  const [slugEdit, setSlugEdit] = useState('');

  useEffect(() => { fetchSite(); fetchImoveis(); }, [fetchSite, fetchImoveis]);
  useEffect(() => {
    if (site) { setCfg({ ...VAZIO, ...site.config }); setSlugEdit(site.slug); setDirty(false); }
  }, [site?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (p: Partial<SiteConfig>) => { setCfg(c => ({ ...c, ...p })); setDirty(true); };
  const publicUrl = site ? window.location.origin + '/s/' + site.slug : '';

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Site</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Site de imóveis</h1>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '5px 0 0' }}>Uma página pública com os imóveis do CRM. O formulário de contato cai direto nos leads.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {site && (
            <a href={publicUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
              <ExternalLink size={13} /> Ver site
            </a>
          )}
          <button
            onClick={() => salvarSite(cfg, site?.publicado ? undefined : true)}
            style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: site?.publicado ? 'var(--olive)' : 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}
          >
            {site?.publicado ? 'Salvar' : 'Publicar site'}
          </button>
          {site?.publicado && (
            <button onClick={() => salvarSite(cfg, false)} style={{ padding: '9px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13, color: 'var(--terra)' }}>Despublicar</button>
          )}
        </div>
      </div>

      {site?.publicado && (
        <div style={{ ...card, background: 'var(--oliveSoft)', borderColor: 'var(--olive)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--olive)' }}>No ar:</span>
          <a href={publicUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--olive)', fontWeight: 600 }}>{publicUrl}</a>
        </div>
      )}

      <div className="grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        <div>
          <div style={card}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>Marca</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={lbl}>Nome exibido</label><input value={cfg.nomeExibicao} onChange={e => set({ nomeExibicao: e.target.value })} style={inp} placeholder="Ex: Realiza Vale Imóveis" /></div>
              <UploadImagem label="Logomarca" url={cfg.logoUrl} onChange={u => set({ logoUrl: u })} previewLogo
                dica="PNG com fundo transparente, na horizontal. Ideal: 480 × 140 px (ou proporção parecida). Aparece com ~54 px de altura no site — mande em alta pra não ficar borrada." />
              <div>
                <label style={lbl}>Cor principal</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={cfg.corPrimaria} onChange={e => set({ corPrimaria: e.target.value })} style={{ width: 44, height: 34, border: '1px solid var(--line)', borderRadius: 6, background: 'none' }} />
                  <input value={cfg.corPrimaria} onChange={e => set({ corPrimaria: e.target.value })} style={{ ...inp, width: 120 }} />
                </div>
              </div>
            </div>
          </div>

          <div style={card}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>Topo do site (hero)</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={lbl}>Título</label><input value={cfg.heroTitulo} onChange={e => set({ heroTitulo: e.target.value })} style={inp} placeholder="Encontre o imóvel certo pra você" /></div>
              <div><label style={lbl}>Subtítulo</label><textarea value={cfg.heroSubtitulo} onChange={e => set({ heroSubtitulo: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
              <UploadImagem label="Imagem de fundo" url={cfg.heroImagemUrl} onChange={u => set({ heroImagemUrl: u })}
                dica="Foto horizontal, bem larga. Ideal: 1920 × 1080 px (JPG, até 1 MB). O título do site fica por cima, então prefira uma imagem sem muita coisa no meio e à esquerda." />
            </div>
          </div>

          <div style={card}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>Sobre a imobiliária</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={lbl}>Título</label><input value={cfg.sobreTitulo} onChange={e => set({ sobreTitulo: e.target.value })} style={inp} placeholder="Sobre nós" /></div>
              <div><label style={lbl}>Texto</label><textarea value={cfg.sobreTexto} onChange={e => set({ sobreTexto: e.target.value })} rows={5} style={{ ...inp, resize: 'vertical' }} placeholder="Conte a história, diferenciais, tempo de mercado…" /></div>
              <UploadImagem label="Imagem" url={cfg.sobreImagemUrl} onChange={u => set({ sobreImagemUrl: u })}
                dica="Formato retrato ou quadrado. Ideal: 1000 × 900 px (JPG). Aparece ao lado do texto." />
            </div>
          </div>
        </div>

        <div>
          <div style={card}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>Contato</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={lbl}>WhatsApp</label><input value={cfg.whatsapp} onChange={e => set({ whatsapp: e.target.value })} style={inp} placeholder="(91) 98293-5558" /></div>
              <div><label style={lbl}>Telefone</label><input value={cfg.telefone} onChange={e => set({ telefone: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>E-mail</label><input value={cfg.email} onChange={e => set({ email: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>Endereço</label><input value={cfg.endereco} onChange={e => set({ endereco: e.target.value })} style={inp} /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}><label style={lbl}>Instagram</label><input value={cfg.instagram} onChange={e => set({ instagram: e.target.value })} style={inp} placeholder="@perfil" /></div>
                <div style={{ flex: 1 }}><label style={lbl}>Facebook</label><input value={cfg.facebook} onChange={e => set({ facebook: e.target.value })} style={inp} /></div>
              </div>
            </div>
          </div>

          <ListaEditavel
            titulo="Destaques (por que escolher a gente)"
            itens={cfg.destaques}
            vazio={{ titulo: '', texto: '' }}
            onChange={d => set({ destaques: d })}
            campos={[{ k: 'titulo', ph: 'Título do destaque' }, { k: 'texto', ph: 'Descrição curta', area: true }]}
            max={8}
          />

          <ListaEditavel
            titulo="Depoimentos de clientes"
            itens={cfg.depoimentos}
            vazio={{ nome: '', texto: '', cargo: '' }}
            onChange={d => set({ depoimentos: d })}
            campos={[{ k: 'texto', ph: 'O que o cliente falou', area: true }, { k: 'nome', ph: 'Nome' }, { k: 'cargo', ph: 'Ex: comprou apto em 2025' }]}
            max={12}
          />

          <div style={card}>
            <label style={lbl}>Endereço do site</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>{window.location.origin}/s/</span>
              <input value={slugEdit} onChange={e => setSlugEdit(e.target.value)} style={{ ...inp, width: 180 }} />
              <button onClick={() => mudarSlugSite(slugEdit)} disabled={slugEdit === site?.slug} style={{ ...inp, width: 'auto', padding: '8px 12px', cursor: 'pointer', opacity: slugEdit === site?.slug ? 0.5 : 1 }}>Mudar</button>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Texto do rodapé</label>
              <input value={cfg.rodapeTexto} onChange={e => set({ rodapeTexto: e.target.value })} style={inp} placeholder="CRECI 00000 · Todos os direitos reservados" />
            </div>
          </div>
        </div>
      </div>

      <div style={card}>
        <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 4px' }}>Imóveis no site</p>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>Desmarque os que não devem aparecer na página pública.</p>
        {imoveis.map(im => (
          <label key={im.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
            <input type="checkbox" checked={im.publicarNoSite !== false} onChange={e => toggleImovelNoSite(im.id, e.target.checked)} style={{ accentColor: 'var(--terra)' }} />
            <span style={{ flex: 1 }}>{im.titulo}</span>
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{im.finalidade} · {im.tipo}</span>
          </label>
        ))}
        {imoveis.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Nenhum imóvel cadastrado ainda — adicione em Imóveis.</p>}
      </div>

      {dirty && (
        <div style={{ position: 'sticky', bottom: 12, display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <button onClick={() => salvarSite(cfg)} style={{ padding: '11px 24px', border: 'none', borderRadius: 24, background: 'var(--terra)', color: '#fff', fontSize: 13.5, fontWeight: 700, boxShadow: '0 6px 20px rgba(0,0,0,.18)' }}>Salvar alterações</button>
        </div>
      )}
      {!API_URL && null}
    </div>
  );
}

interface CampoDef { k: string; ph: string; area?: boolean }
function ListaEditavel<T extends Record<string, string>>({ titulo, itens, vazio, onChange, campos, max }: {
  titulo: string; itens: T[]; vazio: T; onChange: (v: T[]) => void; campos: CampoDef[]; max: number;
}) {
  return (
    <div style={card}>
      <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>{titulo}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {itens.map((it, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 10, background: 'var(--bg)' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              {campos.map(c => c.area
                ? <textarea key={c.k} value={it[c.k] ?? ''} onChange={e => onChange(itens.map((x, j) => (j === i ? { ...x, [c.k]: e.target.value } : x)))} rows={2} placeholder={c.ph} style={{ ...inp, resize: 'vertical', fontSize: 13 }} />
                : <input key={c.k} value={it[c.k] ?? ''} onChange={e => onChange(itens.map((x, j) => (j === i ? { ...x, [c.k]: e.target.value } : x)))} placeholder={c.ph} style={{ ...inp, fontSize: 13 }} />)}
            </div>
            <button onClick={() => onChange(itens.filter((_, j) => j !== i))} style={{ marginTop: 6, border: 'none', background: 'none', color: 'var(--terra)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Trash2 size={11} /> remover</button>
          </div>
        ))}
      </div>
      {itens.length < max && (
        <button onClick={() => onChange([...itens, { ...vazio }])} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px dashed var(--line)', borderRadius: 8, background: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', width: '100%', justifyContent: 'center' }}>
          <Plus size={13} /> Adicionar
        </button>
      )}
    </div>
  );
}
