import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, useReactFlow, Background, Controls, Handle, Position, applyNodeChanges,
  type Node, type Edge, type NodeProps, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MessageSquare, Mic, Image as ImageIcon, FileText, Clock, Zap, Trash2 } from 'lucide-react';
import { useAppStore, GATILHOS_FLOW, type FlowBloco, type BlocoTipo, type FlowDef } from '../store/appStore';
import { useRoleInfo } from '../lib/selectors';

const DND_MIME = 'application/x-crm-visitaia-bloco';

const TIPO_META: Record<BlocoTipo, { label: string; Icon: typeof MessageSquare }> = {
  texto: { label: 'Texto', Icon: MessageSquare },
  audio: { label: 'Áudio', Icon: Mic },
  imagem: { label: 'Imagem', Icon: ImageIcon },
  pdf: { label: 'PDF', Icon: FileText },
  espera: { label: 'Espera', Icon: Clock },
};

const cardBase: React.CSSProperties = { padding: '12px 14px', border: '1.5px solid var(--line)', borderRadius: 10, background: 'var(--card)', boxShadow: '0 2px 6px rgba(28,27,26,.06)' };
const handleStyle = { background: 'var(--line)', width: 7, height: 7, border: 'none' };

function TriggerNode({ data }: NodeProps) {
  return (
    <div style={{ ...cardBase, borderColor: 'var(--terra)', background: 'var(--terraSoft)', minWidth: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Zap size={14} color="var(--terra)" />
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--terra)' }}>Gatilho</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{String(data.label ?? '')}</p>
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={handleStyle} />
    </div>
  );
}

function BlocoNode({ data, selected }: NodeProps) {
  const bloco = data.bloco as FlowBloco;
  const meta = TIPO_META[bloco.tipo];
  const preview = bloco.tipo === 'texto' ? bloco.texto : bloco.tipo === 'espera' ? 'Aguardar ' + bloco.delay : bloco.arquivo;
  return (
    <div style={{ ...cardBase, borderColor: selected ? 'var(--terra)' : 'var(--line)', minWidth: 260, maxWidth: 280 }}>
      <Handle type="target" position={Position.Top} isConnectable={false} style={handleStyle} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <meta.Icon size={13} color="var(--terra)" />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{meta.label}</span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const }}>{preview || '(vazio)'}</p>
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={handleStyle} />
    </div>
  );
}

const nodeTypes = { trigger: TriggerNode, bloco: BlocoNode };

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' };
const fieldInput: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' };
const iconBtn: React.CSSProperties = { border: '1px solid var(--line)', background: 'var(--card)', width: 26, height: 26, borderRadius: 6, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const canvasHeight = 'clamp(640px, calc(100vh - 260px), 920px)';
const basePos = (i: number) => ({ x: 40, y: 160 + i * 155 });

/** O canvas propriamente dito — precisa estar dentro de um <ReactFlowProvider> porque usa
 * `screenToFlowPosition` (useReactFlow) pra converter onde o bloco foi solto em coordenadas do
 * fluxo. Isolado num componente próprio até por isso: o hook não pode ser chamado no mesmo
 * componente que renderiza o Provider, só em um descendente dele. */
function FlowCanvas({ flow, addBloco, setBlocoIdSel }: {
  flow: FlowDef;
  addBloco: (flowId: string, tipo: BlocoTipo) => string;
  setBlocoIdSel: (id: string | null) => void;
}) {
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Nós de verdade em estado (não só um mapa de posições) — o React Flow reclama ("not
  // initialized") e a posição do nó se perde/salta durante o arrasto se a gente não devolver pra
  // ele, via onNodesChange, o MESMO array de nós com as mudanças aplicadas (inclusive as de
  // dimensão que ele mesmo mede) — é o padrão "controlado" oficial da lib, não um detalhe opcional.
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  // Quando um bloco é solto (drag da paleta) na posição X,Y, guarda aqui pra o efeito de sincronia
  // abaixo usar como posição inicial em vez do empilhamento vertical padrão.
  const pendingPos = useRef<{ id: string; pos: { x: number; y: number } } | null>(null);

  // Sincroniza conteúdo (texto/arquivo/gatilho) sempre que o fluxo mudar, mas preserva a posição
  // (e as dimensões medidas) dos nós que já existiam — editar um texto não reseta o que foi
  // arrastado.
  useEffect(() => {
    setRfNodes(prev => {
      const porId = new Map(prev.map(n => [n.id, n]));
      const t = porId.get('trigger');
      const ns: Node[] = [t ? { ...t, data: { label: flow.gatilho } } : { id: 'trigger', type: 'trigger', position: { x: 60, y: 30 }, data: { label: flow.gatilho }, draggable: false, selectable: false }];
      flow.blocos.forEach((b, i) => {
        const ex = porId.get(b.id);
        if (ex) { ns.push({ ...ex, data: { bloco: b } }); return; }
        const drop = pendingPos.current?.id === b.id ? pendingPos.current.pos : basePos(i);
        ns.push({ id: b.id, type: 'bloco', position: drop, data: { bloco: b } });
      });
      pendingPos.current = null;
      return ns;
    });
  }, [flow]);

  // `fitView` como prop booleana só roda uma vez, no primeiro render — e o primeiro render aqui
  // sempre começa com `rfNodes` vazio (o efeito acima só popula depois), então o enquadramento
  // automático acertava a vista contra ZERO nós e nunca reenquadrava depois, deixando o canvas
  // "em branco" (só os controles de zoom visíveis, os blocos existindo fora da área enquadrada).
  // Chamando fitView manualmente assim que os nós existirem de verdade, resolve.
  const jaEnquadrou = useRef(false);
  useEffect(() => {
    if (rfNodes.length > 0 && !jaEnquadrou.current) {
      jaEnquadrou.current = true;
      requestAnimationFrame(() => fitView({ padding: 0.2, duration: 200 }));
    }
  }, [rfNodes.length, fitView]);

  const onNodesChange = (changes: NodeChange[]) => setRfNodes(nds => applyNodeChanges(changes, nds));

  // Efeito corrente (estilo Typebot): ao começar a arrastar um bloco, guarda a posição de partida
  // de todos os nós; a cada tick do arrasto, cada bloco SEGUINTE na sequência segue o MESMO
  // deslocamento total do bloco arrastado desde o início (não incremental — incremental faz a
  // cauda "correr" mais rápido que a cabeça e divergir).
  const dragStart = useRef<{ idx: number; base: Record<string, { x: number; y: number }> } | null>(null);

  const onNodeDragStart = (_: unknown, node: Node) => {
    if (node.id === 'trigger') return;
    const idx = flow.blocos.findIndex(b => b.id === node.id);
    if (idx < 0) return;
    const base: Record<string, { x: number; y: number }> = {};
    rfNodes.forEach(n => { base[n.id] = n.position; });
    dragStart.current = { idx, base };
  };

  const onNodeDrag = (_: unknown, node: Node) => {
    if (node.id === 'trigger' || !dragStart.current) return;
    const { idx, base } = dragStart.current;
    const origem = base[node.id];
    if (!origem) return;
    const delta = { x: node.position.x - origem.x, y: node.position.y - origem.y };
    setRfNodes(nds => nds.map(n => {
      const i = flow.blocos.findIndex(b => b.id === n.id);
      if (i <= idx) return n; // trigger (i=-1) e o próprio nó arrastado (já tratado pelo onNodesChange) ficam de fora
      const b0 = base[n.id];
      return b0 ? { ...n, position: { x: b0.x + delta.x, y: b0.y + delta.y } } : n;
    }));
  };

  const onNodeDragStop = () => { dragStart.current = null; };

  const edges = useMemo(() => {
    const es: Edge[] = [];
    let prev = 'trigger';
    flow.blocos.forEach(b => {
      es.push({
        id: prev + '-' + b.id, source: prev, target: b.id, type: 'default', animated: true,
        style: { stroke: 'var(--terra)', strokeWidth: 1.6, opacity: 0.55 },
      });
      prev = b.id;
    });
    return es;
  }, [flow]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const tipo = e.dataTransfer.getData(DND_MIME) as BlocoTipo;
    if (!tipo || !TIPO_META[tipo]) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const id = addBloco(flow.id, tipo);
    pendingPos.current = { id, pos };
    setBlocoIdSel(id);
  };

  return (
    <div
      style={{ flex: 1, minWidth: 0, height: canvasHeight, border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, n) => { if (n.id !== 'trigger') setBlocoIdSel(n.id); }}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={() => setBlocoIdSel(null)}
        minZoom={0.3}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--line)" gap={22} size={1.2} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default function Followup() {
  const flows = useAppStore(s => s.flows);
  const perfis = useAppStore(s => s.perfisRemotos);
  const createFlow = useAppStore(s => s.createFlow);
  const renameFlow = useAppStore(s => s.renameFlow);
  const setFlowGatilho = useAppStore(s => s.setFlowGatilho);
  const toggleFlowAtivo = useAppStore(s => s.toggleFlowAtivo);
  const deleteFlow = useAppStore(s => s.deleteFlow);
  const addBloco = useAppStore(s => s.addBloco);
  const ask = useAppStore(s => s.ask);
  const { isManager, meNome } = useRoleInfo();

  // perfisRemotos chega assíncrono (fetch pós-login) — não dá pra fixar o corretor selecionado
  // num useState inicial (a lista pode estar vazia no primeiro render). Fica null até o usuário
  // escolher, e cai no primeiro corretor real assim que a lista carrega.
  const corretores = useMemo(() => perfis.filter(p => p.role === 'corretor').map(p => p.nome), [perfis]);
  const [corretorSel, setCorretorSel] = useState<string | null>(null);
  const corretorAtivo = isManager ? (corretorSel ?? corretores[0] ?? meNome) : meNome;

  const flowsDoCorretor = flows.filter(f => f.corretor === corretorAtivo);
  const [flowIdSel, setFlowIdSel] = useState<string | null>(null);
  const flow = flows.find(f => f.id === flowIdSel) ?? flowsDoCorretor[0] ?? null;
  const [blocoIdSel, setBlocoIdSel] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState('');

  const bloco = flow?.blocos.find(b => b.id === blocoIdSel) ?? null;

  const criarFluxo = () => {
    if (!novoNome.trim()) return;
    const id = createFlow(corretorAtivo, novoNome.trim());
    setNovoNome('');
    setFlowIdSel(id);
  };

  const paletaBtn = (tipo: BlocoTipo) => {
    const meta = TIPO_META[tipo];
    return (
      <button
        key={tipo}
        draggable={!!flow}
        onDragStart={e => { if (!flow) return; e.dataTransfer.setData(DND_MIME, tipo); e.dataTransfer.effectAllowed = 'move'; }}
        onClick={() => { if (!flow) return; const id = addBloco(flow.id, tipo); setBlocoIdSel(id); }}
        disabled={!flow}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 8,
          background: 'var(--bg)', fontSize: 12.5, fontWeight: 600, opacity: flow ? 1 : 0.5, width: '100%', textAlign: 'left',
          cursor: flow ? 'grab' : 'not-allowed',
        }}
      >
        <meta.Icon size={14} />+ {meta.label}
      </button>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 4px' }}>Automação</p>
        <h1 style={{ fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 24, margin: 0, lineHeight: 1.2 }}>Follow-up Automático</h1>
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '6px 0 0' }}>Cada corretor monta o próprio fluxo de blocos — dispara quando um lead é atribuído a ele. Arraste um bloco da lista pro fluxo, ou clique pra adicionar no fim. Envio real via WAHA entra numa próxima etapa; por enquanto é só o construtor visual.</p>
      </div>

      <div className="split-pane" style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 14, alignItems: 'start' }}>
        {/* coluna esquerda: corretor + fluxos + paleta de blocos — fixa ao rolar a página, com
            rolagem própria caso o conteúdo (fluxos + blocos) seja mais alto que a tela. */}
        <div className="split-aside" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 78, maxHeight: 'calc(100vh - 98px)', overflowY: 'auto' }}>
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 16 }}>
            {isManager && (
              <>
                <label style={fieldLabel}>Corretor</label>
                <select value={corretorAtivo} onChange={e => { setCorretorSel(e.target.value); setFlowIdSel(null); setBlocoIdSel(null); }} style={fieldInput}>
                  {corretores.map(c => <option key={c}>{c}</option>)}
                </select>
              </>
            )}
            <p style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: '4px 0 8px' }}>Fluxos de {corretorAtivo}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {flowsDoCorretor.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>Nenhum fluxo ainda.</p>}
              {flowsDoCorretor.map(f => (
                <button
                  key={f.id}
                  onClick={() => { setFlowIdSel(f.id); setBlocoIdSel(null); }}
                  style={{
                    textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: '1px solid ' + (f.id === flow?.id ? 'var(--terra)' : 'var(--line)'),
                    background: f.id === flow?.id ? 'var(--terraSoft)' : 'var(--bg)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.ativo ? 'var(--olive)' : 'var(--muted)', flex: 'none' }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{f.nome}</span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{f.gatilho}</span>
                </button>
              ))}
            </div>
            <label style={fieldLabel}>Novo fluxo</label>
            <input value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && criarFluxo()} placeholder="Ex: Primeira vez" style={fieldInput} />
            <button onClick={criarFluxo} style={{ width: '100%', padding: '9px 12px', border: 'none', borderRadius: 8, background: 'var(--terra)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>+ Criar fluxo</button>
          </div>

          <div style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--card)', padding: 16 }}>
            <p style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 10px' }}>Blocos</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(['texto', 'audio', 'imagem', 'pdf', 'espera'] as BlocoTipo[]).map(paletaBtn)}
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '10px 0 0', lineHeight: 1.5 }}>Arraste pro fluxo, ou clique pra adicionar no fim.</p>
          </div>
        </div>

        {/* coluna direita: canvas + editor do bloco selecionado */}
        <div>
          {flow ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                <input
                  value={flow.nome}
                  onChange={e => renameFlow(flow.id, e.target.value)}
                  style={{ fontFamily: 'Newsreader,serif', fontSize: 19, border: '1px solid transparent', background: 'none', padding: '4px 6px', borderRadius: 6, minWidth: 120 }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--line)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'transparent')}
                />
                <select value={flow.gatilho} onChange={e => setFlowGatilho(flow.id, e.target.value)} style={{ padding: '7px 10px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--card)', fontSize: 12 }}>
                  {GATILHOS_FLOW.map(g => <option key={g}>{g}</option>)}
                </select>
                <button onClick={() => toggleFlowAtivo(flow.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 20, background: 'var(--card)' }}>
                  <span style={{ width: 26, height: 15, borderRadius: 10, background: flow.ativo ? 'var(--olive)' : 'var(--line)', padding: 2, display: 'flex', justifyContent: flow.ativo ? 'flex-end' : 'flex-start' }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#fff', display: 'block' }} />
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{flow.ativo ? 'Ativo' : 'Inativo'}</span>
                </button>
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => ask('Excluir fluxo "' + flow.nome + '"?', 'Todos os blocos desse fluxo são apagados. Esta ação não pode ser desfeita.', 'Excluir fluxo', () => { deleteFlow(flow.id); setFlowIdSel(null); setBlocoIdSel(null); })}
                  style={{ ...iconBtn, color: 'var(--terra)' }}
                  title="Excluir fluxo"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="fu-canvas-row" style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                <ReactFlowProvider>
                  <FlowCanvas key={flow.id} flow={flow} addBloco={addBloco} setBlocoIdSel={setBlocoIdSel} />
                </ReactFlowProvider>

                {/* painel do bloco selecionado — só aparece durante a edição, pra dar mais espaço ao canvas o resto do tempo */}
                {bloco && (
                  <div className="fu-editor" style={{ width: 320, flex: 'none', height: canvasHeight, overflowY: 'auto' }}>
                    <div style={cardBase}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        {(() => { const M = TIPO_META[bloco.tipo].Icon; return <M size={15} color="var(--terra)" />; })()}
                        <h3 style={{ margin: 0, fontFamily: 'Newsreader,serif', fontWeight: 400, fontSize: 17 }}>{TIPO_META[bloco.tipo].label}</h3>
                        <span style={{ flex: 1 }} />
                        <button onClick={() => useAppStore.getState().moveBloco(flow.id, bloco.id, 'up')} title="Mover pra cima" style={iconBtn}>↑</button>
                        <button onClick={() => useAppStore.getState().moveBloco(flow.id, bloco.id, 'down')} title="Mover pra baixo" style={iconBtn}>↓</button>
                        <button onClick={() => { useAppStore.getState().removeBloco(flow.id, bloco.id); setBlocoIdSel(null); }} title="Excluir bloco" style={{ ...iconBtn, color: 'var(--terra)' }}><Trash2 size={12} /></button>
                      </div>
                      {bloco.tipo === 'texto' && (
                        <textarea
                          value={bloco.texto ?? ''}
                          onChange={e => useAppStore.getState().updateBloco(flow.id, bloco.id, { texto: e.target.value })}
                          rows={8}
                          style={{ ...fieldInput, resize: 'vertical', fontFamily: 'inherit' }}
                          placeholder="Digite a mensagem…"
                        />
                      )}
                      {bloco.tipo === 'espera' && (
                        <>
                          <label style={fieldLabel}>Aguardar</label>
                          <input value={bloco.delay ?? ''} onChange={e => useAppStore.getState().updateBloco(flow.id, bloco.id, { delay: e.target.value })} style={fieldInput} placeholder="+1 dia, +10 min…" />
                        </>
                      )}
                      {(bloco.tipo === 'audio' || bloco.tipo === 'imagem' || bloco.tipo === 'pdf') && (
                        <>
                          <label style={fieldLabel}>Arquivo ({TIPO_META[bloco.tipo].label.toLowerCase()})</label>
                          <input value={bloco.arquivo ?? ''} onChange={e => useAppStore.getState().updateBloco(flow.id, bloco.id, { arquivo: e.target.value })} style={fieldInput} />
                          <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>Upload de verdade e envio pelo WAHA entram numa próxima etapa — por enquanto é só o nome do arquivo, ilustrativo.</p>
                        </>
                      )}
                      <p style={{ fontSize: 11, color: 'var(--muted)', margin: '14px 0 0' }}>Variáveis disponíveis: {'{nome}'}, {'{corretor}'}, {'{imovel}'}</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ height: canvasHeight, border: '1px dashed var(--line)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13.5 }}>
              Selecione ou crie um fluxo pra começar a montar os blocos.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
