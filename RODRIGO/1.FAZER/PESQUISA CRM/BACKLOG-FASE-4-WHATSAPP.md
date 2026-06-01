# Backlog — Fase 4 · Interações Nativas do WhatsApp · Evolução WhatsApp CRM

> Quebra atomizada do `PRD-EVOLUCAO-WHATSAPP.md` (Fase 4 apenas).
> Continuação direta de `BACKLOG-FASE-3-WHATSAPP.md` (T01–T30).
> Gerado pelo agente Backlog em 2026-05-17.
> Total: 11 tasks (~52 pts).

---

## Pesquisa Z-API por recurso (base para estimativas e limitações)

### C1 — Responder/citar mensagem (reply-to)

Endpoint Z-API: `POST /send-text` com campo adicional `quoted: { messageId: "<id_zapi>" }`.
O Z-API suporta citação em mensagens de texto. Para mídia, a EF `zapi-send-media` também
aceita o campo `quoted`. Sem nova EF necessária — a `zapi-send-text` e `zapi-send-media`
existentes são estendidas. No `ReceivedCallback`, mensagens com quote chegam com campo
`quoted: { messageId, fromMe, body, type }` — o webhook não persiste esses dados ainda.

**Limitação conhecida:** a Z-API só retorna o `messageId` da mensagem citada, não o corpo
completo (o conteúdo vem no campo `quoted.body` somente em mensagens recebidas). Para
exibição no bubble, armazenamos o `quoted_message_id` + `quoted_body` (preview) que chegam
no ReceivedCallback.

### C2 — Reagir com emoji (enviar reação)

Endpoint Z-API: `POST /send-reaction` com body `{ phone, messageId, reaction }`.
O projeto já recebe e exibe reações inbound (media_type=reaction, migration 051).
Esta task é o ENVIO — nova EF `zapi-send-reaction`.

**Limitação:** a Z-API suporta apenas emojis de reação nativos do WhatsApp (os mesmos 6
padrão: ❤️ 👍 😂 😮 😢 👏 + extended no WhatsApp atual). Não há lista oficial fechada —
exibir um picker com os 6 principais é o caminho seguro.

### C3 — Encaminhar mensagem entre conversas

Endpoint Z-API: `POST /forward-message` com body `{ phone, messageId }` (a Z-API identifica
a instância pelo token na URL, então só precisa do `phone` de destino e o `messageId` da
mensagem a encaminhar). Não é necessário o número original remetente.

**Limitação:** encaminhar mídia de outros números funciona apenas se a mensagem foi
recebida na mesma instância Z-API (a Z-API não consegue encaminhar mensagens de outras
instâncias — só mensagens do próprio histórico da conta). Isso é suficiente para o caso
de uso: operador encaminha mensagem recebida de um eleitor para outro número.

### C5 — Favoritar mensagem

Tabela `zapi_chat_message_flags` já existe (migration 057) com `chat_id`, `message_id`
(texto Z-API), `flagged_by` (UUID do usuário). RLS: cada usuário gerencia os próprios
favoritos. Sem nova EF necessária — escrita direta via Supabase client com RLS.

### C6 — Recibos de leitura (✓✓ azul) + "digitando…"

**Recibos de leitura:** o webhook já trata `MessageStatusCallback` e atualiza
`zapi_messages.status` para `'read'` (código `handleStatusUpdate`). O `MessageBubble.tsx`
já exibe `CheckCheck` azul quando `status === 'read'`. O pipeline está completo.
Esta task é verificar que o fluxo end-to-end está funcionando + adicionar indicador
visual de "Visto em hh:mm" no hover do status icon (enriquecimento de UX).

**Digitando…:** a Z-API envia evento `PresenceCallback` com campo `state: 'composing'`
(ou `'paused'`, `'available'`). O webhook atual não trata esse tipo de evento — é preciso
adicionar o handler. Não requer nova tabela: o estado de "digitando" é efêmero e pode
ser armazenado apenas em memória (Supabase Realtime channel, sem persistir no banco).

**Arquitetura decidida:** usar Supabase Realtime `presence` (broadcast-only, sem banco)
para propagar o estado "digitando" aos clients conectados. O webhook recebe o evento
da Z-API e faz `supabase.channel('presence-<chat_id>').send(...)` via REST API do
Realtime ou via função de DB. Alternativa mais simples (sem presença Realtime): o webhook
salva em tabela efêmera com TTL de 30s, e o front usa polling curto (5s) — porém isso
é menos eficiente. **Decisão final para o Fullstack:** usar Realtime broadcast é o caminho
correto para este projeto (Supabase já está no stack).

### C7 — Mensagem de localização (receber e enviar)

**Receber:** o webhook já trata e persiste localização (branch `location` em
`extractMedia`, com `media_metadata: {latitude, longitude, name, address}`). O
`MessageBubble.tsx` já renderiza o tile de localização com link para Google Maps.
O recebimento está 100% implementado.

**Enviar:** endpoint Z-API `POST /send-location` com body
`{ phone, lat, lng, name?, address? }`. Nova EF `zapi-send-location` necessária.
Alternativa: estender `zapi-send-media` com `type: 'location'` — mas a semântica é
diferente (não é mídia), então EF própria é mais limpa.

### C8 — Edição e exclusão de mensagem do WhatsApp

Eventos Z-API:
- **Edição:** `EditedMessageCallback` com campos `messageId` (original) e `text.message`
  (novo conteúdo).
- **Exclusão:** `DeletedMessageCallback` com campo `messageId` (mensagem removida),
  possivelmente `deletedMessageId`.

O webhook atual não trata esses dois tipos. É necessário:
1. Adicionar colunas em `zapi_messages`: `edited_body TEXT` (conteúdo editado),
   `edited_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ`.
2. Adicionar os handlers no webhook.
3. Exibir no `MessageBubble` o estado "editada" (lápis + corpo novo) e "apagada"
   (balão fantasma).

**Limitação:** a Z-API só notifica edição/exclusão de mensagens recebidas na instância
(inbound). Mensagens enviadas pelo próprio operador pelo CRM: se o operador as apagar
pelo WhatsApp, a Z-API envia o callback e o CRM reflete. Se o operador tentar apagar
pelo CRM (ação proativa), seria necessário endpoint `/delete-message` — **Z-API não
documenta esse endpoint de forma clara**; deixamos fora do escopo desta task (apenas
receber e refletir edições/exclusões iniciadas no WhatsApp do eleitor ou operador).

---

## O que já existe e NÃO recriar

- `zapi_chat_message_flags` com RLS (migration 057) — já pronto para T35.
- `MessageBubble` com render de `status === 'read'` (CheckCheck azul) — recibo visual já existe.
- `handleStatusUpdate` no webhook atualiza `zapi_messages.status` para `'read'` — pipeline de leitura ok.
- Render de localização recebida no `MessageBubble` (case `'location'`) — T36 cobre apenas o envio.
- Branch `reaction` no `extractMedia` do webhook — recepção de reações já implementada.
- EFs existentes: `zapi-send-text`, `zapi-send-media`, `zapi-send-poll`, `zapi-chat-update`,
  `zapi-mark-as-read`, `zapi-instance-status`.
- Última migration aplicada: `061`. Próximas disponíveis: `062`, `063`, `064`...

---

## Decisões de design registradas

### C1 (reply): onde armazenar o contexto da mensagem citada?

A `zapi_messages` não tem colunas para quote. Precisamos adicionar:
- `quoted_message_id TEXT` — ID Z-API da mensagem citada (para correlacionar com o
  histórico local se disponível).
- `quoted_body TEXT` — preview do conteúdo citado (truncado a 500 chars), para exibir
  mesmo se a mensagem original não estiver mais no histórico local.
- `quoted_type TEXT` — tipo de mídia citada (text/image/audio/...), para renderizar
  o ícone certo no bubble de reply.

Esses campos são populados pelo webhook quando chega uma mensagem com `quoted`. Para
mensagens enviadas pelo CRM com reply, a EF `zapi-send-text` (estendida) recebe o
`quoted_message_id` e persiste no INSERT de `zapi_messages`.

**Migration 062** cobre essas 3 colunas + as colunas de C8 (`edited_body`, `edited_at`,
`deleted_at`) — todas nullable, expand-contract, sem downtime.

### C3 (encaminhar): EF nova ou extensão de send-text?

O endpoint `/forward-message` da Z-API tem contrato diferente de `/send-text` (recebe
`messageId` em vez de `message`). É uma EF separada `zapi-forward-message` para não
poluir a `zapi-send-text` com lógica condicional. O forward não persiste nova mensagem
no banco — a Z-API vai gerar um `ReceivedCallback`/`fromMe` que o webhook vai persistir
normalmente. Precisamos apenas de um "ack" de que o forward foi aceito.

### C5 (favoritar): EF ou client direto?

A RLS da `zapi_chat_message_flags` permite INSERT/DELETE diretamente pelo client
autenticado (`flagged_by = auth.uid()`). Não é preciso Edge Function — escrita direta
é mais simples e o RLS já garante que um usuário só flagga mensagens para si mesmo.

### C6 (typing): Realtime broadcast sem persistência

O estado "digitando" é efêmero (TTL de ~30s no WhatsApp). Persistir em banco seria
poluição. A abordagem: o webhook detecta `PresenceCallback` com `state: 'composing'`
e chama `supabase.realtime.broadcast('typing', { chatId, phone })` usando o service_role.
O front React subscreve ao canal `typing-<chatId>` e exibe o indicador por até 30s após
o último evento. Sem nova tabela, sem migration.

### C8 (edição/exclusão): apagar localmente, não via Z-API

Esta fase implementa apenas "receber e refletir" — se alguém apagou a mensagem no
WhatsApp, o CRM mostra "Mensagem apagada". A ação proativa de "apagar pelo CRM" fica
para fase futura (dependeria de endpoint Z-API não-documentado).

---

## Ordem de execução (dependências técnicas)

```
T31 — Migration: colunas de quote + edição/exclusão em zapi_messages     [Security]
T32 — Webhook: handler de quoted + EditedMessageCallback + DeletedCallback [Security+Pentest]
T33 — Estender zapi-send-text para suportar reply (campo quoted)          [Security]
T34 — UI: bubble de reply (citação) + botão "Responder" no context menu
T35 — Hook useMessageFlags + UI de favoritar mensagem + visão de favoritas
T36 — EF zapi-send-reaction + UI de reagir a mensagem                    [Security+Pentest]
T37 — EF zapi-forward-message + UI de encaminhar mensagem                [Security+Pentest]
T38 — EF zapi-send-location + UI de enviar localização                   [Security+Pentest]
T39 — UI: recibo de leitura enriquecido (tooltip "Visto em hh:mm")
T40 — Webhook: PresenceCallback + indicador "digitando..." na UI
T41 — UI: MessageBubble — exibir estado editado/apagado
```

**Dependências críticas:**
- T31 é a migration de base — T32, T33, T34, T41 dependem dela.
- T32 (webhook handler) deve ser feito antes de T41 (UI), pois sem o handler os eventos
  de edição/exclusão chegam mas são ignorados (sem dado no banco para exibir).
- T33 (EF estendida) deve ser feita antes de T34 (UI do reply).
- T34 depende de T31 + T33 (banco pronto + EF pronta).
- T35 é independente (banco já existe, RLS já existe — usa Supabase client direto).
- T36, T37, T38 são independentes entre si (EFs novas, cada uma com UI própria).
- T39 é puramente de UI sobre dados já existentes — independente.
- T40 depende de lógica no webhook (handler de PresenceCallback) + UI.
- T41 depende de T31 + T32 (colunas e dados precisam existir).

**Ordem recomendada:**
T31 → T32 → T33 → T34 → T35 → T36 → T37 → T38 → T39 → T40 → T41

T35, T39 e T41 podem ser paralelizadas com T36/T37/T38 se houver mais de um dev.

---

## Tasks

### T31 — Migration: colunas de quoted message + edição/exclusão em zapi_messages

**Tipo:** feature (infraestrutura)
**Estimativa:** S (2pt)
**Camadas afetadas:** model
**Depende de:** — (independente)
**WSJF score:** (9 + 9 + 8) / 2 = **13.0** — enabler; implementar primeiro
**Segurança:** migration em tabela existente com dados de mensagens — Security obrigatório

#### User story

Como desenvolvedor mantendo o módulo WhatsApp, quero colunas extras em `zapi_messages`
para persistir contexto de reply e estados de edição/exclusão, para que as features de
C1 e C8 tenham onde armazenar os dados sem quebrar registros existentes.

#### Contexto

`zapi_messages` é a tabela central de mensagens. Para suportar C1 (responder/citar) e
C8 (refletir edição/exclusão), precisamos de 6 novas colunas nullable (expand-contract,
sem `NOT NULL`, sem default obrigatório). Todas as linhas existentes ficam com NULL nesses
campos — sem impacto em produção.

Convenção já estabelecida nos backlogs anteriores: migrations sequenciais a partir de 062.

#### Critérios de aceite

- [ ] Migration `062_zapi_mensagens_quoted_edited.sql` aplicada sem erro em produção
  (`npx supabase db push` ok).
- [ ] `zapi_messages` tem as colunas: `quoted_message_id TEXT`, `quoted_body TEXT`,
  `quoted_type TEXT`, `edited_body TEXT`, `edited_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ`.
  Todas nullable, sem default.
- [ ] Índice parcial `idx_zapi_messages_edited` em `(chat_id) WHERE edited_at IS NOT NULL`
  para queries de "mensagens editadas neste chat".
- [ ] Índice parcial `idx_zapi_messages_deleted` em `(chat_id) WHERE deleted_at IS NOT NULL`.
- [ ] `types.ts` regenerado e commitado (as novas colunas aparecem em `Tables<'zapi_messages'>`).
- [ ] Nenhuma regressão em testes de envio/recebimento existentes.

#### Hints técnicos (não-prescritivos)

- **Arquivo:** `supabase/migrations/062_zapi_mensagens_quoted_edited.sql`
- **Pattern:** seguir migration 051 (adição de colunas nullable em `zapi_messages`).
- **Regenerar types:** `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts`
- **Não adicionar RLS extra:** `zapi_messages` já tem RLS existente; as novas colunas herdam.
- **Sem FK para quoted_message_id:** o `message_id` de `zapi_messages` é TEXT (ID Z-API),
  não UUID. Uma FK geraria problema de integridade quando mensagens antigas forem purgadas
  pelo cron (migration 044). Manter como TEXT simples.

#### Test cases

- **Happy path:** `npx supabase db push` executa sem erro; `\d zapi_messages` mostra as 6 novas colunas.
- **Idempotência:** rodar a migration duas vezes não gera erro (usar `ADD COLUMN IF NOT EXISTS`).
- **Dados existentes:** SELECT em `zapi_messages` retorna as linhas antigas com as novas colunas como NULL.
- **Typecheck:** `npm run build` (com types regenerado) passa sem erro de tipo em nenhum arquivo que importa `ZapiMessage`.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: `SELECT quoted_message_id, edited_at, deleted_at FROM zapi_messages LIMIT 1` retorna NULL sem erro
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Colunas de outros recursos de Fase 4 não relacionados a quote/edição (localização de envio, etc. já têm estrutura).
- Purge das colunas em cron (extensão futura se volumes forem altos).

---

### T32 — Webhook: handler de quoted + EditedMessageCallback + DeletedMessageCallback

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route (zapi-webhook)
**Depende de:** T31 (colunas precisam existir)
**WSJF score:** (8 + 8 + 7) / 5 = **4.6**
**Segurança:** alteração em Edge Function que processa todos os webhooks Z-API — Security + Pentest obrigatórios

#### User story

Como atendente do gabinete, quero que quando um eleitor edite ou apague uma mensagem
no WhatsApp, o CRM reflita essa mudança automaticamente, para que o histórico da conversa
seja fiel ao que o eleitor vê no próprio WhatsApp.

#### Contexto

O `zapi-webhook/index.ts` já tem um switch de tipos de evento. Precisamos adicionar:

1. **No handler `handleReceivedMessage`:** quando o payload tem `quoted` (campo Z-API
   presente em mensagens com reply), extrair `quoted.messageId`, `quoted.body` e
   `quoted.type` e incluir no INSERT de `zapi_messages`. O campo `quoted` não é parte
   do enum de `MediaExtract` — é metadado adicional do `ReceivedCallback`.

2. **Novo case `EditedMessageCallback`:** atualiza `edited_body = payload.text.message`
   e `edited_at = now()` na linha de `zapi_messages` onde `message_id = payload.messageId`
   e `account_id = accountId`.

3. **Novo case `DeletedMessageCallback`:** atualiza `deleted_at = now()` e
   `edited_body = null` na linha correspondente. O `body` original é preservado — apenas
   `deleted_at` marca que foi apagada (o CRM decide na UI o que exibir).

A Z-API envia `DeletedMessageCallback` com campo `messageId` (a mensagem apagada) e
possivelmente `deletedMessageId` (depende da versão da Z-API). Usar ambos defensivamente
(`payload.messageId ?? payload.deletedMessageId`).

#### Critérios de aceite

- [ ] Mensagem recebida com campo `quoted` (reply do eleitor) persiste `quoted_message_id`,
  `quoted_body` (truncado a 500 chars) e `quoted_type` no INSERT de `zapi_messages`.
- [ ] Evento `EditedMessageCallback`: `zapi_messages.edited_body` é atualizado com o novo
  texto; `edited_at` é setado com o timestamp atual. A linha é localizada por
  `message_id + account_id`.
- [ ] Evento `DeletedMessageCallback`: `zapi_messages.deleted_at` é setado; o `body`
  original NÃO é modificado (preservado para auditoria).
- [ ] Ambos os eventos são logados em `zapi_webhook_log` com `processing_status = 'processed'`.
- [ ] Evento desconhecido (ex: `EditedMessageCallback` em versão Z-API futura com formato
  diferente) não crasha a EF — cai no `default` do switch e loga `ignored`.
- [ ] Nenhuma regressão nos casos existentes: `ReceivedCallback`, `MessageStatusCallback`,
  `DisconnectedCallback`, `ConnectedCallback`.
- [ ] EF deployada (`npx supabase functions deploy zapi-webhook`).

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `supabase/functions/zapi-webhook/index.ts`
- **Extração do quoted:** adicionar campo `quoted?: { messageId?: string; body?: string; type?: string }` na interface `ZapiPayload`. No `handleReceivedMessage`, após o INSERT de `zapi_messages`, se `payload.quoted?.messageId` existir, fazer UPDATE na mesma linha (ou incluir no INSERT — mais simples) com os campos `quoted_*`.
- **EditedMessageCallback:** adicionar `case 'EditedMessageCallback':` no switch. Novo handler `handleEditedMessage(admin, accountId, payload)`.
- **DeletedMessageCallback:** similar. Handler `handleDeletedMessage(admin, accountId, payload)`. Usar `payload.messageId ?? (payload as { deletedMessageId?: string }).deletedMessageId` defensivamente.
- **Truncamento de quoted_body:** `String(payload.quoted?.body ?? '').slice(0, 500)`.
- **Sem nova tabela:** tudo vai nas colunas de T31 em `zapi_messages`.

#### Test cases

- **Happy path — quoted:** postar no webhook um `ReceivedCallback` com `quoted: { messageId: 'abc', body: 'Texto original', type: 'text' }` → linha inserida tem `quoted_message_id='abc'`, `quoted_body='Texto original'`.
- **Happy path — edited:** postar `{ type: 'EditedMessageCallback', messageId: 'msg-x', text: { message: 'Novo texto' } }` → `edited_body='Novo texto'`, `edited_at` setado, `body` original preservado.
- **Happy path — deleted:** postar `{ type: 'DeletedMessageCallback', messageId: 'msg-y' }` → `deleted_at` setado, `body` original mantido.
- **Edge — messageId inexistente:** UPDATE num `message_id` que não existe → 0 linhas afetadas, sem erro (UPDATE silencioso).
- **Edge — quoted sem body:** `quoted: { messageId: 'abc' }` sem body → `quoted_body = ''` ou `null`, sem crash.
- **Edge — evento desconhecido:** `{ type: 'FutureCallback' }` → cai no default, loga `ignored`, retorna 200.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK (Deno lint se disponível)
- [ ] Typecheck OK
- [ ] Build OK (`npx supabase functions deploy zapi-webhook --dry-run`)
- [ ] Smoke test: enviar payload de teste via curl para o webhook e verificar no `zapi_webhook_log` + `zapi_messages`
- [ ] Code review aprovado
- [ ] QA aprovou
- [ ] Security auditou a EF modificada

#### Out of scope

- PresenceCallback ("digitando") — coberto em T40.
- Forward de mensagem via webhook (Z-API trata forward como mensagem normal outbound).
- Notificação push para o atendente quando eleitor apaga mensagem.

---

### T33 — Estender zapi-send-text para suportar reply (campo quoted_message_id)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** route (zapi-send-text), action (hook)
**Depende de:** T31 (coluna `quoted_message_id` precisa existir)
**WSJF score:** (8 + 7 + 6) / 2 = **10.5**
**Segurança:** alteração em Edge Function de envio — Security obrigatório

#### User story

Como atendente do gabinete, quero citar uma mensagem específica ao responder, para que
o eleitor veja claramente a qual mensagem estou me referindo, igual ao comportamento
nativo do WhatsApp.

#### Contexto

A EF `zapi-send-text` já aceita `{ account_id, phone, message }`. Para suportar reply
(citação), a Z-API exige o campo `quoted: { messageId: "<id_zapi>" }` no body do
`POST /send-text`. Precisamos:

1. Aceitar `quoted_message_id?: string` no body da EF.
2. Se presente, incluir `quoted: { messageId }` no fetch para a Z-API.
3. No INSERT em `zapi_messages`, persistir `quoted_message_id` na nova coluna de T31.

Nota: `zapi-send-media` também pode precisar de suporte a quoted no futuro (responder
com imagem a uma mensagem), mas está fora do escopo desta task. O foco é texto.

O hook `useSendZapiMessage` em `src/hooks/useZapiMessages.ts` precisa ser extendido
com o campo opcional `quoted_message_id?: string`.

#### Critérios de aceite

- [ ] EF aceita `{ account_id, phone, message, quoted_message_id?: string }`.
- [ ] Quando `quoted_message_id` está presente, o body enviado à Z-API inclui
  `quoted: { messageId: "<quoted_message_id>" }`.
- [ ] O INSERT em `zapi_messages` inclui `quoted_message_id` na linha persistida.
- [ ] Quando `quoted_message_id` não está presente (null/undefined), o comportamento
  é idêntico ao atual (sem campo `quoted` no body da Z-API).
- [ ] `quoted_message_id` passa por validação básica: se presente, deve ser string
  não-vazia (senão 400).
- [ ] `SendZapiMessageInput` em `useZapiMessages.ts` inclui `quoted_message_id?: string`.
- [ ] EF deployada.

#### Hints técnicos (não-prescritivos)

- **Arquivo principal:** `supabase/functions/zapi-send-text/index.ts`
- **Interface `SendBody`:** adicionar `quoted_message_id?: string`.
- **Fetch para Z-API:** construir `zapiBody` condicionalmente:
  ```ts
  const zapiBody: Record<string, unknown> = { phone, message };
  if (quotedId) zapiBody.quoted = { messageId: quotedId };
  ```
- **INSERT em zapi_messages:** adicionar `quoted_message_id: quotedId ?? null`.
- **Hook:** `src/hooks/useZapiMessages.ts` — interface `SendZapiMessageInput`, campo opcional `quoted_message_id?: string`.
- **Sem breaking change:** o campo é opcional; todos os callers existentes continuam funcionando.

#### Test cases

- **Happy path — com reply:** `{ account_id, phone, message: 'Claro!', quoted_message_id: '3EB0796DC6B777C0C7CD' }` → Z-API recebe `{ phone, message, quoted: { messageId: '3EB0796DC6B777C0C7CD' } }` → mensagem enviada com citação.
- **Happy path — sem reply:** body sem `quoted_message_id` → comportamento idêntico ao atual.
- **Edge — quoted_message_id vazio:** `quoted_message_id: ''` → 400 "quoted_message_id inválido".
- **Edge — quoted_message_id com mensagem vazia:** `{ message: '', quoted_message_id: 'abc' }` → 400 "Mensagem não pode ser vazia" (validação de message acontece antes).

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: enviar mensagem com reply via UI, verificar que a Z-API processa e o WhatsApp do destinatário exibe a citação
- [ ] Code review aprovado
- [ ] QA aprovou
- [ ] Security auditou a EF

#### Out of scope

- Suporte a reply em `zapi-send-media` (extensão futura).
- Reply com citação de mídia (exigiria buscar o `media_url` da mensagem citada).

---

### T34 — UI: bubble de reply (citação) + botão "Responder" no context menu

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** component (MessageBubble, ConversasTabContent), hook
**Depende de:** T31 (colunas existem), T33 (EF estendida)
**WSJF score:** (8 + 7 + 5) / 5 = **4.0**
**Segurança:** puramente UI sobre dados existentes — sem gatilho Security/Pentest

#### User story

Como atendente do gabinete, quero ver qual mensagem foi citada dentro do balão de reply
e clicar em "Responder" para responder a qualquer mensagem com citação, para que a
comunicação seja clara e contextual como no WhatsApp nativo.

#### Contexto

Após T31 e T33, os dados de quote já chegam no banco (`quoted_message_id`, `quoted_body`,
`quoted_type`). Esta task entrega a experiência de UI:

1. **Bubble de reply:** quando uma mensagem tem `quoted_message_id` não-nulo, exibir
   um "mini-bloco" no topo do `MessageBubble` com o texto citado (`quoted_body`) e
   uma linha colorida à esquerda — igual ao WhatsApp nativo. Se `quoted_type` for
   imagem/áudio, exibir ícone correspondente em vez do texto.

2. **Botão "Responder":** ao passar o mouse sobre qualquer balão (ou long-press em
   mobile), exibir um micro-toolbar com ações contextuais. Nesta task: apenas o botão
   "Responder" (ícone Reply). As outras ações (reagir, encaminhar, favoritar) entram nas
   tasks T35, T36, T37.

3. **Estado de reply ativo no composer:** ao clicar em "Responder", o composer exibe
   um preview da mensagem citada acima do input, com botão X para cancelar. O `send`
   inclui o `quoted_message_id` no payload para a EF.

#### Critérios de aceite

- [ ] `MessageBubble` exibe, acima do corpo da mensagem, um bloco de citação quando
  `message.quoted_message_id` é não-nulo. O bloco tem: borda esquerda colorida (azul
  para mensagens outbound, cinza para inbound), texto `quoted_body` truncado a 80 chars
  + reticências se maior.
- [ ] Se `quoted_type` for `'image'` ou `'video'` ou `'audio'` ou `'document'`, o bloco
  de citação exibe o ícone correspondente (ImageIcon, Video, Music, FileText) + texto
  `quoted_body` (que pode ser caption ou vazio).
- [ ] Ao passar o mouse sobre um `MessageBubble`, aparece um micro-toolbar flutuante com
  pelo menos o botão "Responder" (ícone `Reply` do lucide-react).
- [ ] Ao clicar em "Responder", um banner de "Respondendo a:" aparece acima do campo
  de texto do composer, exibindo o preview da mensagem citada e um botão X para cancelar.
- [ ] Ao enviar (tecla Enter ou botão Enviar) com banner de reply ativo, o payload
  inclui `quoted_message_id` na chamada a `useSendZapiMessage`.
- [ ] Clicar no botão X do banner cancela o reply (sem enviar a mensagem).
- [ ] O banner de reply e o estado de "mensagem citada ativa" são resetados após o envio
  (sucesso ou erro).
- [ ] Em mobile (viewport < 768px), o micro-toolbar é ativado por botão contextual
  (não hover), pois hover não funciona em touch.

#### Hints técnicos (não-prescritivos)

- **Arquivos a editar:** `src/components/whatsapp/MessageBubble.tsx` + `ConversasTabContent.tsx` (composer).
- **Props novas em MessageBubble:** `onReply?: (message: ZapiMessage) => void` — callback acionado pelo botão Responder.
- **Estado no composer:** `useState<ZapiMessage | null>` para `replyTo`. Quando não-null, renderiza o banner.
- **Micro-toolbar:** `div` absoluto com `opacity-0 group-hover:opacity-100 transition-opacity` dentro do wrapper do `MessageBubble`. Em mobile, usar botão com `...` que abre um mini-menu.
- **Bloco de citação:** componente `QuotedMessageBlock` extraído — reutilizável tanto no bubble (para exibir mensagem citada recebida) quanto no composer (para exibir o preview de reply ativo).
- **ZapiMessage com campos novos:** com T31 aplicado, `Tables<'zapi_messages'>` já terá `quoted_message_id`, `quoted_body`, `quoted_type`. Usar diretamente sem cast.

#### Test cases

- **Happy path — exibição:** mensagem inbound com `quoted_body: 'Preciso do documento X'` e `quoted_type: 'text'` → bubble exibe bloco cinza com o texto acima do corpo.
- **Happy path — reply flow:** clicar "Responder" em qualquer mensagem → banner aparece → digitar "Claro, enviando agora!" → Enter → mensagem enviada com `quoted_message_id` → na conversa, o novo bubble exibe o bloco de citação.
- **Happy path — cancelar:** clicar X no banner → banner some, input limpo, mensagem enviada sem quoted.
- **Edge — quoted_body longo (>80 chars):** texto truncado no bloco de citação, sem quebrar o layout.
- **Edge — quoted_type = 'image' sem body:** bloco exibe ícone ImageIcon + texto "[Imagem]".
- **Edge — mensagem sem quoted:** `MessageBubble` renderiza normalmente sem o bloco de citação.
- **Mobile:** sem hover, o micro-toolbar é acessível por toque/botão contextual.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: abrir conversa, clicar "Responder" em mensagem, enviar reply, verificar que o bloco de citação aparece no novo bubble
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Reagir, encaminhar, favoritar no micro-toolbar (T35, T36, T37).
- Scroll automático até a mensagem citada ao clicar no bloco de citação (nice-to-have futuro).
- Reply com mídia (citação de imagem + envio de imagem) — exigiria estender `zapi-send-media`.

---

### T35 — Hook useMessageFlags + UI de favoritar mensagem + visão de favoritas

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** — (zapi_chat_message_flags já existe desde T02 da Fase 0)
**WSJF score:** (6 + 5 + 4) / 5 = **3.0**
**Segurança:** escrita client-side com RLS (flagged_by = auth.uid()) — sem gatilho Security/Pentest

#### User story

Como atendente do gabinete, quero favoritar mensagens importantes de uma conversa e
ter uma visão dedicada com todas as minhas mensagens favoritadas, para não perder
informações críticas num histórico longo.

#### Contexto

`zapi_chat_message_flags` já existe (migration 057) com `chat_id`, `message_id` (ID Z-API
text), `flagged_by` (UUID do usuário). A RLS já permite que cada usuário faça INSERT e
DELETE nos próprios registros diretamente pelo client Supabase (sem EF necessária). Esta
task entrega o hook, o botão estrela no micro-toolbar do MessageBubble e a visão de
mensagens favoritas.

A visão de favoritas é um painel/aba lateral na coluna 3 (ContactPanel) ou uma seção
dentro do chat — decisão para o Fullstack. A abordagem mais simples: uma aba "Favoritas"
no header do ChatPanel que lista as mensagens flagged para o usuário atual nessa conversa.

#### Critérios de aceite

- [ ] `useMessageFlags(chatId)` em `src/hooks/useMessageFlags.ts` expõe:
  - `flagsQuery`: lista `message_id` flagados pelo `auth.uid()` neste `chat_id`.
  - `flagMutation`: INSERT em `zapi_chat_message_flags` com `{chat_id, message_id, flagged_by: auth.uid()}`.
  - `unflagMutation`: DELETE pelo `id` do flag (ou por `chat_id + message_id + flagged_by`).
  - `isFlagged(messageId): boolean` — helper derivado de `flagsQuery.data`.
- [ ] Micro-toolbar do `MessageBubble` inclui botão estrela (ícone `Star`/`StarOff`
  do lucide-react) com estado preenchido/vazio conforme `isFlagged(message.message_id)`.
- [ ] Ao clicar na estrela, toggle: se não flagado → chama `flagMutation`; se flagado →
  chama `unflagMutation`. Toast de sucesso/erro em ambos.
- [ ] Botão estrela com estado visual otimista (muda imediatamente, reverte em erro).
- [ ] No header do ChatPanel, botão "Favoritas" (ícone `Bookmark`) exibe o total de
  favoritas do usuário atual naquele chat (badge numérico quando > 0).
- [ ] Ao clicar em "Favoritas", uma lista vertical exibe os balões das mensagens
  favoritadas (renderizando `MessageBubble` em modo compacto com timestamp).
- [ ] A visão de favoritas volta ao histórico normal ao clicar novamente em "Favoritas"
  ou num botão "Voltar ao histórico".
- [ ] Ao trocar de chat, a visão de favoritas é resetada (volta ao histórico).

#### Hints técnicos (não-prescritivos)

- **Arquivo novo:** `src/hooks/useMessageFlags.ts`.
- **Key factory:** `messageFlagKeys = { byChatAndUser: (chatId, userId) => ['message-flags', chatId, userId] }`.
- **SELECT:** `supabase.from('zapi_chat_message_flags').select('id, message_id').eq('chat_id', chatId).eq('flagged_by', userId)`.
- **Optimistic toggle:** no `onMutate` da `flagMutation`, adicionar o `message_id` ao cache; em `unflagMutation`, remover. Rollback em `onError`.
- **Visão de favoritas:** filtrar `messages` (já no estado do ChatPanel) pelo `isFlagged` — sem nova query ao banco. Os balões são os `MessageBubble` normais.
- **Integração com micro-toolbar:** passar `onFlag` e `isFlagged` como props para `MessageBubble` (junto com `onReply` de T34).

#### Test cases

- **Happy path — favoritar:** clicar estrela em mensagem → estrela fica preenchida, badge no header incrementa.
- **Happy path — desfavoritar:** clicar estrela novamente → estrela fica vazia, badge decrementa.
- **Happy path — visão de favoritas:** clicar "Favoritas" no header → apenas as mensagens flagadas aparecem na lista.
- **Edge — 0 favoritas:** painel de favoritas exibe empty state "Nenhuma mensagem favoritada ainda."
- **Edge — erro de rede ao favoritar:** optimistic update reverte, toast.error exibido.
- **Edge — trocar de chat:** visão de favoritas fecha automaticamente ao selecionar outro chat.
- **Isolamento de usuário:** favoritas do usuário A não aparecem para o usuário B (RLS garante; validar que a query filtra por `flagged_by = auth.uid()`).

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: favoritar 2 mensagens, abrir visão de favoritas, desfavoritar 1, verificar que lista atualiza
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Favoritas compartilhadas entre usuários (cada usuário tem seus próprios favoritos).
- Visão global de favoritas (de todos os chats) — extensão futura.
- Notificação ao favoritar.

---

### T36 — EF zapi-send-reaction + UI de reagir a mensagem

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route (nova EF), hook, component
**Depende de:** — (independente)
**WSJF score:** (7 + 6 + 5) / 8 = **2.25**
**Segurança:** nova Edge Function com chamada à Z-API — Security + Pentest obrigatórios

#### User story

Como atendente do gabinete, quero reagir a uma mensagem do eleitor com um emoji, para
comunicar de forma rápida e sem precisar digitar uma resposta completa.

#### Contexto

O projeto já recebe e persiste reações inbound do eleitor (media_type=reaction, migration
051, branch `reaction` no webhook). Esta task é o ENVIO de reação pelo atendente.

A Z-API expõe `POST /send-reaction` com body `{ phone, messageId, reaction }`. O campo
`reaction` é o emoji Unicode (ex: `"❤️"`). Para remover uma reação, enviar `reaction: ""`.

O CRM não persiste reações enviadas como linha separada em `zapi_messages` — a Z-API vai
devolver um `ReceivedCallback` com `fromMe: true` e `reaction: { value: "❤️" }` que o
webhook já persiste normalmente. Assim, a reação enviada vai aparecer na conversa via
realtime como qualquer outra mensagem.

**Picker de emoji:** não instalar biblioteca pesada de emoji picker. Usar um popover
simples com os 6 emojis-padrão de reação do WhatsApp: ❤️ 👍 😂 😮 😢 👏. Suficiente para
o caso de uso político (agilidade > completude).

#### Critérios de aceite

- [ ] Nova EF `supabase/functions/zapi-send-reaction/index.ts` aceita
  `{ account_id, phone, message_id, reaction }` via POST autenticado.
- [ ] `reaction` deve ser um dos 6 emojis-padrão ou string vazia (para remover reação).
  Validação: length <= 8 chars (um emoji Unicode composto pode ter até 7 bytes). Se
  string inválida (> 8 chars), retornar 400.
- [ ] EF chama Z-API `POST /send-reaction` com `{ phone, messageId: message_id, reaction }`.
- [ ] Erros da Z-API (4xx/5xx) são repassados com código 502 sem vazar tokens.
- [ ] `useReactToMessage` em `src/hooks/useZapiReaction.ts` expõe mutation que invoca a EF.
  Em sucesso, invalida `zapiMessageKeys.byChat(chatId)` para que o realtime traga a reação.
- [ ] Micro-toolbar do `MessageBubble` exibe botão de sorriso (ícone `Smile`) que abre
  um `Popover` com os 6 emojis de reação dispostos em linha.
- [ ] Ao selecionar um emoji, o popover fecha e a mutation é disparada.
- [ ] Toast de erro se a EF retornar falha.
- [ ] EF deployada (`npx supabase functions deploy zapi-send-reaction`).

#### Hints técnicos (não-prescritivos)

- **Arquivo novo:** `supabase/functions/zapi-send-reaction/index.ts`
- **Pattern:** seguir estrutura de `zapi-send-text/index.ts` (requireAuth, busca conta, fetch para Z-API).
- **Z-API endpoint:** `POST https://api.z-api.io/instances/{id}/token/{token}/send-reaction`
  Body: `{ phone, messageId, reaction }`.
- **Validação de reaction:** `const VALID_REACTIONS = ['❤️','👍','😂','😮','😢','👏','']`. Verificar inclusão.
- **Hook:** `src/hooks/useZapiReaction.ts` — `useReactToMessage(chatId)` retorna `useMutation`.
- **UI:** micro-toolbar com `<Popover>` do shadcn. Os 6 emojis como botões inline `text-xl`.
- **Props em MessageBubble:** `onReact?: (messageId: string, emoji: string) => void`.

#### Test cases

- **Happy path:** clicar sorriso em mensagem → popover abre → selecionar ❤️ → popover fecha → toast "Reação enviada" → em breve (via realtime) a reação ❤️ aparece no chat.
- **Happy path — remover reação:** se o atendente já reagiu, clicar no mesmo emoji novamente envia `reaction: ""` (a Z-API remove a reação).
- **Edge — conta desconectada:** EF retorna 422 → toast.error "Conta desconectada".
- **Edge — emoji inválido:** mandar emoji fora da lista no body direto → 400 "Reação inválida".
- **Edge — messageId inválido:** Z-API retorna erro → 502 → toast.error.
- **Security:** tokens da conta nunca aparecem no response da EF.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: reagir a uma mensagem no chat real, verificar que o emoji aparece no WhatsApp do destinatário
- [ ] Code review aprovado
- [ ] QA aprovou
- [ ] Security auditou a EF
- [ ] Pentest executado (nova EF com chamada à Z-API)

#### Out of scope

- Picker completo com todos os emojis Unicode (Fase 5 ou sob demanda).
- Exibição de quais usuários reagiram a cada mensagem (informação não retornada pela Z-API para mensagens enviadas).
- Reação em mensagens de mídia (funciona, mas sem UI diferenciada).

---

### T37 — EF zapi-forward-message + UI de encaminhar mensagem

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route (nova EF), hook, component
**Depende de:** — (independente)
**WSJF score:** (6 + 5 + 4) / 8 = **1.875**
**Segurança:** nova Edge Function com chamada à Z-API — Security + Pentest obrigatórios

#### User story

Como atendente do gabinete, quero encaminhar uma mensagem (texto ou mídia) de um
eleitor para outro número, para compartilhar informações relevantes entre conversas sem
precisar copiar e colar manualmente.

#### Contexto

A Z-API disponibiliza `POST /forward-message` com body `{ phone, messageId }`. O
`phone` é o destinatário e `messageId` é o ID Z-API da mensagem a ser encaminhada.
A instância Z-API identifica a mensagem pelo `messageId` no próprio histórico da
instância.

**Limitação importante (documentar na UI):** só é possível encaminhar mensagens
recebidas ou enviadas pela mesma instância Z-API. Não é possível encaminhar mensagens
de instâncias diferentes.

O fluxo de UX:
1. Atendente clica "Encaminhar" no micro-toolbar de uma mensagem.
2. Um dialog abre com um seletor de conversa destino (busca por nome/telefone nos chats
   existentes da mesma conta).
3. Atendente confirma → EF encaminha → toast de sucesso.

A mensagem encaminhada vai aparecer no destino via `ReceivedCallback` com `fromMe: true`,
que o webhook persiste normalmente. Sem nova linha manual em `zapi_messages`.

#### Critérios de aceite

- [ ] Nova EF `supabase/functions/zapi-forward-message/index.ts` aceita
  `{ account_id, source_message_id, destination_phone }` via POST autenticado.
- [ ] EF chama Z-API `POST /forward-message` com `{ phone: destination_phone, messageId: source_message_id }`.
- [ ] `destination_phone` é validado e normalizado via `normalizePhoneForZapi` + `isValidPhone`.
- [ ] Erros da Z-API são repassados com 502 sem vazar tokens.
- [ ] `useForwardMessage` em `src/hooks/useZapiForward.ts` expõe mutation.
- [ ] Micro-toolbar do `MessageBubble` inclui botão "Encaminhar" (ícone `Forward`).
- [ ] Ao clicar, abre um `Dialog` shadcn com:
  - Input de busca de conversa (filtra `chats` carregados na conta ativa por nome/telefone).
  - Lista de resultados com `ChatListItem` simplificado (avatar + nome + número).
  - Botão "Encaminhar" que confirma a operação.
- [ ] Toast "Mensagem encaminhada" em sucesso; toast.error em falha.
- [ ] O dialog fecha após confirmação (sucesso ou erro).
- [ ] EF deployada.

#### Hints técnicos (não-prescritivos)

- **Arquivo novo EF:** `supabase/functions/zapi-forward-message/index.ts`.
- **Z-API endpoint:** `POST https://api.z-api.io/instances/{id}/token/{token}/forward-message`
  Body: `{ phone, messageId }`.
- **Hook:** `src/hooks/useZapiForward.ts` — `useForwardMessage()` retorna `useMutation`.
  Em sucesso, invalida `zapiMessageKeys.byChat` do destino (se já carregado).
- **Dialog de seleção:** novo componente `ForwardMessageDialog.tsx` em
  `src/components/whatsapp/`. Recebe `messageId` e `accountId` como props. Reutiliza
  os `chats` já carregados (prop `chats: ZapiChat[]`) para evitar query extra.
- **Busca no dialog:** `useState` local + filter client-side sobre `chats` (mesma
  abordagem do filtro de conversas existente — não faz nova query).
- **Normalização do phone destino:** usar `phoneComparisonKey` de `src/lib/normalization.ts`
  ou o `phone` já normalizado de `ZapiChat.phone`.

#### Test cases

- **Happy path:** clicar "Encaminhar" em mensagem de texto → dialog abre → buscar "João" → selecionar conversa → confirmar → toast sucesso → mensagem aparece na conversa de João em breve (via webhook/realtime).
- **Happy path — mídia:** encaminhar mensagem de imagem → mesma UX → Z-API encaminha a imagem.
- **Edge — destino igual à origem:** encaminhar para o mesmo chat → a Z-API permite (sem validação extra no CRM, Z-API trata).
- **Edge — messageId inválido:** Z-API retorna erro → 502 → toast.error.
- **Edge — conta desconectada:** EF retorna 422 → toast.error.
- **Edge — dialog fechado sem confirmar:** X do dialog ou Escape → nenhuma ação, micro-toolbar some.
- **Limitação exibida:** UI mostra tooltip/aviso "Encaminhamento funciona apenas entre conversas da mesma conta Z-API."

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: encaminhar mensagem de texto para outra conversa ativa, confirmar que aparece no destino
- [ ] Code review aprovado
- [ ] QA aprovou
- [ ] Security auditou a EF
- [ ] Pentest executado

#### Out of scope

- Encaminhar para número não cadastrado como chat (exigiria criar chat novo — cobre o caso em que o operador digita um número avulso; deixar para extensão futura).
- Encaminhar entre instâncias Z-API diferentes.
- Encaminhar múltiplas mensagens de uma vez.

---

### T38 — EF zapi-send-location + UI de enviar localização

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route (nova EF), hook, component
**Depende de:** — (independente)
**WSJF score:** (5 + 4 + 3) / 8 = **1.5** — menor prioridade da fase
**Segurança:** nova Edge Function com chamada à Z-API — Security + Pentest obrigatórios

#### User story

Como atendente do gabinete, quero enviar a localização de um evento ou ponto de encontro
diretamente na conversa, para que o eleitor possa abrir no mapa sem precisar copiar
coordenadas.

#### Contexto

O recebimento de localização já está implementado (webhook branch `location`, render em
`MessageBubble`). Esta task entrega o ENVIO.

A Z-API expõe `POST /send-location` com body `{ phone, lat, lng, name?, address? }`.
O `name` é o título exibido (ex: "Gabinete da Vereadora Raquel") e `address` é a linha
de endereço exibida abaixo.

O fluxo de UX: botão "Localização" no menu de anexos do composer (ao lado de Imagem,
Vídeo, Áudio, Documento) → abre um dialog com campos lat/lng (manual) + nome + endereço.
Opcional: campo de busca de endereço via Geocoding (fora do escopo desta task — só input
manual de coordenadas/nome).

#### Critérios de aceite

- [ ] Nova EF `supabase/functions/zapi-send-location/index.ts` aceita
  `{ account_id, phone, lat, lng, name?, address? }` via POST autenticado.
- [ ] Validação: `lat` deve ser number em [-90, 90]; `lng` em [-180, 180]. Senão 400.
- [ ] EF chama Z-API `POST /send-location` com `{ phone, lat, lng, name, address }`.
- [ ] Em sucesso, insere em `zapi_messages` com `media_type = 'location'` e
  `media_metadata = { latitude: lat, longitude: lng, name, address }` (mesma estrutura
  que mensagens de localização recebidas).
- [ ] `useSendLocation` em `src/hooks/useZapiLocation.ts` expõe mutation.
- [ ] No menu de anexos do composer (o `Popover` de `Paperclip`), adicionar item
  "Localização" (ícone `MapPin`).
- [ ] Ao clicar em "Localização", abre dialog `SendLocationDialog.tsx` com:
  - Campo "Latitude" (number input, -90 a 90).
  - Campo "Longitude" (number input, -180 a 180).
  - Campo "Nome do local" (text, opcional, ex: "Gabinete da Raquel").
  - Campo "Endereço" (text, opcional).
  - Botão "Enviar" desabilitado até lat e lng serem válidos.
- [ ] Toast "Localização enviada" em sucesso. A mensagem de localização aparece na
  conversa via realtime (inserida pela EF em `zapi_messages`).
- [ ] EF deployada.

#### Hints técnicos (não-prescritivos)

- **Arquivo novo EF:** `supabase/functions/zapi-send-location/index.ts`.
- **Z-API endpoint:** `POST https://api.z-api.io/instances/{id}/token/{token}/send-location`
  Body: `{ phone, lat, lng, name?, address? }`.
- **INSERT em zapi_messages:** seguir o padrão de `zapi-send-text` — UPSERT do chat,
  INSERT da mensagem, UPDATE de `last_message_at`. Usar `media_type = 'location'` e
  `media_metadata = { latitude, longitude, name: name ?? null, address: address ?? null }`.
  `body = name ?? null`, `media_url = null`.
- **Hook:** `src/hooks/useZapiLocation.ts`.
- **Dialog:** `src/components/whatsapp/SendLocationDialog.tsx`. Usar `react-hook-form + zod`
  com schema de validação de lat/lng.
- **Menu de anexos:** `ConversasTabContent.tsx`, no Popover de Paperclip — adicionar item
  com `MapPin` que chama `setLocationDialogOpen(true)`.

#### Test cases

- **Happy path:** preencher lat=-22.9068, lng=-43.1729, nome="Gabinete" → confirmar → toast → localização aparece no chat.
- **Edge — lat inválido:** lat=200 → botão "Enviar" desabilitado (validação Zod no form) + EF retornaria 400 se chegasse.
- **Edge — sem nome/endereço:** apenas lat/lng → localização enviada com tile mínimo (sem nome).
- **Edge — conta desconectada:** 422 → toast.error.
- **Edge — campos obrigatórios vazios:** form não submete com lat/lng vazios.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: enviar localização real, verificar que aparece no chat como tile de mapa clicável
- [ ] Code review aprovado
- [ ] QA aprovou
- [ ] Security auditou a EF
- [ ] Pentest executado

#### Out of scope

- Busca de endereço por nome (Geocoding) — exigiria API externa (Google Maps/Nominatim); extensão futura.
- Envio de localização em tempo real ("compartilhar localização ao vivo") — não suportado pela Z-API.
- Recebimento de localização (já implementado desde o início).

---

### T39 — UI: recibo de leitura enriquecido (tooltip "Visto em hh:mm")

**Tipo:** feature
**Estimativa:** XS (1pt)
**Camadas afetadas:** component (MessageBubble)
**Depende de:** — (dados já existem em zapi_messages.status + sent_at)
**WSJF score:** (4 + 3 + 2) / 1 = **9.0** — baixo esforço, alto valor UX
**Segurança:** puramente visual — sem gatilho Security/Pentest

#### User story

Como atendente do gabinete, quero ver no tooltip do ✓✓ azul quando exatamente a
mensagem foi lida pelo eleitor, para saber com precisão se minha mensagem foi vista.

#### Contexto

O pipeline de recibos de leitura já está 100% funcional:
- Webhook `handleStatusUpdate` atualiza `zapi_messages.status = 'read'` quando a Z-API
  envia `MessageStatusCallback` com `status: 'READ'`.
- `MessageBubble` exibe `CheckCheck` azul quando `status === 'read'`.

O que falta é um **enriquecimento visual mínimo**: o timestamp "Visto em HH:MM" quando
o usuário passa o mouse sobre o ícone de status lido. Problema: `zapi_messages` não tem
coluna `read_at` — o timestamp do evento de read não é persistido atualmente.

**Decisão de escopo:** não adicionar coluna `read_at` nesta task (evita migration extra).
Usar `sent_at` como proxy ("Visto depois de HH:MM") com aviso ao usuário. Quando T32
ou futura migration adicionar `read_at`, o tooltip é atualizado. Esta task entrega o
tooltip com `sent_at`.

**Alternativa mais rica (fora do escopo desta task):** adicionar `read_at TIMESTAMPTZ`
em migration e populá-la no webhook. Fica registrado como melhoria futura.

#### Critérios de aceite

- [ ] O `StatusIcon` dentro de `MessageBubble` envolve o ícone em um `Tooltip` do
  shadcn (componente `src/components/ui/tooltip.tsx`).
- [ ] Quando `status === 'sent'`: tooltip exibe "Enviada".
- [ ] Quando `status === 'delivered'`: tooltip exibe "Entregue".
- [ ] Quando `status === 'read'`: tooltip exibe "Lida" (sem timestamp por ora — ver nota acima).
- [ ] Quando `status === 'error'`: tooltip exibe "Erro no envio".
- [ ] O tooltip não aparece em mensagens inbound (o `StatusIcon` já não renderiza para inbound).
- [ ] Layout não quebra em mobile (tooltip desabilita em touch ou usa `title` nativo).

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `src/components/whatsapp/MessageBubble.tsx`.
- **Componente:** `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` de
  `src/components/ui/tooltip.tsx` (shadcn, já disponível).
- **Wrapper mínimo:** envolver `<StatusIcon>` em `<TooltipTrigger asChild>` dentro de um
  `<Tooltip>` com `<TooltipContent>`.
- **Texto do tooltip:** mapa `{ sent: 'Enviada', delivered: 'Entregue', read: 'Lida', error: 'Erro no envio' }`.

#### Test cases

- **Happy path:** hover sobre ✓✓ azul em mensagem enviada → tooltip "Lida".
- **Happy path:** hover sobre ✓✓ cinza → tooltip "Entregue".
- **Happy path:** hover sobre ✓ cinza → tooltip "Enviada".
- **Happy path:** hover sobre triângulo vermelho → tooltip "Erro no envio".
- **Edge — inbound:** nenhum StatusIcon em mensagens do eleitor → sem tooltip.
- **Edge — mobile:** sem hover em touch → tooltip não interfere no toque.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: abrir conversa com mensagens enviadas, verificar tooltips ao hover
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Timestamp exato "Visto em 14:32" (requer coluna `read_at` + migration — extensão futura).
- Tooltip em mensagens inbound (eleitor não precisa saber se o atendente leu — nem se aplica).

---

### T40 — Webhook: PresenceCallback + indicador "digitando…" na UI

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route (zapi-webhook), component
**Depende de:** — (independente, mas deployment da EF vem antes da UI)
**WSJF score:** (6 + 5 + 4) / 5 = **3.0**
**Segurança:** alteração no webhook (EF crítica) — Security obrigatório

#### User story

Como atendente do gabinete, quero ver um indicador "digitando..." quando o eleitor está
compondo uma resposta, para saber quando aguardar antes de enviar a próxima mensagem.

#### Contexto

A Z-API envia `PresenceCallback` quando o estado de presença de um contato muda. O
evento tem estrutura aproximada:
```json
{
  "type": "PresenceCallback",
  "phone": "5511999990001",
  "state": "composing"
}
```
Valores de `state`: `"composing"` (digitando), `"paused"` (parou de digitar), `"available"`,
`"unavailable"`, `"recording"` (gravando áudio).

O webhook atual não trata esse tipo. O estado "digitando" é **efêmero** — não deve ser
persistido no banco. A estratégia: usar **Supabase Realtime Broadcast** (canal de
presença por chat) para propagar o evento ao frontend em tempo real.

**Implementação no webhook:** ao receber `PresenceCallback` com `state = 'composing'`
ou `state = 'recording'`, fazer um POST para o endpoint Realtime Broadcast do Supabase
(`POST /realtime/v1/api/broadcast`) com `{ event: 'typing', payload: { chatId, phone, state } }`.
O frontend subscreve ao canal `typing-<chatId>` e exibe o indicador.

**TTL no frontend:** o indicador desaparece após 30 segundos sem novo evento (clearTimeout
a cada evento recebido).

#### Critérios de aceite

- [ ] Webhook trata `PresenceCallback`: se `state === 'composing'` ou `state === 'recording'`,
  faz broadcast Realtime para o canal `typing-<chatId>` com `{ event: 'typing', payload: { phone, state } }`.
- [ ] Para `state !== 'composing' && state !== 'recording'` (paused/available/unavailable),
  faz broadcast com `{ event: 'stopped-typing', ... }` para limpar o indicador.
- [ ] O `chat_id` é determinado buscando `zapi_chats` pelo `phone` + `account_id` —
  igual ao fluxo de `handleReceivedMessage`.
- [ ] Evento logado em `zapi_webhook_log` com `processing_status = 'ignored'` (não é
  uma mensagem — apenas metadado efêmero; `ignored` é o status correto para eventos
  que não geram dados persistidos).
- [ ] No frontend (`ConversasTabContent` ou hook próprio), subscrever ao canal
  `typing-<selectedChatId>` via `supabase.channel(...)`.
- [ ] Quando evento `typing` chega: exibir `"[Nome do contato] está digitando..."` no
  rodapé do `ChatPanel` (abaixo da lista de mensagens, acima do composer). Ícone
  de 3 pontos animados (CSS animation ou componente).
- [ ] Indicador desaparece automaticamente 30 segundos após o último evento `typing`.
- [ ] Indicador desaparece imediatamente ao receber evento `stopped-typing`.
- [ ] Ao trocar de chat, o indicador é resetado (sem vazamento de estado).
- [ ] EF deployada.

#### Hints técnicos (não-prescritivos)

- **Webhook — Broadcast:** usar a [Realtime Broadcast API do Supabase](https://supabase.com/docs/guides/realtime/broadcast):
  `POST {SUPABASE_URL}/realtime/v1/api/broadcast` com header `Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}` e body `{ messages: [{ topic: 'typing-<chatId>', event: 'typing', payload: {...} }] }`. Isso não requer client Supabase — é um POST puro com fetch.
- **Frontend — hook:** `src/hooks/useTypingIndicator.ts` que recebe `chatId` e retorna `isTyping: boolean` + `typingState: 'composing' | 'recording' | null`. Usa `supabase.channel('typing-' + chatId).on('broadcast', { event: 'typing' }, handler).subscribe()`.
- **Timer:** `useRef<ReturnType<typeof setTimeout>>` para o clearTimeout automático de 30s.
- **Animação:** componente `TypingDots` simples com 3 `span` e CSS `@keyframes bounce` (evitar biblioteca de animação apenas para isso).
- **Nome do contato:** usar `selectedChat.contact_name ?? selectedChat.whatsapp_name ?? formatPhone(selectedChat.phone)`.

#### Test cases

- **Happy path:** eleitor começa a digitar no WhatsApp → em até 2s, o CRM exibe "Fulano está digitando..." → eleitor para → indicador some após 30s (ou imediatamente se evento stopped-typing chegar).
- **Happy path — recording:** eleitor grava áudio → indicador exibe "Fulano está gravando um áudio..." (state=recording).
- **Edge — paused:** evento `state='paused'` → indicador some imediatamente.
- **Edge — troca de chat com typing ativo:** selecionar outro chat → indicador do chat anterior não aparece no novo.
- **Edge — PresenceCallback sem phone válido:** webhook loga erro, não trava.
- **Edge — chat inexistente:** se o `phone` do PresenceCallback não tem chat → webhook loga `ignored`, não trava.

#### Definition of Done

- [ ] Critérios de aceite validados (requer teste com instância Z-API real conectada)
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: com instância Z-API real, iniciar digitação no WhatsApp do eleitor e verificar indicador no CRM
- [ ] Code review aprovado
- [ ] QA aprovou
- [ ] Security auditou a alteração no webhook

#### Out of scope

- Indicador de "digitando" para mensagens enviadas pelo atendente (não há evento Z-API para isso).
- Persistência do estado de presença no banco (efêmero por design).
- "Visto por último em X" (não disponível na Z-API para números de terceiros).

---

### T41 — UI: MessageBubble — exibir estado editado/apagado

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component (MessageBubble)
**Depende de:** T31 (colunas), T32 (dados populados pelo webhook)
**WSJF score:** (7 + 6 + 5) / 2 = **9.0** — baixo esforço, alta fidelidade ao WhatsApp nativo
**Segurança:** puramente visual — sem gatilho Security/Pentest

#### User story

Como atendente do gabinete, quero ver quando uma mensagem foi editada ou apagada pelo
eleitor, para ter um histórico fidedigno e não interpretar erroneamente o contexto.

#### Contexto

Após T31 e T32, as colunas `edited_body`, `edited_at` e `deleted_at` existem e são
populadas pelo webhook quando a Z-API envia os callbacks correspondentes. Esta task
entrega a renderização dessas mudanças no `MessageBubble`.

**Regras de render:**
1. Se `deleted_at` não é null → exibir balão fantasma: fundo cinza claro, itálico,
   texto "Mensagem apagada", ícone `Trash2` — igual ao WhatsApp nativo.
2. Se `edited_body` não é null (e `deleted_at` é null) → exibir `edited_body` no lugar
   do `body` original, com label "Editada" pequeno abaixo do texto.
3. Estado normal (ambos null) → renderização atual, sem mudança.

O `body` original é preservado no banco (apenas `edited_body` tem o novo conteúdo) —
útil para auditoria, mas não é exibido na UI.

#### Critérios de aceite

- [ ] Mensagem com `deleted_at` não-nulo: balão com fundo `bg-muted/50`, texto itálico
  "Mensagem apagada", ícone `Trash2` à esquerda do texto. O `StatusIcon` NÃO é exibido
  (mensagem apagada não tem status de leitura relevante).
- [ ] Mensagem com `edited_body` não-nulo (e sem `deleted_at`): exibe `edited_body` como
  corpo principal; abaixo do texto, em fonte menor e opacidade 60%, label "(editada)".
  O `StatusIcon` continua visível normalmente.
- [ ] Mensagem sem `deleted_at` e sem `edited_body`: render atual sem modificação
  (nenhuma regressão).
- [ ] O bloco de citação (T34) — se presente — continua aparecendo acima do corpo,
  mesmo para mensagens editadas.
- [ ] Tooltips de status (T39) continuam funcionando em mensagens editadas (não em apagadas).

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `src/components/whatsapp/MessageBubble.tsx`.
- **Props:** `ZapiMessage` com `deleted_at` e `edited_body` já disponíveis após T31+typecheck.
- **Guarda de deleção:** adicionar no topo de `MessageBubble` (antes do render normal):
  ```tsx
  if (message.deleted_at) return <DeletedMessageBubble />;
  ```
  Extrair `DeletedMessageBubble` como subcomponente interno.
- **Corpo editado:** no `case 'text'` do `renderContent`, usar
  `message.edited_body ?? message.body` para o texto exibido. Se `edited_body`, adicionar `<span className="text-[10px] opacity-60">(editada)</span>` após o parágrafo.
- **Sem migration extra:** T31 já cria as colunas.

#### Test cases

- **Happy path — apagada:** mensagem com `deleted_at` setado → balão fantasma cinza com "Mensagem apagada" e ícone Trash2. StatusIcon não aparece.
- **Happy path — editada:** mensagem com `edited_body: 'Texto corrigido'` → corpo exibe "Texto corrigido" + "(editada)" em cinza pequeno. StatusIcon presente.
- **Happy path — normal:** mensagem sem os dois campos → render original sem mudança.
- **Edge — editada + reply:** bloco de citação acima + corpo editado + label "(editada)" — tudo coexiste sem sobreposição de layout.
- **Edge — apagada outbound:** balão fantasma à direita (alinhamento correto mantido).

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: via SQL manual, setar `edited_body` e `deleted_at` em mensagens de teste e verificar render
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Apagar mensagem pelo CRM (ação proativa) — endpoint Z-API não documentado; extensão futura.
- Histórico de edições (mostrar versão anterior) — apenas a última versão é suficiente.
- Notificação ao atendente quando eleitor apaga mensagem (extensão futura).

---

## Ordem final de execução (WSJF + dependências)

```
T31 — Migration quoted + edited/deleted                              [S=2pt, WSJF=13.0]  [Security]
T33 — Estender zapi-send-text para reply                             [S=2pt, WSJF=10.5]  [Security]
T39 — Tooltip de recibo de leitura                                   [XS=1pt, WSJF=9.0]  — sem gatilho
T41 — UI editado/apagado                                             [S=2pt, WSJF=9.0]   — depende T31+T32
T32 — Webhook: quoted + edited + deleted handlers                    [M=5pt, WSJF=4.6]   [Security+Pentest]
T34 — UI bubble de reply + botão Responder                           [M=5pt, WSJF=4.0]   — depende T31+T33
T36 — EF zapi-send-reaction + UI reagir                              [L=8pt, WSJF=2.25]  [Security+Pentest]
T40 — Webhook PresenceCallback + indicador digitando                 [M=5pt, WSJF=3.0]   [Security]
T35 — Hook useMessageFlags + UI favoritar + visão favoritas          [M=5pt, WSJF=3.0]   — sem gatilho
T37 — EF zapi-forward-message + UI encaminhar                        [L=8pt, WSJF=1.875] [Security+Pentest]
T38 — EF zapi-send-location + UI enviar localização                  [L=8pt, WSJF=1.5]   [Security+Pentest]
```

**Sequência prática para um dev:**
T31 → T39 → T32 → T33 → T34 → T41 → T35 → T36 → T40 → T37 → T38

T39 pode ser feita a qualquer momento (independente, 1pt). T35 pode ser feita em
paralelo com qualquer EF (não toca EF). T36/T37/T38 podem ser paralelizadas.

**Total estimado: ~52 pts** (1+5+2+5+5+8+8+8+1+5+2 = 50pt; arredondado considerando
margem de integração).

---

## Flags de segurança (resumo)

| Task | Gatilho | Motivo |
|------|---------|--------|
| T31 | Security | Migration em tabela existente com dados de mensagens |
| T32 | Security + Pentest | Alteração na EF webhook (processa todos eventos Z-API) |
| T33 | Security | Alteração em EF de envio |
| T36 | Security + Pentest | Nova EF com chamada à Z-API |
| T37 | Security + Pentest | Nova EF com chamada à Z-API |
| T38 | Security + Pentest | Nova EF com chamada à Z-API |
| T40 | Security | Alteração no webhook + Realtime Broadcast com service_role |

T34, T35, T39, T41: puramente UI sem EF nova — sem gatilho automático de Security/Pentest.

---

## Notas para o Fullstack

1. **Ordem obrigatória:** T31 antes de T32, T33 e T41. T32 antes de T41. T33 antes de T34.
2. **Regenerar types.ts após T31** e commitar antes de iniciar T32/T33/T34/T41.
3. **Micro-toolbar do MessageBubble** vai acumular props de T34 (onReply), T35 (onFlag/isFlagged) e T36 (onReact). Planejar a interface de props para não ter que refatorar a cada task. Sugestão: prop `actions?: { onReply?, onFlag?, isFlagged?, onReact?, onForward? }`.
4. **EFs novas:** seguir o padrão de `zapi-send-text/index.ts` + `_shared/auth-guard.ts`. Sem reinventar roda.
5. **PresenceCallback (T40):** depende de instância Z-API realmente conectada para testar — pode ser difícil em ambiente de desenvolvimento. Documentar no smoke test que o teste requer instância real.
6. **Próxima migration disponível:** `062`. T31 usa `062`. Se outras tasks de Fase 4 precisarem de migration (improvável), usar `063`, `064`.
7. **A tabela `zapi_chat_message_flags` já existe e tem RLS correto** (migration 057). T35 não precisa de migration — só hook + UI.
8. **Z-API limites de rate:** `send-reaction` e `forward-message` contam no rate limit da instância. O CRM não precisa implementar throttle extra para uso normal (operador humano), mas documentar nos tooltips da UI que uso intensivo pode ativar proteção anti-ban da Z-API.
