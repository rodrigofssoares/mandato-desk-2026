# Backlog — Limpeza de Histórico de Conversas WhatsApp

**Cliente:** Mandato Desk 2026 — Raquel
**Código QG:** RAQ-MAND-EM082
**Briefing:** docs/briefings/RAQ-MAND-EM082 (inline no prompt de 2026-06-04)
**Backlog escrito por:** Agente Backlog em 2026-06-04

---

## Notas de contexto pré-backlog

### Decisões de design que impactam o slicing

**Lixeira de 7 dias:** toda operação de limpeza é um soft-delete — os dados ficam ocultos (flag `deleted_at` + `deleted_by`) por 7 dias e só então um cron os apaga de forma definitiva. Isso implica:
- As tabelas afetadas (`zapi_messages`, `zapi_chats`, `zapi_chat_notes`, `zapi_chat_tags`, `zapi_chat_message_flags`, `zapi_webhook_log`) precisam de colunas `deleted_at` e `deleted_by`.
- Toda query de listagem existente precisa de `WHERE deleted_at IS NULL` — impacto em `useZapiChats` e `useAllZapiChats`.
- A operação de purge definitivo (cron 7 dias) é um hard-delete dos registros com `deleted_at < now() - 7 days`.

**Tabela de operações de limpeza (`zapi_cleanup_batches`):** registra cada operação (quem, quando, modo, filtros aplicados, contagem estimada) para permitir que o admin veja o que está na lixeira e restaure o lote inteiro. Sem essa tabela não há como recuperar "o lote que Joana apagou ontem de manhã".

**RBAC:** a flag de permissão para limpar (`canDelete` em `whatsapp`) já existe na seção — a migration apenas garante que o default para proprietário/assessor é `false` (somente admin pode por default). Admin pode habilitar na matriz. Recuperação da lixeira usa `canBulkDelete('whatsapp')` como flag dedicada — restrita a admin por padrão, sem opção de delegar.

**RLS + Edge Functions:** toda escrita de soft-delete deve passar por EF (RLS bloqueia escrita do client em `zapi_chats`, `zapi_messages`, `zapi_webhook_log`). `zapi_chat_notes`, `zapi_chat_tags` e `zapi_chat_message_flags` permitem escrita de autenticado, mas para consistência e auditoria também passam pela EF de limpeza.

**Cron existente (migration 044):** os jobs `zapi-purge-messages` e `zapi-purge-webhook-logs` apagam com `created_at < now() - 90 dias`. Com soft-delete, eles precisam respeitar `deleted_at IS NULL` pra não apagar itens na lixeira que ainda estão dentro dos 7 dias. Um novo job (`zapi-purge-trash`) faz o hard-delete dos itens com `deleted_at < now() - 7 dias`.

---

## Walking skeleton (entrega valor end-to-end)

- **T01** — Model: colunas de soft-delete + tabela `zapi_cleanup_batches` + RLS + cron lixeira + permissão RBAC

A T01 é o walking skeleton porque sem o modelo de dados nada funciona: nem a EF de limpeza, nem o hook, nem a UI. Não entrega valor visível ao usuário mas é a única task que prova end-to-end que o conceito de lixeira de 7 dias é viável no banco.

---

## Ordem de execução (WSJF + dependências)

1. T01 — Model: soft-delete + `zapi_cleanup_batches` + RLS + cron lixeira + RBAC `[walking skeleton]`
2. T02 — EF `zapi-cleanup-history`: limpar por período / tudo / conversas específicas / granular
3. T03 — EF `zapi-restore-history`: recuperar lote da lixeira (admin-only)
4. T04 — Adaptar queries de listagem para filtrar `deleted_at IS NULL`
5. T05 — Hook `useZapiCleanup` + `useZapiTrash` (react-query + mutations)
6. T06 — Dialog de limpeza multi-modo (UI principal)
7. T07 — Painel de lixeira admin (listar batches + restaurar)

**Razão da ordem:** T01 desbloqueia T02+T03. T02+T03 desbloqueiam T05. T04 pode rodar em paralelo com T02+T03 (só lê, não escreve). T05 desbloqueia T06+T07.

---

## Tasks

### T01 — Criar modelo de soft-delete, tabela de lotes e cron de purge da lixeira

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** model
**Depende de:** —
**WSJF score:** (9 + 8 + 9) / 8 = 3,25 — gargalo absoluto, desbloqueia tudo

#### User story

Como administrador do Mandato Desk, quero que operações de limpeza de histórico WhatsApp criem uma lixeira com prazo de 7 dias, para que eu possa recuperar dados apagados por engano antes do prazo vencer.

#### Contexto

Esta task cria toda a infra de banco para a feature. Nenhuma outra task pode avançar sem ela. Cinco tabelas precisam de colunas `deleted_at TIMESTAMPTZ` e `deleted_by UUID` para soft-delete: `zapi_messages`, `zapi_chats`, `zapi_chat_notes`, `zapi_chat_tags`, `zapi_chat_message_flags`. A tabela `zapi_webhook_log` já tem `received_at` como âncora temporal — ela recebe apenas `deleted_at` (não tem `deleted_by` porque é log de sistema). A nova tabela `zapi_cleanup_batches` registra cada operação de limpeza como um lote identificável para restauração. O cron existente em migration 044 (`zapi-purge-messages`) precisa ser atualizado para respeitar `deleted_at IS NULL` — o novo cron `zapi-purge-trash` faz o hard-delete definitivo após 7 dias.

A permissão RBAC de limpar reutiliza `canDelete('whatsapp')` (já mapeado em `usePermissions.tsx`). A nova flag de recuperar lixeira usa `canBulkDelete('whatsapp')` — admin-only por padrão. Ambas precisam de seed na tabela de permissões para garantir os defaults corretos antes da EF ser deployada.

#### Critérios de aceite

- [ ] Colunas `deleted_at TIMESTAMPTZ DEFAULT NULL` e `deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL` adicionadas em `zapi_messages`, `zapi_chats`, `zapi_chat_notes`, `zapi_chat_tags`, `zapi_chat_message_flags`
- [ ] Coluna `deleted_at TIMESTAMPTZ DEFAULT NULL` adicionada em `zapi_webhook_log`
- [ ] Partial indexes `WHERE deleted_at IS NULL` criados em `zapi_messages(chat_id)` e `zapi_chats(account_id)` para performance de listagem
- [ ] Tabela `zapi_cleanup_batches` criada com: `id UUID PK`, `account_id UUID NOT NULL FK zapi_accounts`, `initiated_by UUID NOT NULL FK auth.users`, `mode TEXT CHECK IN ('period','all','chats','granular')`, `filters JSONB` (período, chat_ids, itens granulares), `status TEXT CHECK IN ('pending','restored','expired')`, `row_count_estimate INT`, `created_at TIMESTAMPTZ`, `expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')`
- [ ] RLS em `zapi_cleanup_batches`: SELECT para `is_zapi_privileged` (admin/proprietário vê todos os batches); INSERT/UPDATE/DELETE bloqueado para client (somente via EF service_role)
- [ ] Job pg_cron `zapi-purge-trash` agendado para 03:10 UTC diariamente: hard-delete de registros com `deleted_at < now() - INTERVAL '7 days'` em todas as 6 tabelas afetadas, na ordem correta (filhos antes do pai: messages → chats, notes/tags/flags → chats, webhook_log independente)
- [ ] Job `zapi-purge-messages` atualizado: `WHERE created_at < now() - 90 days AND deleted_at IS NULL` (não apaga itens na lixeira dentro dos 7 dias)
- [ ] Job `zapi-purge-webhook-logs` atualizado: idem com `AND deleted_at IS NULL`
- [ ] Job `zapi-expire-cleanup-batches` agendado: UPDATE `zapi_cleanup_batches SET status='expired' WHERE status='pending' AND expires_at < now()`
- [ ] Seed/upsert de permissão RBAC: `canDelete('whatsapp')` = true para admin; false para proprietário, assessor, assistente, estagiário (admin pode delegar via matriz). `canBulkDelete('whatsapp')` = true para admin; false para todos os demais (não delegável)
- [ ] Migration numerada sequencialmente (≥112), idempotente com `ADD COLUMN IF NOT EXISTS` e `DROP POLICY IF EXISTS`

#### Hints técnicos (não-prescritivos)

- **Model**: nova migration `112_zapi_cleanup_soft_delete.sql`. Seguir padrão de 044 para cron (SELECT cron.unschedule antes de recriar). Padrão de RLS de 111 para `is_zapi_privileged`.
- **Indexes**: `CREATE INDEX IF NOT EXISTS idx_zapi_messages_active ON public.zapi_messages (chat_id) WHERE deleted_at IS NULL;` — evita full scan nas queries de listagem após adicionar o filtro
- **Cron ordem de purge**: respeitar FKs ON DELETE CASCADE — purgar `zapi_messages` antes de `zapi_chats` (CASCADE já faria, mas o hard-delete do cron é SQL direto, não depende de cascade)
- **Pattern existente**: migration 044 como referência de sintaxe de cron; migration 111 como referência de `is_zapi_privileged`

#### Test cases

- **Happy path**: após migration aplicada, INSERT em `zapi_messages` com `deleted_at=NULL`, confirmar que `SELECT WHERE deleted_at IS NULL` retorna o registro
- **Edge — soft-delete respeitado pelo cron-90d**: `zapi_messages` com `created_at = now() - 91 days` e `deleted_at = now() - 1 day` (dentro dos 7 dias) NÃO deve ser apagado pelo job `zapi-purge-messages`
- **Edge — hard-delete após 7 dias**: `zapi_messages` com `deleted_at = now() - 8 days` DEVE ser apagado pelo job `zapi-purge-trash`
- **Edge — batch expirado**: `zapi_cleanup_batches` com `expires_at = now() - 1 hour` deve ter status atualizado para `'expired'` pelo job `zapi-expire-cleanup-batches`
- **Edge — RLS batch**: usuário com role `assessor` não consegue SELECT em `zapi_cleanup_batches` (is_zapi_privileged retorna false para assessor)

#### Definition of Done

- [ ] Critérios de aceite acima checados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Migration aplicada no banco de staging via `supabase db query --linked --file`
- [ ] Smoke test: `SELECT column_name FROM information_schema.columns WHERE table_name='zapi_messages' AND column_name='deleted_at'` retorna 1 linha
- [ ] Smoke test: `SELECT jobname FROM cron.job WHERE jobname LIKE 'zapi%'` lista os 4 jobs (mensagens, webhook-logs, trash, expire-batches)
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Queries de listagem com filtro `deleted_at IS NULL` (T04)
- EFs de limpeza e restauração (T02, T03)
- UI de limpeza (T06, T07)
- Qualquer mudança em `zapi_accounts`, `zapi_panel_passwords`, `zapi_quick_replies` (não participam da lixeira)

---

### T02 — Criar EF `zapi-cleanup-history`: limpeza em 4 modos com registro de lote

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route
**Depende de:** T01
**WSJF score:** (9 + 8 + 8) / 8 = 3,12

#### User story

Como usuário autorizado (admin por padrão; proprietário/assessor se habilitado na matriz), quero limpar o histórico de conversas WhatsApp por período, por conta inteira, por conversas específicas ou de forma granular (escolhendo o que apagar), para que eu possa controlar o que fica armazenado sem perder dados por engano.

#### Contexto

Esta Edge Function centraliza toda a lógica de soft-delete do histórico. Quatro modos distintos chegam no mesmo endpoint via `{ mode }` no body — simplifica o frontend (um único `fetch`) e centraliza auditoria. A função cria um registro em `zapi_cleanup_batches` antes de executar o soft-delete, garantindo que admin possa restaurar mesmo se o usuário fechar o browser antes da confirmação. O soft-delete em `zapi_chats` implica ocultar o chat inteiro da lista — as mensagens, notas, etiquetas e flags já caem por consequência do filtro `deleted_at IS NULL` na listagem.

O helper `is_zapi_privileged` (migration 111) NÃO deve ser usado aqui para checar permissão de limpeza — a feature admite que proprietário/assessor também limpem quando o admin habilita na matriz. A EF deve checar `canDelete('whatsapp')` via lookup na tabela de permissões (padrão das EFs existentes que fazem gate de permissão), não apenas se é admin/proprietário.

#### Critérios de aceite

- [ ] Endpoint POST `zapi-cleanup-history` autenticado (JWT obrigatório, perfil ATIVO)
- [ ] Body aceito: `{ account_id, mode, filters }` onde `mode` é `'period' | 'all' | 'chats' | 'granular'`
- [ ] `filters` por modo: `period` → `{ start_date, end_date }`; `all` → `{}`; `chats` → `{ chat_ids: string[] }`; `granular` → `{ chat_ids?, start_date?, end_date?, items: ('messages'|'notes'|'tags'|'flags'|'logs')[] }`
- [ ] Validação: `account_id` UUID válido; `chat_ids` array de UUIDs válidos; datas em ISO8601; `items` não vazio no modo granular
- [ ] EF verifica permissão de limpeza consultando tabela de permissões RBAC (retorna 403 se `canDelete('whatsapp')` = false para a role do caller)
- [ ] EF cria registro em `zapi_cleanup_batches` com `status='pending'` e `filters` serializado ANTES de executar o soft-delete
- [ ] Soft-delete: `UPDATE SET deleted_at=now(), deleted_by=caller_id WHERE deleted_at IS NULL AND <filtro do modo>`
- [ ] Modo `all`: soft-delete em todos os chats da conta + mensagens + notas + etiquetas + flags + logs
- [ ] Modo `period`: soft-delete em `zapi_messages.sent_at BETWEEN start_date AND end_date` + notas/etiquetas/flags dos chats afetados; chats com TODAS as mensagens no período também são soft-deletados
- [ ] Modo `chats`: soft-delete nos chats listados + tudo em cascata (mensagens, notas, etiquetas, flags)
- [ ] Modo `granular`: soft-delete apenas nos itens selecionados (ex: só `messages` e `notes`, sem apagar etiquetas e flags)
- [ ] `zapi_webhook_log` só é soft-deletado quando `items` inclui `'logs'` ou `mode='all'`
- [ ] Retorno: `{ ok: true, batch_id: "<uuid>", row_count: <n>, expires_at: "<iso>" }`
- [ ] Retorno 403 se permissão negada; 400 se body inválido; 404 se `account_id` não encontrado; 500 em erro interno
- [ ] Log de auditoria: `console.log` com `caller_id`, `account_id`, `mode`, `row_count` (sem PII de conteúdo de mensagens)

#### Hints técnicos (não-prescritivos)

- **Route**: `supabase/functions/zapi-cleanup-history/index.ts`. Padrão de auth: `requireAuth` do `_shared/auth-guard.ts` (igual a `zapi-mark-as-read`)
- **Permissão RBAC**: fazer SELECT na tabela de permissões com `admin` client (service_role) para buscar `canDelete` de `whatsapp` para a role do caller — padrão da EF `zapi-validate-panel-password`
- **Soft-delete em ordem**: sempre atualizar filhos antes do pai para evitar conflito com constraints — `zapi_messages` → `zapi_chats`; `zapi_chat_notes`, `zapi_chat_tags`, `zapi_chat_message_flags` em paralelo (sem FK entre si)
- **Batch insert**: usar `admin.from('zapi_cleanup_batches').insert({...}).select('id,expires_at').single()` antes do soft-delete
- **Pattern existente**: `zapi-bulk-chat-update/index.ts` como referência de EF que opera em múltiplos chats com service_role

#### Test cases

- **Happy path period**: `mode='period', start_date='2026-01-01', end_date='2026-03-31'` → retorna `batch_id` + `row_count > 0`; mensagens dentro do período têm `deleted_at != NULL`; mensagens fora do período têm `deleted_at = NULL`
- **Happy path all**: `mode='all'` → todos os chats e mensagens da conta têm `deleted_at != NULL`
- **Happy path chats**: `mode='chats', chat_ids=['<uuid1>','<uuid2>']` → só esses chats soft-deletados
- **Happy path granular**: `mode='granular', items=['messages','notes']` → só mensagens e notas soft-deletadas; etiquetas e flags intactas
- **Edge — permissão negada**: assessor sem permissão de delete → 403
- **Edge — account_id inexistente**: → 404
- **Edge — chat_ids vazio no modo chats**: → 400
- **Edge — data inválida**: `start_date='não-é-data'` → 400
- **Edge — sem JWT**: → 401
- **Edge — já soft-deletado**: re-chamar cleanup no mesmo período → `row_count=0` (WHERE deleted_at IS NULL já filtra)

#### Definition of Done

- [ ] Critérios de aceite acima checados
- [ ] Lint OK (Deno lint)
- [ ] Typecheck OK (deno check)
- [ ] Build OK (`supabase functions build zapi-cleanup-history`)
- [ ] Smoke test manual: POST com mode='all' numa conta de teste → verificar `zapi_cleanup_batches` tem 1 linha e `zapi_chats` têm `deleted_at != NULL`
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Recuperação da lixeira (T03)
- UI do dialog (T06)
- Notificação em tempo real para outros usuários logados quando limpeza ocorre (feature futura)

---

### T03 — Criar EF `zapi-restore-history`: recuperar lote da lixeira (admin-only)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route
**Depende de:** T01
**WSJF score:** (8 + 7 + 7) / 5 = 4,40 — pequena mas de alto valor para admin

#### User story

Como administrador, quero restaurar um lote de histórico que foi enviado para a lixeira dentro do prazo de 7 dias, para que eu possa desfazer limpezas realizadas por engano por qualquer membro da equipe.

#### Contexto

Esta EF é o par complementar de `zapi-cleanup-history`. Ela reverte o soft-delete de um lote inteiro identificado pelo `batch_id`. A restauração consiste em `UPDATE SET deleted_at=NULL, deleted_by=NULL` nos registros que têm `deleted_by` correspondente ao lote — via correlação com os filtros registrados em `zapi_cleanup_batches`. Após restauração, atualiza o batch para `status='restored'`. Somente `is_zapi_privileged` (admin ou proprietário) — e na prática, apenas admin via `canBulkDelete('whatsapp')` — pode chamar este endpoint.

A correlação de quais registros pertencem ao lote é feita pelo `deleted_at` e `deleted_by` + filtros gravados no batch: a EF re-executa o mesmo predicado do cleanup (modo + filtros) mas com UPDATE `deleted_at=NULL` em vez de soft-delete, limitado a registros que estejam atualmente soft-deletados para aquele `initiated_by`/`created_at` do batch. Isso evita armazenar IDs individuais (potencialmente milhares de rows) no batch.

#### Critérios de aceite

- [ ] Endpoint POST `zapi-restore-history` autenticado (JWT obrigatório, perfil ATIVO)
- [ ] Body: `{ batch_id: string }`
- [ ] Validação: `batch_id` UUID válido
- [ ] EF verifica `canBulkDelete('whatsapp')` para a role do caller (403 se false — somente admin)
- [ ] EF busca o batch; retorna 404 se não existe ou 410 se `status='expired'`
- [ ] EF re-executa o predicado dos filtros do batch com `UPDATE SET deleted_at=NULL, deleted_by=NULL WHERE deleted_at IS NOT NULL AND <mesmo filtro>`
- [ ] Após UPDATE bem-sucedido, atualiza `zapi_cleanup_batches SET status='restored'`
- [ ] Retorno: `{ ok: true, restored_count: <n> }`
- [ ] Retorno 403 se permissão negada; 404 se batch não existe; 410 se batch expirado (status='expired'); 409 se batch já foi restaurado (status='restored')
- [ ] Log de auditoria com `caller_id`, `batch_id`, `restored_count`

#### Hints técnicos (não-prescritivos)

- **Route**: `supabase/functions/zapi-restore-history/index.ts`
- **Predicado de restauração**: reutilizar a mesma lógica de filtro de T02, invertendo o UPDATE. Extrair função utilitária `buildCleanupPredicate(mode, filters)` em `_shared/cleanup-predicate.ts` compartilhada entre as duas EFs
- **Atenção**: o predicado de restauração deve incluir `AND deleted_at IS NOT NULL AND deleted_by = batch.initiated_by` para não tocar em registros soft-deletados por outros lotes que possam existir na mesma conta

#### Test cases

- **Happy path**: restaurar batch com `status='pending'` → `deleted_at=NULL` nos registros; batch vira `status='restored'`; `restored_count > 0`
- **Edge — batch expirado**: status='expired' → 410
- **Edge — batch já restaurado**: status='restored' → 409
- **Edge — batch inexistente**: → 404
- **Edge — permissão negada**: assessor chama → 403
- **Edge — sem JWT**: → 401
- **Edge — batch de outra conta**: admin restaura batch de account_id diferente → 404 (batch não existe para aquele scope) ou 403 (se a EF filtrar por account_id do caller — decidir na implementação)

#### Definition of Done

- [ ] Critérios de aceite acima checados
- [ ] Lint OK (Deno lint)
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: cleanup → restore → verificar `deleted_at=NULL` e batch `status='restored'`
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Restauração seletiva de itens individuais dentro do lote (feature futura)
- Notificação ao usuário que fez o cleanup de que o lote foi restaurado (feature futura)

---

### T04 — Adaptar queries de listagem para filtrar itens soft-deletados

**Tipo:** refactor
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, integration
**Depende de:** T01
**WSJF score:** (7 + 8 + 6) / 2 = 10,5 — pequena, alto impacto: sem isso a lixeira vaza na UI

#### User story

Como usuário do módulo WhatsApp, quero que conversas e mensagens enviadas para a lixeira desapareçam da lista imediatamente, para que a experiência de limpeza seja percebida em tempo real sem recarregar a página.

#### Contexto

Com a adição de `deleted_at` nas tabelas, as queries existentes passam a retornar itens soft-deletados junto com os ativos — isso vaza os dados "apagados" para todos os usuários, anulando o efeito visual da lixeira. Dois hooks precisam de atualização pontual: `useZapiChats` e `useAllZapiChats` em `src/hooks/useZapiChats.ts`. Ambos fazem `SELECT` em `zapi_chats` — basta adicionar `.filter('deleted_at', 'is', null)` (sintaxe PostgREST para `IS NULL`). As queries de mensagens (dentro de `ConversasTabContent.tsx` ou hook dedicado) também precisam do mesmo filtro.

Esta task pode ser executada em paralelo com T02 e T03 pois é puramente do lado do client (hooks React-Query) — não depende das EFs, apenas de T01 (colunas no banco).

#### Critérios de aceite

- [ ] `useZapiChats` adiciona `.filter('deleted_at', 'is', null)` na query de `zapi_chats`
- [ ] `useAllZapiChats` idem
- [ ] Query de `zapi_messages` (onde quer que seja chamada) adiciona filtro equivalente
- [ ] Query de `zapi_chat_notes` adiciona filtro equivalente
- [ ] Realtime subscription em `useZapiChats` invalida a query quando recebe evento de UPDATE em `zapi_chats` (o soft-delete é um UPDATE — já está coberto pelo subscription existente `event: '*'`)
- [ ] Após soft-delete via EF, invalidar `zapiChatKeys.byAccount(accountId)` no `onSuccess` da mutation (T05 fará isso — mas este critério garante que o hook suporte o padrão)
- [ ] TypeScript compila sem erros (`npm run build`)
- [ ] `deleted_at` e `deleted_by` adicionados ao tipo `ZapiChat` como campos opcionais (`deleted_at?: string | null`)

#### Hints técnicos (não-prescritivos)

- **Hook**: `src/hooks/useZapiChats.ts` — `useZapiChats` e `useAllZapiChats`
- **Sintaxe PostgREST para IS NULL**: `.is('deleted_at', null)` (Supabase JS SDK v2)
- **Types**: `src/integrations/supabase/types.ts` é auto-gerado — adicionar `deleted_at` ao tipo manual em `ZapiChat` do hook até próxima regeneração de types
- **Mensagens**: verificar onde `zapi_messages` é consultada — provavelmente em `ConversasTabContent.tsx` ou hook dedicado (`useZapiMessages`); adicionar `.is('deleted_at', null)` lá

#### Test cases

- **Happy path**: após soft-delete de um chat via EF, `useZapiChats` não retorna mais o chat na lista (realtime invalida a query)
- **Edge — chat na lixeira não aparece**: SELECT com `deleted_at='2026-06-04'` → não retorna na lista
- **Edge — chat ativo aparece normalmente**: SELECT com `deleted_at=NULL` → retorna normalmente
- **Edge — typecheck**: `ZapiChat.deleted_at` é `string | null | undefined` sem erros TS

#### Definition of Done

- [ ] Critérios de aceite acima checados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: criar chat de teste, soft-deletar via SQL direto, confirmar que lista React não mostra o chat
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Aba "Lixeira" na UI (T07)
- Queries de auditoria/logs (fora do escopo deste módulo)
- Filtro de soft-delete em `zapi_quick_replies` (não participa da lixeira)

---

### T05 — Criar hooks `useZapiCleanup` e `useZapiTrash` (react-query)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook
**Depende de:** T02, T03
**WSJF score:** (7 + 7 + 5) / 2 = 9,5

#### User story

Como desenvolvedor do módulo WhatsApp, quero hooks tipados que encapsulem as chamadas às EFs de limpeza e restauração, para que os componentes de UI não precisem conhecer os detalhes de fetch/invalidação de cache.

#### Contexto

Seguindo o padrão de `useMarkChatAsRead` (mutation que chama EF via `supabase.functions.invoke` e invalida queries no `onSuccess`), esta task cria dois hooks:

- `useZapiCleanup(accountId)`: mutation que chama `zapi-cleanup-history`, retorna `{ batch_id, row_count, expires_at }` e invalida `zapiChatKeys.byAccount(accountId)` no `onSuccess`.
- `useZapiTrash()`: query `useQuery` que lista `zapi_cleanup_batches` com `status='pending'` para o admin (alimenta T07), mais mutation `restoreBatch` que chama `zapi-restore-history` e invalida a lista de batches + a lista de chats da conta restaurada.

Os tipos de input/output devem espelhar exatamente os bodies e respostas das EFs T02/T03 para evitar drift.

#### Critérios de aceite

- [ ] Hook `useZapiCleanup(accountId: string)` exportado de `src/hooks/useZapiCleanup.ts`
- [ ] `useZapiCleanup` expõe `cleanupMutation: UseMutationResult` com `mutate({ mode, filters })` tipado
- [ ] `cleanupMutation.onSuccess` invalida `zapiChatKeys.byAccount(accountId)` e `['zapi-cleanup-batches']`
- [ ] `cleanupMutation.onError` exibe `toast.error('Erro ao limpar histórico')` via sonner
- [ ] Hook `useZapiTrash()` exportado de `src/hooks/useZapiTrash.ts`
- [ ] `useZapiTrash` expõe: `batchesQuery: UseQueryResult<CleanupBatch[]>` (lista batches pending, ordenados por `created_at DESC`) e `restoreMutation: UseMutationResult` com `mutate({ batch_id })`
- [ ] `restoreMutation.onSuccess` invalida `['zapi-cleanup-batches']` + exibe `toast.success('Histórico restaurado com sucesso')`
- [ ] `restoreMutation.onError` exibe `toast.error('Erro ao restaurar histórico')`
- [ ] Tipos `CleanupMode`, `CleanupFilters`, `CleanupBatch` exportados e compartilhados entre os dois hooks e os componentes T06/T07
- [ ] TypeScript compila sem erros

#### Hints técnicos (não-prescritivos)

- **Hook**: `src/hooks/useZapiCleanup.ts` e `src/hooks/useZapiTrash.ts`
- **Padrão**: `useMarkChatAsRead` em `src/hooks/useZapiChats.ts` como referência de mutation com EF invoke
- **Query de batches**: SELECT direto em `zapi_cleanup_batches` via Supabase client (RLS permite `is_zapi_privileged` ler) — não precisa de EF
- **Key factory**: `zapiCleanupKeys = { all: ['zapi-cleanup-batches'], pending: () => ['zapi-cleanup-batches', 'pending'] }`

#### Test cases

- **Happy path cleanup**: `cleanupMutation.mutate({ mode: 'all', filters: {} })` → `status: 'success'`, `data.batch_id` é UUID válido, cache de chats invalidado
- **Happy path restore**: `restoreMutation.mutate({ batch_id: '<uuid>' })` → `status: 'success'`, toast de sucesso, lista de batches invalidada
- **Edge — erro 403 cleanup**: toast.error exibido, `cleanupMutation.status = 'error'`
- **Edge — erro 410 restore**: toast.error exibido com mensagem específica de prazo expirado
- **Edge — typecheck**: tipos de input/output batem com EFs T02/T03

#### Definition of Done

- [ ] Critérios de aceite acima checados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Lógica de UI (T06, T07)
- Realtime subscription nos batches (não necessário — admin recarrega sob demanda)

---

### T06 — Criar dialog de limpeza multi-modo com confirmação obrigatória

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** component
**Depende de:** T04, T05
**WSJF score:** (9 + 7 + 5) / 8 = 2,62 — maior task visual, valor alto mas depende de T04+T05

#### User story

Como usuário autorizado (admin por padrão), quero acessar um dialog de limpeza de histórico WhatsApp diretamente na aba Conversas, para que eu possa escolher o modo de limpeza, confirmar a ação digitando uma frase de confirmação e receber feedback claro sobre o que foi para a lixeira.

#### Contexto

O dialog de limpeza (`CleanupHistoryDialog`) é o ponto de entrada da feature para o usuário final. Ele deve ser acessível via botão na barra de ações da aba Conversas (dentro de `ConversasTabContent.tsx`), visível apenas para quem tem `can.deleteWhatsapp()` (que mapeia `canDelete('whatsapp')`). O dialog tem 4 passos visuais:

1. **Modo**: escolher entre período / conta inteira / conversas específicas / granular
2. **Filtros**: configurar o filtro do modo selecionado (DatePicker para período, checkboxes de chats, checkboxes de itens granulares)
3. **Resumo + confirmação**: mostrar "Você está prestes a enviar X itens para a lixeira por 7 dias" + campo de digitação "CONFIRMAR" obrigatório
4. **Resultado**: toast de sucesso com batch_id + link para "ver lixeira" (admin) ou apenas "ok" (não-admin)

O DatePicker deve suportar os atalhos rápidos (7d/30d/90d/Tudo) além do intervalo custom — implementar como ButtonGroup acima do calendário.

#### Critérios de aceite

- [ ] Botão "Limpar histórico" visível na barra de ações de `ConversasTabContent` apenas quando `can.deleteWhatsapp() === true`
- [ ] Dialog `CleanupHistoryDialog` com 4 passos (Stepper ou Tabs com navegação linear)
- [ ] Passo 1 — Modo: RadioGroup com 4 opções (Período / Tudo / Conversas específicas / Granular); descrição de cada modo em pt-BR
- [ ] Passo 2 — Filtros por modo:
  - Período: atalhos rápidos (7d / 30d / 90d / Tudo) + DateRangePicker (data início e data fim) mutuamente exclusivos com os atalhos
  - Tudo: sem filtros adicionais, apenas aviso "Todos os chats e mensagens desta conta serão enviados para a lixeira"
  - Conversas específicas: lista de chats da conta com checkbox múltiplo (usar `useZapiChats`); busca por nome/número
  - Granular: lista de chats (opcional) + checkboxes de itens (Mensagens / Anotações / Etiquetas / Favoritos / Logs de webhook)
- [ ] Passo 3 — Confirmação: campo de texto onde usuário deve digitar exatamente "CONFIRMAR" para habilitar o botão de prosseguir; aviso de lixeira de 7 dias visível
- [ ] Passo 4 — Resultado: exibe `batch_id` resumido, `row_count`, `expires_at` formatado; botão "Ver lixeira" visível apenas para admin
- [ ] Toast `toast.success('X itens enviados para a lixeira. Recuperação disponível por 7 dias.')` ao concluir
- [ ] Loading state no botão de confirmar durante a mutation
- [ ] Ao fechar o dialog em qualquer passo, estado interno é resetado (sem vazamento de filtros)
- [ ] UI em pt-BR, shadcn/ui, responsiva para telas ≥ 768px
- [ ] Adição do helper `can.deleteWhatsapp()` em `usePermissions.tsx` se ainda não existir (atualmente tem `accessWhatsapp` e `editWhatsapp` mas não `deleteWhatsapp` explícito)

#### Hints técnicos (não-prescritivos)

- **Component**: `src/components/whatsapp/CleanupHistoryDialog.tsx`
- **DatePicker**: verificar se há DateRangePicker em `src/components/ui/` (shadcn/ui); se não, usar dois `<Input type="date">` + atalhos como `<Button variant="outline">` que setam o range
- **Stepper**: não há Stepper no shadcn/ui padrão — usar estado `step: 1|2|3|4` com `useState` e renderização condicional; ou adaptar `Tabs` com navegação controlada
- **Confirmação**: `<Input>` com `onChange` comparando `.trim().toUpperCase() === 'CONFIRMAR'`; botão desabilitado enquanto não bate
- **Padrão de dialog existente**: `AlertDialog` de shadcn/ui já usado em `ConversasTabContent.tsx` (importado na linha 46); usar `Dialog` (não AlertDialog) pela complexidade multi-passo
- **Gating**: adicionar `deleteWhatsapp: () => canDelete('whatsapp')` em `usePermissions.tsx`

#### Test cases

- **Happy path período**: selecionar "Período", atalho "30d", digitar "CONFIRMAR", clicar confirmar → loading → toast de sucesso → dialog fecha
- **Happy path tudo**: selecionar "Tudo", digitar "CONFIRMAR", confirmar → sucesso
- **Happy path chats**: selecionar "Conversas específicas", marcar 2 chats, confirmar → sucesso; outros chats não afetados
- **Happy path granular**: selecionar "Granular", marcar apenas "Mensagens" e "Anotações", confirmar → sucesso; etiquetas e favoritos intactos
- **Edge — botão desabilitado sem digitar confirmação**: campo vazio ou "confirmar" (minúscula) → botão desabilitado
- **Edge — sem permissão**: usuário com `canDelete('whatsapp')=false` não vê o botão "Limpar histórico"
- **Edge — nenhum chat selecionado no modo chats**: botão "Próximo" desabilitado
- **Edge — nenhum item granular selecionado**: botão "Próximo" desabilitado
- **Edge — erro na EF**: toast.error, dialog permanece aberto para retry
- **Edge — fechar dialog entre passos**: reabrir → passo 1 sem estado anterior

#### Definition of Done

- [ ] Critérios de aceite acima checados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK (`npm run build` sem erros)
- [ ] Smoke test manual: abrir dialog, percorrer 4 passos com modo "Período 7d", confirmar → verificar `zapi_cleanup_batches` no banco
- [ ] Smoke test: usuário sem permissão → botão não aparece
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Painel de lixeira e restauração (T07)
- Animações entre passos (polimento futuro)
- Suporte a mobile < 768px (polimento futuro)
- Internacionalização além de pt-BR

---

### T07 — Criar painel de lixeira admin: listar lotes e restaurar

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** component
**Depende de:** T05
**WSJF score:** (8 + 6 + 6) / 5 = 4,0

#### User story

Como administrador, quero ver todos os lotes de limpeza pendentes na lixeira (com prazo de expiração) e poder restaurar qualquer lote com um clique, para que eu consiga desfazer limpezas acidentais de qualquer membro da equipe antes que os dados sejam apagados definitivamente.

#### Contexto

O painel de lixeira é uma seção dedicada dentro do módulo WhatsApp, acessível apenas para admin (`is_zapi_privileged` no frontend via `can.bulkDeleteWhatsapp()`). Pode ser implementado como uma nova aba "Lixeira" dentro de `src/pages/Whatsapp.tsx` (ao lado das abas existentes) ou como um Sheet/Dialog acessível via botão no cabeçalho do módulo. A opção de aba separada é preferível para não poluir o fluxo das abas de contas.

Cada lote exibe: quem iniciou, quando, modo de limpeza, quantos itens (estimativa), conta afetada, prazo de expiração (com countdown visual se < 24h) e botão "Restaurar". Lotes com `status='expired'` aparecem em cinza com label "Expirado" sem botão de restaurar. Lotes com `status='restored'` aparecem em verde com label "Restaurado".

#### Critérios de aceite

- [ ] Aba "Lixeira" visível em `Whatsapp.tsx` apenas para usuários com `can.bulkDeleteWhatsapp() === true` (admin)
- [ ] Lista de batches ordenada por `created_at DESC`, mostrando: nome do iniciador, conta afetada, modo, `row_count_estimate`, `expires_at` formatado, status badge
- [ ] Batches com `status='pending'` e `expires_at > now()`: botão "Restaurar" habilitado
- [ ] Batches com `status='expired'`: badge "Expirado", sem botão de restaurar
- [ ] Batches com `status='restored'`: badge "Restaurado", sem botão de restaurar
- [ ] Countdown visual (ex: "Expira em 2h 30min") para batches com menos de 24h restantes
- [ ] Botão "Restaurar" abre `AlertDialog` de confirmação: "Restaurar este lote vai desfazer a limpeza de X itens. Confirmar?" com botão "Restaurar" e "Cancelar"
- [ ] Após restauração bem-sucedida: badge do batch vira "Restaurado", toast de sucesso, lista de chats invalidada (via `useZapiTrash.restoreMutation.onSuccess`)
- [ ] Estado de loading no botão durante restauração
- [ ] Empty state quando não há batches: "Nenhum histórico na lixeira."
- [ ] Helper `bulkDeleteWhatsapp: () => canBulkDelete('whatsapp')` adicionado em `usePermissions.tsx`

#### Hints técnicos (não-prescritivos)

- **Component**: `src/components/whatsapp/TrashPanel.tsx` (ou aba em `src/pages/Whatsapp.tsx`)
- **Hook**: `useZapiTrash` de T05
- **Countdown**: `date-fns/differenceInHours` + `differenceInMinutes` para calcular tempo restante; re-render a cada minuto via `setInterval` em `useEffect` ou hook `useCountdown`
- **Padrão de aba**: verificar como abas existentes são registradas em `Whatsapp.tsx` — provavelmente `<Tabs>` shadcn/ui com `TabsList` + `TabsContent`
- **AlertDialog**: padrão já usado em `ConversasTabContent.tsx` para confirmações destrutivas

#### Test cases

- **Happy path**: admin abre aba Lixeira → vê lista de batches com prazo → clica Restaurar → confirma → toast de sucesso → batch vira "Restaurado"
- **Edge — batch expirado**: badge "Expirado", sem botão Restaurar
- **Edge — batch já restaurado**: badge "Restaurado", sem botão
- **Edge — lixeira vazia**: empty state exibido
- **Edge — sem permissão**: usuário não-admin não vê a aba "Lixeira"
- **Edge — erro na EF restore**: toast.error, batch não muda de status
- **Edge — countdown < 24h**: "Expira em 23h 15min" exibido em amarelo/laranja para urgência visual

#### Definition of Done

- [ ] Critérios de aceite acima checados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: criar batch via T06 → abrir aba Lixeira → ver batch → restaurar → confirmar restauração no banco
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Restauração seletiva de itens dentro do lote (feature futura)
- Exportar lista de batches como CSV (feature futura)
- Paginação da lista de batches (assumir volume baixo no MVP; adicionar se > 50 batches)
- Notificação push/email quando lote expira

---

## Resumo de dependências

```
T01 (model)
├── T02 (EF cleanup)   ──→ T05 (hooks) ──→ T06 (UI dialog)
├── T03 (EF restore)   ──→ T05 (hooks) ──→ T07 (UI lixeira)
└── T04 (queries)      ──→ T06 (UI dialog, chats visíveis)
```

T04 pode ser executada em paralelo com T02 e T03 após T01 concluída.
T05 só inicia após T02 e T03 estarem deployadas.
T06 e T07 podem ser desenvolvidas em paralelo após T05.

## Estimativa total

| Task | Estimativa |
|------|-----------|
| T01 | L (8pt) |
| T02 | L (8pt) |
| T03 | M (5pt) |
| T04 | S (2pt) |
| T05 | S (2pt) |
| T06 | L (8pt) |
| T07 | M (5pt) |
| **Total** | **38pt** |

7 tasks — dentro do range ideal (3-8). Nenhuma ultrapassa 13pt.

## Quality gates checados

- [x] Toda task tem user story
- [x] Toda task tem critério de aceite testável
- [x] Estimativas em pontos (Fibonacci)
- [x] Sem CRUD solto (feature é de limpeza/restauração — não é inserção de entidade nova; regra Rodrigo não se aplica no sentido tradicional, mas as 2 EFs formam o par criar/desfazer)
- [x] Walking skeleton identificado (T01)
- [x] Dependências mapeadas
- [x] WSJF aplicado (T03 e T04 têm scores altos relativos ao tamanho — executar cedo)
- [x] 7 tasks no range 3-8
- [x] Toda task < 13pt
