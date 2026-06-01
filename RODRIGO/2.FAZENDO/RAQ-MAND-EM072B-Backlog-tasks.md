# Backlog — Filtro de Grupos e Nome de Eleitores LID no WhatsApp

**Cliente:** Raquel — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM072B
**Briefing:** RODRIGO/2.FAZENDO/RAQ-MAND-EM072B-PO-refinamento.md
**Backlog escrito por:** Agente Backlog em 2026-05-16

---

## Walking skeleton (entrega valor end-to-end)

- **T01** — Adicionar `whatsapp_name` em `zapi_chats` e expandir CHECK de `processing_status` (migration). Base de schema que T02 e T03 dependem.

---

## Ordem de execução (WSJF + dependências)

| # | Task | Story | Estimativa | Camadas | Depende de |
|---|------|-------|-----------|---------|-----------|
| 1 | **T01** — Migration: coluna `whatsapp_name` + valor `ignored` em `processing_status` | US01 + US02 | XS (1pt) | model | — |
| 2 | **T02** — Limpeza one-shot: deletar chats de grupo existentes do banco | US03 | S (2pt) | model | T01 |
| 3 | **T03** — Edge Function: guard de grupo/newsletter/broadcast + persistir `whatsapp_name` | US01 + US02 | M (5pt) | route (EF) + integration | T01 |
| 4 | **T04** — Hook + tipos: incluir `whatsapp_name` no select e no tipo `ZapiChat` | US02 | XS (1pt) | hook + integration | T01 |
| 5 | **T05** — UI: exibir `whatsapp_name` como camada de display intermediária | US02 | S (2pt) | component | T04 |

**Total estimado:** 11pt

> T01 desbloqueia tudo. T02 pode rodar em paralelo com T03 (ambos dependem de T01, não entre si). T04 e T05 são sequenciais — T05 consome o campo que T04 expõe.

---

## Flag de Security

| Task | Toca auth / dados sensíveis / Edge Function? | Exige Security agent? |
|------|----------------------------------------------|----------------------|
| T01 | Sim — altera CHECK constraint e schema de tabela em producao | **SIM** — migration em producao |
| T02 | Sim — DELETE destrutivo em `zapi_messages` e `zapi_chats` (dados de producao) | **SIM** — operacao irreversivel |
| T03 | Sim — Edge Function com `service_role` (webhook receiver) + filtro de segurança novo | **SIM** — superficie critica (webhook + service_role) |
| T04 | Nao — leitura de campo novo, sem mutation | **NAO** |
| T05 | Nao — renderizacao client-side de dado ja persistido | **NAO** |

---

## Tasks

---

### T01 — Adicionar coluna `whatsapp_name` e valor `ignored` no schema

**Tipo:** feature
**Estimativa:** XS (1pt)
**Camadas afetadas:** model
**Depende de:** —
**WSJF score:** (4 + 4 + 3) / 1 = 11 — desbloqueia T02..T05 inteiras; custo de delay alto

#### User story

Como assessora de gabinete, quero que o sistema suporte armazenar o nome do WhatsApp e registrar payloads ignorados, para que os dados de display e auditoria estejam disponíveis nas próximas tasks.

#### Contexto

Duas alterações de schema necessárias antes de qualquer outra task:

1. `zapi_chats` precisa de coluna `whatsapp_name TEXT` (nullable) para persistir o `chatName`/`senderName` que a Z-API envia em chats LID. Hoje esse campo é descartado na Edge Function.

2. `zapi_webhook_log.processing_status` tem CHECK constraint `IN ('processed', 'error')`. O guard de US01 precisa logar `processing_status='ignored'` — sem adicionar `'ignored'` ao CHECK, o INSERT falhará com constraint violation e o webhook retornará erro ao invés de 200.

Migration: `054_zapi_group_filter_and_lid_name.sql`. Deve ser idempotente (`IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` antes de recriar CHECK).

#### Critérios de aceite

- [ ] `zapi_chats` possui coluna `whatsapp_name TEXT NULL` após `supabase db push`
- [ ] `zapi_webhook_log.processing_status` aceita o valor `'ignored'` (INSERT de teste não falha com constraint violation)
- [ ] Migration é idempotente: rodar duas vezes não gera erro
- [ ] `src/integrations/supabase/types.ts` atualizado para refletir a nova coluna (gerado via `supabase gen types` ou editado manualmente para manter consistência)

#### Hints técnicos (não-prescritivos)

- **Model**: `supabase/migrations/054_zapi_group_filter_and_lid_name.sql`
- **Coluna**: `ALTER TABLE public.zapi_chats ADD COLUMN IF NOT EXISTS whatsapp_name TEXT CHECK (whatsapp_name IS NULL OR length(whatsapp_name) <= 255);`
- **CHECK constraint**: usar `DROP CONSTRAINT IF EXISTS chk_zapi_webhook_log_status` antes de recriar com os 3 valores
- **Types**: `src/integrations/supabase/types.ts` — adicionar `whatsapp_name: string | null` na interface de `zapi_chats`
- **Pattern existente**: migration 045 usa `DROP CONSTRAINT IF EXISTS` antes de recriar — seguir o mesmo idioma

#### Test cases

- **Happy path**: `supabase db push` aplica sem erro; `\d zapi_chats` mostra a coluna; INSERT com `processing_status='ignored'` em `zapi_webhook_log` não viola constraint
- **Idempotência**: segunda aplicação da migration retorna sem erro
- **Rollback manual**: `ALTER TABLE zapi_chats DROP COLUMN whatsapp_name;` + recriar CHECK sem 'ignored' — documentar no comentário da migration

#### Definition of Done

- [ ] Critérios de aceite verificados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: query `INSERT INTO zapi_webhook_log (..., processing_status) VALUES (..., 'ignored')` via Supabase SQL editor retorna sucesso
- [ ] QA aprovou

#### Out of scope

- RLS na nova coluna (herda a policy existente `zapi_chats_select` — sem mudança)
- Índice em `whatsapp_name` (volume não justifica agora)
- Preencher `whatsapp_name` retroativamente (T03 cobre apenas novos eventos)

---

### T02 — Migration one-shot: deletar chats de grupo existentes

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** model
**Depende de:** T01
**WSJF score:** (4 + 3 + 2) / 2 = 4,5 — resultado visível imediato (lista limpa), risco controlado por idempotência

#### User story

Como assessora de gabinete, quero que os ~16 chats de grupo já registrados no banco sejam removidos, para que minha lista de conversas fique limpa assim que o deploy for feito.

#### Contexto

A limpeza é destrutiva e irreversível em produção. A identificação de "chat de grupo" usa dois critérios combinados por OR (conforme decisão do PO):

1. `length(regexp_replace(phone, '\D', '', 'g')) > 15` — mais de 15 dígitos após extrair só dígitos. Telefones BR têm ≤13 dígitos; LIDs têm ≤15 dígitos. Grupos têm 16-18 dígitos.
2. `phone ~ '^\d+-\d+(@g\.us)?$'` — formato JID antigo de grupo (`XXXXXXXX-XXXXXXXXXX`).

A migration deve:
- Deletar de `zapi_messages` primeiro (FK CASCADE não está definido como ON DELETE CASCADE entre `zapi_messages` e `zapi_chats`? verificar — se tiver, DELETE em `zapi_chats` já cascateia; se não, deletar mensagens primeiro explicitamente)
- Deletar de `zapi_chats`
- Ser idempotente: segunda execução retorna sem erro (DELETE WHERE não encontra linhas)
- Logar via `RAISE NOTICE` quantas linhas foram deletadas

Decisão PO: deletar mesmo se `contact_id` não for NULL.

#### Critérios de aceite

- [ ] Após `supabase db push`, `SELECT count(*) FROM zapi_chats WHERE length(regexp_replace(phone, '\D', '', 'g')) > 15 OR phone ~ '^\d+-\d+'` retorna 0
- [ ] `SELECT count(*) FROM zapi_chats` cai de ~23 para ≤ 7 (ou número menor que o atual)
- [ ] Nenhuma mensagem órfã permanece em `zapi_messages` (FK satisfeita)
- [ ] Migration idempotente: segunda aplicação não gera erro
- [ ] `zapi_chats` com phones de telefone normal (≤13 dígitos) e LIDs legítimos (@lid, ≤15 dígitos) não são tocados

#### Hints técnicos (não-prescritivos)

- **Model**: arquivo separado `055_zapi_cleanup_group_chats.sql` — migration própria para facilitar rollback e auditoria. Numeração 055 pois 054 é T01.
- **Verificação de FK**: `SELECT conname, confdeltype FROM pg_constraint WHERE conname = 'zapi_messages_chat_id_fkey'` — se `confdeltype = 'c'` (cascade), o DELETE em `zapi_chats` já cobre; senão, deletar `zapi_messages` explicitamente primeiro
- **Pattern de log**: `DO $$ DECLARE cnt INT; BEGIN SELECT count(*) INTO cnt FROM zapi_chats WHERE ...; RAISE NOTICE 'Grupos encontrados: %', cnt; END $$;`
- **Segurança extra**: rodar `SELECT id, phone FROM zapi_chats WHERE length(regexp_replace(phone, '\D', '', 'g')) > 15 OR phone ~ '^\d+-\d+'` no SQL editor antes do push para visualizar o que será deletado (smoke test pré-aplicação)

#### Test cases

- **Happy path**: migration aplicada; query de verificação retorna 0 grupos; chats de telefone normal existem
- **Idempotência**: aplicar migration duas vezes não falha
- **LID não tocado**: chat com `phone = '151415313924248@lid'` (15 dígitos + sufixo) permanece — apenas dígitos = 15, não > 15
- **Telefone BR não tocado**: `phone = '556184299707'` (12 dígitos) permanece

#### Definition of Done

- [ ] Critérios de aceite verificados via query no SQL editor
- [ ] Lint OK (migration SQL)
- [ ] Smoke test pré-aplicação (SELECT antes do DELETE) registrado no comentário do QG
- [ ] QA aprovou contagem de chats restantes

#### Out of scope

- Retenção de backup das mensagens deletadas (Rodrigo confirmou que não há necessidade)
- Limpeza de chats futuros (coberto pelo guard em T03)
- Deduplicação de chats LID + telefone da mesma pessoa

---

### T03 — Edge Function: guard de grupos e persistência de `whatsapp_name`

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route (Edge Function), integration
**Depende de:** T01
**WSJF score:** (5 + 4 + 4) / 5 = 2,6 — impede reacumulação de lixo; alto risco se não feito

#### User story

Como assessora de gabinete, quero que mensagens vindas de grupos, newsletters e broadcasts sejam descartadas automaticamente e que o nome real do eleitor apareça em chats LID, para que minha lista de conversas seja limpa e legível a partir do próximo atendimento.

#### Contexto

Dois sub-comportamentos na mesma Edge Function (`supabase/functions/zapi-webhook/index.ts`), ambos em `handleReceivedMessage`:

**Guard (US01):** No início de `handleReceivedMessage`, antes de qualquer normalização de phone, checar se `payload.isGroup === true || payload.isNewsletter === true || payload.broadcast === true`. Se sim: retornar cedo (throw com motivo, ou retornar explicitamente antes do upsert). O dispatcher principal (step 5 do Deno.serve) precisa capturar esse retorno antecipado e logar `processing_status='ignored'` com `error_detail=null` (não é erro — é intenção). Hoje o dispatcher só conhece 'processed'|'error'; após T01, 'ignored' estará no CHECK.

Atenção: o log de auditoria (step 6) sempre roda — a saída antecipada do guard não deve bypassar o log. Estratégia recomendada: `handleReceivedMessage` lança um tipo especial (ex: `class IgnoredPayload extends Error`) que o dispatcher captura antes do catch genérico e seta `processingStatus = 'ignored'`.

**Nome LID (US02):** No upsert de chat, se `payload.phone` contém `@lid` (ou seja, é um identificador LID), popular `whatsapp_name` com `(payload.chatName ?? payload.senderName ?? null)?.slice(0, 255)`. O upsert deve incluir `whatsapp_name` no objeto. Para chats que recebem nova mensagem e mudaram de nome, o `onConflict` deve atualizar o campo (já é UPDATE no upsert existente).

Interface `ZapiPayload` precisa de campos adicionais: `isGroup?: boolean`, `isNewsletter?: boolean`, `broadcast?: boolean`, `chatName?: string`.

#### Critérios de aceite

- [ ] Payload com `isGroup: true` → webhook retorna `{ ok: true, reason: "ignored_group" }`, nenhum `zapi_chats` novo criado, `zapi_webhook_log` com `processing_status='ignored'`
- [ ] Payload com `isNewsletter: true` (qualquer valor de `isGroup`) → mesmo comportamento de descarte
- [ ] Payload com `broadcast: true` → mesmo comportamento de descarte
- [ ] Payload com `isGroup: false, isNewsletter: false, broadcast: false` e phone normal → comportamento original inalterado
- [ ] Payload com `phone` contendo `@lid` e `chatName: "Thais Souza Prima"` → `zapi_chats.whatsapp_name = "Thais Souza Prima"` após o upsert
- [ ] Payload com `@lid` e `chatName` ausente mas `senderName: "Zé"` → `whatsapp_name = "Zé"`
- [ ] Payload com `@lid` e ambos ausentes → `whatsapp_name = NULL` (sem erro)
- [ ] Segundo evento do mesmo chat LID com nome diferente → `whatsapp_name` atualizado (upsert cobre)

#### Hints técnicos (não-prescritivos)

- **Route**: `supabase/functions/zapi-webhook/index.ts` — modificar `handleReceivedMessage` e o dispatcher em `Deno.serve`
- **Interface**: adicionar `isGroup?: boolean; isNewsletter?: boolean; broadcast?: boolean; chatName?: string;` à `ZapiPayload` (linhas 96-133)
- **Pattern do guard**: lançar `class IgnoredPayload extends Error { constructor(reason: string) { super(reason); this.name = 'IgnoredPayload'; } }` e no dispatcher: `} catch (err) { if (err instanceof IgnoredPayload) { processingStatus = 'ignored'; } else { processingStatus = 'error'; ... } }`
- **Detecção de LID**: `String(payload.phone ?? '').includes('@lid')` — direto, antes da normalização via `normalizePhoneForZapi`
- **Upsert com whatsapp_name**: adicionar `whatsapp_name` ao objeto do upsert de chat; usar `onConflict: 'account_id,phone'` já existente — o UPDATE gerado pelo upsert atualizará o campo
- **Log 'ignored'**: a variável `processingStatus` passa de `'processed' | 'error'` para `'processed' | 'error' | 'ignored'` — ajustar o type local na EF

#### Test cases

- **Happy path grupo**: simular POST com `{ type: "ReceivedCallback", isGroup: true, phone: "5521999999-99", ... }` → `processing_status='ignored'` no log, zero linhas novas em `zapi_chats`
- **Happy path LID com nome**: POST com `{ phone: "151415313924248@lid", chatName: "Thais Souza Prima", ... }` → `zapi_chats.whatsapp_name = "Thais Souza Prima"`
- **Edge — newsletter com isGroup false**: `{ isGroup: false, isNewsletter: true }` → descartado
- **Edge — telefone normal não afetado**: `{ isGroup: false, isNewsletter: false, broadcast: false, phone: "556184299707" }` → processado normalmente, `whatsapp_name` não tocado (não é LID)
- **Edge — LID sem nome**: `{ phone: "151415313924248@lid" }` sem chatName/senderName → `whatsapp_name = NULL`, sem erro
- **Edge — rede**: EF responde 200 mesmo em exceção interna (invariante existente mantida)

#### Definition of Done

- [ ] Critérios de aceite verificados
- [ ] Lint OK (Deno/TypeScript)
- [ ] Typecheck OK (`deno check` ou build da EF)
- [ ] Build OK
- [ ] Deploy da EF via `supabase functions deploy zapi-webhook`
- [ ] Smoke test: enviar payload de grupo via curl ao endpoint de staging/prod e verificar log
- [ ] QA aprovou

#### Out of scope

- Reescrever `normalizePhoneForZapi` (guard roda ANTES da normalização)
- Guard para subtipos de grupo sem `isGroup: true` sem `broadcast: true` (edge case não documentado)
- Sincronização retroativa de `whatsapp_name` via polling da Z-API

---

### T04 — Hook e tipos: expor `whatsapp_name` em `ZapiChat`

**Tipo:** feature
**Estimativa:** XS (1pt)
**Camadas afetadas:** hook, integration
**Depende de:** T01
**WSJF score:** (3 + 2 + 1) / 1 = 6 — desbloqueador de T05; custo mínimo

#### User story

Como assessora de gabinete, quero que o sistema traga o `whatsapp_name` junto com os dados do chat, para que o componente de UI possa exibi-lo sem query adicional.

#### Contexto

`useZapiChats` faz `select('*, contacts:contact_id (nome)')` e retorna `ZapiChat[]`. Com T01, a coluna `whatsapp_name` existe em `zapi_chats` mas não está mapeada no tipo nem no select — TypeScript não a enxergará.

Mudanças mínimas:
1. `src/integrations/supabase/types.ts`: adicionar `whatsapp_name: string | null` na `Row` de `zapi_chats` (se a atualização de types não foi feita em T01, fazer aqui)
2. `src/hooks/useZapiChats.ts`: o `select('*')` já retorna todas as colunas, incluindo a nova — nenhuma mudança no select necessária. Mas o tipo `ZapiChat` (que hoje é `Tables<'zapi_chats'> & { contact_name?: ... }`) passa a incluir `whatsapp_name` automaticamente via `Tables<'zapi_chats'>` assim que o types.ts for atualizado.
3. Verificar que `filteredChats` em `ConversasTabContent` pode incluir `whatsapp_name` no filtro de busca (opcional — se o PO quiser buscar por nome do WA; incluir é trivial)

#### Critérios de aceite

- [ ] `ZapiChat` possui campo `whatsapp_name: string | null` acessível sem erro de TypeScript
- [ ] `useZapiChats` retorna o campo populado para chats onde o banco tem valor
- [ ] Typecheck (`tsc --noEmit`) passa sem erros relacionados à nova coluna
- [ ] Filtro de busca em `ConversasTabContent.filteredChats` inclui `whatsapp_name` na comparação (se não estiver, adicionar como melhoria trivial)

#### Hints técnicos (não-prescritivos)

- **Hook**: `src/hooks/useZapiChats.ts` — `ZapiChat` herda de `Tables<'zapi_chats'>` que já terá o campo após atualização do types
- **Integration**: `src/integrations/supabase/types.ts` — Row de `zapi_chats`
- **Filtro**: `ConversasTabContent.tsx` linha ~97 — adicionar `c.whatsapp_name?.toLowerCase().includes(term)` na condição de `filter`

#### Test cases

- **Happy path**: `ZapiChat.whatsapp_name` acessível em TS sem cast; valor "Thais Souza Prima" retorna da query quando banco tem o dado
- **Edge — campo null**: chat sem `whatsapp_name` retorna `null`, sem TypeError na UI

#### Definition of Done

- [ ] Critérios de aceite verificados
- [ ] Typecheck OK
- [ ] Build OK
- [ ] QA aprovou

#### Out of scope

- Mutation para editar `whatsapp_name` manualmente (read-only; só a EF escreve)
- Query separada para buscar `whatsapp_name` de chats históricos

---

### T05 — UI: exibir `whatsapp_name` como camada de display intermediária

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T04
**WSJF score:** (5 + 3 + 2) / 2 = 5 — entrega visual direta da proposta de valor para a assessora

#### User story

Como assessora de gabinete, quero ver o nome real do eleitor (ex: "Thais Souza Prima") em chats LID e não exibir o LID numérico cru como nome ou subtítulo, para que eu saiba com quem estou falando antes de abrir a conversa.

#### Contexto

Três componentes exibem o nome/identificador do chat. Todos precisam adotar a ordem `contact_name ?? whatsapp_name ?? "Contato sem nome"`.

Hoje:
- `ChatListItem.tsx` linha 37: `const display = chat.contact_name ?? formatPhone(chat.phone)` — problema: para chats LID, `formatPhone(phone)` retorna o LID numérico como se fosse telefone
- `ChatPanel` (em `ConversasTabContent.tsx`) linha 311: `const display = chat.contact_name ?? formatPhone(chat.phone)` — mesmo problema no header da conversa
- `ContactPanel` linha 594: `<p className="text-xs text-muted-foreground mt-0.5">{formatPhone(chat.phone)}</p>` — subtítulo sempre chama `formatPhone`, exibindo LID como número

Mudanças necessárias:

1. **ChatListItem**: `display = contact_name ?? whatsapp_name ?? "Contato sem nome"`. Subtítulo: quando não há `contact_name` (e portanto o nome exibido é do WA ou fallback), o subtítulo do phone deve ser omitido se o phone for um LID (detectar via `.includes('@lid')` ou `length(digitsOnly) > 13`). Hoje o subtítulo só aparece quando `showSubtitle = !!chat.contact_name` — isso já evita mostrar o phone como subtítulo quando não há contato CRM. Revisar se o behavior é adequado.

2. **ChatPanel header**: mesma lógica de display. Subtítulo (`formatPhone(chat.phone)`) só exibir se `contact_name` existe E o phone for telefone válido (não LID).

3. **ContactPanel subtítulo**: trocar `formatPhone(chat.phone)` por display condicional — se phone contém `@lid` ou tem >13 dígitos, exibir `whatsapp_name ?? "Identificador LID"` ou omitir o subtítulo.

4. **Iniciais no Avatar** (`ChatListItem` linha 52): hoje usa `chat.contact_name` para gerar iniciais; se `contact_name` for null mas `whatsapp_name` existir, usar `whatsapp_name` para as iniciais.

Fallback final definido pelo PO: `"Contato sem nome"`.

#### Critérios de aceite

- [ ] Chat LID com `whatsapp_name = "Thais Souza Prima"` e `contact_id = NULL` exibe "Thais Souza Prima" como nome principal na lista
- [ ] Chat LID com `whatsapp_name = "Thais Souza Prima"` e `contact_name = "Thais (CRM)"` exibe "Thais (CRM)" (contact_name prevalece)
- [ ] Chat LID sem `whatsapp_name` e sem `contact_name` exibe "Contato sem nome" (não trava, não exibe vazio)
- [ ] Nenhum chat exibe sequência numérica longa (LID) como nome principal ou subtítulo
- [ ] Chat com telefone real (ex: `556184299707`) continua exibindo o número formatado como subtítulo quando há `contact_name`
- [ ] Avatar com iniciais usa `whatsapp_name` quando `contact_name` é null e `whatsapp_name` existe

#### Hints técnicos (não-prescritivos)

- **Component**: `src/components/whatsapp/ChatListItem.tsx` (linhas 37-38, 52)
- **Component**: `src/components/whatsapp/ConversasTabContent.tsx` — `ChatPanel` (linha 311, 349) e `ContactPanel` (linha 594)
- **Helper de detecção de LID**: `const isLid = (phone: string) => phone.includes('@lid') || phone.replace(/\D/g, '').length > 13` — extrair para `src/lib/zapi-format.ts` se não existir
- **Pattern existente**: `formatPhone` em `src/lib/zapi-format.ts` — não reescrever; adicionar guard antes de chamar

#### Test cases

- **Happy path LID com nome**: chat `{ phone: '151415313924248@lid', whatsapp_name: 'Thais Souza Prima', contact_name: null }` → exibe "Thais Souza Prima"
- **Happy path LID CRM**: `{ ..., whatsapp_name: 'Thais WA', contact_name: 'Thais CRM' }` → exibe "Thais CRM"
- **Edge — LID sem nome**: `{ ..., whatsapp_name: null, contact_name: null }` → exibe "Contato sem nome"
- **Edge — telefone normal**: `{ phone: '556184299707', whatsapp_name: null, contact_name: 'João Silva' }` → exibe "João Silva" + subtítulo com telefone formatado
- **Edge — telefone normal sem contato**: `{ phone: '556184299707', whatsapp_name: null, contact_name: null }` → exibe "Contato sem nome" (ou `formatPhone` — decisão do dev; não exibir o LID)

#### Definition of Done

- [ ] Critérios de aceite verificados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test visual: abrir aba Conversas e confirmar que "Thais Souza Prima" aparece legível
- [ ] QA aprovou

#### Out of scope

- Reformatar exibição do LID no subtítulo com prefixo "LID·" (PO definiu fallback como "Contato sem nome", não formatação do LID)
- Deduplicação visual de dois itens (LID + telefone) do mesmo eleitor
- Edição manual do `whatsapp_name` pela assessora
