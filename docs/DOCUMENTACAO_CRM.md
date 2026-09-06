# CRM Hinode — Documentação

> Apelido interno do projeto: **CRM Hinode**. Rebuild v2, independente, do CRM em produção da imobiliária "Hinode Imóveis" (o sistema original em produção é outro projeto, chamado internamente de "CRM OKA" — este aqui **não compartilha banco, código nem infraestrutura** com ele).

Repositório: [`github.com/balbiss/CRM_HINODE_IM-VEIS`](https://github.com/balbiss/CRM_HINODE_IM-VEIS) — toda atualização de código deste projeto é commitada e enviada pra lá.

**🟢 EM PRODUÇÃO desde 2026-09-06**: [`https://hinode.inoovaweb.com.br`](https://hinode.inoovaweb.com.br), com **10.048 leads reais + 12 perfis reais** importados do CRM OKA (produção).

Última atualização: 2026-09-06 (Conversas real + áudio/emoji no chat; 10.043 leads reais e 12 perfis reais importados do CRM OKA de produção pro banco local; endpoint de captação (`/api/captacao/facebook`) + workflow n8n de captação via Facebook Graph API, criado e pronto porém inativo até o backend ser deployado publicamente).

## O que é

Um CRM imobiliário sob medida para a Hinode Imóveis: kanban de leads com roleta de distribuição automática entre corretores, follow-up de WhatsApp, análise de crédito, gestão de equipe, tudo com controle de acesso por papel (Dono / Gerente / Corretor).

Este projeto começou como um protótipo visual (Lovable, puramente front-end e desconectado) e evoluiu para uma aplicação real: front-end React + TypeScript e back-end Node/Express com Postgres próprio.

## Stack

**Front-end** (`/` — raiz do repo):
- Vite + React 19 + TypeScript
- React Router v6/v7
- Zustand (estado global, sem Redux)
- Sem Tailwind — estilos inline via objetos JS, gerados a partir de strings CSS literais (`src/lib/css.ts`) para reaproveitar 1:1 o CSS do protótipo original
- Socket.io-client (realtime)
- PWA via `vite-plugin-pwa`
- Fontes: Newsreader (serifada, títulos) + Manrope (sans, corpo)
- Paleta: carvão/terracota (`--terra: #B5652F`, fundo lateral escuro `#201F1D`; verde/oliva reservado só para indicar status positivo, nunca decorativo)

**Back-end** (`server/`):
- Node + Express + TypeScript (`tsx` em dev)
- Drizzle ORM + driver `postgres` (postgres-js)
- Socket.io (realtime, rooms por imobiliária)
- JWT (`jsonwebtoken`) + `bcryptjs` para senha
- Validação de payload com `zod`
- Postgres 16 local via Docker Compose (`docker-compose.yml` na raiz), porta **55432** (não 5432, para não colidir com outro projeto local que já usa a porta padrão)

**Por que não Supabase:** decisão explícita do dono — backend próprio, banco próprio, sem depender de BaaS de terceiro.

## Estrutura de pastas

```
nova-crm/
├── src/                    # front-end
│   ├── pages/              # uma página por rota (ver tabela de rotas abaixo)
│   ├── components/         # Sidebar, Topbar, AppShell, MobileTabs, RequireAuth, etc.
│   ├── store/appStore.ts   # Zustand — estado global único
│   └── lib/                # css.ts, format.ts, data.ts (mocks restantes), selectors.ts,
│                            # nav.ts, schedule.ts, api.ts, socket.ts, remoteLeads.ts
├── server/                 # back-end
│   └── src/
│       ├── db/             # schema.ts (Drizzle), client.ts, seed.ts, migrate.ts
│       ├── routes/         # auth, leads, colunas, filas, perfis
│       └── middleware/     # auth.ts (requireAuth, requireRole)
├── docker-compose.yml       # Postgres local
└── docs/DOCUMENTACAO_CRM.md # este arquivo
```

## Como rodar localmente

```bash
# 1. Subir o Postgres
docker compose up -d

# 2. Backend
cd server
cp .env.example .env   # ajustar se preciso
npm install
npm run db:migrate
npm run db:seed        # cria imobiliária, perfis de teste e 10 leads de demonstração
npm run dev            # http://localhost:3001

# 3. Frontend (outro terminal, na raiz)
npm install
npm run dev             # http://localhost:5173
```

Variáveis de ambiente do backend (`server/.env`):
```
DATABASE_URL=postgres://nova:nova_dev_local@localhost:55432/nova_app
JWT_SECRET=troque-este-segredo-em-producao
JWT_EXPIRES_IN=8h
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

Front-end lê `VITE_API_URL` (default `http://localhost:3001`) via `src/lib/api.ts`.

## Contas de teste (criadas pelo seed)

| Papel | Email | Senha |
|---|---|---|
| Dono | `hinodeimoveis.crm@gmail.com` | `280896Ab@` |
| Gerente | (ver `server/src/db/seed.ts`) | `123456` |
| Corretor (ex: Diego) | (ver `server/src/db/seed.ts`) | `123456` |

O Dono tem hash de senha próprio e diferente dos demais contas (todas as outras usam `123456` para facilitar demonstração).

## Regras de negócio (copiadas do CRM em produção)

### Roleta / horário comercial (`src/lib/schedule.ts` + `server/src/lib/schedule.ts`)
- **Domingo:** roleta nunca distribui leads, corretor não consegue entrar "No Plantão".
- **Corte de expediente:** 18:20 na maioria dos dias, **19:20 na quinta**, **15:20 no sábado**.
- **Sem religamento automático de manhã** — cada corretor precisa ligar "No Plantão" manualmente todo dia; ninguém começa o dia já disponível (nem após login).
- Ao tentar ligar "No Plantão" fora do horário ou estando bloqueado, o toggle é recusado com um toast — não liga silenciosamente.
- `AppShell` roda essa checagem a cada 60s (`enforceHorarioComercial`), desligando automaticamente quem estava online quando o expediente encerra (e agora também desliga de verdade no servidor, não só na tela).
- **A regra é validada nos dois lados agora**: o front recusa na hora (UX instantânea) e o backend recusa de novo em `PATCH /api/filas/disponibilidade` (403 se fora do horário ou bloqueado) — importante porque sem essa checagem no servidor dava pra ligar o plantão fora do horário chamando a API direto, ignorando o front.

### Controle de acesso por papel
- Três papéis: `dono`, `gerente`, `corretor` (enum no Postgres, `perfis.role`).
- Dono e Gerente enxergam todos os leads da imobiliária; Corretor só os seus.
- Itens de menu com `mgrOnly: true` (Equipe, Ajustes) ficam escondidos para Corretor.
- Bolsão de Leads: só Dono/Gerente veem as abas "Leads Novos", "Rebatidas Geral", "Leads Descartados" e "Lead Descadastrar"; Corretor só vê "Rebatidas" e "Histórico da Roleta".
- Isolamento testado manualmente: login como Dono/Gerente mostra os 10 leads seed; login como corretor (ex: Diego) mostra só os leads atribuídos a ele.

## Rotas do front-end (`src/lib/nav.ts`)

**Menu:** Dashboard, Conversas, Leads (Kanban), Clientes, Imóveis, Tarefas, Roleta, Rebatidas (Bolsão), Análise de Crédito.
**Ferramentas:** Equipe*, Relatórios, Templates, Follow-ups, Integrações, Links Úteis, Treinamentos, Manual do CRM, Ajustes*.
(* = só Dono/Gerente)

## O que já fala com o backend real (Postgres) vs. o que ainda é mock

| Módulo | Status |
|---|---|
| Autenticação (login/logout/hidratação de sessão) | ✅ Real |
| Leads / Kanban (listar, criar, mover entre colunas) | ✅ Real, com realtime via Socket.io |
| Colunas do kanban | ✅ Real (lidas do banco) |
| Perfis / corretores (nome, papel, disponibilidade) | ✅ Real (leitura) |
| Fila de atendimento / disponibilidade | ✅ Real (ativar/desativar, embaralhar ordem, validação de horário/bloqueio no servidor) |
| Busca global (Topbar) e busca do Kanban | ✅ Real (filtra os leads já carregados do backend) |
| Equipe (CRUD de corretor/gerente) | ✅ Real (convidar, editar, bloquear/desbloquear, excluir) |
| Chat/Conversas (mensagens WhatsApp) | ✅ Real (persistência + anexos + áudio — envio ainda só dentro do CRM, ver nota abaixo) |
| Follow-up (construtor visual de blocos) | ❌ Mock (visual completo, sem persistência nem envio real — ver seção própria abaixo) |
| Templates de mensagem | ✅ Real (CRUD completo, pessoal por corretor) |
| Imóveis (catálogo) | ✅ Real (CRUD completo — criar/editar/excluir só Dono/Gerente, todos veem) |
| Links Úteis | ✅ Real (CRUD completo — criar/editar/excluir só Dono/Gerente, todos veem) |
| Treinamentos | ✅ Real (CRUD completo + vídeo real via upload ou link do YouTube) |
| Notificações | ✅ Real (pessoal por usuário — listar, marcar uma/todas como lidas) |
| Webhook WAHA (WhatsApp real) | ❌ Não existe ainda |
| "Remover Acesso (Seguro)" da Equipe | ❌ Ainda só toast — ver nota abaixo |

### Como o mapeamento de coluna funciona
O backend guarda `colunaId` como UUID dinâmico; o front-end inteiro (herdado do protótipo) espera um slug fixo de 7 valores (`ColId`). Em vez de reescrever todo o front, `src/lib/remoteLeads.ts` faz a ponte casando pelo **título** da coluna (o seed cria colunas com os mesmos títulos que `COLS` no front já usava) — `colIdToSlug` / `slugToColunaId`.

## Equipe (gestão de corretores/gerentes)

Rotas em `server/src/routes/perfis.ts` (`perfisRouter(io)`):
- `POST /api/perfis` — convida um membro novo (nome/email/telefone/cargo). Senha padrão `123456`. Só o Dono pode criar outro Gerente; Gerente só cria Corretor. Corretor criado já entra automaticamente na fila da roleta.
- `PATCH /api/perfis/:id` — edita nome/telefone (Gerente só edita linhas de Corretor; Dono edita qualquer um).
- `PATCH /api/perfis/:id/bloquear` — bloqueia/desbloqueia (reaproveita a coluna `perfis.bloqueado`, que já impede login desde antes). Bloquear tira automaticamente da roleta.
- `DELETE /api/perfis/:id` — exclui de verdade (só Dono, não pode excluir a si mesmo). Leads do corretor excluído ficam sem corretor atribuído (FK `set null`), a entrada na fila da roleta some junto (FK `cascade`).
- Todas emitem eventos de socket (`perfil:criado`/`perfil:atualizado`/`perfil:removido`) para sincronizar outras sessões logadas em tempo real.

Na tela (`src/pages/Equipe.tsx`), tem alternância **Cards / Lista** (mesmo padrão visual do toggle Kanban/Lista da página de Leads). "Leads" mostrado no card é contagem real; "Conversão"/"Resposta" mostram "—" porque essas métricas ainda não existem no schema — propositalmente não fabricamos número falso para uma conta real.

**Gap conhecido:** o botão "Remover Acesso (Seguro)" continua só mock (toast, sem chamar o backend). O schema só tem um campo `bloqueado`, e criar um segundo estado ("revogado") redundante com o bloqueio pareceu forçado sem confirmar a semântica exata que a produção usa para essa ação — fica pendente até essa decisão ser tomada.

## Templates de Mensagem

CRUD real e simples (`server/src/routes/templates.ts`, tabela `templates_mensagem` já existia no schema desde o início — só faltava a rota). Cada template pertence a um corretor (`criadoPor`) e só ele o vê/edita/exclui — nem Dono nem Gerente enxergam os templates dos outros, igual à produção. Sem realtime (não precisa — dado pessoal, sem necessidade de sincronizar entre sessões).

## Imóveis (catálogo)

CRUD real (`server/src/routes/imoveis.ts`, tabela `imoveis` já existia no schema desde o início). Todos os autenticados veem o catálogo (corretor precisa consultar pra falar com lead); **criar/editar/excluir é restrito a Dono/Gerente** (mesma régua da Equipe). Seed cria as 6 propriedades de demonstração, cada uma já com fotos de exemplo.

**Campos do anúncio:** tipo, finalidade (Venda/Aluguel), título, endereço/cidade/UF, preço, área, quartos/suítes/banheiros/vagas, amenidades, descrição, fotos/vídeo (ver seção de upload), e mais:
- **Situação**: "Pronto para morar" / "Em obras" / "Lançamento" — as duas últimas ganham um campo de **previsão de entrega** (texto livre, ex: "Dezembro/2027"), que só aparece no formulário quando a situação não é "Pronto".
- **Aceita financiamento** (sim/não).
- **Condomínio** (R$/mês) e **IPTU** (R$/ano), opcionais.

## Links Úteis e Treinamentos

CRUD real (`server/src/routes/linksUteis.ts` e `server/src/routes/treinamentos.ts`) — mesma régua de sempre: todos veem, só Dono/Gerente cadastram/editam/excluem. Links agrupados por categoria na tela. Treinamentos tem player de vídeo próprio (ver seção de upload abaixo) com estado "sem vídeo ainda" quando não há nada cadastrado.

## Notificações

Pessoais por usuário (`server/src/routes/notificacoes.ts`, tabela `notificacoes` já existia no schema) — cada um só vê e marca como lida as próprias, nem o Dono vê as dos outros. O sino do Topbar mostra um dropdown real (não decorativo): lista as notificações, badge só aparece com contagem de não-lidas de verdade, clicar marca como lida, tem "Marcar todas como lidas". **Ainda não existe nada no sistema que dispare notificação automaticamente** (ex: avisar quando um lead é atribuído) — hoje só existe o que o seed cria; a rota de criar fica pra quando algum evento real for cabeado a isso.

## Conversas (chat WhatsApp)

Persistência real (`server/src/routes/mensagens.ts`, tabela `mensagens_whatsapp` — já existia no schema desde o início): `GET /api/mensagens/:leadId` (histórico do lead, checando que quem pede pode ver aquele lead — mesma régua de `leads.ts`: corretor só os próprios) e `POST /api/mensagens/:leadId` (grava e emite `mensagem:created` via Socket.io pra sincronizar outras sessões logadas em tempo real).

- **Não existe envio real pro WhatsApp ainda** — a mensagem só fica salva no Postgres do CRM Hinode. Integrar de verdade com o WAHA (`waha-oka.inoovaweb.cloud`, mesma instância de produção do CRM OKA) é trabalho futuro deliberadamente adiado: exige uma sessão pareada por QR code com um número real (ação manual) e cuidado extra por ser a mesma instância que atende corretores reais hoje.
- **Envio otimista + reconciliação por id**: a bolha aparece na hora com um id temporário; quando o POST responde, troca pelo id real — a menos que o evento de socket já tenha entregue a mesma mensagem primeiro (evita duplicata).
- **Anexos reaproveitam o mesmo pipeline de upload do MinIO** (ver seção abaixo): imagem, vídeo, documento e **áudio** (`src/components/AnexoMensagem.tsx` escolhe o elemento certo — `<img>`, `<video controls>`, link de download, ou `<audio controls>` — conforme `anexoTipo`).
- **Gravação de áudio em tempo real** (`src/components/AudioRecordButton.tsx`, via `MediaRecorder`/`getUserMedia`, com indicador pulsante + timer) e **seletor de emoji** (`src/components/EmojiPicker.tsx`, popover simples sem lib externa) na barra de composição, tanto em `Conversas.tsx` quanto na aba de chat do `LeadModal.tsx`.
- **Não existe sinal de "entregue"/"lido" (check marks do WhatsApp)** — decisão explícita do dono de não fabricar esse dado até a integração real com WAHA existir (aí sim dá pra usar o webhook de ACK do WAHA pra ter esse status de verdade).

## Upload de arquivos (MinIO)

**Decisão de arquitetura:** imagens e vídeos ficam no MinIO (S3-compatible), o Postgres só guarda a URL — nunca o binário. Mesmo padrão usado em outros projetos do dono em produção.

- **Local (dev)**: serviço `minio` no `docker-compose.yml` da raiz, portas `59000` (API) / `59001` (console) — fora do padrão 9000/9001 pra não colidir com outro projeto local. Bucket `hinode-imoveis`, criado automaticamente com leitura pública no boot do backend.
- **Endpoint genérico**: `POST /api/uploads` (multipart, campo `file`, até 30MB, imagem/vídeo/áudio/PDF) devolve `{url, nome}`. Qualquer usuário autenticado pode subir (não é uma ação de gestão).
- **Componente de front**: `src/components/FileUpload.tsx` — usado no anexo de Templates, nas fotos/vídeo de Imóveis (`imagens: string[]` + `videoUrl`) e no vídeo de Treinamentos. Nas Conversas, o upload é acionado direto pelo botão de anexo/gravação de áudio da barra de composição (`src/lib/upload.ts`), sem passar por esse componente.
- **Treinamentos aceita vídeo de dois jeitos**: upload real (vira URL do MinIO) **ou** colar um link do YouTube — o player (`src/pages/Treinamentos.tsx`) detecta o padrão da URL e decide entre `<iframe>` de embed do YouTube ou `<video>` nativo pro arquivo.
- **Em produção**: só trocar as variáveis `MINIO_*` do backend pra apontar pro MinIO real (ex: `storage.inoovaweb.com.br`) — nenhum código muda.

## Follow-up (construtor visual de blocos)

A aba Follow-up (`src/pages/Followup.tsx`) é um construtor visual estilo **ManyChat/Typebot**: canvas livre com nós conectados por linha (biblioteca [`@xyflow/react`](https://reactflow.dev/), a mesma categoria de motor usada no Flow Builder do projeto Zaplo). Cada corretor monta os próprios fluxos; um fluxo dispara (conceitualmente, ainda não de verdade) quando um lead é atribuído a ele.

- **Blocos disponíveis:** Texto, Áudio, Imagem, PDF, Espera — **sem vídeo** (decisão explícita).
- **Múltiplos fluxos por corretor**, cada um com um gatilho nomeado (`GATILHOS_FLOW`: "Lead atribuído (novo)", "Lead rebatido", "Pós-visita agendada", "Análise de crédito parada") e um interruptor ativo/inativo.
- **Paleta de blocos na coluna esquerda** (abaixo da lista de fluxos), com drag-and-drop de verdade: arrastar um bloco solta ele exatamente onde o mouse largou dentro do canvas (`screenToFlowPosition` do hook `useReactFlow`); clique simples também funciona como atalho, adicionando no fim do fluxo.
- **Efeito corrente ao arrastar (estilo Typebot):** mover um bloco desloca ele e todos os blocos seguintes na sequência pelo mesmo tanto. Linhas de conexão em curva suave (bezier animado), não em cotovelo reto.
- Canvas ocupa a largura toda, altura generosa (`clamp(640px, calc(100vh-260px), 920px)`); o painel de edição do bloco selecionado só aparece como um drawer lateral quando há um bloco clicado, pra não roubar espaço do canvas o resto do tempo.
- **Estado 100% mock em `appStore.ts`** (`flows: FlowDef[]` + ações `createFlow/addBloco/updateBloco/...`) — **propositalmente separado** do `steps`/`FollowupStep` antigo, que o `LeadModal` ainda usa pra mostrar a sequência ativa de follow-up de um lead específico (são conceitos diferentes: um é o construtor/template, o outro é a execução mockada por lead). Toda ação aplica **instantaneamente** no estado (sem botão "salvar"), mas é só memória do navegador — recarregar a página volta pro seed de demonstração.
- **Nada aqui persiste ou envia mensagem de verdade.** Quando for a hora de tirar do mock: schema novo no Postgres pra fluxos/blocos, uma engine que dispare a execução (evento de atribuição de lead), e o envio real dos blocos reaproveitando a integração WAHA que já existe pro CRM OKA em produção.

**Gotchas técnicos do React Flow (`@xyflow/react`), pra não recair nos mesmos bugs:**
- Sempre implementar `onNodesChange` com `applyNodeChanges` de verdade sobre um array de nós em estado — só usar `onNodeDrag` isolado (sem isso) faz a lib considerar o nó "não inicializado" e o arrasto quebra/salta.
- A prop booleana `fitView` só roda uma vez, no primeiríssimo render — não serve para canvas cujos nós são populados depois do mount (via efeito assíncrono). Nesse caso, chamar `useReactFlow().fitView()` manualmente num efeito que dispara quando os nós passam a existir.
- `useReactFlow()` só funciona em um componente **descendente** de `<ReactFlowProvider>` — nunca no mesmo componente que renderiza o Provider (por isso o canvas é um componente `FlowCanvas` à parte).
- O CSS padrão da lib (`@xyflow/react/dist/style.css`) é sempre claro. Sobrescrever `.react-flow__controls-button { background: ... }` direto **não é suficiente** — o React Flow v12 lê variáveis CSS próprias com fallback (`--xy-controls-button-background-color` e afins), e por ordem de import a regra da lib pode vencer um simples override de mesma especificidade. O jeito que funciona de verdade: setar essas variáveis `--xy-controls-*` no `:root` de `src/index.css`, apontando pras variáveis de tema do app.
- A coluna esquerda do Follow-up (corretor/fluxos/paleta de blocos) é `position:'sticky'` com rolagem própria, pra continuar acessível mesmo com a página rolada.

## Captação de leads via Facebook (n8n)

Réplica do fluxo real de produção do CRM OKA ("FACEBOOK FORM - CAPTAÇÃO LEADS", n8n.inoovaweb.cloud) — **sem tocar no workflow original**, já que o Facebook só permite uma URL de callback por App/assinatura de evento (não dá pra apontar o mesmo webhook pra dois sistemas diferentes sem criar um segundo App).

- **Endpoint novo no backend**: `POST /api/captacao/facebook` (`server/src/routes/captacao.ts`) — **não usa `requireAuth`** (uma automação não mantém sessão de usuário); protegido por um segredo compartilhado no header `x-captacao-secret`, comparado contra `CAPTACAO_SECRET` (env). Cria o lead direto na coluna "Lead Novo", canal `Facebook`.
- **Workflow n8n dedicado** (`HINODE - FACEBOOK FORM - CAPTAÇÃO LEADS (CRM Hinode)`, mesma instância n8n.inoovaweb.cloud): em vez de depender do mesmo webhook da produção, esse workflow **busca leads novos periodicamente via Facebook Graph API** (Schedule Trigger a cada 5 min → lista formulários ativos da página → busca leads de cada formulário criados depois do último polling → monta o payload → `POST /api/captacao/facebook`). Reaproveita a mesma credencial Graph API já cadastrada (`CRM HINODE PERNAMENTE`) e a mesma página do Facebook — zero mudança na configuração da Meta, zero mudança no workflow de produção.
- **Criado mas INATIVO de propósito**: o backend do CRM Hinode ainda só roda local, sem endereço público que o n8n (na nuvem) consiga alcançar. Antes de ativar: (1) deployar o backend publicamente (domínio já reservado: `hinode.inoovaweb.com.br`), (2) rodar "Test workflow" manualmente uma vez, (3) só então ativar o toggle no n8n.

## Realtime

Socket.io, uma room por imobiliária (`imobiliaria:<id>`), handshake autenticado por JWT. Eventos: `lead:created`, `lead:updated`. O front escuta e faz upsert local sem precisar recarregar a página.

## Dados de demonstração (seed)

10 leads espalhados nas etapas do funil (incluindo 2 já em "Venda Concluída"), atribuídos apenas aos corretores de verdade (Dono/Gerente não recebem lead, só gerenciam — igual à produção). Ver array `DEMO_LEADS` em `server/src/db/seed.ts`.

⚠️ **O seed é destrutivo** — ele limpa as tabelas antes de inserir. Seguro em dev; **não pode ser rodado em produção depois que houver dado real**.

**Dado real importado (além do seed, 2026-09-06):** os **10.043 leads reais** e os **12 perfis reais da equipe** do CRM OKA (produção) foram copiados pro Postgres local, pra validar o sistema com dado de verdade — ver detalhe completo do mapeamento de schema/status/corretor na memória do projeto. **Rodar `npm run db:seed` de novo APAGA esse dado importado** junto com o resto (o seed limpa a tabela `leads`/`perfis` inteira) — se precisar do dado real de novo depois de um `db:seed`, a importação precisa ser refeita (script não fica versionado no repo de propósito, por conter token de acesso).

## Pendências conhecidas (não é bug, é trabalho ainda não feito)

- Nenhum Dockerfile ainda (nem front nem back) — necessário antes de qualquer deploy.
- Nenhuma stack do Portainer criada ainda.
- `CORS_ORIGIN` e `VITE_API_URL` apontam para localhost — precisam de variável de ambiente por ambiente antes de ir para VPS.
- Seed destrutivo (ver acima) precisa virar idempotente/seguro antes de produção.
- Módulos ainda mock listados na tabela acima.
- Semântica de "Remover Acesso (Seguro)" na Equipe ainda não definida (ver seção Equipe acima).
- Conversas ainda não manda mensagem de verdade pro WhatsApp (só persiste no CRM) — integração real com WAHA adiada de propósito (ver seção Conversas acima). Consequência direta: também não existe check mark de entregue/lido nas mensagens enviadas.
- Workflow n8n de captação de leads do Facebook está pronto mas **inativo** — falta deployar o backend publicamente antes de ativar (ver seção Captação de leads acima).

## Convenção de documentação

Este arquivo deve ser mantido atualizado a cada mudança relevante (feature nova, decisão de arquitetura, regra de negócio, bug corrigido) — não é opcional, é instrução permanente do dono do projeto.
