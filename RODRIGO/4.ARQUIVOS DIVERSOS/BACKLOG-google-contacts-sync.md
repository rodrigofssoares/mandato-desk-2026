# Backlog — Sincronização Google Contacts

**Cliente:** Raquel Auxiliadora
**Codigo QG:** RAQ-MAND-EM047
**Briefing:** RODRIGO/4.ARQUIVOS DIVERSOS/PRD-google-contacts-sync.md
**Backlog escrito por:** Agente Backlog em 2026-05-04

---

## Resumo executivo

Implementar a integracao CRM -> Google Contacts no Mandato Desk 2026. O schema Supabase esta 100% modelado (tabelas `google_oauth_tokens`, `google_sync_settings`, `contact_sync`, `google_sync_logs` e colunas `google_resource_name`, `google_contact_id`, `google_etag` em `contacts`). Nao existe nenhuma Edge Function de sync nem hook React. A entrega e dividida em 9 tasks verticalmente fatiadas: walking skeleton (T01-T03) entrega o ciclo OAuth -> criar contato -> aparecer no Google end-to-end; T04-T06 adicionam as operacoes restantes (update, delete, disparo automatico pos-mutation); T07 entrega a reconciliacao em lote; T08 entrega o painel de erros e retry; T09 cobre testes dos helpers criticos.

---

## Pre-requisitos externos (bloqueadores fora do codigo)

1. **Google Cloud Console** — criar projeto, ativar a API "Google People API", criar credenciais OAuth 2.0 (tipo "Web application").
2. **Redirect URI autorizado** — adicionar `https://<project-ref>.supabase.co/functions/v1/google-auth/callback` no Google Cloud Console (campo "Authorized redirect URIs").
3. **Supabase Secrets** — configurar antes do deploy das Edge Functions:
   - `GOOGLE_CLIENT_ID` — ID do cliente OAuth
   - `GOOGLE_CLIENT_SECRET` — segredo do cliente OAuth
   - `FRONTEND_URL` — URL do frontend em producao (usado no redirect final apos OAuth)
4. **Escopo OAuth** — usar `https://www.googleapis.com/auth/contacts` (leitura + escrita). Nao usar `contacts.readonly`.
5. **Modo de teste Google OAuth** — para uso interno (<100 usuarios), manter app em modo "Teste" no Google Cloud Console. Nao e necessario publicar o app.

---

## Glossario

- **Edge Function** — funcao serverless Deno hospedada no Supabase (`supabase/functions/<nome>/index.ts`), acessivel via HTTPS.
- **People API** — API REST do Google para gerenciar contatos (`https://people.googleapis.com/v1/people`).
- **resourceName** — identificador unico de um contato no Google People API, formato `people/c12345678`. Armazenado em `contacts.google_resource_name`.
- **etag** — hash de versao retornado pela People API. Necessario para updates (evitar erro 412 Precondition Failed).
- **contact_sync** — tabela de rastreamento de estado do sync por contato + usuario.
- **google_sync_logs** — log imutavel de cada operacao de sync (auditoria).
- **walking skeleton** — versao minima end-to-end que prova o ciclo completo.

---

## Walking skeleton (entrega valor end-to-end)

T01 + T02 + T03 — ao concluir essas tres tasks, uma assessora consegue: conectar o Google, criar um contato no CRM e vê-lo aparecer no Google Contacts em ate 30 segundos.

---

## Ordem de execucao (WSJF + dependencias)

1. **T01** — Criar Edge Function `google-auth` com fluxo OAuth completo [walking skeleton]
2. **T02** — Criar Edge Function `google-contacts-sync` com operacao `create` [walking skeleton]
3. **T03** — Substituir placeholder `/google-integration` por pagina de conexao basica [walking skeleton]
4. **T04** — Adicionar operacoes `update` e `delete` na Edge Function `google-contacts-sync`
5. **T05** — Criar hook `useGoogleSync` com queries e mutations de status/configuracoes
6. **T06** — Interceptar mutations de contacts para disparar sync automatico em background
7. **T07** — Implementar reconciliacao em lote ("Sincronizar todos") com progresso
8. **T08** — Expandir pagina de integracao com painel de status, logs e retry manual
9. **T09** — Adicionar testes dos helpers de mapeamento de campos CRM -> People API

---

## Tasks

### T01 — Criar Edge Function `google-auth` com fluxo OAuth completo

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route, integration
**Depende de:** pre-requisitos externos (Google Cloud Console configurado, secrets no Supabase)
**WSJF score:** (8 + 8 + 5) / 5 = 4,2

#### User story

Como administradora ou proprietaria do gabinete, quero clicar em "Conectar com Google" e autorizar o acesso, para que o CRM possa escrever contatos na minha agenda Google.

#### Contexto

Nao existe nenhuma Edge Function de autenticacao Google no projeto. O `_shared/admin-guard.ts` ja mostra o padrao de Edge Function Deno com `createClient`, CORS headers e validacao de JWT — reutilizar esse padrao. O OAuth 2.0 do Google requer dois endpoints: `/google-auth/start` (gera a URL de autorizacao e redireciona) e `/google-auth/callback` (recebe o `code`, troca por tokens, salva em `google_oauth_tokens` via upsert por `user_id`). O `client_secret` deve ser lido de `Deno.env.get('GOOGLE_CLIENT_SECRET')`, nunca exposto no frontend.

#### Criterios de aceite

- [ ] `GET /functions/v1/google-auth/start?user_id=<uuid>` retorna redirect 302 para a URL de consentimento Google com os parametros corretos (`client_id`, `redirect_uri`, `scope=https://www.googleapis.com/auth/contacts`, `access_type=offline`, `prompt=consent`, `state=<user_id>`)
- [ ] Apos autorizacao, Google redireciona para `/google-auth/callback?code=<code>&state=<user_id>`
- [ ] Callback troca `code` por `access_token` + `refresh_token` via `POST https://oauth2.googleapis.com/token`
- [ ] Tokens salvos em `google_oauth_tokens` via upsert (`ON CONFLICT (user_id) DO UPDATE`) com `expires_at`, `google_email` e `is_active = true`
- [ ] Apos salvar, cria registro em `google_sync_settings` para o usuario se nao existir (upsert com defaults: `sync_enabled=true`, `keep_on_google_delete=true`)
- [ ] Callback redireciona o browser para `${FRONTEND_URL}/google-integration?connected=true` ao concluir com sucesso
- [ ] `GOOGLE_CLIENT_SECRET` e lido de `Deno.env` — nunca retornado em resposta HTTP
- [ ] Se `code` for invalido ou expirado, retorna redirect para `${FRONTEND_URL}/google-integration?error=oauth_failed`
- [ ] Se usuario ja tem token ativo, o upsert sobrescreve o token anterior (nao duplica)

#### Hints tecnicos (nao-prescritivos)

- **Arquivo a criar:** `supabase/functions/google-auth/index.ts`
- **Padrao:** seguir estrutura de `_shared/admin-guard.ts` para CORS headers e `jsonResponse`
- **Roteamento interno:** `const path = url.pathname` — branch `path.endsWith('/start')` vs `path.endsWith('/callback')`
- **Salvar tokens:** usar `supabase` com `service_role_key` para bypass de RLS (igual a `api-proxy/index.ts` linha 413)
- **google_email:** buscar via `GET https://www.googleapis.com/oauth2/v2/userinfo` com o `access_token` recem-obtido

#### Test cases

- Happy path: usuario clica em "Conectar", autoriza, e volta para `/google-integration?connected=true` com `is_active=true` em `google_oauth_tokens`
- Edge — reautorizacao: usuario ja tem token, reconecta com outra conta Google — token anterior e sobrescrito
- Edge — code invalido: callback com `?code=invalido` redireciona para `?error=oauth_failed`
- Edge — secrets ausentes: Edge Function retorna 500 com mensagem descritiva (nao expoe valores de env)

#### Definition of Done

- [ ] Criterios de aceite validos
- [ ] Lint OK (`deno lint` ou equivalente)
- [ ] Build OK (`supabase functions serve google-auth` sobe sem erro)
- [ ] Smoke test manual: clicar no botao da pagina e completar o OAuth com conta Google real
- [ ] QA aprovou

#### Out of scope

- Refresh automatico de token (implementado em T02)
- UI do botao "Conectar" (implementada em T03)
- Revogacao/desconexao (implementada em T08)

---

### T02 — Criar Edge Function `google-contacts-sync` com operacao `create`

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route, integration
**Depende de:** T01 (token precisa existir para sync funcionar)
**WSJF score:** (8 + 8 + 8) / 8 = 3,0

#### User story

Como assessora que acabou de salvar um novo contato no CRM, quero que esse contato apareca automaticamente no Google Contacts em ate 30 segundos, para nao precisar cadastrar duas vezes.

#### Contexto

Esta e a Edge Function central do sistema. Recebe `{ contact_id, user_id, operation: 'create' }` via POST, busca o contato em `contacts`, mapeia os campos para o formato da People API (decisao D5 do PRD), cria o contato no Google e grava o resultado em `contact_sync` e `google_sync_logs`. Retry automatico 2x com backoff de 1s (decisao D3). Refresh de token integrado: se `expires_at < now()`, renova via `refresh_token` antes de chamar a People API. Esta task cobre apenas `operation = 'create'`; update e delete sao adicionados em T04 para manter a task abaixo de 8pt.

#### Criterios de aceite

- [ ] `POST /functions/v1/google-contacts-sync` com body `{ contact_id, user_id, operation: 'create' }` cria o contato na People API
- [ ] Mapeamento de campos respeita a decisao D5: `nome` -> `names[0].displayName`, `telefone` -> `phoneNumbers` tipo `home`, `whatsapp` -> tipo `mobile`, `email` -> `emailAddresses[0]`, campos de endereco -> `addresses[0]`, `data_nascimento` -> `birthdays[0]`, `observacoes` + `notas_assessor` concatenados em `biographies[0]`, `instagram` -> `urls` tipo `instagramProfile`
- [ ] Apos criacao bem-sucedida: `contacts.google_resource_name` e `contacts.google_contact_id` sao preenchidos com o `resourceName` retornado
- [ ] `contacts.google_etag` e `contacts.google_last_synced_at` sao preenchidos
- [ ] `contact_sync` recebe upsert com `sync_status = 'synced'`, `last_synced_at = now()`, `google_resource_name` preenchido
- [ ] Log gravado em `google_sync_logs` com `operation = 'create'`, `status = 'success'`
- [ ] Se token expirado (`expires_at < now()`): renova via `POST https://oauth2.googleapis.com/token` com `grant_type=refresh_token`, atualiza `google_oauth_tokens` antes de chamar a People API
- [ ] Se refresh falhar (token revogado): grava `google_oauth_tokens.is_active = false` e retorna 401 com mensagem descritiva
- [ ] Se People API falhar: retry 2x com delay de 1s. Apos 3 tentativas, `contact_sync.sync_status = 'error'` + `last_error` preenchido + log com `status = 'error'`
- [ ] Se `contacts.nome` for nulo ou vazio: nao chama People API, grava log com `error_message = 'nome obrigatorio'`
- [ ] Se `google_sync_settings.sync_enabled = false` ou usuario nao tem token ativo: retorna 200 sem fazer nada (skip silencioso)

#### Hints tecnicos (nao-prescritivos)

- **Arquivo a criar:** `supabase/functions/google-contacts-sync/index.ts`
- **Padrao de retry:** `for (let attempt = 0; attempt < 3; attempt++) { try { ... break } catch { if (attempt < 2) await sleep(1000) } }`
- **People API endpoint create:** `POST https://people.googleapis.com/v1/people:createContact`
- **Autorizacao na People API:** header `Authorization: Bearer <access_token>`
- **upsert em contact_sync:** `supabase.from('contact_sync').upsert({ contact_id, user_id, ... }, { onConflict: 'contact_id,user_id' })`
- **Rate limit (429):** ler header `Retry-After` da resposta e aguardar esse valor antes do proximo retry

#### Test cases

- Happy path: body valido, token ativo, contato com `nome` preenchido — `contact_sync.sync_status = 'synced'` e `google_resource_name` preenchido
- Edge — token expirado: `expires_at` no passado — Edge Function renova e continua
- Edge — refresh invalido: `refresh_token` revogado — `is_active = false`, retorna 401
- Edge — nome vazio: contato sem `nome` — log com `error_message = 'nome obrigatorio'`, `contact_sync` nao e criado
- Edge — 3 falhas na People API: `sync_status = 'error'`, `last_error` preenchido, CRM nao e afetado
- Edge — sync desabilitado: `sync_enabled = false` — retorna 200 sem nenhuma escrita

#### Definition of Done

- [ ] Criterios de aceite validos
- [ ] Lint OK
- [ ] Build OK
- [ ] Smoke test manual: criar contato no CRM, verificar no Google Contacts em < 30s
- [ ] QA aprovou

#### Out of scope

- Operacoes `update` e `delete` (T04)
- Reconciliacao em lote (T07)
- Disparo automatico a partir das mutations React (T06)

---

### T03 — Substituir placeholder `/google-integration` por pagina de conexao basica

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T01 (para o botao de conexao funcionar), T02 (para exibir status)
**WSJF score:** (8 + 5 + 3) / 5 = 3,2

#### User story

Como administradora ou proprietaria, quero ver na pagina de Integracao se minha conta Google esta conectada e qual e-mail foi autorizado, para saber se o sync esta ativo.

#### Contexto

`src/pages/GoogleIntegration.tsx` e atualmente um placeholder com Badge "Em desenvolvimento". Esta task o substitui por uma pagina funcional minima: estado de conexao (conectado/desconectado), botao "Conectar com Google" ou "Reconectar", exibicao do e-mail da conta Google conectada. A logica de dados fica em um hook `useGoogleSync` criado nesta task (versao minima — queries de status). O hook sera expandido em T05 para incluir mutations. A pagina e acessivel apenas para roles `admin` e `proprietario` (secao `google` ja existe em `src/types/permissions.ts`).

#### Criterios de aceite

- [ ] Pagina `/google-integration` exibe estado da conexao: se `google_oauth_tokens` existe e `is_active = true`, mostra "Conectado como <google_email>"; caso contrario mostra "Nao conectado"
- [ ] Botao "Conectar com Google" — ao clicar, abre `window.open('/functions/v1/google-auth/start?user_id=<id>', '_blank')` (popup ou nova aba). Se popup for bloqueado, exibe link clicavel como fallback
- [ ] Apos retorno do OAuth (`?connected=true` na URL), pagina exibe toast "Conta Google conectada com sucesso" e recarrega o status
- [ ] Se retorno com `?error=oauth_failed`, exibe toast de erro "Falha ao conectar. Tente novamente."
- [ ] Banner de aviso visivel quando `is_active = false` (token revogado): "Sua conexao com o Google expirou. Reconecte."
- [ ] Pagina renderiza loading skeleton enquanto a query de status carrega
- [ ] Roles `assessor`, `assistente`, `estagiario` nao tem acesso a esta pagina (guard existente de secoes)

#### Hints tecnicos (nao-prescritivos)

- **Pagina:** `src/pages/GoogleIntegration.tsx` — reescrever completamente
- **Hook (versao minima):** `src/hooks/useGoogleSync.ts` — criar com `useGoogleStatus()` retornando query de `google_oauth_tokens` do usuario logado
- **Detectar retorno OAuth:** `const params = new URLSearchParams(window.location.search); params.get('connected')` — usar `useEffect` + `useSearchParams` ou equivalente
- **Popup blocker fallback:** `const win = window.open(...); if (!win) setShowFallbackLink(true)`
- **shadcn/ui:** usar `Card`, `Badge`, `Button`, `Alert` — componentes ja presentes no projeto

#### Test cases

- Happy path: usuario com token ativo ve "Conectado como usuario@gmail.com"
- Estado inicial: usuario sem token ve botao "Conectar com Google"
- Retorno OAuth sucesso: URL com `?connected=true` exibe toast e atualiza status
- Retorno OAuth erro: URL com `?error=oauth_failed` exibe toast de erro
- Token revogado: `is_active=false` exibe banner de aviso
- Popup bloqueado: link fallback aparece

#### Definition of Done

- [ ] Criterios de aceite validos
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual: abrir pagina, clicar "Conectar", completar OAuth, ver email exibido
- [ ] QA aprovou

#### Out of scope

- Contadores de status sync (T08)
- Botao desconectar (T08)
- Painel de logs (T08)
- Botao "Sincronizar todos" (T07)

---

### T04 — Adicionar operacoes `update` e `delete` na Edge Function `google-contacts-sync`

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route, integration
**Depende de:** T02
**WSJF score:** (8 + 5 + 5) / 5 = 3,6

#### User story

Como assessora que corrigiu o telefone de um contato ou removeu um contato desatualizado, quero que a agenda Google reflita essa mudanca automaticamente, para que o celular tenha sempre os dados corretos.

#### Contexto

T02 implementou apenas `operation = 'create'`. Esta task adiciona `update` e `delete` na mesma Edge Function. Para `update`: buscar o etag atual via `GET people/<resourceName>?personFields=metadata`, atualizar via `PATCH people/<resourceName>:updateContact`, tratar erro 412 (etag desatualizado: buscar etag novamente e retentar 1x). Para `delete`: verificar `google_sync_settings.keep_on_google_delete` do usuario — se `false`, chamar `DELETE people/<resourceName>:deleteContact`; se `true`, apenas remover de `contact_sync`. Em ambos os casos, a operacao no CRM nunca falha por causa do Google (decisao D3 e D7).

#### Criterios de aceite

- [ ] `operation = 'update'` com `google_resource_name` preenchido: busca etag atual e chama `people.updateContact` com os campos mapeados (D5) e `updatePersonFields` correto
- [ ] Se contato nao tem `google_resource_name` mas `operation = 'update'`: fallback para `create` (cria o contato no Google)
- [ ] Apos update bem-sucedido: `contacts.google_etag` e `contacts.google_last_synced_at` atualizados, `contact_sync.sync_status = 'synced'`
- [ ] Erro 412 (etag desatualizado): busca etag atualizado e retenta 1x. Se falhar novamente: `sync_status = 'conflict'`, log com `status = 'error'`
- [ ] `operation = 'delete'` com `keep_on_google_delete = true`: remove registro de `contact_sync`, nao chama People API, grava log
- [ ] `operation = 'delete'` com `keep_on_google_delete = false` e `google_resource_name` preenchido: chama `people.deleteContact`, remove `contact_sync`, grava log
- [ ] Se `people.deleteContact` retornar erro: log com `status = 'error'`, mas a deleção no CRM nao e afetada (operacao ja ocorreu antes da Edge Function ser chamada)
- [ ] Rate limit 429 em qualquer operacao: aguarda `Retry-After` ou 60s e retenta dentro do timeout Deno (150s)

#### Hints tecnicos (nao-prescritivos)

- **People API update:** `PATCH https://people.googleapis.com/v1/{resourceName}:updateContact?updatePersonFields=names,phoneNumbers,emailAddresses,addresses,birthdays,biographies,urls`
- **People API get etag:** `GET https://people.googleapis.com/v1/{resourceName}?personFields=metadata`
- **People API delete:** `DELETE https://people.googleapis.com/v1/{resourceName}:deleteContact`
- **sync_status 'conflict':** enum ja existe em `sync_status_type` no banco

#### Test cases

- Happy path update: contato com `google_resource_name`, etag valido — update aceito, `sync_status = 'synced'`
- Edge — etag desatualizado (412): Edge Function busca etag e retenta. Se segunda falha: `sync_status = 'conflict'`
- Happy path delete com `keep=true`: `contact_sync` removido, People API nao chamada
- Happy path delete com `keep=false`: People API chamada, `contact_sync` removido
- Edge — delete com erro na People API: CRM nao e afetado, log grava erro
- Edge — update sem `google_resource_name`: fallback para create

#### Definition of Done

- [ ] Criterios de aceite validos
- [ ] Lint OK
- [ ] Build OK
- [ ] Smoke test manual: editar contato sincronizado e verificar mudanca no Google Contacts
- [ ] QA aprovou

#### Out of scope

- Disparo automatico (T06)
- Sincronizacao reversa Google -> CRM (out of scope do PRD)

---

### T05 — Criar hook `useGoogleSync` com queries e mutations completas

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, action
**Depende de:** T03 (hook minimo ja criado, esta task expande)
**WSJF score:** (5 + 3 + 3) / 2 = 5,5

#### User story

Como desenvolvedor mantendo o frontend de sync, quero um hook centralizado `useGoogleSync` que encapsula todas as queries e mutations de sincronizacao, para que os componentes nao acessem o Supabase diretamente e a logica fique testavel.

#### Contexto

T03 criou `useGoogleSync` com apenas a query de status. Esta task completa o hook com: query de `google_sync_settings`, mutation de desconexao, mutation de configuracoes (`keep_on_google_delete`), query de contadores de sync status (`synced/error/pending`), query de logs recentes. Esse hook sera consumido pela pagina expandida (T08).

#### Criterios de aceite

- [ ] `useGoogleStatus()` retorna `{ token, isConnected, isExpired, isLoading }` — ja existe em T03, verificar se precisa ajuste
- [ ] `useGoogleSettings()` retorna query de `google_sync_settings` do usuario logado
- [ ] `useUpdateGoogleSettings()` retorna mutation que atualiza `google_sync_settings` (ex: `keep_on_google_delete`)
- [ ] `useDisconnectGoogle()` retorna mutation que: deleta `google_oauth_tokens` do usuario, seta `google_sync_settings.sync_enabled = false`
- [ ] `useSyncStatusCounts()` retorna `{ synced: number, error: number, pending: number }` via query agregada em `contact_sync`
- [ ] `useGoogleSyncLogs(limit?: number)` retorna as ultimas N entradas de `google_sync_logs` com join em `contacts` para buscar `nome`
- [ ] `useContactSyncErrors()` retorna lista de `contact_sync` com `sync_status = 'error'` com join em `contacts` para `nome` e `last_error`

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `src/hooks/useGoogleSync.ts` — expandir o criado em T03
- **Padrao de hook existente:** ver `useContacts.ts` — pattern `useQuery` + `useMutation` com `queryClient.invalidateQueries`
- **Query de contadores:** `supabase.from('contact_sync').select('sync_status').eq('user_id', userId)` + agrupamento no cliente, ou `.select('sync_status, count', { count: 'exact' }).eq('user_id', userId)` com group
- **Join logs + nome:** `supabase.from('google_sync_logs').select('*, contacts(nome)').order('created_at', { ascending: false }).limit(50)`

#### Test cases

- Happy path: `useGoogleStatus` retorna `isConnected: true` quando token ativo existe
- `useDisconnectGoogle` executado: `google_oauth_tokens` deletado e `sync_enabled = false` confirmado
- `useSyncStatusCounts` retorna contagens corretas para cada status
- `useGoogleSyncLogs` retorna maximo 50 entradas em ordem decrescente

#### Definition of Done

- [ ] Criterios de aceite validos
- [ ] Typecheck OK (sem erros de tipo)
- [ ] Lint OK
- [ ] QA aprovou (smoke test via pagina T08)

#### Out of scope

- Mutation de disparo de sync (fica em T06 — invocacao de Edge Function)
- Mutation de reconciliacao em lote (T07)

---

### T06 — Interceptar mutations de contacts para disparar sync automatico em background

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, action
**Depende de:** T02 e T04 (Edge Functions precisam existir), T05 (hook de status para verificar se sync esta ativo)
**WSJF score:** (8 + 8 + 5) / 5 = 4,2

#### User story

Como assessora que salva, edita ou remove um contato no CRM, quero que o Google Contacts seja atualizado automaticamente sem nenhuma acao extra da minha parte, para que o celular sempre reflita o estado atual da base.

#### Contexto

`useCreateContact`, `useUpdateContact` e `useDeleteContact` em `src/hooks/useContacts.ts` ja existem e funcionam. Esta task adiciona uma chamada fire-and-forget a Edge Function `google-contacts-sync` no `onSuccess` de cada mutation. A chamada e assincrona (sem `await` que bloqueie a UX): o contato ja foi salvo no CRM, o sync acontece em paralelo. Se o usuario nao tem token Google ativo, a Edge Function retorna 200 silenciosamente (skip). A invocacao usa `supabase.functions.invoke` que ja lida com autenticacao do usuario logado.

#### Criterios de aceite

- [ ] `useCreateContact.onSuccess`: apos sucesso do insert, chama `supabase.functions.invoke('google-contacts-sync', { body: { contact_id: data.id, user_id, operation: 'create' } })` sem `await` (fire-and-forget)
- [ ] `useUpdateContact.onSuccess`: chama `invoke` com `operation: 'update'` e `contact_id` do contato atualizado
- [ ] `useDeleteContact.mutationFn`: antes de deletar do Supabase, captura `google_resource_name` do contato; `onSuccess` chama `invoke` com `operation: 'delete'` e o `google_resource_name` capturado (contato ja nao existe apos o delete)
- [ ] Falha na invocacao da Edge Function nao bloqueia nem exibe erro para o usuario — apenas loga no console em dev
- [ ] Toast existente de sucesso ("Contato criado/atualizado/excluido") aparece imediatamente, sem aguardar o sync
- [ ] Usuario sem token Google ativo: invoke retorna 200 silencioso, UX nao e afetada
- [ ] Apos sync bem-sucedido (status 200 da Edge Function), queries `contact_sync` e `google-sync-status-counts` sao invalidadas para que os contadores na pagina de integracao atualizem

#### Hints tecnicos (nao-prescritivos)

- **Arquivo a editar:** `src/hooks/useContacts.ts`
- **Invocacao:** `supabase.functions.invoke('google-contacts-sync', { body: { ... } })` — ja disponivel no cliente Supabase
- **user_id:** obter via `supabase.auth.getUser()` ou `useAuth` context — verificar qual padrao o projeto usa
- **Para delete:** `const { data: contact } = await supabase.from('contacts').select('google_resource_name').eq('id', id).single()` antes do delete
- **Invalidacao pos-sync:** `.then(() => { queryClient.invalidateQueries({ queryKey: ['sync-status-counts'] }) })` no invoke — sem bloquear

#### Test cases

- Happy path create: contato criado, invoke chamado em background, `contact_sync` aparece como `synced` em < 30s
- Happy path update: contato editado, invoke chamado, `google_etag` atualizado
- Happy path delete com `keep=false`: contato deletado do CRM e do Google
- Edge — usuario sem Google: invoke retorna 200, nenhum efeito colateral
- Edge — Edge Function lenta: toast de sucesso do CRM aparece imediatamente, sync ocorre depois

#### Definition of Done

- [ ] Criterios de aceite validos
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual: criar contato, esperar < 30s, verificar no Google Contacts
- [ ] QA aprovou

#### Out of scope

- Disparo na API externa (`api-proxy`) — fora de escopo do MVP
- Sync reverso Google -> CRM

---

### T07 — Implementar reconciliacao em lote com progresso

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route, hook, component
**Depende de:** T02 (Edge Function create), T05 (hook de status), T03 (pagina de integracao)
**WSJF score:** (5 + 3 + 5) / 8 = 1,6

#### User story

Como administradora conectando o Google pela primeira vez, quero sincronizar todos os 2000+ contatos do CRM com o Google em uma unica operacao, para que a agenda inicie completa sem precisar editar cada contato um a um.

#### Contexto

A reconciliacao inicial deve: (a) rodar automaticamente ao final do OAuth (T01 ja salva o token — T03 detecta `?connected=true` e dispara); (b) ser acionavel manualmente via botao. O processo e executado em lotes de 50 no frontend (loop com await) para evitar timeout do Deno (150s). Cada lote chama a Edge Function com `operation: 'bulk'` passando um array de contact_ids, ou chama sequencialmente cada contato. A decisao de implementacao (bulk vs sequencial) fica com o Fullstack — o criterio e: respeitar rate limit de 10 req/s da People API. O progresso e exibido em tempo real.

#### Criterios de aceite

- [ ] Botao "Sincronizar todos os contatos" visivel na pagina de Integracao (somente quando `is_active = true`)
- [ ] Ao clicar, busca todos os contacts do usuario sem `sync_status = 'synced'` em `contact_sync` (ou sem registro em `contact_sync`)
- [ ] Exibe progresso: "X de Y contatos enviados para o Google" atualizado a cada lote de 50 processado
- [ ] Contatos com `sync_status = 'synced'` sao pulados (idempotencia)
- [ ] Rate limit respeitado: maximo 10 requisicoes por segundo (delay entre sub-lotes)
- [ ] Ao concluir: `google_sync_settings.last_full_sync = now()` atualizado, contadores de status atualizados
- [ ] Se processo for interrompido (usuario fecha aba): contatos ja sincronizados permaneceram com `sync_status = 'synced'` e nao serao reprocessados na proxima execucao
- [ ] Apos conclusao automatica pos-OAuth: toast "Sincronizacao inicial concluida: X contatos enviados para o Google"
- [ ] Botao fica desabilitado durante o processo (sem duplo clique)

#### Hints tecnicos (nao-prescritivos)

- **Logica de lote no frontend:** `for (let i = 0; i < contactIds.length; i += 50) { const batch = contactIds.slice(i, i + 50); await Promise.all(batch.map(id => supabase.functions.invoke(...))); setProgress(i + batch.length); await sleep(1000) }`
- **Buscar contatos para sync:** `supabase.from('contacts').select('id, nome, google_resource_name').is('merged_into', null)` + left join em `contact_sync` para filtrar os nao-sinalizados como synced
- **Atualizar last_full_sync:** mutation em `useGoogleSync` — `supabase.from('google_sync_settings').update({ last_full_sync: new Date().toISOString() }).eq('user_id', userId)`
- **Progresso:** estado local `[progress, setProgress]` em useState — nao e necessario persistir no banco

#### Test cases

- Happy path: 2000 contatos — processo conclui sem timeout, `last_full_sync` atualizado
- Idempotencia: rodar novamente com contatos ja `synced` — nenhum reprocessado
- Interrupcao: fechar aba no meio — contatos ja processados permanecem `synced`
- Contato sem `nome`: pulado com log de erro, processo continua para os demais
- Pos-OAuth: reconexao dispara reconciliacao automaticamente

#### Definition of Done

- [ ] Criterios de aceite validos
- [ ] Lint OK
- [ ] Build OK
- [ ] Smoke test manual: base com 50+ contatos, clicar "Sincronizar todos", verificar progresso e resultado
- [ ] QA aprovou

#### Out of scope

- Sync periodico automatico (cron) — out of scope do PRD
- Import do Google para o CRM (fluxo reverso)
- Painel de logs detalhado (T08)

---

### T08 — Expandir pagina de integracao com painel de status, logs e retry manual

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T05 (hook completo), T07 (reconciliacao ja existe)
**WSJF score:** (5 + 3 + 3) / 5 = 2,2

#### User story

Como administradora, quero ver quantos contatos estao sincronizados, com erro ou pendentes, e poder reprocessar os erros com um clique, para monitorar a saude da integracao sem precisar acessar o banco de dados.

#### Contexto

T03 entregou a pagina minima (conexao/desconexao). Esta task expande para: 3 cards de contadores de status (usando `useSyncStatusCounts` de T05), tabela de logs recentes (usando `useGoogleSyncLogs` de T05), secao de contatos com erro e botao de retry (usando `useContactSyncErrors` de T05), botao "Desconectar" com confirmacao, toggle de configuracao `keep_on_google_delete`. O retry por contato invoca `supabase.functions.invoke('google-contacts-sync', { body: { contact_id, operation: 'update' } })`.

#### Criterios de aceite

- [ ] Tres cards de contadores: "Sincronizados" (sync_status = 'synced'), "Com erro" (sync_status = 'error'), "Pendentes" (sync_status = 'pending')
- [ ] Exibe `last_full_sync` formatado em pt-BR: "Ultima sincronizacao completa: DD/MM/YYYY HH:mm" (ou "Nunca" se null)
- [ ] Tabela de logs: data/hora, nome do contato, operacao (criar/atualizar/deletar), status (sucesso/erro), mensagem de erro se houver. Limite de 50 entradas mais recentes
- [ ] Secao "Contatos com erro": lista contatos com `sync_status = 'error'`, nome e `last_error`. Botao "Tentar novamente" por linha invoca Edge Function com `operation = 'update'` para aquele contato
- [ ] Botao "Reprocessar todos os erros" invoca sync em lote para todos os contatos com erro (mesma logica de loop de T07, filtrado por `sync_status = 'error'`)
- [ ] Botao "Desconectar conta Google" com AlertDialog de confirmacao ("Isso nao remove contatos do Google Contacts")
- [ ] Toggle "Manter contatos no Google ao excluir do CRM" espelhando `keep_on_google_delete` com save imediato
- [ ] Apos retry bem-sucedido: contato some da lista de erros e contadores sao atualizados
- [ ] Pagina e acessivel somente por roles com permissao `google` (admin e proprietario)

#### Hints tecnicos (nao-prescritivos)

- **Componentes shadcn/ui:** `Card`, `Table`, `AlertDialog`, `Switch`, `Badge`, `Button`
- **Formatacao de data:** `new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(last_full_sync))`
- **Retry individual:** `supabase.functions.invoke('google-contacts-sync', { body: { contact_id, user_id, operation: 'update' } }).then(() => queryClient.invalidateQueries(...))`
- **AlertDialog:** ja usado no projeto (verificar em outros componentes para manter padrao visual)

#### Test cases

- Happy path: pagina exibe contadores corretos, logs em ordem decrescente
- Retry individual: botao "Tentar novamente" processa contato, ele some da lista de erros
- "Reprocessar todos": todos os contatos com erro sao reprocessados em sequencia
- Desconectar: dialog de confirmacao exibe texto correto, apos confirmar pagina volta ao estado inicial
- Toggle `keep_on_google_delete`: alternar e verificar que `google_sync_settings` e atualizado

#### Definition of Done

- [ ] Criterios de aceite validos
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual: criar contato com nome vazio (forca erro), verificar na lista de erros, reprocessar
- [ ] QA aprovou

#### Out of scope

- Paginacao infinita de logs (limite de 50 e suficiente para MVP)
- Graficos de historico de sync
- Configuracao visual de mapeamento de campos (out of scope do PRD — decisao D5)

---

### T09 — Adicionar testes dos helpers de mapeamento CRM -> People API

**Tipo:** test
**Estimativa:** S (2pt)
**Camadas afetadas:** test
**Depende de:** T02 (helpers de mapeamento precisam existir como funcoes exportaveis)
**WSJF score:** (3 + 2 + 5) / 2 = 5,0

#### User story

Como desenvolvedor mantendo a integracao, quero testes unitarios dos helpers de mapeamento de campos, para ter confianca de que alteracoes no schema ou na People API nao quebram o sync silenciosamente.

#### Contexto

A logica de mapeamento CRM -> People API (decisao D5) e o ponto mais critico de correcao: um campo errado em `phoneNumbers.type` ou ausencia de `displayName` causa falha silenciosa na People API. Se T02 implementar o mapeamento como funcao pura exportavel (`mapContactToPeopleApi(contact: Contact): PeopleApiPerson`), esta task adiciona testes unitarios coberto os casos do PRD. O projeto Mandato Desk 2026 nao tem infraestrutura de testes (diferente do NaMi V2 e Nosso CRM). Se o custo de setup for maior que 2pt, esta task entrega apenas os testes da funcao de mapeamento sem infraestrutura de CI.

#### Criterios de aceite

- [ ] Funcao `mapContactToPeopleApi` e exportada da Edge Function (ou extraida para arquivo compartilhado) e pode ser importada em teste
- [ ] Teste: contato com todos os campos preenchidos -> payload People API correto (todos os 8 campos de D5)
- [ ] Teste: `telefone` mapeado para `phoneNumbers[{ type: 'home' }]`, `whatsapp` para `{ type: 'mobile' }`
- [ ] Teste: endereco completo mapeado para `addresses[0]` com `streetAddress`, `city`, `region`, `postalCode`, `country = 'Brazil'`
- [ ] Teste: `observacoes` e `notas_assessor` concatenados em `biographies[0].value` com separador `\n---\n`
- [ ] Teste: contato sem `nome` -> funcao lanca erro ou retorna null (validacao usada em T02)
- [ ] Teste: campos sem equivalente na People API (`ranking`, `declarou_voto`, `leader_id`) nao aparecem no payload de saida

#### Hints tecnicos (nao-prescritivos)

- **Se projeto sem Vitest:** instalar `vitest` como devDependency, criar `vitest.config.ts` minimo (ver `Nosso CRM` para referencia de config)
- **Arquivo de teste:** `supabase/functions/google-contacts-sync/mapContact.test.ts` ou `src/lib/googleMapping.test.ts` (dependendo de onde o helper ficar)
- **Alternativa sem Vitest:** se setup for custoso, escrever os testes como scripts Deno (`Deno.test(...)`) que rodam localmente

#### Test cases

(Sao os proprios criterios de aceite — cada criterio e um caso de teste)

#### Definition of Done

- [ ] Todos os testes passando (`npm run test` ou `deno test`)
- [ ] Nenhum teste flaky (deterministico)
- [ ] QA aprovou

#### Out of scope

- Testes de integracao das Edge Functions (requerem ambiente Supabase real — fora de escopo desta task)
- Testes E2E do fluxo OAuth (requerem conta Google real)
- Cobertura de 100% do codigo

---

## Resumo de estimativas

| Task | Titulo resumido | Estimativa | Depende de |
|------|----------------|------------|------------|
| T01 | Edge Function `google-auth` OAuth | M (5pt) | pre-requisitos externos |
| T02 | Edge Function `google-contacts-sync` create | L (8pt) | T01 |
| T03 | Pagina `/google-integration` basica | M (5pt) | T01, T02 |
| T04 | `google-contacts-sync` update + delete | M (5pt) | T02 |
| T05 | Hook `useGoogleSync` completo | S (2pt) | T03 |
| T06 | Disparo automatico pos-mutation | M (5pt) | T02, T04, T05 |
| T07 | Reconciliacao em lote com progresso | L (8pt) | T02, T05, T03 |
| T08 | Painel de status, logs e retry | M (5pt) | T05, T07 |
| T09 | Testes de mapeamento CRM -> People API | S (2pt) | T02 |

**Total estimado:** 45 pontos
**Walking skeleton (T01+T02+T03):** 18 pontos — entrega o ciclo completo end-to-end
