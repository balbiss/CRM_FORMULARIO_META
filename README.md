# CRM Formulário Meta

CRM imobiliário **multi-tenant** (várias imobiliárias no mesmo sistema, dados isolados por
`imobiliaria_id`): funil de leads em Kanban, roletas de distribuição automática entre corretores,
follow-up de WhatsApp, análise de crédito, catálogo de imóveis, site público por imobiliária,
captação de leads do Facebook/site e um painel "Plataforma" para o dono do SaaS.

- **Frontend** (`/`): Vite + React 19 + TypeScript + Zustand + Socket.io-client, PWA.
- **Backend** (`server/`): Node + Express + TypeScript, Drizzle ORM + PostgreSQL, Socket.io, MinIO (S3) para arquivos.
- **WhatsApp**: [WAHA](https://waha.devlike.pro/) (engine GOWS). Opcional — sem ele o CRM funciona, só não envia/recebe no WhatsApp.
- **Produção**: frontend em `https://visitaia.com.br`, backend em `https://api.visitaia.com.br` (deploy via Coolify).

## Documentação

| Documento | Assunto |
|---|---|
| [`docs/DOCUMENTACAO_CRM.md`](docs/DOCUMENTACAO_CRM.md) | Como o CRM funciona: arquitetura, módulos, regras de negócio, papéis de acesso |
| [`docs/INSTALACAO.md`](docs/INSTALACAO.md) | O que é preciso e como instalar (dev local e produção) |
| [`VISAO_MULTI_TENANT.md`](VISAO_MULTI_TENANT.md) | Por que este repo existe e o que ainda falta na captação Facebook multi-empresa |

## Início rápido (desenvolvimento local)

Pré-requisitos: **Node 22+**, **Docker** (para Postgres + MinIO).

```bash
# 1. Postgres + MinIO
docker compose up -d

# 2. Backend
cd server
cp .env.example .env            # ajuste os segredos
npm install
npm run db:migrate              # cria/atualiza o schema
npm run db:seed                 # imobiliária + contas + dados de demonstração
npm run dev                     # http://localhost:3001

# 3. Frontend (outro terminal, na raiz)
npm install
npm run dev                     # http://localhost:5173
```

Detalhes completos (variáveis de ambiente, WAHA, deploy em produção, migrações) em
[`docs/INSTALACAO.md`](docs/INSTALACAO.md).

## Scripts

**Frontend** (raiz): `npm run dev` · `npm run build` (`tsc -b && vite build`) · `npm run lint` (oxlint) · `npm run preview`

**Backend** (`server/`): `npm run dev` (tsx watch) · `npm run build` (`tsc`) · `npm start` · `npm run db:generate` (gera migração a partir do schema) · `npm run db:migrate` · `npm run db:seed`
