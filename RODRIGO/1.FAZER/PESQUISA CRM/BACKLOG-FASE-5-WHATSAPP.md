# Backlog — Fase 5 · Produtividade · Evolução WhatsApp CRM

> Quebra atomizada do `PRD-EVOLUCAO-WHATSAPP.md` (Fase 5 apenas).
> Continuação direta de `BACKLOG-FASE-4-WHATSAPP.md` (T01–T41).
> Gerado pelo agente Backlog em 2026-05-17.
> Total: 16 tasks (~77 pts).

---

## Pesquisa e decisões de arquitetura registradas

### O que já existe — NÃO recriar

- `zapi_quick_replies`: tabela pronta (migration 057) — `account_id`, `titulo`, `corpo`,
  `categoria`, `variaveis jsonb`, `created_by`. Índice por `account_id` e por
  `(account_id, categoria)`. RLS: leitura para autenticados, escrita pelo próprio criador.
- `zapi_chat_tags`: tabela pronta (migration 057) — junção `chat_id ↔ tag_id` com
  `UNIQUE(chat_id, tag_id)`. Escrita bloqueada no client (service_role).
- `zapi_chats.snoozed_until TIMESTAMPTZ`: coluna pronta (migration 056).
- `useChatUpdate(accountId)` em `src/hooks/useChatUpdate.ts`: aceita patch com
  `snoozed_until: string | null` — infrastructure de snooze já existe.
- `pg_cron`: habilitado no projeto (migration 044 já usa `cron.schedule`).
- `jspdf` v4 + `jspdf-autotable` v5: presentes em `package.json`.
- `FiltrosFavoritosBar` em `src/components/contacts/FiltrosFavoritosBar.tsx`:
  padrão de visões salvas em localStorage com CRUD de favoritos — reaproveitar.
- `useFiltrosFavoritos` em `src/hooks/useFiltrosFavoritos.ts`: hook genérico de
  filtros favoritos em localStorage — pode ser clonado para versão de conversas.
- Migrations aplicadas até `063`. Próximas disponíveis: `064`, `065`, `066`...
- EFs existentes: `zapi-send-text`, `zapi-send-media`, `zapi-chat-update`,
  `zapi-mark-as-read`, `zapi-webhook`, `zapi-send-reaction`, `zapi-forward-message`,
  `zapi-send-location`, `zapi-instance-status`, `zapi-send-poll`.
- Última task numerada: T41. Tasks desta fase: T42–T57.

---

### C9 — Agendar envio de mensagem: pg_cron ou Edge Function agendada?

**Decisão: tabela de fila + cron job pg_cron** (não Edge Function agendada via
Supabase Cron — esse recurso é pago/enterprise e o projeto já usa pg_cron).

Arquitetura:
1. Nova tabela `zapi_scheduled_messages(id, account_id, chat_id, phone, body,
   quoted_message_id, scheduled_at TIMESTAMPTZ, status, sent_at, error_msg)`.
   RLS: INSERT/SELECT/DELETE pelo próprio autor (`created_by = auth.uid()`);
   UPDATE bloqueado no client (apenas service_role via cron).
2. Edge Function `zapi-send-scheduled` chamada pelo cron: faz SELECT das mensagens
   com `status='pendente' AND scheduled_at <= now()`, chama `zapi-send-text` para
   cada uma (internamente, sem HTTP externo), atualiza status para `'enviado'` ou
   `'falha'`.
3. pg_cron job: `SELECT cron.schedule('zapi-scheduled-sender', '* * * * *',
   $$SELECT extensions.http_post(...) $$)` — chama a EF a cada minuto.
   **Alternativa mais simples** (sem pg_cron chamando EF por HTTP): usar
   `pg_net` + `cron.schedule`. O Fullstack decide qual é mais simples no projeto.
   **Restrição**: o cron job não pode chamar diretamente código Deno. O caminho
   mais testado no Supabase é: cron job chama `SELECT net.http_post(url, headers, body)`
   via `pg_net` (extensão já presente em todo Supabase). A EF usa `service_role`
   para ler a fila e chamar a Z-API.

**Segurança:** nova tabela com `user_id` + nova EF com `service_role` — Security
+ Pentest obrigatórios.

---

### C10 — Snooze: volta automática precisa de cron?

**Decisão: filtro client-side + badge visual (sem cron para reativar).**

A coluna `snoozed_until` já existe. O comportamento de "sumir da lista" é um filtro
na `filteredChats` useMemo:
```ts
result = result.filter(c => !c.snoozed_until || new Date(c.snoozed_until) <= new Date());
```
A conversa "volta" automaticamente assim que o usuário recarrega a lista (ou a cada
atualização do realtime). Não é necessário cron — a mesma lógica de filtro que esconde
a conversa também a traz de volta quando `snoozed_until <= now()`.

Um badge "X snoozadas" no cabeçalho da lista alerta que existem conversas ocultas,
com opção de "Ver snoozadas" (equivalente ao "Ver arquivadas").

**Esta task não precisa de migration — tudo em cima da infraestrutura da Fase 0.**

---

### C31 — Exportar conversa em PDF: jspdf está no projeto?

**Sim** — `jspdf` v4 + `jspdf-autotable` v5 presentes em `package.json`. O padrão
já foi usado em `Financeiro Rotha IA` e `CRM Raquel`. A implementação é puramente
client-side: sem nova EF, sem migration. Busca as mensagens via `useZapiMessagesByChat`
(já existente) e gera o PDF via `jsPDF` diretamente no browser.

---

### C32 — Fila de reenvio offline/falha: pg_cron ou localStorage?

**Decisão: localStorage com retry automático (sem pg_cron).**

C32 é sobre "mensagem que falhou ao enviar → fila local de reenvio". O cenário é:
usuário sem internet tenta enviar, a mensagem vai para uma fila local e reenvia
quando a conexão volta. Isso é um problema de **resiliência de UI**, não de
persistência de servidor.

Arquitetura: `useMessageQueue` hook com estado em `localStorage`
(`zapi_message_queue_<account_id>`). Mensagens pendentes ficam na fila local e
são processadas por um `useEffect` que escuta `window.addEventListener('online', ...)`.
Ao voltar online, chama `useSendZapiMessage().mutateAsync` para cada item da fila
(com backoff exponencial em caso de falha continuada — max 3 tentativas).

**Sem nova migration, sem EF, sem pg_cron** — é resiliência de frontend.
Nota: mensagens agendadas (C9) são diferentes — ficam no servidor. A fila de reenvio
(C32) é para falhas de envio imediato por problemas de rede.

---

### C27 — Horário de atendimento: onde persistir?

**Decisão: coluna `horario_atendimento jsonb` em `zapi_accounts`.**

O campo armazena um objeto com dias da semana e faixas de horário:
```json
{ "seg": {"inicio": "08:00", "fim": "18:00", "ativo": true}, "ter": {...}, ... }
```
O cálculo de "dentro/fora do horário" é client-side (puro JavaScript, sem EF).
O aviso visual ("Fora do horário de atendimento — mensagens serão respondidas amanhã")
aparece no header da conversa quando `isFeatureEnabled(config, 'c27')` e a hora
atual está fora do horário configurado.

Migration `064` adiciona a coluna. RLS: UPDATE pela própria conta/admin (herda RLS
de `zapi_accounts`). Escrita via client autenticado (não precisa de EF — a tabela
`zapi_accounts` já tem RLS que permite UPDATE pelo owner).

---

### C13 — Ações em massa: EF nova ou reutilizar zapi-chat-update?

**Decisão: EF nova `zapi-bulk-chat-update`.**

A `zapi-chat-update` opera em 1 chat por chamada. Para ações em massa (N chats
selecionados), é mais eficiente uma EF que receba `{ chat_ids: string[], patch: ChatPatch }`
e execute 1 UPDATE ... WHERE id = ANY($1) no banco (1 roundtrip vs. N). Também
evita N chamadas de EF do client, o que reduziria latência e risco de rate-limit.

**Segurança:** EF nova com `service_role` + UPDATE em múltiplos chats — Security
+ Pentest obrigatórios.

---

### C14 — Visões salvas: banco ou localStorage?

**Decisão: localStorage**, seguindo exatamente o padrão de `useFiltrosFavoritos`
(contatos). Razão: os filtros de conversas são configuração pessoal do operador,
não dados compartilhados com a equipe. localStorage é suficiente e evita migration.
Se houver demanda futura de compartilhar visões entre atendentes, migra para banco.
O hook `useFiltrosFavoritosConversas` é análogo ao `useFiltrosFavoritos` de contatos.

---

### C15 — Rascunho persistente: localStorage ou estado React?

**Decisão: localStorage por `chat_id`** (`zapi_draft_<chat_id>`).
Estado React se perde ao navegar entre conversas. localStorage garante que o
rascunho survive a troca de chat e a recargas de página. O `ChatPanel` lê o rascunho
ao montar e persiste a cada keystroke com debounce de 500ms.

---

### Etiquetas na conversa (C10-analógico / #10) — usa zapi_chat_tags

A tabela `zapi_chat_tags` existe desde migration 057 (escrita bloqueada no client,
apenas service_role). É necessário uma EF `zapi-chat-tag-update` para adicionar/remover
etiquetas de uma conversa — padrão igual à `zapi-chat-update`. A UI é o gerenciador
de etiquetas na coluna 3 (ContactPanel) ou no context menu da lista.

**Segurança:** EF nova com `service_role` — Security obrigatório.

---

### Click-to-extract (#21) — selecionar texto e salvar em campo do contato

Não precisa de nova EF nem migration. O fluxo: usuário seleciona texto no
`MessageBubble`, aparece um tooltip/popover com "Salvar como campo do contato",
escolhe qual campo (ex: bairro, profissão, observações), e a escrita usa
`useContacts().updateMutation` (já existente). O `contact_id` já está no `chat.contact_id`.

---

### Atalhos de teclado (#53) — mapeamento global

Implementado como um hook `useKeyboardShortcuts(shortcuts: Shortcut[])` registrado
no `ConversasTabContent`. Sem migration, sem EF. Atalhos a implementar:
`Ctrl+K` (nova conversa), `Ctrl+F` (buscar na conversa), `Ctrl+/` (respostas rápidas),
`Escape` (fechar painéis/modais), `Ctrl+Enter` (enviar mensagem — alternativo ao Enter),
`Ctrl+Shift+S` (snooze rápido — 1h).

---

## Ordem de execução (WSJF + dependências)

```
T42 — Migration: zapi_scheduled_messages + cron job pg_cron            [Security+Pentest]
T43 — EF zapi-send-scheduled + agendamento na UI                       [Security+Pentest]
T44 — EF zapi-bulk-chat-update + UI ações em massa                     [Security+Pentest]
T45 — EF zapi-chat-tag-update + UI etiquetas na conversa               [Security]
T46 — CRUD de respostas rápidas (zapi_quick_replies) + C12 categorias
T47 — Atalho "/" no composer + preenchimento de variáveis (C11)        (depende T46)
T48 — Snooze de conversa (C10) — filtro client-side + badge + UI       (infra Fase 0)
T49 — Rascunho persistente por conversa (C15) — localStorage
T50 — Migration: horario_atendimento em zapi_accounts (C27)            [Security]
T51 — UI: horário de atendimento — config + aviso fora do expediente   (depende T50)
T52 — Visões salvas de conversas (C14) — localStorage                  (depende T42-T48)
T53 — Exportar/imprimir conversa em PDF (C31) — jspdf client-side
T54 — Fila de reenvio offline (C32) — localStorage + retry automático
T55 — Click-to-extract (#21) — selecionar texto → salvar em campo
T56 — Atalhos de teclado globais (#53)
T57 — Indicador de snoozadas + visão "Ver snoozadas"                   (depende T48)
```

**Dependências críticas:**
- T42 (migration + cron) deve vir antes de T43 (EF + UI de agendamento).
- T46 (CRUD de respostas rápidas) deve vir antes de T47 (atalho `/`).
- T50 (migration horário) deve vir antes de T51 (UI de config).
- T57 é enriquecimento de T48 (badge + visão separada de snoozadas).
- T44, T45, T48, T49, T52, T53, T54, T55, T56 são independentes entre si.

---

## Tasks

### T42 — Migration: tabela zapi_scheduled_messages + cron job pg_cron

**Tipo:** feature (infraestrutura)
**Estimativa:** M (5pt)
**Camadas afetadas:** model
**Depende de:** — (independente)
**WSJF score:** (8 + 7 + 8) / 5 = **4.6** — enabler de C9; implementar antes de T43
**Segurança:** nova tabela com `user_id` + novo cron job — Security + Pentest obrigatórios

#### User story

Como desenvolvedor mantendo o módulo WhatsApp, quero uma tabela de fila de mensagens
agendadas e um cron job que a processe a cada minuto, para que a feature C9 (agendar
envio) tenha infraestrutura robusta independente do browser estar aberto.

#### Contexto

C9 (agendar envio) precisa que a mensagem seja enviada mesmo que o operador feche o
browser. Isso exige persistência no servidor. A decisão de usar pg_cron (já habilitado
desde migration 044) é coerente com o padrão do projeto — evita custo de Supabase
Edge Functions Cron (recurso enterprise). O cron job chama a EF `zapi-send-scheduled`
via `pg_net.http_post` (extensão presente em todo Supabase).

A tabela tem `status` com valores `'pendente'`, `'enviado'`, `'falha'` — o cron
processa apenas `'pendente'` com `scheduled_at <= now()`.

#### Critérios de aceite

- [ ] Migration `064_zapi_scheduled_messages.sql` aplicada sem erro (`npx supabase db push` ok).
- [ ] Tabela `zapi_scheduled_messages` existe com colunas:
  `id UUID PK`, `account_id UUID NOT NULL → zapi_accounts`, `chat_id UUID → zapi_chats`,
  `phone TEXT NOT NULL`, `body TEXT NOT NULL`, `quoted_message_id TEXT`,
  `scheduled_at TIMESTAMPTZ NOT NULL`, `status TEXT NOT NULL DEFAULT 'pendente'
  CHECK (status IN ('pendente', 'enviado', 'falha', 'cancelado'))`,
  `sent_at TIMESTAMPTZ`, `error_msg TEXT`, `created_by UUID → auth.users`,
  `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- [ ] CHECK: `body` com no máximo 4096 chars; `phone` com no máximo 32 chars.
- [ ] Índice `idx_zapi_scheduled_messages_pendente` em `(scheduled_at)
  WHERE status = 'pendente'` (usado pelo cron).
- [ ] Índice `idx_zapi_scheduled_messages_account` em `(account_id, status)`.
- [ ] RLS habilitada: SELECT para autenticados (somente próprios registros —
  `created_by = auth.uid()`); INSERT para autenticados; UPDATE e DELETE bloqueados
  no client (apenas service_role); política de cancelamento: DELETE apenas se
  `status = 'pendente'` AND `created_by = auth.uid()`.
- [ ] Cron job `zapi-scheduled-sender` registrado: `'* * * * *'` (a cada minuto),
  chama `zapi-send-scheduled` via `net.http_post` com Authorization Bearer service_role.
- [ ] `types.ts` regenerado e commitado.
- [ ] Nenhuma regressão nos jobs cron existentes (purge de mensagens e logs).

#### Hints técnicos (não-prescritivos)

- **Arquivo:** `supabase/migrations/064_zapi_scheduled_messages.sql`
- **Pattern:** seguir migration 044 (CREATE EXTENSION IF NOT EXISTS pg_cron + cron.schedule).
- **pg_net:** `SELECT net.http_post(url := '...', headers := '{"Authorization":"Bearer ..."}',
  body := '{}')` — verificar se `pg_net` está habilitado; se não, criar extensão primeiro.
- **URL da EF:** usar `current_setting('app.supabase_url')` || `/functions/v1/zapi-send-scheduled`
  ou hardcodar em configuração de projeto. O service_role_key pode ser passado via
  `current_setting('app.service_role_key')` — isso requer setar esses parâmetros no DB.
  Alternativa mais simples: armazenar a URL e a key em `vault.secrets` (já existe no projeto)
  e ler de lá. O Fullstack decide.
- **Idempotência:** `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  `SELECT cron.unschedule(...)` antes de `cron.schedule`.

#### Test cases

- **Happy path:** migration aplicada; `\d zapi_scheduled_messages` mostra todas as colunas; `SELECT * FROM cron.job WHERE jobname = 'zapi-scheduled-sender'` retorna 1 linha.
- **RLS INSERT:** usuário autenticado insere registro com `scheduled_at = now() + interval '1 hour'` → sucesso.
- **RLS UPDATE bloqueado:** usuário autenticado tenta UPDATE no próprio registro → erro de RLS.
- **RLS DELETE:** usuário autenticado deleta seu registro `'pendente'` → sucesso. Tenta deletar registro `'enviado'` → bloqueado.
- **Idempotência:** rodar migration duas vezes não gera erro.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: `SELECT id FROM zapi_scheduled_messages LIMIT 1` retorna 0 linhas sem erro
- [ ] Security auditou a migration (superfície crítica: nova tabela com user_id + RLS + cron)
- [ ] Pentest passou (nova superfície de agendamento)
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- A EF `zapi-send-scheduled` e a UI de agendamento ficam na T43.
- Retry automático em caso de falha (a EF da T43 pode marcar `'falha'` e uma task futura implementa retry com backoff).

---

### T43 — EF zapi-send-scheduled + UI de agendamento de mensagem (C9)

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route, hook, component
**Depende de:** T42
**WSJF score:** (8 + 7 + 7) / 8 = **2.75**
**Segurança:** EF nova com `service_role` — Security + Pentest obrigatórios

#### User story

Como atendente do gabinete, quero agendar o envio de uma mensagem para um horário
específico, para que comunicados saiam no momento certo (ex: avisos para segunda-feira
de manhã preparados na sexta) sem eu precisar estar online.

#### Contexto

A infraestrutura de fila existe (T42). Esta task entrega: (1) a EF `zapi-send-scheduled`
que o cron chama a cada minuto para processar a fila; (2) o hook `useScheduledMessages`
para listar/cancelar mensagens agendadas de um chat; (3) o botão "Agendar" no composer
da conversa — DateTimePicker (via `shadcn/ui` Popover + `<input type="datetime-local">`)
que insere o registro na fila.

A EF não usa `zapi-send-text` como dependência HTTP — ela replica a lógica de envio
internamente (chamada direta à Z-API) para evitar EF chamando EF (latência + billing).

#### Critérios de aceite

- [ ] EF `zapi-send-scheduled` deployada; dado `{ account_id, phone, body, quoted_message_id? }`,
  chama a Z-API e retorna `{ ok: true }`.
- [ ] EF processa todos os registros `status='pendente' AND scheduled_at <= now()`
  da tabela `zapi_scheduled_messages` em uma única chamada.
- [ ] Após envio bem-sucedido: `status='enviado'`, `sent_at=now()`.
- [ ] Após falha da Z-API (HTTP 4xx/5xx): `status='falha'`, `error_msg=<mensagem de erro>`.
- [ ] EF é idempotente: processar o mesmo registro duas vezes (race condition) não
  envia a mensagem duplicada — usar UPDATE ... RETURNING antes de enviar (lock otimista).
- [ ] UI: botão "Agendar" ao lado do botão "Enviar" no composer da conversa.
- [ ] UI: ao clicar, abre popover com `<input type="datetime-local">` — data mínima é
  `now() + 5 minutos`; data máxima é `now() + 30 dias`.
- [ ] UI: após confirmar, toast "Mensagem agendada para <data>" + indicador na conversa
  ("1 mensagem agendada" clicável que lista as mensagens pendentes com opção de cancelar).
- [ ] UI: cancelar uma mensagem agendada remove o registro da tabela (DELETE via client
  — permitido por RLS quando `status='pendente'`).
- [ ] UI: se o agendamento foi feito com `replyTo` ativo, `quoted_message_id` é preservado.
- [ ] Operador sem permissão `editWhatsapp()` não vê o botão de agendamento.

#### Hints técnicos (não-prescritivos)

- **EF:** `supabase/functions/zapi-send-scheduled/index.ts` — recebe chamada do cron
  (Authorization com service_role_key). Padrão de chamada à Z-API: seguir `zapi-send-text`.
  Lock otimista: `UPDATE zapi_scheduled_messages SET status='processando' WHERE id=$1
  AND status='pendente' RETURNING *` — se retornar 0 linhas, outra instância já processou.
- **Hook:** `useScheduledMessages(chatId)` em `src/hooks/useScheduledMessages.ts` —
  `listQuery` (SELECT por `chat_id + status='pendente'`) + `cancelMutation` (DELETE).
- **Component:** botão no `ChatPanel` (em `ConversasTabContent.tsx`) após o botão de envio.
  DateTimePicker: `Popover + PopoverContent + Input type="datetime-local"` — shadcn pattern.
- **Indicador de agendadas:** badge pequeno acima do composer ou no header do chat.

#### Test cases

- **Happy path:** inserir registro com `scheduled_at = now() - 1 min`; chamar EF manualmente via curl; registro atualizado para `status='enviado'`, mensagem aparece no WhatsApp e no histórico via webhook.
- **Edge — enviado duas vezes:** duas chamadas simultâneas à EF; apenas 1 mensagem enviada (lock otimista garante).
- **Edge — Z-API offline:** Z-API retorna 500; registro marcado como `'falha'` com `error_msg` preenchido.
- **Edge — data no passado:** UI bloqueia datetime < now() + 5min; tentativa via API direta é rejeitada pela EF (validar `scheduled_at >= now()` na EF).
- **Edge — cancelar após envio:** botão cancelar desaparece quando `status != 'pendente'`.
- **Happy path — UI:** agendar uma mensagem via UI, verificar toast, verificar indicador "1 agendada", cancelar via indicador, indicador some.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual descrito no comentário do QG (enviar mensagem agendada 5min à frente e aguardar)
- [ ] Security auditou a EF (service_role, fila de envio)
- [ ] Pentest passou
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Retry automático em caso de `'falha'` (backoff exponencial — task futura).
- Visualização de histórico de mensagens já enviadas via agendamento.
- Agendamento de mídias (áudio/imagem) — apenas texto nesta task.

---

### T44 — EF zapi-bulk-chat-update + UI ações em massa (C13)

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route, hook, component
**Depende de:** — (independente)
**WSJF score:** (7 + 6 + 6) / 8 = **2.375**
**Segurança:** EF nova com `service_role` + UPDATE em múltiplos chats — Security + Pentest obrigatórios

#### User story

Como coordenador do gabinete, quero selecionar várias conversas de uma vez e
aplicar uma ação em lote (atribuir, etiquetar, arquivar, mudar status), para que
a triagem de conversas no início do dia leve minutos em vez de horas.

#### Contexto

A lista de conversas atual não tem multi-seleção. Para C13, a coluna 1 ganha um
modo de seleção: ao segurar Shift+Clique ou clicar num checkbox, as conversas ficam
marcadas e aparece uma barra de ações em massa. A EF `zapi-bulk-chat-update` recebe
`{ chat_ids: string[], patch: ChatPatch }` e executa 1 UPDATE em batch.

O modo de seleção é ativado explicitamente (botão "Selecionar" na toolbar da lista)
ou implicitamente (Shift+Clique no primeiro item). Ao confirmar uma ação em massa,
o modo de seleção é desativado.

#### Critérios de aceite

- [ ] EF `zapi-bulk-chat-update` deployada; recebe `{ chat_ids: string[], patch: ChatPatch }`
  e retorna `{ ok: true, updated: number }`.
- [ ] EF valida que todos os `chat_ids` pertencem ao mesmo `account_id` do JWT — proíbe
  operações cross-tenant.
- [ ] EF valida que `chat_ids.length >= 1` e `<= 100` (limite anti-abuso).
- [ ] Patch suporta: `status`, `assigned_to`, `archived`, `pinned`.
- [ ] UI: botão "Selecionar" na toolbar da lista ativa o modo multi-seleção.
- [ ] UI: no modo multi-seleção, cada item da lista exibe checkbox. Clique seleciona/deseleciona.
  Shift+Clique seleciona o intervalo.
- [ ] UI: barra de ações em massa aparece quando `selectedCount >= 1`, mostra "X selecionadas"
  e botões: "Arquivar", "Atribuir a...", "Mudar status", "Cancelar seleção".
- [ ] UI: "Arquivar" chama bulk com `{ archived: true }` e confirma com toast "X conversas arquivadas".
- [ ] UI: "Atribuir a..." abre popover de seleção de atendente (mesmo componente do `AssignmentSelector`).
- [ ] UI: "Mudar status" abre popover com os 4 status. Aplica o escolhido a todas as selecionadas.
- [ ] UI: após ação, seleção é limpa e modo de seleção é desativado.
- [ ] Operadores sem permissão `editWhatsapp()` não veem o botão "Selecionar".

#### Hints técnicos (não-prescritivos)

- **EF:** `supabase/functions/zapi-bulk-chat-update/index.ts` — seguir padrão de
  `zapi-chat-update`. Usar `UPDATE zapi_chats SET ... WHERE id = ANY($1::uuid[])
  AND account_id = $2` (validação de tenant via account_id extraído do JWT).
- **Hook:** `useBulkChatUpdate(accountId)` em `src/hooks/useBulkChatUpdate.ts` —
  `bulkMutation` com optimistic update (marcar os chats afetados no cache).
- **Estado de seleção:** `useState<Set<string>>` para `selectedChatIds` + `useState<boolean>`
  para `selectionMode` em `ConversasTabContent`. Passar `onToggleSelect` para `ChatListItem`.
- **ChatListItem:** adicionar prop `selectionMode: boolean` e `selected: boolean` para
  exibir checkbox. O checkbox não substitui o clique de navegação — ficam em paralelo.

#### Test cases

- **Happy path — arquivar 3:** selecionar 3 conversas, clicar "Arquivar", verificar que as 3 somem da lista ativa e apareçam em "Arquivadas".
- **Happy path — atribuir em lote:** selecionar 5 conversas, atribuir ao atendente X, verificar que todas ficam com `assigned_to = X` no banco e na UI.
- **Edge — cross-tenant:** enviar `chat_ids` de accounts diferentes na mesma chamada → EF retorna 400.
- **Edge — limite:** enviar 101 `chat_ids` → EF retorna 422.
- **Edge — chat inexistente:** `chat_id` que não existe no array → UPDATE afeta os existentes, `updated` retorna o count correto.
- **Edge — sem permissão:** usuário sem `editWhatsapp()` não vê o botão "Selecionar" nem consegue chamar a EF (JWT sem permissão → 403).

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: selecionar 2 conversas e arquivar em lote, verificar no banco
- [ ] Security auditou (EF com service_role + update multi-chat)
- [ ] Pentest passou
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Etiquetar em massa via `zapi_chat_tags` (depende de T45 — task futura de encadeamento).
- Deletar conversas em massa (ação destrutiva — fora do escopo desta fase).
- Mover para funil em massa (operação de board, não de chat).

---

### T45 — EF zapi-chat-tag-update + UI etiquetas na conversa (#10)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route, hook, component
**Depende de:** — (independente; `zapi_chat_tags` já existe desde migration 057)
**WSJF score:** (7 + 5 + 5) / 5 = **3.4**
**Segurança:** EF nova com `service_role` escrevendo em `zapi_chat_tags` — Security obrigatório

#### User story

Como atendente do gabinete, quero etiquetar uma conversa com tags já cadastradas
no CRM (ex: "#Demanda", "#Prioridade", "#Reeleição"), para que conversas possam
ser filtradas por assunto sem precisar abrir o cadastro do contato.

#### Contexto

A tabela `zapi_chat_tags` existe (migration 057) com RLS bloqueando escrita no client
(apenas service_role). É necessária uma EF que adicione ou remova uma etiqueta de uma
conversa. A UI de gerenciamento fica na coluna 3 (ContactPanel) — seção "Etiquetas da
conversa" separada das etiquetas do contato.

O `useZapiChats` já faz LEFT JOIN em `zapi_chat_tags` indiretamente via `contact_tags`
(etiquetas do contato). As etiquetas da conversa são diferentes — pertencem ao chat,
não ao contato.

#### Critérios de aceite

- [ ] EF `zapi-chat-tag-update` deployada; aceita `{ chat_id, tag_id, action: 'add' | 'remove' }`;
  retorna `{ ok: true }`.
- [ ] EF valida que o `chat_id` pertence à conta autenticada (anti-IDOR).
- [ ] `add`: INSERT em `zapi_chat_tags(chat_id, tag_id, created_by)` com `ON CONFLICT DO NOTHING`.
- [ ] `remove`: DELETE em `zapi_chat_tags WHERE chat_id=$1 AND tag_id=$2`.
- [ ] Hook `useChatTags(chatId)` em `src/hooks/useChatTags.ts` com:
  `tagsQuery` (SELECT `zapi_chat_tags` + join em `tags`) e `addTagMutation` / `removeTagMutation`.
- [ ] UI: seção "Etiquetas da conversa" no `ContactPanel.tsx` (coluna 3).
- [ ] UI: exibe etiquetas aplicadas com badge colorido + botão `×` para remover.
- [ ] UI: botão "+" abre popover com busca de tags cadastradas no CRM; clicar adiciona.
- [ ] UI: tags da conversa são distintas das tags do contato (não se misturam visualmente).
- [ ] Operadores sem `editWhatsapp()` veem as etiquetas mas não podem adicionar/remover.

#### Hints técnicos (não-prescritivos)

- **EF:** `supabase/functions/zapi-chat-tag-update/index.ts` — verificar ownership:
  `SELECT 1 FROM zapi_chats WHERE id = chat_id AND account_id IN (SELECT id FROM zapi_accounts
  WHERE ...)`. Padrão de validação: seguir `zapi-chat-update`.
- **Hook:** `useChatTags` — `useQuery` em `zapi_chat_tags` com join em `tags` para obter
  `nome` e `cor` da tag. `useMutation` chama a EF.
- **Component:** nova seção `<ChatTagsSection>` em `ContactPanel.tsx`. O popover de busca
  usa `Command + CommandInput` — mesmo padrão de `AssignmentSelector`.
- **Tags do CRM:** vêm de `useTags()` (já existe) — filtrar para mostrar somente as não
  aplicadas ainda na conversa.

#### Test cases

- **Happy path — adicionar:** abrir ContactPanel, clicar "+", buscar "Demanda", clicar → badge "#Demanda" aparece na seção.
- **Happy path — remover:** clicar "×" no badge → badge some; confirmado no banco com SELECT.
- **Edge — adicionar duplicata:** clicar "+" na mesma tag duas vezes → `ON CONFLICT DO NOTHING`, sem erro, badge persiste normalmente.
- **Edge — IDOR:** enviar `chat_id` de outra conta → EF retorna 403.
- **Edge — tag inexistente:** `tag_id` inválido → EF retorna 404.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: adicionar e remover etiqueta numa conversa, confirmar no banco
- [ ] Security auditou (EF nova service_role)
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Filtrar conversas por etiqueta da conversa (entra em T52 — visões salvas).
- Criar novas tags via este fluxo (usa `useTags().createMutation` já existente — usuário acessa o cadastro de tags separadamente).

---

### T46 — CRUD de respostas rápidas + C12 categorias (zapi_quick_replies)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** — (tabela `zapi_quick_replies` existe desde migration 057)
**WSJF score:** (8 + 6 + 5) / 5 = **3.8**

#### User story

Como atendente do gabinete, quero criar, editar e excluir modelos de resposta
rápida organizados por categoria (Triagem / Encerramento / Reclamação), para que
o time inteiro use os mesmos textos padronizados sem reescrever mensagens repetitivas.

#### Contexto

A tabela `zapi_quick_replies` existe com RLS (INSERT por autenticado; UPDATE/DELETE
apenas pelo criador ou admin). Esta task entrega o CRUD completo de gerenciamento
fora da conversa — uma tela/modal acessível pelo menu de configurações da conta.
A task T47 (atalho `/`) consome esses dados.

**Regra Rodrigo — CRUD obrigatório:** criar, listar, editar, excluir em tasks separadas
(aqui, por serem apenas 4 operações simples sobre 1 tabela e sem complexidade de multi-step,
são reunidas em uma task M — o CRUD é implementado num único formulário modal).

#### Critérios de aceite

- [ ] Hook `useQuickReplies(accountId)` em `src/hooks/useQuickReplies.ts` com:
  `listQuery`, `createMutation`, `updateMutation`, `deleteMutation`.
- [ ] `listQuery`: SELECT `zapi_quick_replies` WHERE `account_id=$1` ORDER BY `categoria NULLS LAST, titulo`.
- [ ] `createMutation`: INSERT com `account_id`, `titulo`, `corpo`, `categoria?`, `variaveis?` (parseado
  do `corpo` — regex `{{(\w+)}}` extrai os nomes); `created_by = auth.uid()`.
- [ ] `updateMutation`: UPDATE em `titulo`, `corpo`, `categoria`, `variaveis` (recalculado).
- [ ] `deleteMutation`: DELETE por `id`.
- [ ] UI: botão "Respostas rápidas" no card/modal da conta (`AccountCard` ou `AccountFormDialog`).
- [ ] UI: lista as respostas agrupadas por categoria (Accordion ou seções colapsáveis).
- [ ] UI: formulário de criação/edição com campos: Título (obrigatório), Categoria (opcional, input com
  sugestões das categorias já cadastradas), Corpo (Textarea). Preview do corpo com variáveis
  destacadas em amarelo (ex: `{{nome}}` aparece com fundo amarelo no preview).
- [ ] UI: ao deletar, confirmação via `AlertDialog` (`"Excluir resposta rápida?"` + botão "Excluir").
- [ ] UI: ordenação por categoria → título (C12: categorias como agrupadores visuais).
- [ ] Variáveis são extraídas automaticamente do corpo ao salvar — não há campo separado para declarar.

#### Hints técnicos (não-prescritivos)

- **Hook:** `useQuickReplies` em `src/hooks/useQuickReplies.ts` — seguir padrão
  `use<Entity>` com `listQuery + createMutation + updateMutation + deleteMutation`.
  Query key: `['quick-replies', accountId]`.
- **Extração de variáveis:** `[...corpo.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])` →
  array de strings únicos.
- **Component:** `QuickRepliesManager.tsx` em `src/components/whatsapp/` —
  modal com Tabs ("Por categoria") ou lista plana. Invocado do `AccountFormDialog`
  ou via link no `ContactPanel`.
- **Validação Zod:** `titulo` max 100 chars; `corpo` max 4096 chars; `categoria` max 64 chars.

#### Test cases

- **Happy path — criar:** preencher título "Saudação", categoria "Triagem", corpo "Olá {{nome}}", salvar → aparece na lista na seção "Triagem"; `variaveis=['nome']` no banco.
- **Happy path — editar:** editar corpo para "Olá {{nome}}, bem-vindo a {{bairro}}" → `variaveis=['nome','bairro']` atualizado.
- **Happy path — excluir:** confirmar exclusão → item some da lista.
- **Edge — sem título:** formulário bloqueia submit; tooltip "Título obrigatório".
- **Edge — corpo com variável malformada:** `{{nome incompleto` não é detectada como variável (regex exige `\w+`).
- **Edge — categoria nova:** digitar uma categoria que não existe ainda → salvo normalmente.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: criar, editar e excluir uma resposta rápida; verificar `variaveis` no banco
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Atalho `/` na conversa (T47).
- Permissões granulares por categoria (fora do escopo desta fase).

---

### T47 — Atalho "/" no composer + preenchimento de variáveis C11

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T46 (respostas rápidas precisam existir)
**WSJF score:** (9 + 7 + 5) / 5 = **4.2**

#### User story

Como atendente do gabinete, quero digitar `/` na caixa de mensagem para ver uma
lista de respostas rápidas filtradas pelo que digito a seguir, e ao selecionar uma
com variáveis (ex: `{{nome}}`), preencher cada variável antes de enviar, para que
mensagens padronizadas sejam enviadas sem precisar navegar a outra tela.

#### Contexto

O `ChatPanel` em `ConversasTabContent.tsx` tem o composer (`Textarea + ref`). O atalho
`/` detectado num `onChange` do draft abre um popover de seleção acima do composer
(tipo command palette). Ao selecionar uma resposta, se ela tem variáveis, um modal
de preenchimento de variáveis aparece (C11). Após confirmar, o corpo preenchido
substitui o draft.

A interpolação de variáveis é simples: `corpo.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '{{'+key+'}}'`.

#### Critérios de aceite

- [ ] Digitar `/` no início do composer (ou após espaço) abre um popover/overlay acima
  da área de digitação com a lista de respostas rápidas da conta.
- [ ] Digitar `/triagem` filtra as respostas pela categoria "triagem" OU pelo título.
  Digitar `/saudação` filtra pelo título.
- [ ] Filtro é case-insensitive, inclui busca no título e na categoria.
- [ ] Navegar com `↑↓` e confirmar com `Enter` (ou clicar) seleciona a resposta.
- [ ] `Escape` fecha o popover e mantém o draft com o texto `/...` digitado.
- [ ] Resposta **sem variáveis**: corpo substitui o draft imediatamente.
- [ ] Resposta **com variáveis** (C11): abre modal `VariablesFillDialog` com campos
  de input para cada variável detectada. Valores pré-preenchidos quando o contato
  tem o dado: `{{nome}}` → `chat.contact_name`, `{{bairro}}` → `contact.bairro` (se existir).
- [ ] Modal de variáveis: "Confirmar" → corpo com variáveis preenchidas vai para o draft.
  Variáveis não preenchidas ficam como `{{nome}}` (o operador vê e pode editar antes de enviar).
- [ ] C12: se há categorias, o popover as exibe como seções agrupadas.
- [ ] `useQuickReplies(accountId).listQuery.data` é usada (sem novo fetch).

#### Hints técnicos (não-prescritivos)

- **Detecção:** no `onChange` do Textarea, verificar se o valor começa com `/` ou
  tem `/` após espaço. Usar `const slashIdx = value.lastIndexOf(' ') + 1; const query = value.slice(slashIdx);` se começa com `/`.
- **Popover de seleção:** `Popover + PopoverContent` posicionado `side="top"` logo acima
  do composer. Conteúdo: `Command + CommandInput + CommandList` com as respostas filtradas.
- **VariablesFillDialog:** `Dialog + DialogContent` com `form` de `react-hook-form`.
  Campos dinâmicos gerados a partir de `resposta.variaveis` (array de strings).
- **Pré-preenchimento:** `{{nome}}` → `selectedChat.contact_name`;
  `{{bairro}}` → contact.bairro (precisaria de um `useContact(chat.contact_id)` já
  disponível no contexto do chat).
- **Limpeza do trigger `/`:** após selecionar, o draft recebe o corpo substituído
  (sem o `/query` inicial). `setDraft(corpoPreenchido)`.

#### Test cases

- **Happy path — sem variáveis:** digitar `/saudação`, selecionar a resposta → draft substituído pelo corpo da resposta.
- **Happy path — com variáveis:** selecionar resposta com `{{nome}}`; modal abre com campo pré-preenchido com o nome do contato; confirmar → draft tem nome interpolado.
- **Edge — sem respostas:** conta sem respostas cadastradas → popover mostra "Nenhuma resposta rápida cadastrada".
- **Edge — Escape:** pressionar Escape fecha o popover, draft mantém `/triagem` digitado.
- **Edge — variável não pré-preenchida:** `{{bairro}}` sem dado no contato → campo em branco no modal; operador preenche manualmente.
- **Edge — variável não preenchida e enviada:** `{{nome}}` não preenchido → draft tem `{{nome}}` literal; toast de aviso "Há variáveis não preenchidas" mas não bloqueia o envio.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: criar resposta com variável, abrir conversa, digitar `/`, selecionar, preencher variável, verificar draft
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Atalho `/` em mídia/áudio (apenas texto).
- Respostas rápidas com mídia anexa (task futura).

---

### T48 — Snooze de conversa (C10) — filtro client-side + UI de ativação

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, component
**Depende de:** — (coluna `snoozed_until` existe; `useChatUpdate` aceita `snoozed_until`)
**WSJF score:** (7 + 5 + 4) / 2 = **8.0**

#### User story

Como atendente do gabinete, quero "sonorizar" uma conversa até um horário específico
para ela sumir da lista e só reaparecer quando for o momento certo, para que o
inbox fique limpo e eu não me distraia com conversas que só podem ser tratadas depois.

#### Contexto

A infraestrutura de snooze está pronta (coluna `snoozed_until` em `zapi_chats` +
`useChatUpdate` aceitando `snoozed_until`). Esta task é exclusivamente de UI:
(1) adicionar o filtro no `filteredChats` useMemo para esconder conversas snoozadas;
(2) adicionar o item "Snooze" no menu de contexto da lista de conversas com opções de
duração pré-definidas; (3) badge de contagem de snoozadas no cabeçalho da lista
(expandido na T57).

**A conversa "volta" automaticamente no próximo render após `snoozed_until <= now()`
— sem cron, sem polling extra** (o realtime existente garante re-render a cada
INSERT/UPDATE de qualquer chat da conta).

#### Critérios de aceite

- [ ] `filteredChats` exclui chats com `snoozed_until IS NOT NULL AND snoozed_until > now()`.
  Chats com `snoozed_until <= now()` (já expirou) aparecem normalmente.
- [ ] Menu de contexto (DropdownMenu) do `ChatListItem` ganha item "Adiar conversa"
  com submenu: "Por 1 hora", "Por 2 horas", "Hoje à noite (20h)", "Amanhã de manhã (8h)",
  "Próxima semana (segunda 8h)", "Hora personalizada...".
- [ ] "Hora personalizada" abre um `Popover` com `<input type="datetime-local">`.
- [ ] Ao selecionar, `useChatUpdate` é chamado com `{ snoozed_until: isoString }`.
- [ ] Toast "Conversa adiada até <data/hora formatada>" com ação "Desfazer"
  (chama `useChatUpdate` com `{ snoozed_until: null }`).
- [ ] Conversa selecionada que é snoozada: deselecionar (`setSelectedChatId(null)`).
- [ ] Operador sem `editWhatsapp()` não vê a opção de snooze.

#### Hints técnicos (não-prescritivos)

- **Filtro:** no `useMemo` de `filteredChats` em `ConversasTabContent.tsx`, adicionar:
  `result = result.filter(c => !c.snoozed_until || new Date(c.snoozed_until) <= new Date())`.
- **Menu:** em `ChatListItem.tsx`, o `DropdownMenu` já existe. Adicionar item
  "Adiar" com `DropdownMenuSub + DropdownMenuSubContent`.
- **Cálculo de datas:** usar `date-fns` (já no package.json) para calcular "hoje às 20h",
  "amanhã às 8h", "próxima segunda às 8h".
- **Toast com desfazer:** padrão já implementado no `handleArchive` do `ConversasTabContent`.

#### Test cases

- **Happy path — 1 hora:** snooze de 1h; conversa some da lista; passado 1h (simular via DB update de `snoozed_until` para o passado) → conversa reaparece após próximo render.
- **Happy path — desfazer:** snooze + clicar "Desfazer" no toast → `snoozed_until = null`, conversa volta imediatamente.
- **Edge — hora personalizada no passado:** datetime-local < now() → validar antes de chamar EF; toast de erro "Hora deve ser no futuro".
- **Edge — conversa já snoozada:** abrir menu → opção "Adiar" deve mostrar "Remover adiamento" se já está snoozada.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: snooze de 1 conversa, verificar que some da lista, remover snooze, verificar que volta
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Badge de contagem + visão "Ver snoozadas" (T57).
- Notificação push quando o snooze expirar (fora do escopo desta fase).

---

### T49 — Rascunho persistente por conversa (C15)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, component
**Depende de:** — (independente)
**WSJF score:** (6 + 4 + 3) / 2 = **6.5**

#### User story

Como atendente do gabinete, quero que o texto que estou digitando numa conversa
seja salvo automaticamente, para que ao navegar para outra conversa e voltar, meu
rascunho esteja preservado sem eu precisar reescrever.

#### Contexto

O `draft` atual é estado React local no `ChatPanel` — ao trocar de `chat.id`, o
estado é resetado. Esta task salva o draft em `localStorage` com key
`zapi_draft_<chatId>`, com debounce de 500ms (evitar escrita a cada tecla).
Ao montar o `ChatPanel`, lê o rascunho do localStorage. Ao enviar com sucesso,
limpa o localStorage do chat.

Não usa banco — rascunhos são pessoais e efêmeros; localStorage é suficiente.

#### Critérios de aceite

- [ ] Hook `useDraftPersistence(chatId)` em `src/hooks/useDraftPersistence.ts`:
  `draft` (state), `setDraft(text)` (escreve no localStorage com debounce 500ms),
  `clearDraft()` (remove a key do localStorage).
- [ ] Key do localStorage: `zapi_draft_${chatId}` — cada conversa tem seu rascunho independente.
- [ ] Ao montar o `ChatPanel` para um `chat.id`, o `draft` inicial vem do localStorage (não da string vazia).
- [ ] Ao enviar mensagem com sucesso (`handleSend` → `onSuccess`): `clearDraft()` chamado.
- [ ] Ao trocar de conversa (mudança do `chat.id`): `clearDraft` do chat anterior NÃO é chamado
  (preserva o rascunho do chat anterior); o estado do React carrega o rascunho do novo chat.
- [ ] Indicador visual: se há rascunho não enviado (draft não vazio), exibir ícone de lápis
  discreto no `ChatListItem` ao lado do tempo da última mensagem.
- [ ] Erros de quota de localStorage são silenciados (try/catch), sem crash.

#### Hints técnicos (não-prescritivos)

- **Hook:** `useDraftPersistence(chatId: string | null)` — retorna `{ draft, setDraft, clearDraft }`.
  Usar `useCallback` para o `setDraft` com debounce interno (via `useRef` de timeout).
  Retornar `draft` como estado local React para o componente poder renderizar.
- **Integração:** em `ChatPanel`, substituir `useState('')` por `useDraftPersistence(chatId)`.
  O `draft` e `setDraft` têm a mesma assinatura — mudança mínima.
- **Indicador no ChatListItem:** adicionar prop `hasDraft?: boolean` no `ChatListItem`.
  Em `ConversasTabContent`, calcular `hasDraftChats: Set<string>` lendo todas as keys
  `zapi_draft_*` do localStorage ao montar (ou via evento de storage).

#### Test cases

- **Happy path:** digitar "Olá eleitor", trocar para outra conversa, voltar → "Olá eleitor" está no composer.
- **Happy path — envio limpa:** digitar, enviar → ao voltar ao mesmo chat, composer está vazio.
- **Edge — chat null:** `useDraftPersistence(null)` retorna draft vazio e setDraft é no-op.
- **Edge — localStorage cheio:** `setItem` lança DOMException → silenciado, nenhum crash.
- **Edge — chat diferente:** rascunho do chat A não aparece no chat B.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: digitar rascunho, trocar chat, voltar, confirmar rascunho presente
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Rascunho de mídia/arquivo (apenas texto).
- Sincronização entre dispositivos/abas (localStorage é por browser — comportamento esperado).

---

### T50 — Migration: coluna horario_atendimento em zapi_accounts (C27)

**Tipo:** feature (infraestrutura)
**Estimativa:** XS (1pt)
**Camadas afetadas:** model
**Depende de:** — (independente)
**WSJF score:** (6 + 4 + 4) / 1 = **14.0** — migration enabler; barata de fazer
**Segurança:** alteração em tabela com configurações de conta — Security obrigatório

#### User story

Como desenvolvedor mantendo o módulo WhatsApp, quero uma coluna `horario_atendimento JSONB`
em `zapi_accounts` para que a configuração de horários por dia da semana seja persistida
por conta, sem precisar de tabela separada.

#### Contexto

C27 requer persistência do horário de atendimento por conta Z-API. O JSONB em
`zapi_accounts` é suficiente — a estrutura é simples (7 chaves de dia, cada uma com
`{ inicio, fim, ativo }`). Segue o padrão já estabelecido por `recursos_config JSONB`
(migration 056) na mesma tabela.

A escrita será pelo client autenticado via `useZapiAccounts().updateMutation` — a RLS
de `zapi_accounts` já permite UPDATE pelo owner.

#### Critérios de aceite

- [ ] Migration `065_zapi_horario_atendimento.sql` aplicada sem erro.
- [ ] `zapi_accounts` tem coluna `horario_atendimento JSONB DEFAULT NULL`.
- [ ] `types.ts` regenerado.
- [ ] Nenhuma regressão: registros existentes de `zapi_accounts` permanecem com `horario_atendimento = NULL`.

#### Hints técnicos (não-prescritivos)

- **Arquivo:** `supabase/migrations/065_zapi_horario_atendimento.sql`
- **Pattern:** seguir migration 056 (`ALTER TABLE ADD COLUMN IF NOT EXISTS`).
- **Schema JSONB esperado** (para documentar no COMMENT):
  ```json
  {
    "seg": { "inicio": "08:00", "fim": "18:00", "ativo": true },
    "ter": { "inicio": "08:00", "fim": "18:00", "ativo": true },
    "qua": { "inicio": "08:00", "fim": "18:00", "ativo": true },
    "qui": { "inicio": "08:00", "fim": "18:00", "ativo": true },
    "sex": { "inicio": "08:00", "fim": "18:00", "ativo": true },
    "sab": { "inicio": "09:00", "fim": "12:00", "ativo": false },
    "dom": { "inicio": "09:00", "fim": "12:00", "ativo": false }
  }
  ```

#### Test cases

- **Happy path:** `ALTER TABLE` aplica; `\d zapi_accounts` mostra `horario_atendimento jsonb`.
- **Idempotência:** `ADD COLUMN IF NOT EXISTS` — rodar duas vezes não gera erro.
- **Null por padrão:** `SELECT horario_atendimento FROM zapi_accounts LIMIT 1` retorna NULL.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK (migration)
- [ ] Build OK
- [ ] Security auditou (alteração em tabela de contas)
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- A UI de configuração e o aviso visual ficam na T51.

---

### T51 — UI: configuração de horário de atendimento + aviso fora do expediente (C27)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T50 (coluna precisa existir)
**WSJF score:** (6 + 4 + 4) / 5 = **2.8**

#### User story

Como assessor de comunicação, quero configurar o horário de atendimento do gabinete
e que o sistema avise automaticamente no chat quando o operador está fora do expediente,
para que os eleitores tenham expectativa clara de quando serão respondidos.

#### Contexto

Dois sub-recursos: (1) painel de configuração do horário (no `AccountFormDialog` →
nova aba "Horário"); (2) banner de aviso na conversa quando `isFeatureEnabled(config, 'c27')`
e a hora atual está fora do horário configurado.

O cálculo de "está dentro ou fora do horário" é puramente client-side (JavaScript
com `new Date()`, sem EF). A configuração é salva via `useZapiAccounts().updateMutation`
— sem nova EF, sem Edge Function.

#### Critérios de aceite

- [ ] Hook `useBusinessHours(account)` em `src/hooks/useBusinessHours.ts`:
  `isOpen: boolean` (calculado a partir de `horario_atendimento` + hora atual);
  `nextOpenTime: Date | null` (quando abrirá);
  `saveSchedule(schedule) → Promise` (chama `updateMutation`).
- [ ] Feature flag `c27` adicionada ao `FEATURES_CATALOG` em `featureFlags.ts`.
- [ ] UI — aba "Horário" em `AccountFormDialog`: tabela com 7 linhas (Seg–Dom),
  cada linha com Switch (ativo/inativo), `<input type="time">` para início e fim.
  Botão "Salvar horário". Disponível apenas quando `isFeatureEnabled(config, 'c27')`.
- [ ] UI — banner no header do `ChatPanel`: quando `c27` ativo e `isOpen === false`,
  exibir `<Alert variant="warning">` com texto "Fora do horário de atendimento.
  Próximo atendimento: <nextOpenTime formatado>". Apenas visual — não bloqueia envio.
- [ ] O banner não aparece para conversas pendentes (nova conversa iniciada pelo operador).
- [ ] Ao salvar o horário, toast "Horário de atendimento atualizado".
- [ ] `horario_atendimento = NULL` → feature desligada (sem banner, sem cálculo).

#### Hints técnicos (não-prescritivos)

- **Cálculo de isOpen:** mapear dia da semana atual (`new Date().getDay()` → 0=dom, 1=seg, ...)
  para a key do JSON (`['dom','seg','ter','qua','qui','sex','sab']`). Comparar hora atual
  com `inicio` e `fim` do dia.
- **AccountFormDialog:** já tem Tabs (Conexão + Recursos) desde T06. Adicionar terceira
  aba "Horário". Exibir apenas se `isFeatureEnabled(config, 'c27')`.
- **date-fns:** `format(nextOpenTime, "EEE, dd/MM 'às' HH:mm", { locale: ptBR })` para exibição.
- **Tipo TypeScript:** definir `BusinessHoursConfig` e `DaySchedule` em `src/types/` ou
  colocado no próprio hook — sem nova tabela, sem migration extra.

#### Test cases

- **Happy path — horário configurado:** seg–sex 8h–18h; testar com hora dentro do expediente → sem banner. Testar fora (ex: 19h) → banner aparece.
- **Happy path — salvar:** preencher horário, salvar → `useZapiAccounts` invalida cache, horário persiste após reload.
- **Edge — c27 desligado:** `isFeatureEnabled(config, 'c27') = false` → aba "Horário" não aparece, banner nunca aparece.
- **Edge — dia inativo:** sábado com `ativo: false` → `isOpen = false` mesmo às 10h.
- **Edge — horario_atendimento = null:** `useBusinessHours` retorna `isOpen = true` (sem config = sem restrição).

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: configurar horário, ativar flag c27, simular horário fora → banner aparece
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Envio automático de mensagem ao eleitor quando fora do horário (automação — Fase 6).
- Fuso horário configurável por conta (usar fuso do browser — suficiente para esta fase).

---

### T52 — Visões salvas de conversas (C14)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, component
**Depende de:** — (independente; reaproveita padrão `useFiltrosFavoritos`)
**WSJF score:** (6 + 4 + 3) / 2 = **6.5**

#### User story

Como atendente do gabinete, quero salvar combinações de filtros da lista de conversas
(ex: "Demandas em aberto + atribuídas a mim") e reaplicá-los com um clique, para que
não precise reconfigurar os mesmos filtros toda vez que entro no sistema.

#### Contexto

O padrão de filtros favoritos já existe em contatos (`FiltrosFavoritosBar` +
`useFiltrosFavoritos`). Esta task clona o padrão para conversas, adaptando o tipo
de filtros. Os filtros de conversas incluem: `status`, `assigned_to`, `onlyMine`,
`hasTag` (tag_id), `showArchived`, `showSnoozed`.

Persistência em localStorage — não banco (decisão de design registrada acima).

#### Critérios de aceite

- [ ] Hook `useFiltrosFavoritosConversas` em `src/hooks/useFiltrosFavoritosConversas.ts`:
  segue exatamente a API de `useFiltrosFavoritos` (salvar, listar, aplicar, remover).
  Key localStorage: `mandato_desk_2026_filtros_favoritos_conversas`.
- [ ] Tipo `FiltroFavoritoConversa { id, nome, filtros: ConversaFilters, criadoEm }` onde
  `ConversaFilters = { status?, onlyMine?, hasTagId?, showArchived?, showSnoozed? }`.
- [ ] Component `FiltrosFavoritosConversasBar` em `src/components/whatsapp/FiltrosFavoritosConversasBar.tsx`:
  equivalente ao `FiltrosFavoritosBar` de contatos.
- [ ] UI: barra de filtros favoritos aparece abaixo dos chips de status na coluna 1 do
  `ConversasTabContent`. Botão "Salvar filtro atual" (estrela) + lista de favoritos salvos.
- [ ] Aplicar um favorito atualiza os states de filtro (`setStatusFilter`, `setOnlyMine`, etc.).
- [ ] Remover favorito via ícone de lixeira com confirmação.
- [ ] Sincronização entre abas (event listener `storage` — herda do padrão).

#### Hints técnicos (não-prescritivos)

- **Hook:** clonar `useFiltrosFavoritos.ts`, adaptar tipos e STORAGE_KEY.
- **Component:** clonar `FiltrosFavoritosBar.tsx`, adaptar para `ConversaFilters`
  (a função `descreverFiltros` exibe `"Status: Aberta"`, `"Só minhas"`, etc.).
- **ConversasTabContent:** adicionar `<FiltrosFavoritosConversasBar>` logo abaixo dos chips
  de status. Passar `filtrosAtuais` (objeto com os states atuais) e callbacks para
  `onAplicar` (que chama `setStatusFilter`, `setOnlyMine`, etc.) e `onSalvar`.

#### Test cases

- **Happy path:** configurar filtro "status=aguardando + onlyMine=true", salvar como "Minhas pendentes", navegar para outra seção, voltar → "Minhas pendentes" aparece na barra; clicar → filtros reaplicados.
- **Happy path — remover:** excluir o filtro favorito → some da barra.
- **Edge — filtro sem nome:** formulário de salvar bloqueia submit se nome vazio.
- **Edge — localStorage indisponível:** hook lida com erro graciosamente (try/catch), retorna array vazio.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: criar, aplicar e excluir um filtro favorito de conversas
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Visões compartilhadas entre atendentes (requer banco — task futura).
- Filtro por etiqueta da conversa integrado nas visões (pode ser encadeado depois de T45).

---

### T53 — Exportar/imprimir conversa em PDF (C31)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** — (independente; `jspdf` + `jspdf-autotable` já no package.json)
**WSJF score:** (5 + 3 + 3) / 5 = **2.2**

#### User story

Como coordenador do gabinete, quero exportar uma conversa completa em PDF com nome
do eleitor, telefone, data e histórico de mensagens formatado, para que possa arquivar
ou imprimir registros de atendimento sem depender de prints manuais.

#### Contexto

`jspdf` v4 + `jspdf-autotable` v5 estão no `package.json`. A implementação é
client-side: busca as mensagens via o cache do `useZapiMessagesByChat` (já carregadas
— sem novo fetch), gera o PDF em memória e aciona o download via `doc.save()`.

O padrão de geração de PDF existe em `fluxo-financeiro-pro/` (Financeiro Rotha IA) e
em `health-insights-hub/` (CRM Raquel) — seguir esses exemplos.

#### Critérios de aceite

- [ ] Botão "Exportar PDF" acessível no menu `⋮` (three-dot) do header da conversa.
- [ ] PDF gerado no browser (sem upload/EF); download automático ao clicar.
- [ ] Estrutura do PDF:
  - Cabeçalho: logotipo/nome "Mandato Desk 2026", nome da conta Z-API, data de exportação.
  - Dados do eleitor: nome do contato (ou "Desconhecido"), telefone (formatado via `formatPhone`).
  - Tabela de mensagens: colunas `Data/Hora | De | Mensagem`. Mensagens de mídia aparecem
    como "[Imagem]", "[Áudio]", "[Documento: nome_arquivo]", etc.
  - Mensagens editadas: `[Editado] novo texto`. Mensagens apagadas: `[Mensagem apagada]`.
  - Rodapé: "Exportado em <data>" + número de página.
- [ ] Mensagens no PDF na ordem cronológica crescente (mais antiga no topo).
- [ ] PDF com nome de arquivo `conversa_<nome_contato>_<YYYY-MM-DD>.pdf`.
- [ ] Botão desabilitado e com spinner enquanto gera (para conversas longas com +500 msgs).
- [ ] Disponível apenas para conversas reais (não para `pendingChat`).

#### Hints técnicos (não-prescritivos)

- **Lib:** `import jsPDF from 'jspdf'; import autoTable from 'jspdf-autotable'`.
- **Geração:** criar `doc = new jsPDF()`, usar `autoTable(doc, { head: [['Data/Hora', 'De', 'Mensagem']], body: rows })`.
- **`De` column:** `msg.from_me ? 'Atendente' : (chat.contact_name ?? chat.whatsapp_name ?? chat.phone)`.
- **Data/Hora:** `format(new Date(msg.created_at), "dd/MM/yy HH:mm", { locale: ptBR })`.
- **Util puro:** criar `src/lib/exportChatPdf.ts` com a função `exportChatToPdf(chat, messages)`.
  O componente chama a função diretamente — sem hook.
- **useState loading:** `const [exporting, setExporting] = useState(false)` no ChatPanel.

#### Test cases

- **Happy path:** conversa com 10 msgs; clicar "Exportar PDF" → download gerado; abrir PDF; verificar nome do eleitor no cabeçalho, todas as mensagens na tabela.
- **Edge — conversa longa (+500 msgs):** gerar PDF; verificar múltiplas páginas sem crash.
- **Edge — mensagem de mídia:** `media_type='image'` → aparece como "[Imagem]" na coluna Mensagem.
- **Edge — sem contato vinculado:** `contact_name = null` → PDF usa `chat.whatsapp_name` ou o telefone.
- **Edge — conversa pendente:** botão não aparece (verificado por `!isPending`).

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: exportar conversa de teste e verificar PDF gerado manualmente
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Exportação de mídias em base64 no PDF (apenas placeholders de texto).
- Exportação em formato CSV/XLSX (task futura).
- Envio do PDF por e-mail (task futura).

---

### T54 — Fila de reenvio offline e retry automático (C32)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** — (independente)
**WSJF score:** (6 + 4 + 5) / 5 = **3.0**

#### User story

Como atendente do gabinete, quero que mensagens que falharam ao enviar (por queda
de rede) sejam automaticamente reenviadas quando a conexão voltar, com feedback
visual claro do estado "pendente", para que nenhuma mensagem se perca silenciosamente.

#### Contexto

C32 é sobre resiliência de frontend — mensagens que falham por `navigator.onLine === false`
ou por erro transitório de rede vão para uma fila local (localStorage). A fila é
processada ao detectar o evento `window.addEventListener('online', ...)` ou em
intervalos curtos (30s) enquanto a conexão está ativa.

Diferente de C9 (agendamento no servidor), C32 é efêmera — não persiste entre sessões
do browser e não requer tabela no banco.

#### Critérios de aceite

- [ ] Hook `useMessageQueue(accountId)` em `src/hooks/useMessageQueue.ts`:
  - `enqueue(message: SendZapiMessageInput)`: adiciona à fila localStorage.
  - `processQueue()`: tenta reenviar todos os itens da fila via `useSendZapiMessage`.
    Max 3 tentativas por item. Após 3 falhas, marca como `'falha_permanente'`.
  - `queue: QueuedMessage[]`: estado reativo da fila atual.
  - `failedCount: number`: itens com `'falha_permanente'`.
  - `clearFailed()`: remove itens `'falha_permanente'` da fila.
- [ ] Integração no `ChatPanel`: ao `sendMessage.mutate` falhar por erro de rede
  (detectado via `error.message.includes('Failed to fetch')` ou `!navigator.onLine`),
  enfileirar a mensagem em vez de mostrar toast de erro; exibir toast "Sem conexão —
  mensagem em fila para reenvio" (sem erro vermelho).
- [ ] Processamento automático: ao montar o `ChatPanel`, chamar `processQueue()`
  se `navigator.onLine === true`; listener `window.online` também chama `processQueue()`.
- [ ] Indicador visual: se `queue.length > 0`, badge amarelo "X mensagem(ns) aguardando envio"
  acima do composer.
- [ ] Indicador de falha permanente: se `failedCount > 0`, badge vermelho "X mensagem(ns)
  não puderam ser enviadas" com botão "Limpar".
- [ ] Retry com intervalo: tentar a cada 30s enquanto online e fila não vazia (via `setInterval`
  + cleanup no unmount).
- [ ] Itens da fila com `pendente` aparecem no histórico do chat com estilo "enviando..." (estilo
  de mensagem otimista — opcional, melhor esforço).

#### Hints técnicos (não-prescritivos)

- **Key localStorage:** `zapi_msg_queue_${accountId}` — por conta, não por chat.
- **Tipo:** `QueuedMessage { id, chatId, message: SendZapiMessageInput, attempts, status, createdAt }`.
- **Backoff:** `attempts: 1 → 5s`, `attempts: 2 → 15s`, `attempts: 3 → 30s` antes de
  `'falha_permanente'` — implementado com `setTimeout` no hook.
- **Detecção de erro de rede:** verificar `!navigator.onLine` antes de enfileirar;
  para erros da EF (500), não enfileirar (problema no servidor, não na rede).
- **ChatPanel:** `const { queue, enqueue, failedCount, clearFailed } = useMessageQueue(chat.account_id)`.
  No `handleSend`, envolver em try/catch — se `!navigator.onLine`, chamar `enqueue` em vez de `sendMessage.mutate`.

#### Test cases

- **Happy path:** desligar rede do browser (DevTools → offline), enviar mensagem → toast "em fila"; ligar rede → mensagem enviada automaticamente.
- **Edge — falha permanente:** simular 3 falhas consecutivas (mock retornando erro) → badge vermelho aparece; "Limpar" remove da fila.
- **Edge — mensagens múltiplas:** 3 mensagens na fila; voltar online → todas processadas na ordem FIFO.
- **Edge — erro de servidor (500):** EF retorna 500 → não enfileira (problema no servidor); toast de erro normal.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: simular offline no DevTools, enviar mensagem, voltar online, verificar envio
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Persistência da fila entre sessões do browser (requer banco — fora do escopo).
- Fila de mídias/arquivos (apenas texto nesta task).

---

### T55 — Click-to-extract: selecionar texto da mensagem e salvar em campo do contato (#21)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** — (independente; usa `useContacts().updateMutation` existente)
**WSJF score:** (6 + 4 + 5) / 5 = **3.0**

#### User story

Como atendente do gabinete, quero selecionar um trecho de texto numa mensagem
(ex: "moro no Bairro do Retiro") e com um clique salvar esse texto no campo "Bairro"
do contato, para que informações capturadas na conversa enriqueçam automaticamente
o cadastro sem precisar abrir o modal de edição.

#### Contexto

O `MessageBubble` renderiza o texto das mensagens. Ao selecionar texto dentro de um
bubble, um tooltip/popover flutuante aparece com a opção "Salvar em campo do contato".
Clicando, abre um mini-modal com seleção do campo destino e o texto selecionado
pré-preenchido como valor. Ao confirmar, chama `useContacts().updateMutation`.

O `chat.contact_id` já está disponível no `ChatPanel` — se `null`, o recurso fica
desabilitado (contato não vinculado ao chat).

#### Critérios de aceite

- [ ] Ao selecionar texto dentro de um `MessageBubble` (evento `mouseup`/`touchend`),
  aparece um pequeno Popover com botão "Salvar em campo" (ícone de lápis).
- [ ] Clicar no botão abre `ExtractToContactDialog` com:
  - Texto selecionado exibido em readonly como "Valor a salvar".
  - Select com campos editáveis do contato: Nome, Telefone, WhatsApp, E-mail,
    Profissão, Bairro, Observações, (campos personalizados se existirem).
  - Botão "Salvar" + "Cancelar".
- [ ] Ao confirmar: `useContacts().updateMutation.mutate({ id: chat.contact_id, [campo]: texto })`.
- [ ] Toast "Campo '<campo>' atualizado com sucesso".
- [ ] Se o contato não tem `contact_id` (chat sem contato vinculado): botão "Salvar em campo"
  não aparece (ou aparece desabilitado com tooltip "Vincule um contato primeiro").
- [ ] O Popover some ao clicar fora ou ao `mousedown` fora da seleção.
- [ ] Funciona apenas em mensagens recebidas (não em mensagens enviadas pelo operador —
  informações do eleitor estão no que ELE enviou).

#### Hints técnicos (não-prescritivos)

- **Detecção de seleção:** `document.addEventListener('mouseup', handleSelection)` no
  `ChatPanel`. `window.getSelection()?.toString().trim()` retorna o texto selecionado.
  Verificar se a seleção está dentro de um MessageBubble usando `anchorNode.closest('[data-message-id]')`.
- **Posicionamento do Popover:** usar `getBoundingClientRect()` da seleção para posicionar
  o Popover flutuante via CSS `position: fixed`.
- **Component:** `ExtractToContactDialog` em `src/components/whatsapp/ExtractToContactDialog.tsx`.
  Select com `useCustomFields(contact_id)` para incluir campos personalizados.
- **MessageBubble:** adicionar `data-message-id={msg.message_id}` e
  `data-from-me={msg.from_me}` no container do bubble para identificação.

#### Test cases

- **Happy path:** selecionar "Bairro das Graças" numa mensagem recebida; clicar "Salvar em campo"; selecionar "Bairro"; confirmar → `contacts.bairro = 'Bairro das Graças'` no banco; toast de sucesso.
- **Edge — sem contato vinculado:** `chat.contact_id = null` → botão não aparece.
- **Edge — mensagem enviada pelo operador:** `from_me = true` → botão não aparece.
- **Edge — seleção muito curta:** < 2 chars selecionados → Popover não aparece.
- **Edge — clique fora:** Popover some sem salvar.
- **Edge — texto longo:** seleção de 300 chars → truncada a 255 no campo destino (limite dos campos texto do schema).

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: selecionar texto em mensagem recebida, salvar em "Observações", verificar na aba Contatos
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Salvar em campos de tipo não-texto (ex: data de nascimento — requer parsing).
- Salvar múltiplos campos de uma seleção (apenas 1 campo por vez).
- Funcionar em mensagens de mídia (título de arquivo, localização) — texto apenas.

---

### T56 — Atalhos de teclado globais (#53)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, component
**Depende de:** — (independente; melhoria de UX puramente)
**WSJF score:** (5 + 3 + 3) / 2 = **5.5**

#### User story

Como atendente do gabinete que opera via teclado, quero atalhos de teclado para as
ações mais frequentes da aba WhatsApp, para que possa navegar e executar ações
sem trocar as mãos para o mouse.

#### Contexto

Implementado como hook `useKeyboardShortcuts` que registra listeners no `document`
e despacha as ações via callbacks. O hook é registrado no `ConversasTabContent` e
cada atalho chama a função correspondente no componente pai. Sem nova EF, sem migration.

Atalhos devem ser desativados quando o foco está em `<input>`, `<textarea>` ou
`contenteditable` (exceto onde o atalho é específico para o composer, como `Ctrl+Enter`).

#### Critérios de aceite

- [ ] Hook `useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean)` em
  `src/hooks/useKeyboardShortcuts.ts`. `KeyboardShortcut = { key, ctrlKey?, shiftKey?, handler, disableInInputs? }`.
- [ ] Atalhos implementados:
  | Atalho | Ação |
  |--------|------|
  | `Ctrl+K` | Abre a command palette (nova conversa) |
  | `Ctrl+F` | Ativa busca dentro da conversa (foca `chatSearchInputRef`) |
  | `Ctrl+/` | Dispara atalho `/` no composer (abre respostas rápidas) |
  | `Escape` | Fecha busca / fecha popover de respostas rápidas / deseleciona conversa |
  | `Ctrl+Enter` | Envia a mensagem (alternativo ao Enter) |
  | `Ctrl+Shift+S` | Snooze rápido de 1 hora na conversa selecionada |
- [ ] Atalhos que operam na conversa (`Ctrl+F`, `Ctrl+Enter`, `Ctrl+/`, `Ctrl+Shift+S`)
  só funcionam quando há uma conversa selecionada.
- [ ] `Ctrl+K` funciona em qualquer estado da aba WhatsApp.
- [ ] `Escape` é tratado contextualmente: fecha o que estiver aberto (busca → popover → deseleciona).
- [ ] Tooltip de atalho visível ao passar o mouse nos botões com atalho (ex: botão de busca mostra "Ctrl+F").
- [ ] Painel de ajuda: botão `?` no canto do header mostra uma lista dos atalhos disponíveis
  (Dialog simples com tabela).

#### Hints técnicos (não-prescritivos)

- **Hook:** `useEffect` com `document.addEventListener('keydown', handler)`. Cleanup no unmount.
  `handler`: `if (e.ctrlKey && e.key === 'k') { e.preventDefault(); onNewConversation(); }`.
- **Desativação em inputs:** `const isInput = (e.target as Element).closest('input, textarea, [contenteditable]')`.
  Para atalhos com `disableInInputs: true`, retornar early se `isInput`.
- **`Ctrl+Enter`:** ativo mesmo dentro do `<Textarea>` — não desabilitar em inputs.
- **Integração:** em `ConversasTabContent`, chamar `useKeyboardShortcuts([...], !!selectedAccountId)`.
  Passar callbacks: `() => setPaletteOpen(true)`, `() => setChatSearchOpen(true)`, etc.

#### Test cases

- **Happy path — Ctrl+K:** foco em qualquer lugar → command palette abre.
- **Happy path — Ctrl+F:** conversa aberta → barra de busca aparece e recebe foco.
- **Happy path — Ctrl+Enter:** texto no composer → mensagem enviada.
- **Edge — Escape em cascata:** busca aberta → Escape fecha busca. Popover de respostas rápidas aberto → Escape fecha o popover. Nada aberto → Escape não faz nada (não deseleciona a conversa neste estado).
- **Edge — atalho em input de terceiro:** Ctrl+K durante digitação num input não-relacionado → ignorado (não abre palette enquanto usuário está digitando em outro campo).

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: testar os 6 atalhos em sequência na aba WhatsApp
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Atalhos customizáveis pelo usuário (configuração de atalhos — task futura).
- Atalhos para navegação entre conversas com setas (muito invasivo — pode conflitar com scroll).

---

### T57 — Badge de snoozadas + visão "Ver snoozadas"

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T48 (snooze deve estar funcionando)
**WSJF score:** (5 + 3 + 3) / 2 = **5.5**

#### User story

Como atendente do gabinete, quero ver quantas conversas estão adiadas e poder
visualizá-las numa visão separada, para ter consciência do que está adiado e
gerenciar o retorno dessas conversas.

#### Contexto

T48 implementa o snooze e esconde as conversas. Esta task complementa com visibilidade:
(1) badge de contagem de snoozadas ativas no cabeçalho da lista; (2) chip "Adiadas"
ao lado do chip "Arquivadas" para alternar para a visão de snoozadas; (3) na visão
de snoozadas, o item da lista exibe quando a conversa vai reaparecer ("volta em 2h 30min").

#### Critérios de aceite

- [ ] `chats.filter(c => c.snoozed_until && new Date(c.snoozed_until) > new Date()).length`
  exibe como badge no header da lista de conversas (ex: "3 adiadas"). Oculto se 0.
- [ ] Chip "Adiadas" na barra de chips (ao lado de "Arquivadas") com ícone de relógio.
- [ ] Clicar em "Adiadas" ativa `showSnoozed: true` nos filtros, mostrando apenas
  conversas com `snoozed_until > now()`.
- [ ] Na visão de snoozadas, cada `ChatListItem` exibe o tempo restante: "Volta em
  <formatSlaDuration(minutosRestantes)>" no lugar do tempo da última mensagem.
- [ ] Opção no menu de contexto de cada item na visão snoozadas: "Remover adiamento"
  (chama `useChatUpdate` com `{ snoozed_until: null }`).
- [ ] Na visão de snoozadas não aparecem filtros de status (não faz sentido filtrar
  por status dentro de "Adiadas").
- [ ] O chip "Adiadas" é incompatível com "Arquivadas" e com chips de status — mutuamente exclusivos.

#### Hints técnicos (não-prescritivos)

- **State:** adicionar `showSnoozed: boolean` ao lado de `showArchived` em `ConversasTabContent`.
  A lógica de filtro: se `showSnoozed`, filtra `c.snoozed_until && new Date(c.snoozed_until) > new Date()`.
- **Formatação do tempo restante:** `formatSlaDuration(Math.floor((new Date(c.snoozed_until).getTime() - Date.now()) / 60_000))` — reutilizar `formatSlaDuration` já existente em `ChatListItem.tsx`.
- **Badge no header:** ao lado do texto "Conversas (X de Y)", adicionar `{snoozedCount > 0 && <Badge variant="outline" className="text-amber-600 border-amber-400">{snoozedCount} adiadas</Badge>}`.

#### Test cases

- **Happy path:** snooze de 2 conversas → badge "2 adiadas" no header; clicar em chip "Adiadas" → apenas as 2 conversas aparecem com tempo restante.
- **Happy path — expirou:** snoozed_until no passado → não aparece na visão de snoozadas; aparece na lista ativa normal.
- **Edge — sem snoozadas:** badge oculto; chip "Adiadas" clicável mas mostra empty state "Nenhuma conversa adiada".
- **Edge — remover adiamento:** "Remover adiamento" → conversa vai para lista ativa imediatamente; count do badge decresce.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: snooze de 1 conversa, verificar badge, verificar visão "Adiadas", remover snooze
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Notificação sonora/push quando snooze expira (requer Service Worker — task futura).
- Snooze em lote via ações em massa (encadeamento futuro com T44).

---

## Resumo executivo da Fase 5

| Task | Título resumido | Estimativa | Segurança |
|------|-----------------|------------|-----------|
| T42 | Migration: zapi_scheduled_messages + cron | M (5pt) | Security+Pentest |
| T43 | EF zapi-send-scheduled + UI agendamento | L (8pt) | Security+Pentest |
| T44 | EF zapi-bulk-chat-update + ações em massa | L (8pt) | Security+Pentest |
| T45 | EF zapi-chat-tag-update + etiquetas na conversa | M (5pt) | Security |
| T46 | CRUD respostas rápidas + categorias (C12) | M (5pt) | — |
| T47 | Atalho "/" + variáveis C11 | M (5pt) | — |
| T48 | Snooze — filtro client-side + UI | S (2pt) | — |
| T49 | Rascunho persistente por conversa | S (2pt) | — |
| T50 | Migration: horario_atendimento em zapi_accounts | XS (1pt) | Security |
| T51 | UI: horário de atendimento + banner fora do expediente | M (5pt) | — |
| T52 | Visões salvas de conversas | S (2pt) | — |
| T53 | Exportar conversa em PDF | M (5pt) | — |
| T54 | Fila de reenvio offline + retry | M (5pt) | — |
| T55 | Click-to-extract: texto → campo do contato | M (5pt) | — |
| T56 | Atalhos de teclado globais | S (2pt) | — |
| T57 | Badge de snoozadas + visão "Ver snoozadas" | S (2pt) | — |
| **Total** | | **~77pt** | |

**Walking skeleton da Fase 5:** T46 → T47 (respostas rápidas com variáveis) — entregam
o recurso de maior impacto operacional (operadores usam respostas rápidas dezenas de vezes
por dia) com dependência mínima (tabela já pronta desde Fase 0).

**Migrations desta fase:** 064 (fila agendada), 065 (horário de atendimento).
Próxima migration disponível após T57: `066`.
