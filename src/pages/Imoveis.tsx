import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore, type RemoteImovel, type ImovelInput, type SituacaoImovel } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';
import { BRL, thumb, PILL } from '../lib/format';
import { css } from '../lib/css';
import { FileUpload } from '../components/FileUpload';

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' };
const fieldInput: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13.5, marginBottom: 16, boxSizing: 'border-box' };

export default function Imoveis() {
  const imoveis = useAppStore(s => s.imoveis);
  const createImovel = useAppStore(s => s.createImovel);
  const updateImovel = useAppStore(s => s.updateImovel);
  const deleteImovel = useAppStore(s => s.deleteImovel);
  const { isManager } = useRoleInfo();
  const [tipo, setTipo] = useState('Todos os tipos');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<RemoteImovel | null>(null);

  const lista = tipo === 'Todos os tipos' ? imoveis : imoveis.filter(i => i.tipo === tipo);

  return (
    <div>
      <div className="page-head" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Catálogo</p>
          <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Imóveis</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={tipo} onChange={e => setTipo(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--card)', fontSize: 13 }}>
            <option>Todos os tipos</option><option>Apartamento</option><option>Casa</option><option>Comercial</option><option>Terreno</option>
          </select>
          {isManager && <button onClick={() => setModalAberto(true)} style={{ padding: '9px 16px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Novo imóvel</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
        {lista.map((im, i) => (
          <div key={im.id} style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', overflow: 'hidden' }}>
            {im.imagens[0] ? (
              <img src={im.imagens[0]} alt={im.titulo} style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block', borderBottom: '1px solid var(--line)' }} />
            ) : (
              <div style={css(thumb(i, 999) + ';width:100%;height:150px;border-radius:0;border:none;border-bottom:1px solid var(--line)')} />
            )}
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={css(PILL + 'border:1px solid var(--line);color:var(--muted)')}>{im.tipo}</span>
                <span style={css(PILL + (im.finalidade === 'Venda' ? 'background:var(--oliveSoft);color:var(--olive)' : 'background:var(--terraSoft);color:var(--terra)'))}>{im.finalidade}</span>
                {im.situacao !== 'Pronto para morar' && (
                  <span style={css(PILL + 'background:var(--terraSoft);color:var(--terra)')}>{im.situacao}{im.previsaoEntrega ? ' · ' + im.previsaoEntrega : ''}</span>
                )}
              </div>
              <p style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 3px' }}>{im.titulo}</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px' }}>{im.cidade}{im.cidade && im.estado ? ', ' : ''}{im.estado}</p>
              <p style={{ fontFamily: 'Newsreader,serif', fontSize: 21, margin: '0 0 3px' }}>{BRL(Number(im.preco))}</p>
              {im.aceitaFinanciamento && <p style={{ fontSize: 11.5, color: 'var(--olive)', margin: '0 0 9px', fontWeight: 600 }}>Aceita financiamento</p>}
              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                {im.area && <span>{Number(im.area)} m²</span>}
                {!!im.quartos && <span>{im.quartos} qts</span>}
                {!!im.banheiros && <span>{im.banheiros} banh.</span>}
                {!!im.vagas && <span>{im.vagas} vagas</span>}
              </div>
              {(im.valorCondominio || im.valorIptu) && (
                <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
                  {im.valorCondominio && <span>Cond. {BRL(Number(im.valorCondominio))}/mês</span>}
                  {im.valorIptu && <span>IPTU {BRL(Number(im.valorIptu))}/ano</span>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: isManager ? 12 : 0 }}>
                {im.amenidades.slice(0, 3).map(a => (
                  <span key={a} style={{ fontSize: 10.5, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 20, padding: '3px 8px' }}>{a}</span>
                ))}
              </div>
              {isManager && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditando(im)} style={{ flex: 1, padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12, fontWeight: 600 }}>Editar</button>
                  <button onClick={() => deleteImovel(im.id)} style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 7, background: 'none', fontSize: 12, color: 'var(--terra)' }}>Excluir</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {lista.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>Nenhum imóvel cadastrado com esse filtro.</p>
        </div>
      )}

      {modalAberto && <ImovelModal onClose={() => setModalAberto(false)} onSave={async input => (await createImovel(input)) && setModalAberto(false)} />}
      {editando && (
        <ImovelModal
          imovel={editando}
          onClose={() => setEditando(null)}
          onSave={async input => (await updateImovel(editando.id, input)) && setEditando(null)}
        />
      )}
    </div>
  );
}

function ImovelModal({ imovel, onClose, onSave }: {
  imovel?: RemoteImovel;
  onClose: () => void;
  onSave: (input: ImovelInput) => void;
}) {
  const [tipo, setTipo] = useState(imovel?.tipo ?? 'Apartamento');
  const [finalidade, setFinalidade] = useState(imovel?.finalidade ?? 'Venda');
  const [titulo, setTitulo] = useState(imovel?.titulo ?? '');
  const [endereco, setEndereco] = useState(imovel?.endereco ?? '');
  const [cidade, setCidade] = useState(imovel?.cidade ?? '');
  const [estado, setEstado] = useState(imovel?.estado ?? '');
  const [preco, setPreco] = useState(imovel?.preco ?? '');
  const [area, setArea] = useState(imovel?.area ?? '');
  const [quartos, setQuartos] = useState(String(imovel?.quartos ?? 0));
  const [suites, setSuites] = useState(String(imovel?.suites ?? 0));
  const [banheiros, setBanheiros] = useState(String(imovel?.banheiros ?? 0));
  const [vagas, setVagas] = useState(String(imovel?.vagas ?? 0));
  const [amenidades, setAmenidades] = useState(imovel?.amenidades.join(', ') ?? '');
  const [descricao, setDescricao] = useState(imovel?.descricao ?? '');
  const [imagens, setImagens] = useState<string[]>(imovel?.imagens ?? []);
  const [videoUrl, setVideoUrl] = useState<string | null>(imovel?.videoUrl ?? null);
  const [situacao, setSituacao] = useState<SituacaoImovel>(imovel?.situacao ?? 'Pronto para morar');
  const [previsaoEntrega, setPrevisaoEntrega] = useState(imovel?.previsaoEntrega ?? '');
  const [aceitaFinanciamento, setAceitaFinanciamento] = useState(imovel?.aceitaFinanciamento ?? true);
  const [valorCondominio, setValorCondominio] = useState(imovel?.valorCondominio ?? '');
  const [valorIptu, setValorIptu] = useState(imovel?.valorIptu ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!titulo.trim() || !preco) return;
    setSaving(true);
    await onSave({
      tipo, finalidade, titulo: titulo.trim(),
      endereco: endereco.trim() || null, cidade: cidade.trim() || null, estado: estado.trim() || null,
      preco: Number(preco), area: area ? Number(area) : null,
      quartos: Number(quartos) || 0, suites: Number(suites) || 0, banheiros: Number(banheiros) || 0, vagas: Number(vagas) || 0,
      amenidades: amenidades.split(',').map(a => a.trim()).filter(Boolean),
      descricao: descricao.trim() || null,
      imagens, videoUrl,
      situacao, previsaoEntrega: situacao === 'Pronto para morar' ? null : (previsaoEntrega.trim() || null),
      aceitaFinanciamento,
      valorCondominio: valorCondominio ? Number(valorCondominio) : null,
      valorIptu: valorIptu ? Number(valorIptu) : null,
    });
    setSaving(false);
  };

  return (
    <div onClick={onClose} className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(8,17,31,.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} className="modal-card" style={{ width: '100%', maxWidth: 520, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, animation: 'fadeUp .14s ease', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 22, margin: '0 0 18px' }}>{imovel ? 'Editar imóvel' : 'Novo imóvel'}</h3>
        <div data-modal-grid style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} style={fieldInput}>
              <option>Apartamento</option><option>Casa</option><option>Comercial</option><option>Terreno</option>
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Finalidade</label>
            <select value={finalidade} onChange={e => setFinalidade(e.target.value)} style={fieldInput}>
              <option>Venda</option><option>Aluguel</option>
            </select>
          </div>
        </div>
        <div data-modal-grid style={{ display: 'grid', gridTemplateColumns: situacao !== 'Pronto para morar' ? '1fr 1fr' : '1fr', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Situação</label>
            <select value={situacao} onChange={e => setSituacao(e.target.value as SituacaoImovel)} style={fieldInput}>
              <option>Pronto para morar</option><option>Em obras</option><option>Lançamento</option>
            </select>
          </div>
          {situacao !== 'Pronto para morar' && (
            <div>
              <label style={fieldLabel}>Previsão de entrega</label>
              <input value={previsaoEntrega} onChange={e => setPrevisaoEntrega(e.target.value)} style={fieldInput} placeholder="Ex: Dezembro/2027" />
            </div>
          )}
        </div>
        <label style={fieldLabel}>Título</label>
        <input value={titulo} onChange={e => setTitulo(e.target.value)} style={fieldInput} placeholder="Ex: Edifício Aurora — Cobertura 1201" />
        <label style={fieldLabel}>Endereço</label>
        <input value={endereco} onChange={e => setEndereco(e.target.value)} style={fieldInput} />
        <div data-modal-grid style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Cidade</label>
            <input value={cidade} onChange={e => setCidade(e.target.value)} style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>UF</label>
            <input value={estado} onChange={e => setEstado(e.target.value)} style={fieldInput} maxLength={2} />
          </div>
        </div>
        <div data-modal-grid style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Preço (R$)</label>
            <input value={preco} onChange={e => setPreco(e.target.value)} type="number" style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>Área (m²)</label>
            <input value={area} onChange={e => setArea(e.target.value)} type="number" style={fieldInput} />
          </div>
        </div>
        <div data-modal-grid="2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Quartos</label>
            <input value={quartos} onChange={e => setQuartos(e.target.value)} type="number" style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>Suítes</label>
            <input value={suites} onChange={e => setSuites(e.target.value)} type="number" style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>Banheiros</label>
            <input value={banheiros} onChange={e => setBanheiros(e.target.value)} type="number" style={fieldInput} />
          </div>
          <div>
            <label style={fieldLabel}>Vagas</label>
            <input value={vagas} onChange={e => setVagas(e.target.value)} type="number" style={fieldInput} />
          </div>
        </div>
        <div data-modal-grid style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={fieldLabel}>Condomínio (R$/mês)</label>
            <input value={valorCondominio} onChange={e => setValorCondominio(e.target.value)} type="number" style={fieldInput} placeholder="Opcional" />
          </div>
          <div>
            <label style={fieldLabel}>IPTU (R$/ano)</label>
            <input value={valorIptu} onChange={e => setValorIptu(e.target.value)} type="number" style={fieldInput} placeholder="Opcional" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAceitaFinanciamento(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', marginBottom: 16, width: '100%' }}
        >
          <span style={{ width: 26, height: 15, borderRadius: 10, background: aceitaFinanciamento ? 'var(--olive)' : 'var(--line)', padding: 2, display: 'flex', justifyContent: aceitaFinanciamento ? 'flex-end' : 'flex-start', flex: 'none' }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#fff', display: 'block' }} />
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>Aceita financiamento</span>
        </button>
        <label style={fieldLabel}>Amenidades (separadas por vírgula)</label>
        <input value={amenidades} onChange={e => setAmenidades(e.target.value)} style={fieldInput} placeholder="Piscina, Academia, Portaria 24h" />
        <label style={fieldLabel}>Fotos</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {imagens.map((url, i) => (
            <div key={url} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
              <img src={url} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 5, flex: 'none' }} />
              <a href={url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, color: 'var(--ink)' }}>{url.split('/').pop()}</a>
              <button type="button" onClick={() => setImagens(imgs => imgs.filter((_, x) => x !== i))} title="Remover" style={{ border: 'none', background: 'none', color: 'var(--terra)', display: 'flex', flex: 'none' }}><X size={14} /></button>
            </div>
          ))}
          <FileUpload value={null} onChange={url => { if (url) setImagens(imgs => [...imgs, url]); }} accept="image/*" label="Adicionar foto" />
        </div>
        <label style={fieldLabel}>Vídeo (opcional)</label>
        <div style={{ marginBottom: 16 }}>
          <FileUpload value={videoUrl} onChange={setVideoUrl} accept="video/*" label="Anexar vídeo" />
        </div>
        <label style={fieldLabel}>Descrição</label>
        <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3} style={{ ...fieldInput, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
          <button onClick={submit} disabled={saving} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  );
}
