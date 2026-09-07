import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../../lib/api';
import type { SiteConfig } from '../../store/appStore';

interface SiteImovel {
  id: string; tipo: string; finalidade: string; titulo: string;
  endereco: string | null; cidade: string | null; estado: string | null;
  preco: number; area: number | null; quartos: number | null; suites: number | null;
  banheiros: number | null; vagas: number | null; amenidades: string[];
  descricao: string | null; situacao: string; imagens: string[]; videoUrl: string | null;
  valorCondominio: number | null; aceitaFinanciamento: boolean;
}
interface SiteData { slug: string; config: SiteConfig; imoveis: SiteImovel[] }

const BRL = (n: number) => 'R$ ' + n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const soDigitos = (s: string) => (s || '').replace(/\D/g, '');

export default function SitePublico() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<SiteData | null>(null);
  const [erro, setErro] = useState(false);
  const [fin, setFin] = useState('Todos');
  const [tipo, setTipo] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<SiteImovel | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', mensagem: '', imovel: '', imovelId: '', interesse: '' });
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mobile, setMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 640 : false));

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    fetch(API_URL + '/api/sites/publico/' + encodeURIComponent(slug))
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setErro(true));
  }, [slug]);

  useEffect(() => {
    if (data?.config.nomeExibicao) document.title = data.config.nomeExibicao;
  }, [data]);

  const brand = data?.config.corPrimaria || '#123C87';
  const tipos = useMemo(() => ['Todos', ...Array.from(new Set((data?.imoveis || []).map(i => i.tipo).filter(Boolean)))], [data]);
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data?.imoveis || []).filter(i => {
      if (fin !== 'Todos' && i.finalidade !== fin) return false;
      if (tipo !== 'Todos' && i.tipo !== tipo) return false;
      if (q && !(i.titulo + ' ' + (i.cidade || '') + ' ' + (i.endereco || '')).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, fin, tipo, busca]);

  function abrir(im: SiteImovel) { setAberto(im); setImgIdx(0); }
  function scrollTo(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
  function interesse(im: SiteImovel) {
    setForm(f => ({ ...f, imovel: im.titulo, imovelId: im.id, interesse: f.interesse || (im.finalidade === 'Alugar' ? 'Alugar' : 'Comprar'), mensagem: f.mensagem || 'Tenho interesse no imóvel: ' + im.titulo }));
    setAberto(null);
    scrollTo('contato');
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (form.nome.trim().length < 1 || soDigitos(form.telefone).length < 8) return;
    setEnviando(true);
    try {
      const r = await fetch(API_URL + '/api/sites/publico/' + encodeURIComponent(slug) + '/contato', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: form.nome, telefone: form.telefone, email: form.email || undefined, mensagem: form.mensagem || undefined, imovel: form.imovel || undefined, imovelId: form.imovelId || undefined, interesse: form.interesse || undefined }),
      });
      if (r.ok) setEnviado(true);
    } finally { setEnviando(false); }
  }

  if (erro) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', color: '#555', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Site não encontrado</p>
      <p style={{ margin: 0 }}>Verifique o endereço.</p>
    </div>
  );
  if (!data) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', color: '#999' }}>Carregando…</div>;

  const c = data.config;
  const whats = soDigitos(c.whatsapp || c.telefone);
  const S: Record<string, React.CSSProperties> = {
    wrap: { fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: '#1a1a1a', background: '#fff', lineHeight: 1.55 },
    section: { maxWidth: 1140, margin: '0 auto', padding: '64px 20px', boxSizing: 'border-box' as const },
    h2: { fontSize: 30, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-.02em' },
    sub: { fontSize: 15, color: '#666', margin: '0 0 34px' },
    btn: { background: brand, color: '#fff', border: 'none', borderRadius: 8, padding: '13px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' },
    btnGhost: { background: 'transparent', color: brand, border: '1.5px solid ' + brand, borderRadius: 8, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
    input: { width: '100%', padding: '12px 14px', border: '1px solid #d9d9d9', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', fontFamily: 'inherit' },
  };

  const specIcons = (im: SiteImovel) => [
    im.quartos ? im.quartos + ' quartos' : null,
    im.banheiros ? im.banheiros + ' banh.' : null,
    im.vagas ? im.vagas + ' vagas' : null,
    im.area ? im.area + ' m²' : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={S.wrap}>
      {/* header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #eee' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: mobile ? '9px 14px' : '10px 18px', display: 'flex', alignItems: 'center', gap: mobile ? 10 : 14 }}>
          {c.logoUrl
            ? <img src={c.logoUrl} alt={c.nomeExibicao} style={{ height: mobile ? 38 : 50, width: 'auto', maxWidth: mobile ? 130 : 200, objectFit: 'contain', display: 'block' }} />
            : <span style={{ fontWeight: 800, fontSize: mobile ? 16 : 19, color: brand, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nomeExibicao || 'Imobiliária'}</span>}
          <span style={{ flex: 1 }} />
          <nav style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
            {!mobile && <>
              <button onClick={() => scrollTo('imoveis')} style={{ border: 'none', background: 'none', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', color: '#333' }}>Imóveis</button>
              {c.sobreTexto && <button onClick={() => scrollTo('sobre')} style={{ border: 'none', background: 'none', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', color: '#333' }}>Sobre</button>}
              <button onClick={() => scrollTo('contato')} style={{ border: 'none', background: 'none', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', color: '#333' }}>Contato</button>
            </>}
            {whats && <a href={'https://wa.me/' + (whats.length <= 11 ? '55' + whats : whats)} target="_blank" rel="noreferrer" style={{ ...S.btn, padding: mobile ? '8px 13px' : '9px 15px', fontSize: 13, whiteSpace: 'nowrap' }}>WhatsApp</a>}
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="site-hero" style={{ position: 'relative', minHeight: 420, display: 'flex', alignItems: 'center', background: c.heroImagemUrl ? `linear-gradient(rgba(10,15,26,.55), rgba(10,15,26,.55)), url(${c.heroImagemUrl}) center/cover` : `linear-gradient(135deg, ${brand}, #0A0F1A)` }}>
        <div style={{ maxWidth: 1140, width: '100%', margin: '0 auto', padding: '72px 20px', color: '#fff', boxSizing: 'border-box' }}>
          <h1 style={{ fontSize: 'clamp(26px, 5.5vw, 50px)', fontWeight: 800, margin: '0 0 14px', maxWidth: 760, letterSpacing: '-.02em', lineHeight: 1.12 }}>
            {c.heroTitulo || 'Encontre o imóvel certo pra você'}
          </h1>
          {c.heroSubtitulo && <p style={{ fontSize: 'clamp(14.5px, 2vw, 19px)', margin: '0 0 26px', maxWidth: 620, opacity: .95 }}>{c.heroSubtitulo}</p>}
          <button onClick={() => scrollTo('imoveis')} style={S.btn}>Ver imóveis disponíveis</button>
        </div>
      </section>

      {/* imóveis */}
      <section id="imoveis" style={S.section}>
        <h2 style={S.h2}>Imóveis</h2>
        <p style={S.sub}>{filtrados.length} {filtrados.length === 1 ? 'imóvel disponível' : 'imóveis disponíveis'}</p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
          {['Todos', 'Comprar', 'Alugar'].map(f => (
            <button key={f} onClick={() => setFin(f)} style={{ padding: '9px 16px', borderRadius: 20, border: '1.5px solid ' + (fin === f ? brand : '#ddd'), background: fin === f ? brand : '#fff', color: fin === f ? '#fff' : '#555', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>{f}</button>
          ))}
          {tipos.length > 2 && (
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ ...S.input, width: 'auto', padding: '9px 12px' }}>
              {tipos.map(t => <option key={t}>{t}</option>)}
            </select>
          )}
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por bairro, cidade…" style={{ ...S.input, width: 'auto', flex: 1, minWidth: 180, padding: '9px 12px' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 290px), 1fr))', gap: 20 }}>
          {filtrados.map(im => (
            <button key={im.id} onClick={() => abrir(im)} style={{ textAlign: 'left', border: '1px solid #ececec', borderRadius: 12, overflow: 'hidden', background: '#fff', cursor: 'pointer', padding: 0, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
              <div style={{ height: 200, background: im.imagens[0] ? `url(${im.imagens[0]}) center/cover` : `linear-gradient(135deg, ${brand}22, ${brand}0a)`, position: 'relative' }}>
                <span style={{ position: 'absolute', top: 12, left: 12, background: '#fff', color: brand, fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.03em' }}>{im.finalidade}</span>
              </div>
              <div style={{ padding: 16 }}>
                <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{im.titulo}</p>
                <p style={{ fontSize: 13, color: '#777', margin: '0 0 10px' }}>{[im.endereco, im.cidade].filter(Boolean).join(' · ') || im.tipo}</p>
                <p style={{ fontSize: 19, fontWeight: 800, color: brand, margin: '0 0 8px' }}>{BRL(im.preco)}{im.finalidade === 'Alugar' ? '/mês' : ''}</p>
                {specIcons(im) && <p style={{ fontSize: 12.5, color: '#888', margin: 0 }}>{specIcons(im)}</p>}
              </div>
            </button>
          ))}
        </div>
        {filtrados.length === 0 && <p style={{ color: '#888', fontSize: 15 }}>Nenhum imóvel encontrado com esses filtros.</p>}
      </section>

      {/* destaques */}
      {c.destaques.length > 0 && (
        <section style={{ background: '#f7f8fa' }}>
          <div style={S.section}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 24 }}>
              {c.destaques.map((d, i) => (
                <div key={i}>
                  <div style={{ width: 40, height: 4, background: brand, borderRadius: 4, marginBottom: 14 }} />
                  <p style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>{d.titulo}</p>
                  <p style={{ fontSize: 14.5, color: '#666', margin: 0 }}>{d.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* sobre */}
      {c.sobreTexto && (
        <section id="sobre" style={S.section}>
          <div style={{ display: 'grid', gridTemplateColumns: c.sobreImagemUrl ? '1fr 1fr' : '1fr', gap: 40, alignItems: 'center' }} className="site-2col">
            <div>
              <h2 style={S.h2}>{c.sobreTitulo || 'Sobre nós'}</h2>
              <p style={{ fontSize: 15.5, color: '#555', whiteSpace: 'pre-wrap', margin: 0 }}>{c.sobreTexto}</p>
            </div>
            {c.sobreImagemUrl && <img src={c.sobreImagemUrl} alt="" style={{ width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 380 }} />}
          </div>
        </section>
      )}

      {/* depoimentos */}
      {c.depoimentos.length > 0 && (
        <section style={{ background: '#f7f8fa' }}>
          <div style={S.section}>
            <h2 style={{ ...S.h2, textAlign: 'center' }}>O que dizem nossos clientes</h2>
            <div style={{ height: 34 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 270px), 1fr))', gap: 20 }}>
              {c.depoimentos.map((d, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 12, padding: 22 }}>
                  <p style={{ fontSize: 14.5, color: '#444', fontStyle: 'italic', margin: '0 0 14px' }}>“{d.texto}”</p>
                  <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>{d.nome}</p>
                  {d.cargo && <p style={{ fontSize: 12.5, color: '#888', margin: 0 }}>{d.cargo}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* contato */}
      <section id="contato" style={S.section}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 44 }} className="site-2col">
          <div>
            <h2 style={S.h2}>Fale com a gente</h2>
            <p style={S.sub}>Preencha e um corretor entra em contato.</p>
            {enviado ? (
              <div style={{ padding: 24, background: '#f0f7f0', border: '1px solid #cfe8cf', borderRadius: 12 }}>
                <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Recebemos seu contato!</p>
                <p style={{ fontSize: 14, color: '#555', margin: 0 }}>Em breve um corretor fala com você.</p>
              </div>
            ) : (
              <form onSubmit={enviar} style={{ display: 'grid', gap: 12 }}>
                {form.imovel && <p style={{ fontSize: 13, color: brand, fontWeight: 600, margin: 0 }}>Imóvel: {form.imovel}</p>}
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Comprar', 'Alugar'].map(op => (
                    <button key={op} type="button" onClick={() => setForm({ ...form, interesse: form.interesse === op ? '' : op })}
                      style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1.5px solid ' + (form.interesse === op ? brand : '#d9d9d9'), background: form.interesse === op ? brand : '#fff', color: form.interesse === op ? '#fff' : '#555', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                      Quero {op.toLowerCase()}
                    </button>
                  ))}
                </div>
                <input required value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Seu nome" style={S.input} />
                <input required value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="Telefone / WhatsApp" style={S.input} />
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="E-mail (opcional)" style={S.input} />
                <textarea value={form.mensagem} onChange={e => setForm({ ...form, mensagem: e.target.value })} placeholder="Mensagem (opcional)" rows={3} style={{ ...S.input, resize: 'vertical' }} />
                <button type="submit" disabled={enviando} style={{ ...S.btn, opacity: enviando ? .6 : 1 }}>{enviando ? 'Enviando…' : 'Enviar'}</button>
              </form>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {c.telefone && <InfoLinha rotulo="Telefone" valor={c.telefone} />}
            {c.whatsapp && <InfoLinha rotulo="WhatsApp" valor={c.whatsapp} href={'https://wa.me/' + (whats.length <= 11 ? '55' + whats : whats)} />}
            {c.email && <InfoLinha rotulo="E-mail" valor={c.email} href={'mailto:' + c.email} />}
            {c.endereco && <InfoLinha rotulo="Endereço" valor={c.endereco} />}
            {(c.instagram || c.facebook) && (
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                {c.instagram && <a href={c.instagram.startsWith('http') ? c.instagram : 'https://instagram.com/' + c.instagram.replace('@', '')} target="_blank" rel="noreferrer" style={{ color: brand, fontWeight: 700, fontSize: 14 }}>Instagram</a>}
                {c.facebook && <a href={c.facebook.startsWith('http') ? c.facebook : 'https://facebook.com/' + c.facebook} target="_blank" rel="noreferrer" style={{ color: brand, fontWeight: 700, fontSize: 14 }}>Facebook</a>}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* footer */}
      <footer style={{ background: '#0A0F1A', color: '#aab', padding: '36px 22px', textAlign: 'center' }}>
        {c.logoUrl
          ? <img src={c.logoUrl} alt={c.nomeExibicao} style={{ height: 40, width: 'auto', maxWidth: 200, objectFit: 'contain', margin: '0 auto 12px', display: 'block', background: '#fff', borderRadius: 8, padding: '6px 12px' }} />
          : <p style={{ fontWeight: 700, color: '#fff', margin: '0 0 4px', fontSize: 15 }}>{c.nomeExibicao || 'Imobiliária'}</p>}
        {c.rodapeTexto && <p style={{ margin: '0 0 8px', fontSize: 13 }}>{c.rodapeTexto}</p>}
        <p style={{ margin: 0, fontSize: 11.5, opacity: .5 }}>Site feito com Visita IA</p>
      </footer>

      {/* modal do imóvel */}
      {aberto && (
        <div onClick={() => setAberto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,26,.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, maxWidth: 760, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ height: 340, background: aberto.imagens[imgIdx] ? `url(${aberto.imagens[imgIdx]}) center/cover` : `linear-gradient(135deg, ${brand}22, ${brand}0a)`, position: 'relative', borderRadius: '14px 14px 0 0' }}>
              <button onClick={() => setAberto(null)} style={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.9)', fontSize: 18, cursor: 'pointer' }}>×</button>
            </div>
            {aberto.imagens.length > 1 && (
              <div style={{ display: 'flex', gap: 8, padding: '10px 22px', overflowX: 'auto' }}>
                {aberto.imagens.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} style={{ width: 64, height: 46, flex: 'none', borderRadius: 6, border: '2px solid ' + (i === imgIdx ? brand : 'transparent'), background: `url(${img}) center/cover`, cursor: 'pointer' }} />
                ))}
              </div>
            )}
            <div style={{ padding: '18px 22px 26px' }}>
              <span style={{ background: brand + '15', color: brand, fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase' }}>{aberto.finalidade} · {aberto.tipo}</span>
              <h3 style={{ fontSize: 23, fontWeight: 800, margin: '12px 0 4px' }}>{aberto.titulo}</h3>
              <p style={{ fontSize: 14, color: '#777', margin: '0 0 12px' }}>{[aberto.endereco, aberto.cidade, aberto.estado].filter(Boolean).join(', ')}</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: brand, margin: '0 0 4px' }}>{BRL(aberto.preco)}{aberto.finalidade === 'Alugar' ? '/mês' : ''}</p>
              {aberto.valorCondominio ? <p style={{ fontSize: 13, color: '#888', margin: '0 0 16px' }}>+ condomínio {BRL(aberto.valorCondominio)}</p> : <div style={{ height: 12 }} />}
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13.5, color: '#555', marginBottom: 16 }}>
                {aberto.quartos ? <span><b>{aberto.quartos}</b> quartos</span> : null}
                {aberto.suites ? <span><b>{aberto.suites}</b> suítes</span> : null}
                {aberto.banheiros ? <span><b>{aberto.banheiros}</b> banheiros</span> : null}
                {aberto.vagas ? <span><b>{aberto.vagas}</b> vagas</span> : null}
                {aberto.area ? <span><b>{aberto.area}</b> m²</span> : null}
                <span>{aberto.situacao}</span>
              </div>
              {aberto.amenidades.length > 0 && (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
                  {aberto.amenidades.map((a, i) => <span key={i} style={{ background: '#f2f3f5', color: '#555', fontSize: 12.5, padding: '4px 10px', borderRadius: 20 }}>{a}</span>)}
                </div>
              )}
              {aberto.descricao && <p style={{ fontSize: 14.5, color: '#444', whiteSpace: 'pre-wrap', margin: '0 0 20px' }}>{aberto.descricao}</p>}
              <button onClick={() => interesse(aberto)} style={S.btn}>Tenho interesse</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @media(max-width:820px){ .site-2col{grid-template-columns:1fr!important} }
        @media(max-width:600px){
          .site-navlink{display:none!important}
          .site-logo{height:40px!important}
          .site-hero{min-height:340px!important}
          .site-hero > div{padding:52px 16px!important}
        }
        @media(max-width:400px){ .site-headrow{padding:8px 12px!important} }
      `}</style>
    </div>
  );
}

function InfoLinha({ rotulo, valor, href }: { rotulo: string; valor: string; href?: string }) {
  return (
    <div>
      <p style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: '#999', margin: '0 0 2px', fontWeight: 700 }}>{rotulo}</p>
      {href
        ? <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 15, color: '#1a1a1a', textDecoration: 'none' }}>{valor}</a>
        : <p style={{ fontSize: 15, margin: 0 }}>{valor}</p>}
    </div>
  );
}
