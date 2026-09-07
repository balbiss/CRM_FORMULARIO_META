import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';

type Campo = 'nome' | 'telefone' | 'email' | 'campanha' | '';

/** Parser de CSV simples — aceita separador , ou ; e campos entre aspas. */
function parseCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sep = (limpo.split('\n')[0].match(/;/g) || []).length > (limpo.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const linhas: string[][] = [];
  let campo = '', linha: string[] = [], aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo.length || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter(l => l.some(x => x.trim().length));
}

const PALPITE: Record<Campo, RegExp> = {
  nome: /nome|name|cliente|contato/i,
  telefone: /tel|fone|phone|whats|celular|contato/i,
  email: /mail|e-?mail/i,
  campanha: /campanha|campaign|origem|source|an[uú]ncio/i,
  '': /.^/,
};

export function ImportModal() {
  const importOpen = useAppStore(s => s.importOpen);
  const setImportOpen = useAppStore(s => s.setImportOpen);
  const importarLeads = useAppStore(s => s.importarLeads);
  const perfis = useAppStore(s => s.perfisRemotos);
  const { isManager } = useRoleInfo();
  const inputRef = useRef<HTMLInputElement>(null);

  const [nomeArquivo, setNomeArquivo] = useState('');
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [temCabecalho, setTemCabecalho] = useState(true);
  const [mapa, setMapa] = useState<Campo[]>([]);
  const [corretorId, setCorretorId] = useState('');
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ criados: number; ignorados: number } | null>(null);

  const corretores = perfis.filter(p => p.role === 'corretor');
  const cabecalho = linhas[0] || [];
  const dados = temCabecalho ? linhas.slice(1) : linhas;

  const idxDe = (campo: Campo) => mapa.findIndex(m => m === campo);
  const registros = useMemo(() => {
    const iNome = idxDe('nome'), iTel = idxDe('telefone'), iMail = idxDe('email'), iCamp = idxDe('campanha');
    return dados.map(l => ({
      nome: iNome >= 0 ? (l[iNome] || '').trim() : '',
      telefone: iTel >= 0 ? (l[iTel] || '').trim() : '',
      email: iMail >= 0 ? (l[iMail] || '').trim() : '',
      campanha: iCamp >= 0 ? (l[iCamp] || '').trim() : '',
    }));
  }, [dados, mapa]);

  const validos = registros.filter(r => r.nome.length >= 1 && r.telefone.replace(/\D/g, '').length >= 8);

  function carregar(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result || ''));
      if (!parsed.length) return;
      setNomeArquivo(file.name);
      setLinhas(parsed);
      setResultado(null);
      const cols = parsed[0].length;
      const primeira = parsed[0];
      const pareceCabecalho = primeira.some(c => /[a-zA-Z]/.test(c)) && !primeira.some(c => /^\+?[\d()\s-]{8,}$/.test(c.trim()));
      setTemCabecalho(pareceCabecalho);
      const base = primeira.map((h): Campo => {
        for (const campo of ['nome', 'telefone', 'email', 'campanha'] as Campo[]) {
          if (pareceCabecalho && PALPITE[campo].test(h)) return campo;
        }
        return '';
      });
      // garante um nome e um telefone se o palpite falhou
      if (!base.includes('nome') && cols > 0) base[0] = 'nome';
      if (!base.includes('telefone') && cols > 1) base[1] = 'telefone';
      setMapa(base);
    };
    reader.readAsText(file, 'utf-8');
  }

  async function confirmar() {
    setImportando(true);
    const r = await importarLeads(validos.map(v => ({ ...v, ...(corretorId ? { corretorId } : {}) })));
    setImportando(false);
    setResultado(r);
  }

  function fechar() {
    setImportOpen(false);
    setNomeArquivo(''); setLinhas([]); setMapa([]); setResultado(null); setCorretorId('');
  }

  if (!importOpen) return null;

  return (
    <div onClick={fechar} className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(8,17,31,.5)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={e => e.stopPropagation()} className="modal-card" style={{ width: '100%', maxWidth: 660, maxHeight: '88vh', overflowY: 'auto', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 26, animation: 'fadeUp .14s ease' }}>
        <h3 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 25, margin: '0 0 6px' }}>Importar leads via planilha</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px' }}>Arquivo CSV — os leads entram na coluna "Lead Novo".</p>

        {resultado ? (
          <>
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 22, background: 'var(--bg)', marginBottom: 22 }}>
              <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>{resultado.criados} lead{resultado.criados === 1 ? '' : 's'} importado{resultado.criados === 1 ? '' : 's'}</p>
              {resultado.ignorados > 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>{resultado.ignorados} linha{resultado.ignorados === 1 ? '' : 's'} ignorada{resultado.ignorados === 1 ? '' : 's'} (sem nome ou telefone válido).</p>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={fechar} style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Fechar</button>
            </div>
          </>
        ) : (
          <>
            <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) carregar(f); }} />
            <button
              onClick={() => inputRef.current?.click()}
              style={{ width: '100%', border: '1px dashed var(--line)', borderRadius: 10, padding: 22, textAlign: 'center', marginBottom: 20, background: 'var(--bg)', cursor: 'pointer' }}
            >
              <p style={{ fontSize: 13.5, margin: '0 0 4px', fontWeight: 600 }}>{nomeArquivo || 'Escolher arquivo CSV'}</p>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>
                {linhas.length ? dados.length + ' linhas · ' + cabecalho.length + ' colunas' : 'clique para selecionar'}
              </p>
            </button>

            {linhas.length > 0 && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
                  <input type="checkbox" checked={temCabecalho} onChange={e => setTemCabecalho(e.target.checked)} />
                  a primeira linha é cabeçalho
                </label>

                <p style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 10px' }}>Ligue cada coluna a um campo</p>
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
                  {cabecalho.map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: i < cabecalho.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 12.5 }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600 }}>{temCabecalho ? h || '(coluna ' + (i + 1) + ')' : 'Coluna ' + (i + 1)}</span>
                        <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{(dados[0]?.[i] || '').slice(0, 24)}</span>
                      </span>
                      <select
                        value={mapa[i] || ''}
                        onChange={e => setMapa(m => m.map((x, j) => (j === i ? (e.target.value as Campo) : x)))}
                        style={{ width: 140, padding: '7px 8px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--bg)', fontSize: 12.5 }}
                      >
                        <option value="">— ignorar —</option>
                        <option value="nome">Nome</option>
                        <option value="telefone">Telefone</option>
                        <option value="email">E-mail</option>
                        <option value="campanha">Campanha</option>
                      </select>
                    </div>
                  ))}
                </div>

                {isManager && (
                  <label style={{ display: 'block', marginBottom: 18 }}>
                    <span style={{ display: 'block', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>Atribuir a</span>
                    <select value={corretorId} onChange={e => setCorretorId(e.target.value)} style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13 }}>
                      <option value="">Roleta (distribui automático)</option>
                      {corretores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select>
                  </label>
                )}

                <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 16px' }}>
                  {idxDe('nome') < 0 || idxDe('telefone') < 0
                    ? 'Escolha ao menos as colunas de Nome e Telefone.'
                    : validos.length + ' de ' + registros.length + ' linhas prontas para importar.'}
                </p>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={fechar} style={{ padding: '11px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'none', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
              <button
                onClick={confirmar}
                disabled={importando || validos.length === 0 || idxDe('nome') < 0 || idxDe('telefone') < 0}
                style={{ padding: '11px 18px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 13, fontWeight: 600, opacity: importando || validos.length === 0 || idxDe('nome') < 0 || idxDe('telefone') < 0 ? 0.5 : 1 }}
              >
                {importando ? 'Importando…' : 'Importar ' + validos.length + ' lead' + (validos.length === 1 ? '' : 's')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
