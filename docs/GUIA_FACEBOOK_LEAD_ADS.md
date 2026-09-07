# Guia — Conectar os formulários do Facebook (Lead Ads) ao CRM

Este guia é para a **imobiliária** seguir. No fim você vai ter 3 informações pra colar no CRM
(em **Integrações → Captação de leads do Facebook → Nova conexão**), e a partir daí todo lead que
alguém preencher no seu anúncio do Facebook/Instagram cai sozinho no **"Lead Novo"** e entra na roleta,
a cada 5 minutos.

> Você faz isso **uma vez por formulário**. Se tiver vários formulários (campanhas diferentes),
> repita a parte final pra cada um.

---

## O que você vai coletar

| Campo no CRM | O que é | Onde pega |
|---|---|---|
| **ID da página** | o número da sua página do Facebook | Parte 3 |
| **ID do formulário (Lead Ads)** | o número do formulário instantâneo do anúncio | Parte 4 |
| **Token de acesso** | uma "senha de robô" que deixa o CRM ler os leads | Parte 1 + 2 |

## Pré-requisitos

- Ser **administrador** da página do Facebook.
- Ter um **Gerenciador de Negócios (Meta Business)** — se você roda anúncios, já tem. Endereço:
  [business.facebook.com](https://business.facebook.com).
- A página e o formulário de Lead Ads têm que estar **dentro do mesmo Gerenciador de Negócios**.

Se você tem uma **agência de tráfego**, mande este guia pra ela — provavelmente é mais rápido ela fazer.

---

## Parte 1 — Criar um App no Meta (só uma vez)

O token precisa estar "amarrado" a um App. Se você **já tem um App** no
[developers.facebook.com](https://developers.facebook.com/apps), pule pra Parte 2.

1. Acesse [developers.facebook.com/apps](https://developers.facebook.com/apps) e clique em **Criar app**.
2. Em "Casos de uso", escolha **Outro** → **Avançar**.
3. Tipo de app: **Empresa** → **Avançar**.
4. Nome do app: algo como `Integração CRM <nome da imobiliária>`. Selecione o seu
   **Gerenciador de Negócios** no campo "Portfólio empresarial" → **Criar app**.
5. No painel do app, no menu lateral em **Adicionar produtos**, adicione **"Login do Facebook para empresas"**
   (não precisa configurar nada nele — só precisa existir).
6. Anote o **ID do app** (aparece no topo do painel). Você não vai precisar dele no CRM, mas guarde.

> Não precisa enviar o app pra "Análise" (App Review). Como o token vai ser de um **Usuário do Sistema
> do mesmo Gerenciador de Negócios** que é dono do app, funciona em modo de desenvolvimento.

---

## Parte 2 — Gerar o Token de acesso (Usuário do Sistema)

Esse é o jeito certo: o token de **Usuário do Sistema** não expira (ou dura 60 dias, você escolhe),
diferente do token que sai do "Explorador da API", que morre em 1–2 horas.

1. Acesse [business.facebook.com/settings](https://business.facebook.com/settings) (Configurações do negócio).
2. Menu lateral: **Usuários → Usuários do sistema** → **Adicionar**.
   - Nome: `CRM VisitaIA`
   - Função: **Administrador**
   - **Criar usuário do sistema**.
3. Com o usuário do sistema selecionado, clique em **Atribuir ativos**:
   - Tipo de ativo: **Páginas** → marque a sua página → permissão **Controle total** (ou "Gerenciar Página")
     → **Salvar alterações**.
   - (Se seus formulários ficam na conta de anúncios) repita com tipo **Contas de anúncios** →
     sua conta → **Controle total**.
4. Ainda no usuário do sistema, clique em **Gerar novo token**.
   - **App**: escolha o app da Parte 1.
   - **Validade do token**: escolha **Nunca**.
   - **Permissões**: marque **todas estas**:
     - `leads_retrieval`
     - `pages_show_list`
     - `pages_read_engagement`
     - `pages_manage_metadata`
     - `business_management`
     - `ads_management`
   - **Gerar token**.
5. **Copie o token agora** (ele só aparece uma vez) e guarde num lugar seguro. É um texto longo que
   começa com `EAA...`.

---

## Parte 3 — Pegar o ID da Página

1. Em [business.facebook.com/settings](https://business.facebook.com/settings) → **Contas → Páginas**.
2. Clique na sua página. O **ID da página** aparece logo abaixo do nome (um número tipo `102938475610293`).

Alternativa: abra a página no Facebook → **Sobre** → **Transparência da página** → o "ID da página" está lá.

---

## Parte 4 — Pegar o ID do Formulário (Lead Ads)

O Meta não mostra esse número na tela de forma fácil. O jeito mais confiável é usar o **Explorador da
API**, uma vez:

1. Acesse [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer).
2. No topo à direita, em **Meta App**, selecione o app da Parte 1.
3. Clique em **Gerar token de acesso** (esse token é temporário, serve só pra este passo). Autorize as
   permissões `leads_retrieval` e `pages_show_list` se pedir.
4. No campo da URL, apague o que tiver e digite:

   ```
   <ID_DA_PÁGINA>/leadgen_forms
   ```

   (troque `<ID_DA_PÁGINA>` pelo número da Parte 3) e clique em **Enviar**.
5. A resposta lista os seus formulários, assim:

   ```json
   {
     "data": [
       { "id": "6612345678901234", "name": "Campanha Apartamentos - Setembro" },
       { "id": "6698765432109876", "name": "Lançamento Residencial Aurora" }
     ]
   }
   ```

   O **`id`** de cada bloco é o **ID do formulário**. Copie o do formulário que você quer conectar.

Alternativa sem API: em **Gerenciador de Negócios → Todas as ferramentas → Biblioteca de formulários
instantâneos**, clique no formulário e olhe a URL do navegador — o número comprido depois de
`/forms/` (ou `id=`) é o ID.

---

## Parte 5 — Cadastrar no CRM e testar

1. No CRM, entre como **Dono** ou **Gerente** → menu **Integrações**.
2. Seção **"Captação de leads do Facebook"** → botão **"+ Nova conexão"**.
3. Preencha:
   - **Nome da conexão**: um apelido pra você (ex: `Campanha Apartamentos - Setembro`).
   - **ID da página**: o número da Parte 3.
   - **ID do formulário (Lead Ads)**: o número da Parte 4.
   - **Token de acesso**: o texto `EAA...` da Parte 2.
4. **Adicionar conexão**.
5. Na conexão criada, clique em **"Testar conexão"**.
   - ✅ **"Última captação OK"** / nome do formulário → está funcionando. Novos leads começam a cair em
     até 5 minutos.
   - ⚠️ erro → veja a tabela de problemas abaixo.

> O token fica **criptografado** no banco do CRM. Ninguém (nem a equipe do CRM) vê o valor depois de salvo.

---

## Validade do token e renovação

- Se você escolheu **"Nunca"** na Parte 2, o token não expira. Só pare de funcionar se:
  - alguém **remover** o usuário do sistema ou a atribuição da página no Gerenciador de Negócios;
  - a página trocar de Gerenciador de Negócios;
  - você **revogar** o token na tela do usuário do sistema.
- Se acontecer, a tela de **Integrações** vai mostrar o erro na coluna "Situação". Basta repetir a
  Parte 2 (gerar token novo) e usar o botão **"Editar"** na conexão pra colar o token novo.

---

## Problemas comuns

| Erro que aparece | O que significa | Como resolver |
|---|---|---|
| `Malformed access token` | o token foi colado errado (faltou pedaço, tem espaço) | copie o token de novo, inteiro, sem espaços |
| `Error validating access token` / `Session has expired` | token expirado ou revogado | gere um token novo (Parte 2), edite a conexão |
| `(#10) ... requires leads_retrieval permission` | o token não tem a permissão `leads_retrieval` | gere o token de novo marcando **todas** as permissões da Parte 2 |
| `(#100) Tried accessing nonexisting field (leads)` ou `Unsupported get request` | o ID do formulário está errado, ou o formulário é de outra página | confira o ID na Parte 4; o formulário tem que ser da mesma página |
| `(#200) ... does not have permission` | o usuário do sistema não foi atribuído à página | volte na Parte 2, passo 3, e atribua a página com "Controle total" |
| Testa OK mas não chega lead | o formulário não teve nenhum lead novo desde que você conectou | faça um lead de teste no [Ferramenta de teste de Lead Ads](https://developers.facebook.com/tools/lead-ads-testing), selecione a página e o formulário, envie, e espere até 5 min |

---

## Resumo (checklist)

- [ ] App criado no Meta (Parte 1)
- [ ] Usuário do sistema criado, página atribuída com controle total (Parte 2, passos 1–3)
- [ ] Token gerado com as 6 permissões, validade "Nunca", **copiado** (Parte 2, passos 4–5)
- [ ] ID da página anotado (Parte 3)
- [ ] ID do formulário anotado (Parte 4)
- [ ] Conexão criada no CRM e **"Testar conexão"** deu OK (Parte 5)
