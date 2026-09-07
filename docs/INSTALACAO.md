# Instalação — CRM Formulário Meta

Cobre o que é preciso, como rodar em **desenvolvimento local** e como fazer **deploy em produção**.
Visão geral da arquitetura em [`DOCUMENTACAO_CRM.md`](DOCUMENTACAO_CRM.md).

---

## 1. O que é preciso

| Componente | Versão | Para quê | Obrigatório? |
|---|---|---|---|
| **Node.js** | 22+ | frontend e backend | ✅ |
| **PostgreSQL** | 16 | banco de dados | ✅ |
| **MinIO** (ou outro S3) | qualquer | imagens/vídeo/áudio/PDF | ✅ (upload quebra sem ele) |
| **Docker + Docker Compose** | recente | subir Postgres + MinIO em dev | ✅ em dev (em prod pode ser serviço gerenciado) |
| **WAHA** | `devlikeapro/waha`, engine GOWS | enviar/receber WhatsApp | ⬜ opcional — o CRM roda sem, só não usa WhatsApp |
| **n8n** | community | captação de leads do Facebook | ⬜ opcional |
| `ffmpeg` | — | converter áudio do navegador p/ nota de voz do WhatsApp | já vem no `server/Dockerfile`; em dev, instalar se for testar áudio |

## 2. Desenvolvimento local

### 2.1 Subir Postgres + MinIO

```bash
docker compose up -d
```

`docker-compose.yml` expõe:
- Postgres em **`localhost:55433`** (user `nova`, senha `nova_dev_local`, db `nova_app`)
- MinIO API em **`localhost:9100`**, console em **`localhost:9101`** (user `nova_minio`, senha `nova_dev_local_minio`)

> ⚠️ O `server/.env.example` versionado ainda cita as portas antigas (`55432`, `59000/59001`).
> Use as portas do `docker-compose.yml` acima (`55433`, `9100/9101`) ao preencher o `.env`.

### 2.2 Backend

```bash
cd server
cp .env.example .env
# edite o .env — no mínimo ajuste DATABASE_URL para a porta 55433 e os MINIO_* para 9100
npm install
npm run db:migrate     # aplica todas as migrações de server/drizzle/
npm run db:seed        # OPCIONAL: cria imobiliária + contas + dados de demonstração (DESTRUTIVO)
npm run dev            # http://localhost:3001  (tsx watch, reinicia ao salvar)
```

`.env` mínimo para dev:

```env
DATABASE_URL=postgres://nova:nova_dev_local@localhost:55433/nova_app
JWT_SECRET=qualquer-coisa-local
JWT_EXPIRES_IN=8h
PORT=3001
CORS_ORIGIN=http://localhost:5173

MINIO_ENDPOINT=http://localhost:9100
MINIO_ACCESS_KEY=nova_minio
MINIO_SECRET_KEY=nova_dev_local_minio
MINIO_BUCKET=hinode-imoveis
MINIO_PUBLIC_URL=http://localhost:9100/hinode-imoveis

CAPTACAO_SECRET=dev-secret
INTEGRACOES_SECRET=dev-secret
INTEGRACOES_ENC_KEY=      # gere: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# opcionais (deixe vazio se não for usar)
WAHA_URL=
WAHA_API_KEY=
PUBLIC_URL=
WAHA_WEBHOOK_SECRET=
PLATFORM_ADMIN_EMAIL=
PLATFORM_ADMIN_PASSWORD=
PLATFORM_ADMIN_NAME=Administrador
```

### 2.3 Frontend

```bash
# na raiz do repo, outro terminal
npm install
npm run dev     # http://localhost:5173
```

O frontend lê `VITE_API_URL` (default `http://localhost:3001`) em `src/lib/api.ts`. Em dev não precisa
setar nada.

### 2.4 Contas criadas pelo seed

| Papel | Email | Senha |
|---|---|---|
| Dono | `hinodeimoveis.crm@gmail.com` | `280896Ab@` |
| Gerente (Camila Rocha) | `camila.rocha@novaimob.com.br` | `123456` |
| Corretores (Diego, Fernanda, Marcelo, Priscila, Rafael) | `<nome>@novaimob.com.br` | `123456` |

O painel Plataforma (`/plataforma`) usa a conta de `PLATFORM_ADMIN_EMAIL`/`PLATFORM_ADMIN_PASSWORD`
(criada no boot se a tabela estiver vazia).

## 3. Variáveis de ambiente (referência)

### Backend (`server/.env`)

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | ✅ | string de conexão Postgres |
| `JWT_SECRET` | ✅ | segredo de assinatura dos tokens de tenant |
| `JWT_EXPIRES_IN` | ⬜ | default `8h` |
| `PORT` | ⬜ | default `3001` |
| `CORS_ORIGIN` | ✅ | origem do frontend (ex: `https://visitaia.com.br`) |
| `MINIO_ENDPOINT` | ✅ | URL da API do MinIO/S3 |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | ✅ | credenciais |
| `MINIO_BUCKET` | ✅ | nome do bucket (criado no boot) |
| `MINIO_PUBLIC_URL` | ✅ | URL pública base dos arquivos |
| `CAPTACAO_SECRET` | ✅ | header `x-captacao-secret` das rotas `/api/captacao/*` |
| `INTEGRACOES_SECRET` | ✅ | protege `GET /api/integracoes/facebook/ativas` |
| `INTEGRACOES_ENC_KEY` | ✅ | AES-256-GCM base64 (32 bytes) — cifra o token do Facebook em repouso |
| `WAHA_URL` | ⬜ | base da instância WAHA |
| `WAHA_API_KEY` | ⬜ | `X-Api-Key` da instância |
| `PUBLIC_URL` | ⬜ | URL pública **deste backend** (o WAHA chama o webhook aqui) |
| `WAHA_WEBHOOK_SECRET` | ⬜ | segredo do webhook (`?secret=`); vazio = usa `CAPTACAO_SECRET` |
| `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` / `PLATFORM_ADMIN_NAME` | ⬜ | admin inicial do painel Plataforma |

### Frontend (build-time)

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL do backend (ex: `https://api.visitaia.com.br`). No Coolify é build-time por default. |

## 4. Produção

Ambos os serviços têm Dockerfile e são deployados no **Coolify** (`coolify.visitaia.com.br`).

### 4.1 Backend — `server/Dockerfile`

- `node:22-alpine` + `ffmpeg`, `npm ci`, `npm run build`, expõe `3001`.
- `CMD`: **`npm run db:migrate && node dist/index.js`** — as migrações rodam a cada deploy, antes do
  servidor subir.
- App no Coolify: `visitaia-crm-backend` → `https://api.visitaia.com.br` (base dir `/server`,
  Dockerfile `/Dockerfile`, porta `3001`). `/health` → `{"ok":true}`.
- Todas as variáveis da §3 gravadas como env do app.

### 4.2 Frontend — `Dockerfile` (raiz)

- Estágio build: `node:22-alpine`, `npm ci`, `ARG VITE_API_URL`, `npm run build`.
- Estágio final: `nginx:alpine` servindo `/dist` com `nginx.conf` (SPA fallback para `index.html`).
- App no Coolify: `visitaia-crm-frontend` → `https://visitaia.com.br` (base dir `/`, Dockerfile
  `/Dockerfile`, porta `80`). Build var `VITE_API_URL=https://api.visitaia.com.br`
  (**não** enviar `is_build_time` no POST de envs do Coolify — dá 422).

### 4.3 Disparar deploy (API do Coolify)

```bash
curl -s -X POST "https://coolify.visitaia.com.br/api/v1/deploy?uuid=<APP_UUID>" \
  -H "Authorization: Bearer <TOKEN>"
```

UUIDs: backend `wrm5nrit2ostart7g1sihyif`, frontend `o9mwwoigm0004fwjzail671a`.
(Também dá para usar o botão "Redeploy" no painel, ou webhook de push do GitHub.)

### 4.4 Dependências de infra em produção

- **PostgreSQL**: banco gerenciado do Coolify (a `DATABASE_URL` usa o hostname interno).
- **MinIO**: instância própria; `MINIO_*` apontam pra ela.
- **WAHA**: `https://waha.visitaia.com.br` (Coolify), engine GOWS. Cada imobiliária pareia o(s)
  número(s) por QR code na tela de Integrações do CRM.
- **n8n** (opcional): workflow único de captação Facebook multi-empresa — ver
  [`../VISAO_MULTI_TENANT.md`](../VISAO_MULTI_TENANT.md).

## 5. Primeiro acesso num ambiente novo (sem seed)

1. Suba o backend com `PLATFORM_ADMIN_EMAIL`/`PLATFORM_ADMIN_PASSWORD` definidos → o admin da
   Plataforma é criado no boot.
2. Entre em `/plataforma`, crie a primeira imobiliária e o usuário Dono dela.
3. Logue no CRM como esse Dono, cadastre corretores (Equipe), roletas, imóveis, horário de atendimento.
4. Conecte o WhatsApp em Integrações (opcional).
5. Publique o site em "Site de Imóveis" (opcional).

## 6. Comandos úteis

```bash
# gerar uma migração nova depois de editar server/src/db/schema.ts
cd server && npm run db:generate && npm run db:migrate

# build local de verificação (pega erros que o tsc solto não pega)
npm run build                 # frontend (tsc -b && vite build)
cd server && npm run build    # backend (tsc)

# lint do frontend
npm run lint
```
