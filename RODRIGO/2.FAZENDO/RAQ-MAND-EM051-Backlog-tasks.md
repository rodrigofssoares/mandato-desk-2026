# Backlog — Integração Z-API WhatsApp (MVP)

**Cliente:** Raquel (Mandato Desk 2026)
**Codigo QG:** RAQ-MAND-EM051
**Briefing:** RODRIGO/2.FAZENDO/RAQ-MAND-EM051-PO-refinamento.md
**Backlog escrito por:** Agente Backlog em 2026-05-09

---

## Walking skeleton (entrega valor end-to-end)

- T01 — Migration base Z-API (model completo)
- T02 — Edge Function `zapi-webhook` (recebe e persiste eventos Z-API)
- T10 — Page `/integracoes/whatsapp` esqueleto + 4 tabs + sidebar
- T11 — Aba Contas: CRUD de contas Z-API
- T13 — Aba Conversas: modal senha + interface 3 colunas + realtime

Ao terminar T13, Rodrigo já pode cadastrar uma conta Z-API, configurar o webhook no painel deles e ver mensagens chegando em tempo real — valor fim-a-fim provado.

---

## Ordem de execução (dependencias + WSJF)

1. T01 — Migration base: tabelas + RLS + indices + pg_cron [bloqueador de tudo]
2. T02 — Edge Function `zapi-webhook` (recebe eventos, valida HMAC, persiste, idempotente) [bloqueador de T13/T14]
3. T03 — Edge Function `zapi-validate-panel-password` (bcrypt + session token) [bloqueador de T13]
4. T04 — Edge Function `zapi-send-text` (envia texto, trata 429) [bloqueador de T13 envio]
5. T05 — Hook `useZapiAccounts` (CRUD + react-query) [bloqueador de T11]
6. T06 — Hook `useZapiPanelSession` (senha extra + rate-limit + TTL 30min) [bloqueador de T13]
7. T07 — Hook `useZapiChats` + `useZapiMessages` (queries + Realtime subscriptions) [bloqueador de T13]
8. T08 — Hook `useZapiWebhookLogs` (query paginada + filtros) [bloqueador de T14]
9. T09 — Vinculacao chat-contato via `normalize_phone()` [bloqueador de T13 display de nome]
10. T10 — Page `/integracoes/whatsapp` esqueleto + 4 tabs + item sidebar [walking skeleton UI]
11. T11 — Aba Contas: lista + criar + editar + excluir + resetar senha extra
12. T12 — Aba Webhooks: URL por conta + segredo (copiar/mostrar)
13. T13 — Aba Conversas: modal senha + layout 3 colunas + lista chats + conversa + envio + realtime
14. T14 — Aba Logs: tabela paginada + filtros Conta/Tipo
15. T15 — Status visual de mensagem (icones 1check/2checks/2checks-azuis/X) + atualizacao realtime
16. T16 — Estado vazio e tratamento de erros de rede em todas as abas
17. T17 — Vinculacao nome-contato CRM na conversa (link clicavel para pagina do contato)
18. T18 — pg_cron purge 90 dias (mensagens + logs) [pode ser feito em paralelo com T01]

> T18 pode ser desenvolvido em paralelo com T01 (nao tem dependencia de T02+).
> T09 pode ser desenvolvido em paralelo com T05-T08.
> T15 depende de T13 estar pronto (subcamada de status).
> T16 depende de T10-T14 (polish de edges).
> T17 depende de T09 e T13.

---

## Tasks

---

### T01 — Criar migration base: tabelas Z-API, RLS, indices e cripto-coluna

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** model
**Depende de:** —
**Dispara Security:** SIM (migration com user_id, RLS policies, dados sensiveis)
**Dispara Pentest:** SIM (migration com user_id + RLS policy + armazenamento de tokens criptografados)
**WSJF score:** (9 + 8 + 9) / 8 = 3.25 — maximo bloqueio, executar primeiro

#### User story

Como Rodrigo (admin), quero que as tabelas do modulo WhatsApp existam no banco com RLS correta, para que os demais hooks e Edge Functions possam persistir dados com segurança multi-tenant desde o primeiro dia.

#### Contexto

Cria as 5 tabelas centrais do modulo Z-API. Padroes anteriores: migration 001 para RLS com `auth.uid()`, migration 042 para padrao de comment autodoc e indices compostos. A coluna de tokens (`instance_token`, `client_token`) deve usar `text` simples com nota de que a criptografia AES-256-GCM sera aplicada pela Edge Function antes do INSERT — nao usa extensao pgcrypto nem Vault nesta migration (decisao: fallback AES via Edge Function conforme premissa 3 do PO, avaliando disponibilidade do Vault em runtime). A tabela `zapi_panel_passwords` armazena apenas o hash bcrypt — NUNCA o texto puro. A coluna `webhook_secret` em `zapi_accounts` e um hex de 32 chars gerado no INSERT (via `encode(gen_random_bytes(16), 'hex')`). A tabela `zapi_messages` tem constraint `ON CONFLICT (message_id, account_id) DO NOTHING` para idempotencia.

#### Criterios de aceite

- [ ] Tabela `zapi_accounts` existe com colunas: `id uuid PK`, `name text NOT NULL`, `instance_id text NOT NULL`, `instance_token text NOT NULL` (criptografado pela EF antes do insert), `client_token text NOT NULL` (idem), `webhook_secret text NOT NULL DEFAULT encode(gen_random_bytes(16),'hex')`, `status text DEFAULT 'configured'`, `created_at`, `updated_at`, `created_by uuid REFERENCES auth.users`
- [ ] Tabela `zapi_panel_passwords` existe com colunas: `id uuid PK`, `account_id uuid REFERENCES zapi_accounts ON DELETE CASCADE`, `password_hash text NOT NULL` (bcrypt), `updated_at`, `updated_by uuid`
- [ ] Tabela `zapi_chats` existe com colunas: `id uuid PK`, `account_id uuid REFERENCES zapi_accounts`, `phone text NOT NULL`, `contact_id uuid REFERENCES contacts(id) NULLABLE`, `last_message_at timestamptz`, `last_message_preview text`, `unread_count int DEFAULT 0`, `created_at`, `updated_at`; indice unico em `(account_id, phone)`
- [ ] Tabela `zapi_messages` existe com colunas: `id uuid PK`, `account_id uuid REFERENCES zapi_accounts`, `chat_id uuid REFERENCES zapi_chats`, `message_id text NOT NULL` (ID da Z-API), `direction text CHECK IN ('inbound','outbound')`, `body text`, `status text DEFAULT 'sent' CHECK IN ('sent','delivered','read','error')`, `sent_at timestamptz`, `created_at`; indice unico em `(message_id, account_id)` para idempotencia
- [ ] Tabela `zapi_webhook_log` existe com colunas: `id uuid PK`, `account_id uuid REFERENCES zapi_accounts NULLABLE` (nullable para eventos de conta nao reconhecida), `event_type text`, `payload jsonb`, `processing_status text DEFAULT 'processed' CHECK IN ('processed','error')`, `error_detail text NULLABLE`, `received_at timestamptz DEFAULT now()`
- [ ] RLS habilitado em todas as 5 tabelas
- [ ] Policy `zapi_accounts`: SELECT/INSERT/UPDATE/DELETE para `auth.uid() IS NOT NULL` (qualquer usuario autenticado pode ver contas — senha extra protege o conteudo das conversas; admin e a unica com poder de INSERT/UPDATE/DELETE via check de role)
- [ ] Policy `zapi_chats`, `zapi_messages`: SELECT para `auth.uid() IS NOT NULL`; INSERT/UPDATE via service_role apenas (Edge Functions)
- [ ] Policy `zapi_webhook_log`: SELECT para `auth.uid() IS NOT NULL`; INSERT via service_role apenas
- [ ] Policy `zapi_panel_passwords`: SELECT/INSERT/UPDATE para `has_role(auth.uid(), 'admin')` apenas
- [ ] Trigger `update_updated_at_column` aplicado em `zapi_accounts`, `zapi_chats`
- [ ] Indices: `idx_zapi_messages_chat_id`, `idx_zapi_messages_sent_at`, `idx_zapi_chats_account_id`, `idx_zapi_webhook_log_account_id`, `idx_zapi_webhook_log_received_at`
- [ ] Comments autodoc em cada tabela e coluna sensivel (padrao migration 042)
- [ ] `npx supabase db push` aplica sem erro no remoto

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `supabase/migrations/043_zapi_whatsapp.sql`
- **Padrao RLS:** ver `001_complete_schema.sql` — `has_role()` + `is_user_active()` ja existem
- **Gen secret:** `DEFAULT encode(gen_random_bytes(16), 'hex')` — requer extensao `pgcrypto` (verificar se ja esta habilitada; se nao, adicionar `CREATE EXTENSION IF NOT EXISTS pgcrypto;` no topo)
- **Idempotencia:** `CREATE UNIQUE INDEX IF NOT EXISTS idx_zapi_messages_idempotency ON zapi_messages(message_id, account_id)` — a EF usa `INSERT ... ON CONFLICT (message_id, account_id) DO NOTHING`

#### Test cases

- **Happy path:** `npx supabase db push` + query `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'zapi_%'` retorna 5 tabelas
- **Edge — RLS bloqueio:** usuario anonimo nao consegue SELECT em `zapi_accounts`
- **Edge — idempotencia:** dois INSERTs com mesmo `message_id + account_id` resultam em 1 linha (segundo e ignorado)
- **Edge — policy admin:** usuario com role `user` nao consegue INSERT em `zapi_panel_passwords`

#### Definition of Done

- [ ] Migration aplica sem erro (`npx supabase db push`)
- [ ] Todas as tabelas e indices criados
- [ ] RLS policies testadas manualmente com diferentes roles
- [ ] Comments autodoc presentes
- [ ] Security agent validou policies e colunas sensiveis
- [ ] Typecheck OK (nao ha tipos gerados ainda — integrations/supabase/types.ts sera gerado via `supabase gen types`)
- [ ] QA aprovou

#### Out of scope

- Criptografia AES aplicada nesta migration (responsabilidade da Edge Function)
- Tabelas de midia (entregas futuras)
- pg_cron purge (T18 separado)

---

### T02 — Edge Function `zapi-webhook`: receber, validar e persistir eventos Z-API

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route, model
**Depende de:** T01
**Dispara Security:** SIM (webhook receiver publico, validacao HMAC, insercao de dados externos)
**Dispara Pentest:** SIM (Edge Function publica sem JWT Supabase + webhook receiver com payload externo)
**WSJF score:** (9 + 9 + 9) / 8 = 3.37 — critico para recepcao de mensagens

#### User story

Como Rodrigo (admin), quero que eventos de webhook da Z-API sejam recebidos, validados por HMAC e persistidos automaticamente, para que nenhuma mensagem ou mudanca de status seja perdida silenciosamente.

#### Contexto

Edge Function publica (sem `verify_jwt: true`) pois a Z-API nao envia Authorization header do Supabase. A autenticacao e feita via `webhook_secret` da conta: a Z-API deve ser configurada para passar o segredo como query param `?account=<uuid>` e o sistema valida consultando `zapi_accounts.webhook_secret`. Pattern de HMAC: mesma funcao `hmacVerify` ja existente em `google-auth/index.ts`. Deve tratar 3 tipos de evento Z-API: `message-received` (nova mensagem inbound), `message-status` (update de status: delivered/read/error), `disconnected` (conta desconectada). Idempotencia via `ON CONFLICT (message_id, account_id) DO NOTHING`. Payload de midia (base64) deve ser ignorado/truncado — nao persistir. Toda chamada (sucesso ou erro) gera um registro em `zapi_webhook_log`.

#### Criterios de aceite

- [ ] POST para `https://<projeto>.functions.supabase.co/zapi-webhook?account=<uuid>` retorna 200 para payload valido com `webhook_secret` correto
- [ ] Evento `message-received` com `messageId` novo persiste 1 linha em `zapi_messages` (direction=inbound) e upsert em `zapi_chats` (atualiza `last_message_at`, `last_message_preview`)
- [ ] Evento `message-received` com `messageId` duplicado e ignorado (retorna 200, nenhuma linha duplicada em `zapi_messages`)
- [ ] Evento `message-status` atualiza o campo `status` da linha correspondente em `zapi_messages` (busca por `message_id + account_id`)
- [ ] Evento `disconnected` atualiza `zapi_accounts.status = 'disconnected'`
- [ ] Payload com campo `media` ou `audio` tem esse campo removido antes da persistencia (nao armazena base64)
- [ ] Request sem query param `account` retorna 400
- [ ] Request com `account` UUID invalido (nao encontrado) retorna 401 e registra log com `processing_status = 'error'`
- [ ] Todo evento processado (sucesso ou erro) gera 1 linha em `zapi_webhook_log` com `event_type`, `payload` (sem base64), `processing_status`, `error_detail`
- [ ] Funcao usa `service_role` para insercoes (bypass RLS)

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `supabase/functions/zapi-webhook/index.ts`
- **Padrao boilerplate:** ver `google-auth/index.ts` — corsHeaders, jsonResponse, hmacSign/hmacVerify
- **Autenticacao:** `const url = new URL(req.url); const accountId = url.searchParams.get('account');` — busca `zapi_accounts` pelo UUID + valida `webhook_secret` do payload Z-API (header `x-client-token` ou body field — verificar doc Z-API)
- **Idempotencia:** `supabase.from('zapi_messages').insert({...}).onConflict('message_id, account_id').ignore()`
- **Truncar media:** `const { media, audio, ...safePayload } = rawPayload` antes de persistir no log

#### Test cases

- **Happy path:** POST com payload `message-received` valido → 200 + 1 linha em `zapi_messages` + 1 linha em `zapi_webhook_log` com status `processed`
- **Edge — duplicado:** mesmo POST duas vezes → 200 nos dois, mas apenas 1 linha em `zapi_messages`
- **Edge — assinatura invalida:** POST com `account` errado → 401 + log com `error`
- **Edge — status update:** POST com `message-status` para messageId existente → status atualizado na linha
- **Edge — payload com media:** POST com `media: "base64..."` → campo nao persiste no banco
- **Edge — conta desconectada:** POST `disconnected` → `zapi_accounts.status = 'disconnected'`

#### Definition of Done

- [ ] EF deployada (`npx supabase functions deploy zapi-webhook`)
- [ ] `supabase/functions/zapi-webhook/index.ts` sem erros de TypeScript
- [ ] Todos os tipos de evento tratados
- [ ] Idempotencia validada com teste manual de payload duplicado
- [ ] Security agent validou ausencia de JWT + validacao HMAC + truncagem de base64
- [ ] Pentest agent validou (webhook receiver publico = gatilho obrigatorio)
- [ ] QA aprovou

#### Out of scope

- Eventos de midia (envio de imagem, audio — entregas futuras)
- Notificacoes push ao receber mensagem
- Reprocessamento de eventos com erro

---

### T03 — Edge Function `zapi-validate-panel-password`: bcrypt + session token

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route, action
**Depende de:** T01
**Dispara Security:** SIM (auth com bcrypt, emissao de session token)
**Dispara Pentest:** SIM (auth/password flow, rate limit)
**WSJF score:** (8 + 8 + 9) / 5 = 5.0 — alto risco de seguranca, prioridade maxima entre M

#### User story

Como atendente, quero inserir a senha extra do painel e receber um token de sessao valido por 30 minutos, para acessar as conversas sem redigitar a senha em cada interacao.

#### Contexto

Edge Function privada (com JWT Supabase — o usuario ja esta logado no Mandato Desk). Recebe `{ account_id, password }` via POST com `Authorization: Bearer <supabase_jwt>`. Valida o JWT, busca o hash bcrypt em `zapi_panel_passwords` para aquela conta, compara com a senha enviada. Se valida: emite um session token (HMAC-SHA256 sobre `userId:accountId:expiresAt` com `SUPABASE_JWT_SECRET`) com TTL de 30 minutos. O frontend armazena esse token em memoria (sessionStorage, nao localStorage). Rate limit de 5 tentativas em 60 segundos por `(user_id, account_id)` — implementado via contador em memoria da EF (stateless; para producao com escala, usar tabela de rate_limit ou Upstash Redis — documentar como limitacao do MVP).

#### Criterios de aceite

- [ ] POST com senha correta retorna `{ token: "<signed_token>", expires_at: "<iso_string>" }` e status 200
- [ ] POST com senha incorreta retorna 401 com `{ error: "Senha incorreta" }`
- [ ] Apos 5 tentativas incorretas em 60s o endpoint retorna 429 com `{ error: "Muitas tentativas. Aguarde 60 segundos.", retry_after: 60 }`
- [ ] Token gerado expira em 30 minutos (campo `expires_at` no payload)
- [ ] Senha nao e logada em nenhum `console.log` ou campo de resposta
- [ ] JWT Supabase e validado antes de qualquer operacao (`verify_jwt: true` no config ou validacao manual)
- [ ] Conta sem senha cadastrada retorna 404 `{ error: "Painel nao configurado" }`

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `supabase/functions/zapi-validate-panel-password/index.ts`
- **bcrypt:** usar `https://deno.land/x/bcrypt@v0.4.1/mod.ts` — `bcrypt.compare(password, hash)`
- **HMAC session token:** `hmacSign(`${userId}:${accountId}:${expiresAt}`, jwtSecret)` — mesmo pattern do google-auth
- **Rate limit MVP:** Map em memoria `const attempts = new Map<string, {count: number, resetAt: number}>()` — documentar limitacao de reset em cold start
- **Config:** `supabase/functions/zapi-validate-panel-password/config.toml` com `verify_jwt = true`

#### Test cases

- **Happy path:** POST com senha correta → 200 + token com expires_at em ~30min
- **Edge — senha errada:** POST com senha errada → 401
- **Edge — rate limit:** 5 POSTs errados em sequencia → 6o retorna 429
- **Edge — conta sem senha:** POST para account_id sem registro em `zapi_panel_passwords` → 404
- **Edge — JWT invalido:** POST sem Authorization header → 401

#### Definition of Done

- [ ] EF deployada
- [ ] bcrypt compare funcionando
- [ ] Rate limit implementado e testado manualmente
- [ ] Token expira em 30min (validado pelo hook T06)
- [ ] Security agent validou (auth flow + rate limit + bcrypt)
- [ ] Pentest agent validou (password endpoint = gatilho)
- [ ] QA aprovou

#### Out of scope

- Reset de senha extra (feito via T11 — aba Contas, CRUD admin)
- Rate limit distribuido (Redis/banco) — documentado como limitacao MVP
- "Lembrar nesta sessao" / localStorage — decisao trancada: NAO no MVP

---

### T04 — Edge Function `zapi-send-text`: enviar mensagem de texto via Z-API

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route, action
**Depende de:** T01
**Dispara Security:** SIM (acessa credenciais criptografadas, faz chamada externa)
**Dispara Pentest:** NAO (nao e webhook receiver nem auth endpoint)
**WSJF score:** (8 + 7 + 6) / 5 = 4.2

#### User story

Como atendente, quero enviar uma mensagem de texto para o numero da conversa selecionada, para responder ao eleitor diretamente do Mandato Desk.

#### Contexto

Edge Function privada (JWT Supabase). Recebe `{ account_id, phone, body, panel_session_token }` via POST. Valida o JWT do Supabase e o `panel_session_token` (HMAC do T03). Descriptografa o `instance_token` e `client_token` da conta (AES-256-GCM — logica de decripto compartilhada com T02 via utilitario). Chama `POST https://api.z-api.io/instances/{instanceId}/token/{token}/send-text` com payload `{ phone, message }`. Trata HTTP 429 da Z-API: retorna erro claro para a UI sem retry automatico no MVP. Persiste a mensagem outbound em `zapi_messages` com `direction = 'outbound'` e `status = 'sent'` imediatamente apos o envio bem-sucedido.

#### Criterios de aceite

- [ ] POST com `account_id`, `phone`, `body` e `panel_session_token` valido retorna 200 + `{ message_id: "<zapi_message_id>" }` e persiste linha em `zapi_messages` com `direction='outbound'`, `status='sent'`
- [ ] `body` vazio ou somente espacos retorna 400 `{ error: "Mensagem nao pode ser vazia" }` sem chamar a Z-API
- [ ] Se conta Z-API esta desconectada (`zapi_accounts.status = 'disconnected'`), retorna 422 `{ error: "Conta desconectada" }` sem chamar a Z-API
- [ ] HTTP 429 da Z-API resulta em 429 para o frontend com `{ error: "Limite de envio atingido. Aguarde antes de tentar novamente." }`
- [ ] `panel_session_token` invalido ou expirado retorna 401
- [ ] Token Z-API (`instance_token`) nao aparece em nenhum log ou resposta

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `supabase/functions/zapi-send-text/index.ts`
- **Z-API endpoint:** `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text` (metodo POST, body JSON `{ phone, message }`)
- **Decripto AES:** extrair logica de cripto/decripto para `supabase/functions/_shared/crypto.ts` — importado tanto em `zapi-webhook` quanto em `zapi-send-text`
- **Validacao session token:** replicar a logica de `hmacVerify` com `expiresAt` do payload

#### Test cases

- **Happy path:** POST valido → 200 + linha em `zapi_messages` com direction=outbound
- **Edge — body vazio:** POST com `body: "   "` → 400
- **Edge — conta desconectada:** POST para conta com status disconnected → 422
- **Edge — 429 Z-API:** Z-API retorna 429 → frontend recebe 429 com mensagem clara
- **Edge — session expirado:** POST com token expirado → 401

#### Definition of Done

- [ ] EF deployada
- [ ] Envio real testado com instancia Z-API de homologacao
- [ ] Mensagem outbound persiste no banco
- [ ] Tratamento de 429 validado
- [ ] Security agent validou (decripto de tokens + chamada externa)
- [ ] QA aprovou

#### Out of scope

- Envio de midia, audio, arquivo, figurinha
- Retry automatico em caso de 429
- Preview de link (link unfurling)

---

### T05 — Hook `useZapiAccounts`: CRUD com react-query

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** action, hook
**Depende de:** T01
**Dispara Security:** NAO (leitura de dados proprios, criptografia feita na EF)
**Dispara Pentest:** NAO
**WSJF score:** (7 + 7 + 5) / 5 = 3.8

#### User story

Como Rodrigo (admin), quero criar, editar e excluir contas Z-API pelo sistema, para gerenciar as instancias sem precisar de intervencao tecnica.

#### Contexto

Pattern identico a `useWebhooks.ts` — queryKey factory, listQuery, createMutation, updateMutation, deleteMutation. O hook NAO expoe `instance_token` nem `client_token` diretamente (a query faz SELECT de todos os campos, mas o componente deve exibir apenas `name`, `status`, `instance_id` — tokens chegam ofuscados no banco via decripto na EF, mas a view do hook deve filtrar para seguranca). A criacao de conta chama uma Edge Function de setup (ou insere via supabase client com service_role — definir na implementacao: a EF de cripto pode ser acionada no insert). Reset de senha extra: mutation separada `useResetZapiPanelPassword`.

#### Criterios de aceite

- [ ] `useZapiAccounts()` retorna lista de contas com `{ id, name, status, instance_id (parcial), created_at }`; tokens NAO retornados ao frontend
- [ ] `useCreateZapiAccount()` aceita `{ name, instance_id, instance_token, client_token, panel_password }`, criptografa tokens e persiste; em sucesso invalida queryKey e exibe toast
- [ ] `useUpdateZapiAccount()` aceita campos editaveis (name, instance_id, tokens opcicionais); em sucesso invalida e toast
- [ ] `useDeleteZapiAccount()` deleta a conta (logs permanecem com `account_id` orphan — sem cascade); confirma com toast
- [ ] `useResetZapiPanelPassword()` aceita `{ account_id, new_password }`, chama EF ou RPC para gerar hash bcrypt e atualizar `zapi_panel_passwords`
- [ ] Todos os erros Supabase exibem toast de erro legivel (padrao `useWebhooks.ts`)
- [ ] queryKey: `['zapi-accounts']`

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `src/hooks/useZapiAccounts.ts`
- **Padrao:** `useWebhooks.ts` — mesma estrutura de queryKey factory + useMutation com onSuccess/onError
- **Cripto no insert:** a criptografia AES pode ser feita via Edge Function dedicada `zapi-upsert-account` (recebe credenciais em texto, criptografa, insere via service_role) ou via RPC SECURITY DEFINER — Fullstack decide qual abordagem e mais limpa; sugestao: EF para manter logica de cripto centralizada fora do frontend

#### Test cases

- **Happy path:** criar conta → aparece na lista sem tokens visiveis
- **Edge — delete:** excluir conta com logs → conta some, logs permanecem com account_id preservado
- **Edge — token nao exposto:** inspecionar resposta da query — campos `instance_token`, `client_token` retornam `****` ou null (nunca em claro)
- **Edge — reset senha:** chamar reset → bcrypt hash atualizado em `zapi_panel_passwords`

#### Definition of Done

- [ ] Hook exportado de `src/hooks/useZapiAccounts.ts`
- [ ] Todos os mutations com toast de sucesso/erro
- [ ] Tokens nunca expostos no frontend
- [ ] Typecheck OK
- [ ] QA aprovou (via T11 que consume o hook)

#### Out of scope

- Paginacao de contas (MVP tem maximo 2 — lista simples)
- Filtros de busca

---

### T06 — Hook `useZapiPanelSession`: senha extra + TTL 30min + rate limit frontend

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** action, hook
**Depende de:** T03
**Dispara Security:** NAO (logica de seguranca real esta na EF T03)
**Dispara Pentest:** NAO
**WSJF score:** (8 + 7 + 6) / 2 = 10.5 — estimativa pequena, valor alto

#### User story

Como atendente, quero que apos inserir a senha extra eu nao precise redigita-la por 30 minutos, para trabalhar sem interrupcao durante o atendimento.

#### Contexto

Hook de estado local que gerencia o session token emitido pela EF T03. Armazena o token em `sessionStorage` (nao `localStorage` — expira ao fechar a aba, conforme decisao do PO). Expoe: `validatePassword(account_id, password)` (chama EF T03), `isSessionValid(account_id)` (verifica expiry do token), `clearSession(account_id)`. Tambem gerencia o estado de tentativas no frontend (conta tentativas, exibe mensagem de espera se EF retornar 429 — o rate limit real esta na EF, o frontend apenas exibe o `retry_after`).

#### Criterios de aceite

- [ ] `validatePassword(accountId, password)` chama EF T03, armazena token com expires_at em sessionStorage se 200; retorna `true`
- [ ] `validatePassword` com senha errada (401 da EF) retorna `false` e incrementa contador local de tentativas
- [ ] `validatePassword` quando EF retorna 429 expoe `{ blocked: true, retryAfter: 60 }` para o componente exibir mensagem de bloqueio
- [ ] `isSessionValid(accountId)` retorna `true` se token em sessionStorage nao expirou
- [ ] `clearSession(accountId)` remove token do sessionStorage
- [ ] Token NUNCA persiste em localStorage

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `src/hooks/useZapiPanelSession.ts`
- **Storage:** `sessionStorage.setItem('zapi_session_<accountId>', JSON.stringify({ token, expires_at }))` — prefixo por conta permite multiplas contas simultaneas
- **Expiry check:** `new Date(session.expires_at) > new Date()`

#### Test cases

- **Happy path:** validar senha correta → isSessionValid retorna true por 30min
- **Edge — expirado:** manipular expires_at para o passado → isSessionValid retorna false
- **Edge — rate limit:** EF retorna 429 → hook expoe `blocked: true` com retryAfter
- **Edge — aba fechada:** abrir nova aba → sessionStorage vazio → isSessionValid retorna false

#### Definition of Done

- [ ] Hook em `src/hooks/useZapiPanelSession.ts`
- [ ] Typecheck OK
- [ ] Testado via T13 (modal de senha consome o hook)
- [ ] QA aprovou

#### Out of scope

- Persistencia em localStorage
- "Lembrar por X dias"
- Renovacao automatica de token antes do expiry

---

### T07 — Hooks `useZapiChats` e `useZapiMessages` com Supabase Realtime

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** action, hook
**Depende de:** T01
**Dispara Security:** NAO (leitura de dados, RLS ja garante acesso)
**Dispara Pentest:** NAO
**WSJF score:** (9 + 8 + 7) / 8 = 3.0 — bloqueador da tela de conversas

#### User story

Como atendente, quero que a lista de conversas e as mensagens atualizem em tempo real sem recarregar a pagina, para saber imediatamente quando um novo eleitor ou mensagem chega.

#### Contexto

Dois hooks: `useZapiChats(accountId)` e `useZapiMessages(chatId)`. Ambos usam `useQuery` para carga inicial e `supabase.channel()` para Realtime subscriptions (INSERT/UPDATE). Pattern de Realtime: ao receber evento, invalidar a queryKey correspondente via `queryClient.invalidateQueries()`. `useZapiChats` ordena por `last_message_at DESC`. `useZapiMessages` ordena por `sent_at ASC` (ordem cronologica). A subscription deve ser removida no cleanup do useEffect (evitar vazamento de conexao).

#### Criterios de aceite

- [ ] `useZapiChats(accountId)` retorna lista de chats ordenada por `last_message_at DESC`
- [ ] Novo chat (nova mensagem inbound de numero novo) aparece na lista em menos de 5 segundos apos o webhook T02 persistir
- [ ] `useZapiMessages(chatId)` retorna mensagens em ordem cronologica ascendente
- [ ] Nova mensagem em chat aberto aparece no fim da lista em menos de 5 segundos
- [ ] Update de status de mensagem (delivered/read) atualiza o registro em menos de 5 segundos
- [ ] Subscription e removida quando o componente desmonta (sem vazamento)
- [ ] Quando `accountId` e undefined (sem conta selecionada), hook retorna lista vazia sem erro
- [ ] queryKeys: `['zapi-chats', accountId]` e `['zapi-messages', chatId]`

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `src/hooks/useZapiChats.ts` e `src/hooks/useZapiMessages.ts` (ou arquivo unico `useZapi.ts`)
- **Realtime pattern:**
  ```ts
  useEffect(() => {
    const channel = supabase.channel('zapi-messages-<chatId>')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zapi_messages', filter: `chat_id=eq.${chatId}` },
        () => queryClient.invalidateQueries({ queryKey: ['zapi-messages', chatId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId]);
  ```
- **Realtime Supabase:** requer `SUPABASE_REALTIME_ENABLED=true` e tabela na publication. Adicionar `zapi_messages` e `zapi_chats` a publicacao Realtime (via SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE zapi_messages, zapi_chats`) — pode ser parte da migration T01 ou migration complementar.

#### Test cases

- **Happy path:** webhook T02 insere mensagem → hook invalida → componente re-renderiza com nova mensagem em <5s
- **Edge — sem conta selecionada:** hook com `accountId=undefined` → `enabled: false` → sem query
- **Edge — desmonta:** componente desmontado → channel removido (sem erro no console)
- **Edge — lista vazia:** conta nova sem mensagens → array vazio, sem erro

#### Definition of Done

- [ ] Hooks em `src/hooks/useZapiChats.ts` e `src/hooks/useZapiMessages.ts`
- [ ] Realtime funcionando (testado com webhook real ou simulado via insert direto)
- [ ] Subscriptions limpas no desmonte
- [ ] Tabelas na publicacao Realtime
- [ ] Typecheck OK
- [ ] QA aprovou

#### Out of scope

- Polling como fallback de Realtime (documentado como melhoria futura se latencia > 5s)
- Paginacao de mensagens (MVP: load all para chat — limite pratico de 90 dias de historico)
- Indicador de digitacao ("typing...")

---

### T08 — Hook `useZapiWebhookLogs`: query paginada com filtros

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** action, hook
**Depende de:** T01
**Dispara Security:** NAO
**Dispara Pentest:** NAO
**WSJF score:** (6 + 5 + 4) / 2 = 7.5

#### User story

Como Rodrigo (admin), quero ver todos os eventos de webhook filtrados por conta e tipo de evento, para diagnosticar perdas de mensagem ou erros de entrega.

#### Contexto

Hook simples de listagem paginada. Aceita filtros opcionais `{ account_id?, event_type? }` e paginacao por `page` (50 por pagina). Retorna `{ data, count, page, hasMore }`. Sem Realtime (logs sao append-only; refresh manual e suficiente para auditoria). Pattern: identico a `useWebhookLogs` em `useWebhooks.ts`.

#### Criterios de aceite

- [ ] `useZapiWebhookLogs({ account_id, event_type, page })` retorna 50 registros por pagina ordenados por `received_at DESC`
- [ ] Filtro por `account_id` retorna somente logs daquela conta
- [ ] Filtro por `event_type` retorna somente logs daquele tipo
- [ ] `count` total retornado para calcular numero de paginas
- [ ] queryKey: `['zapi-webhook-logs', { account_id, event_type, page }]`

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `src/hooks/useZapiWebhookLogs.ts`
- **Supabase pagination:** `.range(page * 50, (page + 1) * 50 - 1)` + `{ count: 'exact' }`

#### Test cases

- **Happy path:** 150 logs → pagina 0 retorna 50, pagina 1 retorna 50, pagina 2 retorna 50
- **Edge — filtro conta:** filtrar por account_id → somente logs daquela conta
- **Edge — zero logs:** conta sem eventos → array vazio, count=0

#### Definition of Done

- [ ] Hook em `src/hooks/useZapiWebhookLogs.ts`
- [ ] Paginacao funcionando
- [ ] Filtros funcionando
- [ ] QA aprovou (via T14)

#### Out of scope

- Realtime na aba de Logs
- Export de logs para CSV

---

### T09 — Vinculacao chat-contato via `normalize_phone()`

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** model, action
**Depende de:** T01
**Dispara Security:** NAO
**Dispara Pentest:** NAO
**WSJF score:** (7 + 6 + 5) / 2 = 9.0

#### User story

Como atendente, quero ver o nome do contato CRM vinculado a cada conversa (quando o numero bate), para identificar rapidamente quem e o eleitor sem precisar buscar manualmente.

#### Contexto

Ao persistir uma nova mensagem inbound (dentro do webhook T02), a EF deve tentar fazer matching do `phone` do chat com `contacts.whatsapp` usando `normalize_phone()`. Se encontrar, preenche `zapi_chats.contact_id` com o UUID do contato. O matching deve usar apenas digitos (ja e o comportamento de `normalize_phone` existente na migration 001). Esta logica pode ser uma funcao SQL auxiliar chamada pela EF, ou um UPDATE disparado por trigger apos INSERT em `zapi_chats`. Decisao de implementacao: trigger e mais simples e nao exige mudanca na EF T02.

#### Criterios de aceite

- [ ] Apos INSERT em `zapi_chats` com `phone = '+5511999990000'`, se existir contato com `normalize_phone(whatsapp) = '5511999990000'`, o campo `contact_id` e preenchido automaticamente
- [ ] Numeros sem codigo de pais (ex: `'11999990000'`) tambem fazem match se o contato tiver `whatsapp = '+5511999990000'` (ambos normalizam para mesmos digitos)
- [ ] Numero que nao bate com nenhum contato: `contact_id` permanece NULL (sem criar contato automaticamente)
- [ ] Query `SELECT COUNT(*) FROM zapi_chats WHERE contact_id IS NULL AND phone IN (SELECT normalize_phone(whatsapp) FROM contacts WHERE whatsapp IS NOT NULL)` retorna 0 (metrica M4 do PO)
- [ ] Trigger e executado tanto em INSERT quanto em UPDATE de `zapi_chats.phone`

#### Hints tecnicos (nao-prescritivos)

- **Opcao A (trigger):** `CREATE FUNCTION match_zapi_chat_contact() RETURNS TRIGGER AS $$ BEGIN NEW.contact_id = (SELECT id FROM contacts WHERE normalize_phone(whatsapp) = normalize_phone(NEW.phone) LIMIT 1); RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER zapi_chats_match_contact BEFORE INSERT OR UPDATE ON zapi_chats FOR EACH ROW EXECUTE FUNCTION match_zapi_chat_contact();`
- **Arquivo migration:** pode ser migration separada `044_zapi_match_contact_trigger.sql` ou incluida em T01 se ainda nao foi aplicada
- **`normalize_phone()` ja existe** em migration 001 — nao recriar

#### Test cases

- **Happy path:** insert em `zapi_chats` com phone de contato existente → `contact_id` preenchido
- **Edge — numero sem +55:** phone `'11999990000'` vs contato `'+5511999990000'` → match (ambos normalizam para `'11999990000'` e `'5511999990000'` — verificar se sufixo de 8+ digitos bate; ajustar funcao de matching se necessario)
- **Edge — numero desconhecido:** phone sem contato → `contact_id = NULL`
- **Edge — contato atualiza whatsapp:** UPDATE no contato → chat nao atualiza automaticamente (aceitavel no MVP — vinculacao e best-effort no momento do recebimento)

#### Definition of Done

- [ ] Trigger criado e aplicado no banco
- [ ] Metrica M4 validada por query direta
- [ ] QA aprovou (via T17 que exibe o nome do contato)

#### Out of scope

- Re-matching retroativo de chats existentes quando contato e cadastrado depois
- Criar contato a partir da conversa

---

### T10 — Page `/integracoes/whatsapp`: esqueleto com 4 tabs + item de menu no Sidebar

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** —
**Dispara Security:** NAO
**Dispara Pentest:** NAO
**WSJF score:** (7 + 7 + 3) / 2 = 8.5

#### User story

Como qualquer usuario autenticado, quero acessar o modulo WhatsApp pelo menu lateral, para navegar ate as subabas de Contas, Conversas, Webhooks e Logs.

#### Contexto

Cria a estrutura de roteamento e o esqueleto visual da pagina. Nao inclui conteudo das abas (isso e T11-T14). Segue o padrao de `GoogleIntegration.tsx` (PageHeader com `eyebrow`, `title`, `description`, `icon`, `iconVariant`). Adiciona item "WhatsApp" no `AppSidebar.tsx` na area de Integracoes (apos o ultimo item existente, com separador visual `dividerBefore: true` se for o primeiro item de uma nova secao). Adiciona rota `/integracoes/whatsapp` em `App.tsx`. Adiciona `'whatsapp'` no tipo `Secao` em `src/types/permissions.ts` e no mapeamento `SECAO_TO_PERMISSION` como `can.accessWhatsapp()` (ou fallback `() => true` no MVP — qualquer usuario autenticado ve o menu).

#### Criterios de aceite

- [ ] Item "WhatsApp" aparece no sidebar para qualquer usuario autenticado
- [ ] Clicar no item navega para `/integracoes/whatsapp`
- [ ] A page renderiza `PageHeader` com titulo "WhatsApp", eyebrow "Integracoes", icone `MessageCircle` (lucide-react)
- [ ] 4 tabs renderizadas: "Contas", "Conversas", "Webhooks", "Logs" (conteudo pode ser placeholder `<p>Em construcao</p>` nesta task)
- [ ] URL da aba ativa reflete via query param `?tab=contas` (ou via estado local — Fullstack decide)
- [ ] Rota `/integracoes/whatsapp` protegida por `<ProtectedRoute>`
- [ ] Typecheck OK e build sem erro

#### Hints tecnicos (nao-prescritivos)

- **Arquivo page:** `src/pages/WhatsApp.tsx`
- **Arquivo sidebar:** editar `src/components/layout/AppSidebar.tsx` — adicionar `{ label: 'WhatsApp', icon: MessageCircle, href: '/integracoes/whatsapp', secao: 'whatsapp' }`
- **Arquivo tipos:** editar `src/types/permissions.ts` — adicionar `'whatsapp'` ao array `SECOES`
- **Arquivo App.tsx:** adicionar `<Route path="/integracoes/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />`
- **Tabs:** `import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'`

#### Test cases

- **Happy path:** navegar para `/integracoes/whatsapp` → page renderiza com tabs visiveis
- **Edge — usuario nao autenticado:** acesso direto a URL → redireciona para /auth
- **Edge — sidebar recolhido:** item "WhatsApp" exibe apenas icone com tooltip

#### Definition of Done

- [ ] Page criada e rota registrada em App.tsx
- [ ] Item no sidebar funcionando
- [ ] Typecheck OK, build OK
- [ ] QA aprovou (layout visual conferido)

#### Out of scope

- Conteudo das abas (T11-T14)
- Permissao RBAC granular para o modulo WhatsApp

---

### T11 — Aba Contas: CRUD completo de contas Z-API + reset de senha extra

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** component, hook
**Depende de:** T05, T10
**Dispara Security:** NAO (hook T05 ja passa pelo Security agent)
**Dispara Pentest:** NAO
**WSJF score:** (8 + 7 + 5) / 8 = 2.5

#### User story

Como Rodrigo (admin), quero criar, editar, excluir e resetar a senha extra de contas Z-API pela interface, para gerenciar as instancias do gabinete sem intervencao tecnica.

#### Contexto

Sub-componente da aba "Contas" na page T10. Consome `useZapiAccounts` (T05). Layout: lista de cards, um por conta, com: nome, status badge (Configurado/Desconectado), Instance ID ofuscado (primeiros 4 chars + ****). Acoes por card (apenas visivel para admin): Editar, Excluir, Resetar Senha Extra. Botao "Adicionar Conta" no topo. Criar/Editar: modal (Dialog do shadcn/ui) com campos: Nome, Instance ID, Token, Client-Token, Senha Extra do Painel (com confirm). Token e Client-Token exibidos como `type="password"` com botao de mostrar. Resetar senha: Dialog de confirmacao separado, campo nova senha + confirmar. Excluir: AlertDialog de confirmacao. Para usuarios sem role admin: contas sao visiveis mas botoes de CRUD ficam ocultos.

#### Criterios de aceite

- [ ] Lista exibe contas com nome, status badge, Instance ID ofuscado
- [ ] Token e Client-Token nunca exibidos em texto puro na lista
- [ ] Botao "Adicionar Conta" (somente admin) abre Dialog com formulario valido por zod (nome min 1 char, instance_id min 1 char, token min 1 char, client_token min 1 char, senha_extra min 6 chars, confirmar_senha = senha_extra)
- [ ] Salvar cria conta → lista atualiza sem reload → toast "Conta criada com sucesso"
- [ ] Botao "Editar" (somente admin) abre Dialog pre-preenchido com campos editaveis (senha extra opcional na edicao — vazio = nao altera)
- [ ] Salvar edicao → lista atualiza → toast "Conta atualizada"
- [ ] Botao "Excluir" (somente admin) abre AlertDialog "Tem certeza? Esta acao nao pode ser desfeita." → confirmar → conta some → toast "Conta excluida"
- [ ] Botao "Resetar Senha Extra" (somente admin) abre Dialog com campo nova senha (min 6 chars) + confirmar → salvar → toast "Senha extra atualizada"
- [ ] Lista vazia exibe `EmptyState` do ui-system com instrucao "Nenhuma conta cadastrada. Clique em Adicionar Conta para comecar."
- [ ] Usuarios sem role admin veem a lista mas NAO veem os botoes de CRUD

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `src/components/whatsapp/AccountsTab.tsx`
- **Form:** `react-hook-form + zod` — padrao identico a formularios de Contatos
- **Dialog/AlertDialog:** `src/components/ui/dialog.tsx` e `src/components/ui/alert-dialog.tsx` — ja existem no shadcn
- **Status badge:** `<Badge variant="outline">` com cor via classe condicional (`text-green-600` para Configurado, `text-red-600` para Desconectado)
- **EmptyState:** `import { EmptyState } from '@/components/ui-system'`
- **Admin check:** `const { profile } = useAuth(); const isAdmin = profile?.role === 'admin';`

#### Test cases

- **Happy path:** admin cria conta → aparece na lista com status "Configurado"
- **Edge — validacao:** tentar salvar com senha < 6 chars → erro de validacao inline, botao Salvar desabilitado
- **Edge — nao-admin:** usuario sem role admin ve lista mas nao ve botoes de CRUD
- **Edge — excluir:** excluir conta → soma da lista; verificar banco que logs persistem
- **Edge — lista vazia:** sem contas → EmptyState exibido

#### Definition of Done

- [ ] Componente criado e integrado na aba Contas
- [ ] CRUD completo funcionando (criar, editar, excluir, resetar senha)
- [ ] Validacao zod em todos os formularios
- [ ] Admin-only enforced na UI
- [ ] Typecheck OK, build OK
- [ ] QA aprovou

#### Out of scope

- Status de conexao em tempo real (Realtime na conta — MVP exibe status salvo no banco)
- Visualizar logs de uma conta especifica a partir desta aba
- Importacao de contas em lote

---

### T12 — Aba Webhooks: URL por conta + segredo (copiar/mostrar)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T05, T10
**Dispara Security:** NAO
**Dispara Pentest:** NAO
**WSJF score:** (8 + 8 + 4) / 2 = 10.0 — alto valor de configuracao, estimativa pequena

#### User story

Como Rodrigo (admin), quero copiar a URL de webhook e o segredo de validacao de cada conta Z-API, para configurar o endpoint no painel da Z-API sem precisar de ajuda tecnica.

#### Contexto

Sub-componente da aba "Webhooks". Consome `useZapiAccounts` (T05). Exibe, para cada conta cadastrada: a URL de webhook no formato `https://<projeto>.functions.supabase.co/functions/v1/zapi-webhook?account=<uuid>` e o `webhook_secret` ofuscado com botao "Mostrar" + botao "Copiar URL" + botao "Copiar Segredo". Clicar em "Copiar" usa `navigator.clipboard.writeText()` e exibe toast "URL copiada!" (3 segundos). O segredo e exibido como `****...****` por padrao; ao clicar em "Mostrar", revela em texto claro com botao "Ocultar".

#### Criterios de aceite

- [ ] Para cada conta, exibe nome da conta, URL de webhook completa (texto claro — nao e segredo), segredo ofuscado
- [ ] Botao "Copiar URL" copia a URL e exibe toast "URL copiada!"
- [ ] Botao "Mostrar" revela o segredo; botao "Ocultar" o reesconde
- [ ] Botao "Copiar Segredo" copia o hex do segredo e exibe toast "Segredo copiado!"
- [ ] A URL inclui o `account_id` UUID correto para cada conta
- [ ] Sem contas cadastradas: exibe instrucao "Cadastre uma conta na aba Contas para ver o webhook."

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `src/components/whatsapp/WebhooksTab.tsx`
- **URL template:** `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-webhook?account=${account.id}`
- **Clipboard:** `await navigator.clipboard.writeText(url); toast.success('URL copiada!');`
- **Segredo:** buscar `webhook_secret` de `zapi_accounts` — a query do hook T05 precisa incluir esse campo (apenas para admin, ou sempre — definir se campo e exposto pelo RLS)

#### Test cases

- **Happy path:** conta cadastrada → URL correta exibida → copiar → toast aparece
- **Edge — sem contas:** aba sem contas → instrucao exibida
- **Edge — botao Mostrar:** clicar em Mostrar → segredo revelado; Ocultar → reescondido

#### Definition of Done

- [ ] Componente criado e integrado na aba Webhooks
- [ ] Clipboard funcionando
- [ ] Toasts funcionando
- [ ] QA aprovou

#### Out of scope

- Reger o segredo (gerar novo webhook_secret — entrega futura)
- Testar o webhook diretamente da UI

---

### T13 — Aba Conversas: modal senha extra + layout 3 colunas + lista chats + conversa + envio

**Tipo:** feature
**Estimativa:** XL (13pt)
**Camadas afetadas:** component, hook
**Depende de:** T03, T04, T06, T07, T10
**Dispara Security:** NAO (EFs ja passaram pelo Security)
**Dispara Pentest:** NAO
**WSJF score:** (9 + 9 + 7) / 13 = 1.9 — maior task, maior valor, executar apos blockers

#### User story

Como atendente, quero ver e responder mensagens de WhatsApp diretamente no Mandato Desk em interface familiar tipo WhatsApp Web, para atender eleitores sem alternar entre celular e sistema.

#### Contexto

Sub-componente mais complexo do modulo. Fluxo em 2 etapas: (1) selecionar conta → modal de senha extra → (2) abre layout 3 colunas: painel esquerdo (lista de contas disponiveis), coluna central (lista de chats da conta selecionada), coluna direita (conversa aberta com campo de envio). A senha extra e validada por `useZapiPanelSession` (T06) que chama EF T03. Apos validacao, chats carregados por `useZapiChats` (T07) e mensagens por `useZapiMessages` (T07). Envio por `useZapiSendText` que chama EF T04. Status de mensagem: icones visuais (T15 cuida do detalhe dos icones, mas o componente ja deve ter os slots). Conta desconectada: campo de envio desabilitado com aviso. Corpo vazio: botao Enviar desabilitado. O layout deve ser responsivo: em mobile, as 3 colunas colapsam em navegacao sequencial (lista contas → lista chats → conversa).

#### Criterios de aceite

- [ ] Ao clicar em uma conta na lista, se `isSessionValid(accountId)` e false, abre Modal com campo de senha extra
- [ ] Modal de senha: campo password (min 6 chars), botao "Entrar", mensagem de erro se senha incorreta
- [ ] Apos 5 tentativas erradas: modal exibe "Muitas tentativas. Aguarde 60 segundos." e campo desabilitado pelo tempo restante
- [ ] Apos validacao, modal fecha e lista de chats e exibida
- [ ] Lista de chats exibe: foto placeholder, nome do contato (se vinculado) ou numero bruto, preview da ultima mensagem, timestamp relativo (ex: "14:32" ou "ontem")
- [ ] Lista vazia de chats: `EmptyState` com "Nenhuma conversa ainda. Aguardando mensagens..."
- [ ] Selecionar chat abre a conversa na coluna direita
- [ ] Mensagens recebidas (inbound) a esquerda com fundo cinza; enviadas (outbound) a direita com fundo primary
- [ ] Campo de envio: `<textarea>` com `Enter` envia (sem Shift), `Shift+Enter` insere quebra de linha
- [ ] Enviar mensagem: aparece imediatamente como outbound "enviada"; EF T04 chamada em background
- [ ] Conta desconectada: campo de envio com `disabled` e aviso "Conta desconectada"
- [ ] Realtime: nova mensagem inbound aparece automaticamente sem reload

#### Hints tecnicos (nao-prescritivos)

- **Arquivo principal:** `src/components/whatsapp/ConversationsTab.tsx`
- **Sub-componentes:** `ChatList.tsx`, `ChatWindow.tsx`, `MessageBubble.tsx`, `PanelPasswordModal.tsx`
- **Layout 3 colunas:** `<div className="flex h-[calc(100vh-200px)]">` — altura fixa deduzindo header+tabs
- **Scroll automatico:** `useEffect` com `ref.current?.scrollIntoView({ behavior: 'smooth' })` ao adicionar mensagem
- **Envio otimista:** adicionar mensagem ao estado local antes da EF retornar (UX fluida)
- **Hook envio:** criar `useZapiSendText()` — mutation que chama EF T04 via `supabase.functions.invoke('zapi-send-text', { body: {...} })`

#### Test cases

- **Happy path:** senha correta → lista de chats → selecionar chat → ver mensagens → digitar + Enter → mensagem aparece
- **Edge — senha errada:** 3 tentativas erradas → mensagem de erro; 5 tentativas → bloqueio 60s
- **Edge — lista vazia:** conta sem chats → EmptyState exibido
- **Edge — conta desconectada:** campo de envio desabilitado + aviso
- **Edge — body vazio:** Enter com campo vazio → nenhuma requisicao feita
- **Edge — Realtime:** webhook T02 insere mensagem → aparece na tela em <5s sem reload

#### Definition of Done

- [ ] Modal de senha funcionando com rate limit
- [ ] Layout 3 colunas renderizado corretamente
- [ ] Envio de mensagem end-to-end (frontend → EF T04 → Z-API → webhook T02 → Realtime → UI)
- [ ] Realtime funcionando em campo de uso real
- [ ] Scroll automatico ao receber nova mensagem
- [ ] Typecheck OK, build OK
- [ ] QA aprovou (smoke test descrito: cadastrar conta → configurar webhook na Z-API → enviar mensagem de celular → ver na UI em <5s)

#### Out of scope

- Envio de midia, audio, arquivo
- Notificacao push/browser
- Busca dentro da conversa
- Marcar mensagem como lida manualmente

---

### T14 — Aba Logs: tabela paginada com filtros Conta e Tipo

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** component, hook
**Depende de:** T08, T10
**Dispara Security:** NAO
**Dispara Pentest:** NAO
**WSJF score:** (7 + 6 + 5) / 5 = 3.6

#### User story

Como Rodrigo (admin), quero ver o log de todos os eventos de webhook com filtros por conta e tipo de evento, para diagnosticar perdas de mensagem ou erros de processamento.

#### Contexto

Sub-componente da aba "Logs". Consome `useZapiWebhookLogs` (T08). Tabela com colunas: Conta (nome), Tipo de evento, Timestamp (formatado: "09/05/2026 14:32"), Status (badge: Processado/Erro), Payload (truncado em 200 chars com botao "Ver mais" que abre Dialog com payload completo formatado como JSON). Filtros: dropdown de Conta (lista de `zapi_accounts`) e dropdown de Tipo de evento (lista dos tipos conhecidos). Paginacao: botoes "Anterior" / "Proxima". Somente leitura — sem CRUD.

#### Criterios de aceite

- [ ] Tabela exibe colunas: Conta, Tipo, Timestamp, Status, Payload (truncado)
- [ ] Status "processado" exibe badge verde; "erro" exibe badge vermelho
- [ ] Filtro por Conta funciona (dropdown com lista de contas)
- [ ] Filtro por Tipo de evento funciona (dropdown com opcoes: message-received, message-status, disconnected, outro)
- [ ] Paginacao de 50 por pagina com botoes Anterior/Proxima e indicador "Pagina X de Y"
- [ ] Botao "Ver mais" em payload abre Dialog com JSON formatado (prettified)
- [ ] Sem logs: exibe `EmptyState` com "Nenhum evento recebido ainda."
- [ ] Todos podem ver os logs (nao somente admin — conforme PO: admin e quem mais usa esta aba, mas nao e restricao explicita)

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `src/components/whatsapp/LogsTab.tsx`
- **Tabela:** `<Table>` do shadcn/ui
- **JSON prettify:** `JSON.stringify(JSON.parse(payload), null, 2)` dentro do Dialog
- **Timestamp format:** `new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.received_at))`

#### Test cases

- **Happy path:** logs existentes → tabela exibida; filtrar por conta → somente logs daquela conta
- **Edge — payload grande:** payload >200 chars → truncado + botao "Ver mais"
- **Edge — zero logs:** sem eventos → EmptyState
- **Edge — status erro:** log com `processing_status = 'error'` → badge vermelho

#### Definition of Done

- [ ] Componente criado e integrado na aba Logs
- [ ] Filtros e paginacao funcionando
- [ ] Dialog de payload funcionando
- [ ] QA aprovou

#### Out of scope

- Export de logs para CSV
- Reprocessar evento com erro
- Busca por texto no payload

---

### T15 — Status visual de mensagem: icones de entrega + atualizacao Realtime

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T07, T13
**Dispara Security:** NAO
**Dispara Pentest:** NAO
**WSJF score:** (7 + 6 + 4) / 2 = 8.5

#### User story

Como atendente, quero ver o status de cada mensagem enviada (1 check = enviada, 2 checks cinzas = entregue, 2 checks azuis = lida, X vermelho = erro), para saber se o eleitor recebeu e leu minha resposta.

#### Contexto

Sub-componente `MessageStatus` do `MessageBubble.tsx` (T13). O status e lido diretamente de `zapi_messages.status`. Quando o webhook T02 recebe um `message-status` event e atualiza o banco, o Realtime do T07 invalida a query e o icone atualiza automaticamente. Os icones usam lucide-react: `Check` (1 check enviada), `CheckCheck` (2 checks entregue — cor cinza), `CheckCheck` (2 checks lida — cor blue-500), `X` (erro — cor red-500). Somente mensagens `direction = 'outbound'` exibem icone de status; inbound nao exibe.

#### Criterios de aceite

- [ ] Mensagem outbound com `status = 'sent'` exibe 1 `Check` cinza
- [ ] Mensagem outbound com `status = 'delivered'` exibe `CheckCheck` cinza
- [ ] Mensagem outbound com `status = 'read'` exibe `CheckCheck` azul (text-blue-500)
- [ ] Mensagem outbound com `status = 'error'` exibe `X` vermelho (text-red-500)
- [ ] Mensagem inbound nao exibe icone de status
- [ ] Quando status muda (ex: delivered → read via webhook), icone atualiza sem recarregar em <5s

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `src/components/whatsapp/MessageStatus.tsx`
- **Icones:** `import { Check, CheckCheck, X } from 'lucide-react'`
- **Condicional:** `className={status === 'read' ? 'text-blue-500' : 'text-muted-foreground'}`

#### Test cases

- **Happy path:** mensagem sent → 1 check; webhook message-status (delivered) chega → 2 checks cinzas em <5s; message-status (read) → 2 checks azuis
- **Edge — erro:** mensagem com status=error → X vermelho
- **Edge — inbound:** mensagem recebida → nenhum icone de status

#### Definition of Done

- [ ] Componente `MessageStatus` criado e integrado no `MessageBubble`
- [ ] Atualizacao realtime funcionando (testado com webhook real)
- [ ] QA aprovou

#### Out of scope

- Animacao de transicao entre estados de icone
- Status "pendente" (enviando em andamento)

---

### T16 — Estados vazios e tratamento de erros de rede em todas as abas

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T10, T11, T12, T13, T14
**Dispara Security:** NAO
**Dispara Pentest:** NAO
**WSJF score:** (5 + 4 + 4) / 2 = 6.5

#### User story

Como qualquer usuario, quero ver mensagens de estado vazio e erros de rede claros em todas as abas do modulo WhatsApp, para entender o que esta acontecendo e o que devo fazer.

#### Contexto

Polish de UX. Garante que nenhuma aba fica em branco em caso de erro ou ausencia de dados. Usa `EmptyState` do ui-system e `Alert` do shadcn/ui para erros de rede. Skeleton loading durante carregamento inicial (`Skeleton` do shadcn/ui).

#### Criterios de aceite

- [ ] Aba Contas sem contas: EmptyState "Nenhuma conta cadastrada."
- [ ] Aba Conversas sem contas: EmptyState "Nenhuma conta cadastrada. Va ate a aba Contas para adicionar."
- [ ] Aba Conversas com conta selecionada sem chats: EmptyState "Nenhuma conversa ainda. Aguardando mensagens..."
- [ ] Aba Webhooks sem contas: instrucao de redirecionar para aba Contas
- [ ] Aba Logs sem logs: EmptyState "Nenhum evento recebido ainda."
- [ ] Erro de rede (query falha): Alert com "Erro ao carregar dados. Tente novamente." + botao "Tentar novamente" que chama `refetch()`
- [ ] Skeleton de carregamento inicial (3 linhas de Skeleton) enquanto queries estao em loading

#### Hints tecnicos (nao-prescritivos)

- **EmptyState:** `import { EmptyState } from '@/components/ui-system'`
- **Skeleton:** `import { Skeleton } from '@/components/ui/skeleton'`
- **Alert:** `import { Alert, AlertDescription } from '@/components/ui/alert'`
- **isLoading / isError:** flags do react-query em cada hook

#### Test cases

- **Happy path:** dados carregados → nenhum skeleton, nenhum EmptyState (quando ha dados)
- **Edge — loading:** query em flight → skeletons visiveis
- **Edge — erro:** simular erro de rede (desligar conexao) → Alert de erro exibido

#### Definition of Done

- [ ] Estados vazios em todas as 4 abas
- [ ] Skeleton de loading implementado
- [ ] Alert de erro com refetch implementado
- [ ] QA aprovou

#### Out of scope

- Modo offline completo
- Retry automatico com backoff

---

### T17 — Vinculacao visual nome-contato CRM na conversa (link clicavel)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T09, T13
**Dispara Security:** NAO
**Dispara Pentest:** NAO
**WSJF score:** (7 + 6 + 3) / 2 = 8.0

#### User story

Como atendente, quero ver o nome do contato CRM vinculado no topo da conversa com link para o perfil do contato, para identificar rapidamente quem e o eleitor e acessar seu historico de demandas.

#### Contexto

Sub-componente do cabecalho da conversa (`ChatWindow.tsx` de T13). Se `zapi_chats.contact_id` esta preenchido (trigger T09 fez o matching), faz join com `contacts.nome` e exibe o nome com `<Link to="/contacts/${contactId}">` (react-router-dom). Se `contact_id` e NULL, exibe apenas o numero bruto formatado (ex: `+55 11 9 9999-0000`). Sem criar contato automaticamente.

#### Criterios de aceite

- [ ] Chat com `contact_id` preenchido exibe nome do contato com link clicavel `<a>` que abre `/contacts/<contactId>` (ou navega via Link)
- [ ] Chat sem `contact_id` exibe numero bruto (sem link, sem botao "Criar contato")
- [ ] Link clicavel navega para a pagina do contato sem perder o estado da conversa (se for rota diferente, navega; se for modal — decidir na implementacao; sugestao: navegar para /contacts com filtro pelo numero)
- [ ] Nome exibido no topo da janela de conversa e na lista de chats (coluna central)

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** editar `ChatWindow.tsx` e `ChatList.tsx` (de T13)
- **Join no hook:** `useZapiChats` deve fazer `.select('*, contacts(nome)')` se `contact_id` existir, ou o componente busca o nome via query separada `useQuery(['contact', contactId])` — Fullstack decide qual e menos custoso
- **Link:** `import { Link } from 'react-router-dom'; <Link to={`/contacts?id=${contactId}`}>` (ajustar rota conforme pagina de Contatos existente)

#### Test cases

- **Happy path:** chat com contato vinculado → nome exibido com link → clicar → navega para contato
- **Edge — sem vinculo:** chat com numero desconhecido → numero bruto exibido, sem link
- **Edge — contato deletado:** `contact_id` aponta para contato que foi deletado → graceful fallback para numero bruto

#### Definition of Done

- [ ] Nome do contato exibido na conversa quando vinculado
- [ ] Link funcional para a pagina do contato
- [ ] Fallback para numero bruto quando sem vinculo
- [ ] QA aprovou (metrica M4 validada)

#### Out of scope

- Criar contato a partir da conversa
- Editar contato diretamente da conversa
- Exibir foto do contato

---

### T18 — pg_cron purge 90 dias: mensagens e logs de webhook

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** model
**Depende de:** T01 (pode ser desenvolvido em paralelo depois do T01)
**Dispara Security:** NAO
**Dispara Pentest:** NAO
**WSJF score:** (6 + 5 + 4) / 2 = 7.5

#### User story

Como Rodrigo (admin), quero que mensagens e logs de webhook mais antigos que 90 dias sejam deletados automaticamente, para controlar o custo de storage e cumprir com a retencao definida (decisao LGPD/Raquel).

#### Contexto

Migration que cria 2 jobs pg_cron (extensao provavelmente ja habilitada no Supabase — verificar com `SELECT * FROM pg_extension WHERE extname = 'pg_cron'`). Job 1: deletar `zapi_messages` com `created_at < NOW() - INTERVAL '90 days'`. Job 2: deletar `zapi_webhook_log` com `received_at < NOW() - INTERVAL '90 days'`. Frequencia: diaria (00:00 UTC). Incluir COMMENT autodoc com motivo da retencao (decisao Rodrigo + Raquel, LGPD).

#### Criterios de aceite

- [ ] Job `zapi-purge-messages` criado no cron, roda diariamente, deleta registros com `created_at < NOW() - INTERVAL '90 days'`
- [ ] Job `zapi-purge-webhook-logs` criado no cron, roda diariamente, deleta registros com `received_at < NOW() - INTERVAL '90 days'`
- [ ] `SELECT * FROM cron.job WHERE jobname LIKE 'zapi%'` retorna 2 jobs
- [ ] Migration aplica sem erro em banco com pg_cron habilitado
- [ ] Se pg_cron NAO estiver habilitado, migration falha com erro claro (e deve ser habilitado via Supabase dashboard antes de aplicar)
- [ ] COMMENT autodoc explica motivo da retencao de 90 dias

#### Hints tecnicos (nao-prescritivos)

- **Arquivo:** `supabase/migrations/044_zapi_purge_cron.sql` (ou incluir no 043 se nao foi aplicado ainda)
- **pg_cron check:** `SELECT cron.schedule('zapi-purge-messages', '0 0 * * *', $$DELETE FROM zapi_messages WHERE created_at < NOW() - INTERVAL '90 days'$$);`
- **Prerequisito:** `CREATE EXTENSION IF NOT EXISTS pg_cron;` (requer permissao — verificar se Supabase plan permite)

#### Test cases

- **Happy path:** migration aplica → `SELECT * FROM cron.job WHERE jobname LIKE 'zapi%'` retorna 2 linhas
- **Edge — sem pg_cron:** aplicar em banco sem extensao → erro claro no apply (documentar que admin deve habilitar via Supabase dashboard)
- **Edge — purge correto:** inserir linha com `created_at = NOW() - INTERVAL '91 days'` → apos execucao do job, linha some

#### Definition of Done

- [ ] Migration aplicada no banco remoto
- [ ] Jobs criados e visiveis em `cron.job`
- [ ] COMMENT autodoc presente
- [ ] QA aprovou (verificado por query em `cron.job`)

#### Out of scope

- Purge de dados de contatos (escopo diferente)
- Configuracao de retencao diferente por conta (MVP: 90 dias global)
- Notificacao ao admin sobre purge executado

---

## Diagrama de dependencias (DAG simplificado)

```
T01 (Migration base)
 ├── T02 (EF zapi-webhook)
 ├── T03 (EF validate-password)
 ├── T04 (EF send-text)
 ├── T05 (Hook useZapiAccounts)
 │    ├── T11 (UI Aba Contas)
 │    └── T12 (UI Aba Webhooks)
 ├── T07 (Hooks Chats+Messages)
 │    ├── T13 (UI Aba Conversas) ←── T03, T04, T06, T10
 │    └── T15 (Status icones) ←── T13
 ├── T08 (Hook WebhookLogs)
 │    └── T14 (UI Aba Logs) ←── T10
 └── T09 (Trigger phone-matching)
      └── T17 (UI Nome contato) ←── T13

T06 (Hook PanelSession) ──────→ T13

T10 (Page esqueleto + sidebar)
 ├── T11, T12, T13, T14

T16 (Estados vazios) ←── T10, T11, T12, T13, T14
T18 (pg_cron purge) ←── T01 (pode ser paralelo)
```

---

## Resumo de Security e Pentest por task

| Task | Security automatico | Pentest automatico | Motivo |
|------|--------------------|--------------------|--------|
| T01 | SIM | SIM | Migration com user_id + RLS policies |
| T02 | SIM | SIM | Webhook receiver publico + payload externo |
| T03 | SIM | SIM | Auth/password endpoint + rate limit |
| T04 | SIM | NAO | Acessa credenciais criptografadas + chamada externa |
| T05 | NAO | NAO | CRUD client-side, EF cuida da cripto |
| T06-T09 | NAO | NAO | Logica de UI/hooks, seguranca na EF |
| T10-T18 | NAO | NAO | UI, sem novos vetores de ataque |

---

## Blockers e pre-requisitos externos

| Blocker | Impacto | Mitigation |
|---------|---------|------------|
| Instancias Z-API contratadas | Bloqueia testes reais de T02, T04, T13 | Rodrigo deve contratar 2 instancias antes do QA |
| pg_cron habilitado no Supabase | Bloqueia T18 | Verificar dashboard Supabase; habilitar antes de apply da migration |
| Supabase Vault disponivel | Afeta T01 (cripto) | Decisao trancada: fallback AES via EF se Vault indisponivel — sem blocker critico |
| LGPD: aviso de privacidade | Nao bloqueia implementacao, bloqueia go-live | Rodrigo deve confirmar com Raquel antes de receber primeiras mensagens reais |
| Numero do WhatsApp Business vs Personal | Afeta status read/delivered | Documentar no onboarding que status "lida" so funciona com WA Business API |
