# CRM Formulário Meta — visão e instruções (LER PRIMEIRO)

> Este arquivo existe pra uma sessão NOVA do Claude (ou qualquer outro dev) entender o que fazer aqui,
> sem depender de memória de conversa nenhuma. Se você é uma sessão nova começando neste repo, leia
> este arquivo inteiro antes de tocar em qualquer código.

## De onde isso veio

Este repositório começou como uma **cópia exata** do código do [CRM Hinode](https://github.com/balbiss/CRM_HINODE_IM-VEIS)
(repo irmão, veja `docs/DOCUMENTACAO_CRM.md` copiado junto pra entender a arquitetura herdada: front
React+TS+Zustand, backend Node/Express+Drizzle+Postgres, Socket.io, MinIO para upload de arquivo).

**O CRM Hinode é (e continua sendo) single-tenant** — feito especificamente pra UMA imobiliária (Hinode
Imóveis / cliente real "CRM OKA"), com um Facebook App/Página/formulário fixo, hardcoded. Está em
produção de verdade em `hinode.inoovaweb.com.br`. **Não mexer nesse outro repositório a partir daqui.**

## O que este repositório precisa virar

Uma versão **multi-tenant** do mesmo CRM: várias imobiliárias diferentes usando o MESMO sistema, cada
uma com os próprios dados isolados (o schema já suporta isso — toda tabela já tem `imobiliaria_id`,
essa parte do trabalho pesado já está pronta). A parte que falta construir de verdade é a **captação de
leads do Facebook multi-empresa com um único fluxo de automação**, em vez de um workflow n8n por cliente.

### O problema que motivou isso

No CRM Hinode, resolvi a captação de leads do Facebook criando um workflow n8n **dedicado só pra Hinode**
(polling via Graph API a cada 5 min, credencial e `page_id`/`form_id` fixos no próprio workflow). Isso
funciona bem pra UM cliente, mas não escala: cada imobiliária nova exigiria duplicar o workflow inteiro
no n8n, reconfigurando token/formulário toda vez à mão. O dono quer o oposto: **um workflow só, dinâmico,
atendendo N imobiliárias ao mesmo tempo**, cada uma com as próprias credenciais do Facebook.

### A arquitetura já combinada (não é ideia solta, foi decidida em conversa)

1. **Tela de Integrações no próprio CRM** (`src/pages/Integracoes.tsx` já existe como placeholder mock —
   vira a tela real): cada imobiliária, logada no próprio CRM, cola o **token de acesso do Facebook Graph
   API dela** (gerado no Meta Business Suite da empresa cliente) + o **ID da página e do formulário de
   lead ads**. Isso fica salvo no banco, **criptografado**, vinculado à própria `imobiliaria_id` de quem
   cadastrou. Precisa de uma tabela nova, algo como `integracoes_facebook` (`imobiliaria_id`, `page_id`,
   `form_id`, `access_token` — criptografado em repouso, nunca em texto puro no banco).

2. **Endpoint novo no backend**, algo como `GET /api/integracoes/facebook/ativas`, protegido por um
   segredo compartilhado (mesmo padrão do `CAPTACAO_SECRET` do CRM Hinode) — **não é autenticado por
   usuário**, é uma automação chamando. Devolve a lista de TODAS as conexões ativas de TODAS as
   imobiliárias: `[{ imobiliariaId, pageId, formId, accessToken }, ...]`.

3. **Um workflow n8n só, dinâmico**: em vez de ter `pagina_id`/token fixo hardcoded (como no CRM Hinode),
   ele:
   - Busca a lista de conexões ativas via o endpoint acima.
   - Faz um loop (Split In Batches ou Split Out) — pra CADA conexão da lista:
     - Usa o token DAQUELA empresa pra chamar `GET /{form_id}/leads?filtering=[...since...]` no Graph API
       (mesmo padrão de filtro por `time_created` já usado no CRM Hinode).
     - Monta o lead e faz `POST /api/captacao/facebook` no CRM, **incluindo o campo `imobiliariaId`** no
       corpo (o endpoint de captação do CRM Hinode não tinha isso porque só existia UMA imobiliária —
       aqui esse endpoint precisa aceitar/exigir `imobiliariaId` explícito, e gravar o lead na coluna
       "Lead Novo" **daquela** imobiliária específica, não da primeira que encontrar no banco).
   - **Não precisa mais listar `leadgen_forms` da página** (isso já causou um erro real no CRM Hinode: o
     App do Facebook usado lá estava em modo de desenvolvimento e não tinha permissão pra LISTAR
     formulários — só pra buscar leads de um formulário já conhecido). Como aqui cada empresa já
     cadastra o próprio `form_id` manualmente na tela de Integrações, esse problema nem aparece.

### Gotchas reais já descobertos no CRM Hinode que valem aqui também

- **`this.getWorkflowStaticData(...)` não existe em Code node do n8n** — o certo é
  `$getWorkflowStaticData('global')` (função global do sandbox, não um método de `this`). Causou erro em
  TODA execução até eu perceber.
- **Misturar sintaxe de expressão do n8n (`={{ ... }}`) com concatenação JS por FORA das chaves quebra o
  JSON do workflow inteiro** (erro 500 genérico ao criar/salvar via API, sem mensagem útil). A expressão
  inteira precisa estar dentro de UM `{{ }}` só.
- **`PATCH /rest/workflows/{id}` só salva o RASCUNHO no n8n** (community edition tem versão draft/publish
  mesmo sem ser enterprise) — pra ativar de verdade precisa `POST /rest/workflows/{id}/activate` com
  `{"versionId": "<o versionId do rascunho salvo>"}`.
- **App do Facebook em modo `dev_mode`** (confirmado via Meta DevTools MCP) não consegue LISTAR recursos
  (`/leadgen_forms`) mesmo com permissão nominal de `leads_retrieval` — mas consegue buscar um recurso
  específico por ID sem problema. Isso reforça por que a arquitetura aqui pede o `form_id` de cada
  empresa na tela de Integrações, em vez de tentar descobrir sozinho.
- **Segredo de automação nunca deve ficar hardcoded no workflow n8n** — usar credencial do tipo "HTTP
  Header Auth" (criptografada pelo próprio n8n) em vez de escrever o valor direto no node.
- **`tsc --noEmit -p .` sozinho NÃO pega tudo** — só `npm run build` real (`tsc -b`, modo de project
  references) pegou 2 erros reais que passaram batido no CRM Hinode (identificador duplicado numa
  interface, prop nunca lida). Sempre rodar o build de verdade antes de considerar um refactor pronto,
  nunca confiar só no tsc solto.
- **Índices em toda coluna de FK desde o início** — Postgres não indexa FK automaticamente. No CRM Hinode
  isso só doeu depois que a base passou a ter 10k+ linhas reais (toda query de `leads` fazia sequential
  scan). Aqui, com múltiplas imobiliárias desde o dia 1, **criar os índices já na primeira migration**
  (`imobiliaria_id`, `corretor_id`, `coluna_id` em `leads`; `lead_id` em `mensagens_whatsapp`; etc.) —
  não esperar acontecer de novo.
- **Docker/Swarm: nome de serviço com underscore (`hinode_minio`) quebra o AWS SDK do MinIO** ("invalid
  hostname") mesmo funcionando fine pra Postgres/Redis — usar hífen em nomes de serviço que também agem
  como hostname interno (S3-compatible clients são mais estritos que outros).
- **`VITE_API_URL=""` (vazio, intencional pra path relativo) quebra se o código usar `||` em vez de `??`**
  — `"" || fallback` sempre cai no fallback porque string vazia é falsy em JS. Isso causou um bug real de
  CORS em produção no CRM Hinode (frontend chamando `localhost:3001` mesmo em produção). Se este repo
  também for buildado como imagem Docker com API relativa, usar `??` desde o início nesse tipo de
  variável.

## Escopo desta sessão futura (o que fazer, nesta ordem sugerida)

1. Criar a tabela `integracoes_facebook` (schema Drizzle + migration) — `imobiliariaId`, `pageId`,
   `formId`, `accessToken` (avaliar criptografia em repouso — `pgcrypto` ou cifrar na aplicação antes de
   gravar).
2. Construir a tela real de Integrações (`src/pages/Integracoes.tsx`) — formulário pra colar token +
   page id + form id, só Dono/Gerente podem configurar (mesma régua de outras telas administrativas).
3. Endpoint `GET /api/integracoes/facebook/ativas` (protegido por segredo compartilhado, não por JWT de
   usuário — é uma automação chamando).
4. Estender `POST /api/captacao/facebook` pra aceitar `imobiliariaId` no corpo e gravar na imobiliária
   certa (hoje, no CRM Hinode, ele sempre pega a PRIMEIRA imobiliária do banco — isso só funcionava
   porque só existia uma).
5. Construir o workflow n8n dinâmico (buscar conexões ativas → loop → buscar leads de cada uma → postar
   de volta) — reaproveitar a estrutura de nós já testada e funcionando no CRM Hinode (Schedule Trigger 5
   min, Code node de `since` por execução, Facebook Graph API, Set de extração de campos), só trocando a
   fonte do `form_id`/token de "fixo no workflow" pra "vindo do loop de conexões".
6. Testar de ponta a ponta com pelo menos 2 imobiliárias fictícias/de teste, confirmando isolamento
   (lead de uma não aparece pra outra).

## O que NÃO fazer

- Não reaproveitar nem editar o workflow n8n de produção do CRM OKA (`FACEBOOK FORM - CAPTAÇÃO LEADS`,
  id `i9u30zrBt4FLGvIs`) nem o novo do CRM Hinode (`HINODE - FACEBOOK FORM...`, id `lX3ADa87gsiQrnmW`) —
  os dois continuam existindo e funcionando, intocados, cada um servindo seu próprio cliente único.
- Não commitar nenhum token/segredo real neste repo (nem do Facebook, nem de banco, nem de n8n) — sempre
  variável de ambiente, nunca hardcoded, nem em script de teste esquecido.
