# Backlog — Melhorias operacionais no WhatsApp CRM (Módulo Conversas)

**Cliente:** Raquel — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM072
**Briefing:** RODRIGO/2.FAZENDO/RAQ-MAND-EM072-PO-refinamento.md
**Backlog escrito por:** Agente Backlog em 2026-05-16

---

## Walking skeleton (entrega valor end-to-end)

- **T01** — busca client-side na lista de conversas (US01 completa — nenhuma dependência externa, maior frequência de uso, risco zero)

---

## Ordem de execução (WSJF + dependências)

| # | Task | Story | Estimativa | Camadas | Depende de |
|---|------|-------|-----------|---------|-----------|
| 1 | **T01** — Adicionar campo de busca na lista de conversas | US01 | S (2pt) | component | — |
| 2 | **T02** — Corrigir botão "Ver no CRM" com link direto ao contato | US02 | XS (1pt) | component | — |
| 3 | **T03** — Adicionar botão "Adicionar no CRM" no painel lateral | US03 | M (5pt) | component + hook | T02 (navegação pós-criação usa o mesmo pattern `?contact=<id>`) |
| 4 | **T04** — Adicionar `reaction` ao CHECK constraint de `media_type` | US04 | XS (1pt) | model (migration) | — |
| 5 | **T05** — Processar eventos de reação na Edge Function `zapi-webhook` | US04 | S (2pt) | route (Edge Function) | T04 |
| 6 | **T06** — Renderizar mensagens de reação no `MessageBubble` | US04 | S (2pt) | component | T05 |

**Total estimado:** 13pt

> T01 e T02 são independentes entre si — podem ser implementadas em qualquer ordem ou paralelamente. T03 depende logicamente de T02 (usa o mesmo padrão de URL `?contact=<id>` para navegação pós-criação, garante comportamento consistente). T04 → T05 → T06 são sequenciais por dependência de schema e dados.

---

## Flag de Security

| Task | Toca auth / dados sensíveis / Edge Function? | Exige Security agent? |
|------|----------------------------------------------|----------------------|
| T01 | Nao — filtro client-side puro, zero I/O | **NAO** |
| T02 | Nao — troca de string em `<Link to>` | **NAO** |
| T03 | Sim — invoca `useCreateContact` (insert em `contacts`), duplicata check | **SIM** — mutation em dado de contato |
| T04 | Sim — altera CHECK constraint em tabela `zapi_messages` | **SIM** — migration em producao |
| T05 | Sim — Edge Function com `service_role` (webhook receiver) | **SIM** — superfície crítica (webhook + service_role) |
| T06 | Nao — renderização client-side de dado já persistido | **NAO** |

---

## Tasks

---

### T01 — Adicionar campo de busca na lista de conversas

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** —
**WSJF score:** (5 + 5 + 1) / 2 = 5,5 — maior score da lista; maior frequência de uso, risco zero

#### User story

Como assessora de gabinete monitorando as conversas do WhatsApp, quero um campo de busca na lista de chats que filtre por nome do contato ou número de telefone enquanto digito, para localizar qualquer eleitor em menos de 5 segundos, sem precisar rolar a lista.

#### Contexto

A coluna 1 de `ConversasTabContent` renderiza todos os chats via `.map()` sobre o array `chats` retornado por `useZapiChats`. Com 15-40 conversas ativas, localizar um contato exige scroll manual (20-40s por ação, conforme briefing). A busca é puramente client-side: filtrar `chats` por `contact_name` e `phone` antes de passar ao `.map()`. Nenhuma chamada adicional ao banco. Estado de busca `searchTerm` vive em `ConversasTabContent` junto com `selectedChatId` e `selectedAccountId`. Ao trocar de conta (`selectedAccountId` muda), o `searchTerm` deve ser resetado — o `useEffect` que já zera `selectedChatId` é o ponto natural de extensão.

#### Critérios de aceite

- [ ] Campo `<Input>` com ícone `Search` aparece no cabeçalho da coluna 1, acima da `<ScrollArea>` de chats, sempre visível quando há conta selecionada
- [ ] Filtro é aplicado em até 300ms após parar de digitar (debounce 300ms ou `useMemo` — sem chamada extra ao banco)
- [ ] Filtra por `contact_name` (case-insensitive) E por `phone` (substring match, sem regex — usar `String.includes`)
- [ ] `contact_name` null: compara somente contra `phone` (sem erro de runtime)
- [ ] Campo limpo: todos os chats voltam na ordem original sem reload nem nova requisição
- [ ] Busca sem resultados: exibe mensagem "Nenhuma conversa encontrada para '[termo]'" no lugar da lista vazia
- [ ] Conversa selecionada na coluna 2 não é resetada ao digitar no campo de busca (`selectedChatId` preservado)
- [ ] Ao trocar de conta Z-API, `searchTerm` é zerado (junto com o reset de `selectedChatId` já existente)
- [ ] Busca com espaços extras: `trim()` antes de filtrar
- [ ] Caracteres especiais `(`, `)`, `-`, `+`: não lançam exceção (uso de `includes`, nunca `RegExp` sobre o input do usuário)
- [ ] Lista com 0 chats (estado inicial vazio): campo visível, mas a mensagem de "Sem conversas" do estado vazio original permanece inalterada

#### Hints técnicos (não-prescritivos)

- **Component:** `src/components/whatsapp/ConversasTabContent.tsx` — estado `searchTerm: string` + `setSearchTerm` adicionados ao escopo do componente pai. `useMemo` (ou `useDebounce` com 300ms) deriva `filteredChats` de `chats + searchTerm`. O `.map()` da coluna 1 passa a iterar sobre `filteredChats`.
- **UI:** shadcn `<Input>` já disponível; ícone `Search` de `lucide-react` (já importado em outros arquivos do módulo). Inserir no `div.px-3.py-2.border-b.bg-muted/30` da coluna 1, abaixo do contador de conversas.
- **Debounce:** pode usar `useState` + `useEffect` com `setTimeout` simples de 300ms, ou `useMemo` (para arrays pequenos <100 itens, re-computação síncrona é imperceptível — avaliar).
- **Reset ao trocar conta:** extender o `useEffect` na linha 65 de `ConversasTabContent.tsx` (já zera `selectedChatId` ao trocar `selectedAccountId`) para também chamar `setSearchTerm('')`.

#### Test cases

- **Happy path:** 3 chats carregados, usuária digita "Maria" → lista exibe só os chats com "Maria" no nome; ao apagar, todos voltam
- **Busca por número:** digita "9988" → exibe chats cujo `phone` contém "9988"
- **contact_name null:** chat sem nome cadastrado — busca por número encontra; busca por nome não retorna erro
- **Sem resultados:** digita "xyzxyz" → mensagem "Nenhuma conversa encontrada para 'xyzxyz'"
- **Troca de conta:** digita "Maria", troca conta → campo limpa, lista da nova conta aparece completa
- **Chat selecionado:** seleciona chat A, digita filtro que remove A da lista → coluna 2 ainda exibe A
- **Caracteres especiais:** digita "(11)" → sem crash, filtra normalmente

#### Definition of Done

- [ ] Critérios de aceite validados acima
- [ ] Lint OK (`npm run lint`)
- [ ] Typecheck OK (`tsc --noEmit`)
- [ ] Build OK (`npm run build`)
- [ ] Smoke test manual: abrir Conversas, digitar nome parcial, confirmar filtro; limpar campo, confirmar retorno
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Busca server-side ou paginação de chats
- Busca dentro do conteúdo das mensagens (histórico)
- Highlight do termo buscado nos resultados
- Persistência do termo de busca entre sessões

---

### T02 — Corrigir botão "Ver no CRM" com link direto ao contato

**Tipo:** bug / fix
**Estimativa:** XS (1pt)
**Camadas afetadas:** component
**Depende de:** —
**WSJF score:** (4 + 5 + 3) / 1 = 12 — bug funcional com solução de 1 linha; altíssimo valor/custo do delay

#### User story

Como assessora visualizando uma conversa com um eleitor cadastrado no CRM, quero que o botão "Ver no CRM" abra o card completo desse contato diretamente, para não perder tempo reaplicando filtros manualmente em Contatos.

#### Contexto

Em `ContactPanel` (dentro de `ConversasTabContent.tsx`, linha ~481), quando `chat.contact_id` é não-nulo, o botão atual navega para `<Link to="/contacts">` — sem parâmetros. A página `Contacts.tsx` já consome `?contact=<uuid>` (via `useContact(contactIdFromUrl)`) e abre o `ContactDialog` automaticamente. A correção é substituir o `to` fixo pelo template com `chat.contact_id`. Se `contact_id` for null, o botão não é exibido (comportamento atual preservado — o bloco `else` com o texto orientativo já existe).

#### Critérios de aceite

- [ ] Quando `chat.contact_id` é não-nulo, `<Link to>` navega para `/contacts?contact=<chat.contact_id>`
- [ ] O `ContactDialog` abre automaticamente ao chegar na página Contacts com o parâmetro (comportamento já existente — não alterar `Contacts.tsx`)
- [ ] Quando `chat.contact_id` é null, o botão "Ver no CRM" não aparece (mantém comportamento atual)
- [ ] Quando `contact_id` aponta para contato deletado ou mesclado: `Contacts.tsx` exibe estado vazio sem crash (responsabilidade de `useContact` já existente — verificar que não quebra)
- [ ] Botão mantém aparência visual idêntica ao atual (nenhuma mudança de estilo)

#### Hints técnicos (não-prescritivos)

- **Component:** `src/components/whatsapp/ConversasTabContent.tsx` — função `ContactPanel`, bloco `{chat.contact_id ? (...) : (...)}`, linha ~481. Trocar `to="/contacts"` por `` to={`/contacts?contact=${chat.contact_id}`} ``.
- **Nenhuma alteração** em `Contacts.tsx`, `useContacts.ts`, ou qualquer outra camada.

#### Test cases

- **Happy path:** chat com `contact_id` preenchido → clicar "Ver no CRM" → `ContactDialog` abre com dados do contato
- **contact_id null:** botão não aparece; texto orientativo exibido
- **Contato deletado:** clique navega, `Contacts.tsx` exibe estado vazio sem tela branca
- **Contato mesclado:** `useContact` retorna null → `ContactDialog` não abre ou exibe "Contato não encontrado"

#### Definition of Done

- [ ] Critérios de aceite validados acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual: abrir conversa com contato vinculado, clicar "Ver no CRM", confirmar abertura do ContactDialog
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Qualquer mudança na página Contacts ou no hook useContact
- Abrir ContactDialog inline dentro do módulo Conversas
- Tratamento de contatos duplicados (dois contatos com mesmo telefone)

---

### T03 — Adicionar botão "Adicionar no CRM" no painel lateral da conversa

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** component + hook (uso de hook existente)
**Depende de:** T02 (navegação pós-criação usa o mesmo pattern `?contact=<id>`; garante que o "Ver no CRM" que aparece após criação funcione corretamente)
**WSJF score:** (4 + 3 + 3) / 5 = 2,0 — maior surface de edge cases; depende de T02

#### User story

Como assessora conversando com um eleitor que ainda não está no CRM, quero um botão "Adicionar no CRM" no painel lateral da conversa que crie o contato com nome e número pré-preenchidos e abra o card para edição imediata, para cadastrar o eleitor sem sair do módulo Conversas nem copiar dados manualmente.

#### Contexto

Quando `chat.contact_id` é null, o painel lateral (`ContactPanel`) hoje exibe texto orientativo pedindo que a assessora saia para Contatos → Novo. A solução substitui esse texto por um botão de ação que invoca `useCreateContact` (já existente em `src/hooks/useContacts.ts`) com `nome` e `whatsapp` pré-preenchidos dos dados do chat. O hook já inclui `findDuplicatePhoneContact` internamente — quando o telefone já existe, lança `Error` com mensagem contendo o nome do contato existente. O componente intercepta esse erro antes de chamar a mutation e exibe o alerta de duplicata (CA-03.2) para que a assessora escolha entre abrir o existente ou cancelar. Após criação bem-sucedida, navegar para `/contacts?contact=<novo_id>` (pattern de T02) E fazer refetch de `useZapiChats` para que `chat.contact_id` seja atualizado na lista.

Nota sobre o trigger SQL (migration 047): o trigger que vincula `zapi_chats.contact_id` dispara em eventos na tabela `zapi_chats`, não em `contacts`. Após criar o contato novo, o `contact_id` no chat só se atualiza via trigger se houver um UPDATE no chat (o trigger reverso não existe — é out of scope per briefing). Solução: fazer `refetch` explícito de `useZapiChats` após `onSuccess` da mutation. Confirmar com Fullstack se `useCreateContact.onSuccess` já invalida `zapi-chats` — não invalida (invalida `contacts` e `duplicate-count`). O refetch precisa ser adicionado no `onSuccess` local do componente.

#### Critérios de aceite

- [ ] Quando `chat.contact_id` é null, o painel lateral exibe botão "Adicionar no CRM" no lugar do texto orientativo atual
- [ ] Clicar no botão invoca `useCreateContact` com `nome = chat.contact_name ?? formatPhone(chat.phone)` e `whatsapp = chat.phone`
- [ ] Durante a mutation, o botão exibe estado de loading e fica desabilitado (evita duplo clique)
- [ ] Após criação bem-sucedida: navegar para `/contacts?contact=<id_do_novo_contato>` E chamar `refetchChats()` (já disponível em `ConversasTabContent`)
- [ ] Quando `useCreateContact` detecta duplicata (lança Error com "Já existe um contato com esse telefone: ..."), exibir alerta/dialog com mensagem contendo o nome do contato existente e dois botões: "Abrir existente" (navega para `/contacts?contact=<id_existente>`) e "Cancelar"
- [ ] `contact_name` null: pré-preencher `nome` com `formatPhone(chat.phone)`
- [ ] Falha de rede: botão retorna ao estado inicial; toast de erro exibido (o hook já dispara `toast.error`); nenhum contato parcial gravado
- [ ] Após criação, o painel lateral atualiza para exibir "Ver no CRM" (consequência do `refetchChats` — `chat.contact_id` passa a ser não-nulo)
- [ ] O `ContactDialog` aberto pós-criação (via Contacts com `?contact=<id>`) permite editar todos os campos e deletar o contato (CA-03.5 — CRUD completo — comportamento já existente em `Contacts.tsx`, não requer código novo)

#### Hints técnicos (não-prescritivos)

- **Component:** `src/components/whatsapp/ConversasTabContent.tsx` — `ContactPanel`. Receber `refetchChats` como prop (já existe em `ConversasTabContent` via `useZapiChats`). Importar `useCreateContact` de `@/hooks/useContacts`. Importar `useNavigate` de `react-router-dom`. Para o alerta de duplicata, um `useState<{ id: string; nome: string } | null>` + `AlertDialog` shadcn é suficiente.
- **Detecção de duplicata no componente:** `useCreateContact` lança `Error` cujo `.message` começa com "Já existe um contato com esse telefone: ...". Parsear o `id` do contato existente: o hook não retorna o `id` do duplicado no erro — pode ser necessário extrair via `findDuplicatePhoneContact` chamado antes da mutation no componente, OU ajustar o hook para incluir o `id` na mensagem de erro. Avaliar a opção mais limpa sem quebrar outros consumers do hook.
- **`formatPhone`:** já importado em `ConversasTabContent` (linha 46). Reutilizar para pré-preencher nome quando `contact_name` é null.
- **`refetchChats`:** já desestruturado na linha 69 de `ConversasTabContent`: `const { data: chats, ..., refetch: refetchChats } = useZapiChats(...)`. Passar como prop para `ContactPanel`.
- **Pattern de navegação:** `const navigate = useNavigate()` + `navigate(`/contacts?contact=${data.id}`)` no `onSuccess` local da mutation (não no `onSuccess` do hook global).

#### Test cases

- **Happy path:** chat sem `contact_id`, clicar "Adicionar no CRM" → loading → navega para `/contacts?contact=<id>` → ContactDialog abre com nome e número pré-preenchidos
- **contact_name null:** nome pré-preenchido com `formatPhone(phone)` → ContactDialog abre, assessora edita o nome
- **Duplicata:** telefone já existe no CRM → alerta com nome do existente → "Abrir existente" navega para o contato; "Cancelar" fecha alerta sem criar
- **Duplo clique:** botão desabilitado após primeiro clique → apenas 1 contato criado
- **Erro de rede:** toast de erro; botão reabilitado; `contacts` list inalterada
- **Pós-criação:** painel lateral muda de "Adicionar no CRM" para "Ver no CRM" após refetch
- **CRUD:** no ContactDialog aberto, é possível editar nome e deletar o contato recém-criado

#### Definition of Done

- [ ] Critérios de aceite validados acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual: abrir conversa de número não cadastrado, clicar "Adicionar no CRM", confirmar criação e navegação; testar duplicata
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Trigger reverso `contacts → zapi_chats` (sincronização automática de `contact_id` sem refetch)
- Editar ou excluir contato diretamente pelo painel lateral (só criação + navegação para ContactDialog)
- Formulário de criação inline (sem sair do módulo Conversas)
- Criar contato sem navegar para Contacts depois

---

### T04 — Adicionar `reaction` ao CHECK constraint de `media_type`

**Tipo:** chore (migration)
**Estimativa:** XS (1pt)
**Camadas afetadas:** model (migration SQL)
**Depende de:** —
**WSJF score:** (3 + 4 + 5) / 1 = 12 — blocker para T05 e T06; risco de regressão alto se feito errado

> **Flag Security:** migration em producao altera constraint em tabela com dados existentes — exige agente Security.

#### User story

Como dev mantendo o módulo de WhatsApp CRM, quero que `zapi_messages.media_type` aceite o valor `'reaction'` sem violar o CHECK constraint, para que a Edge Function possa gravar reações sem erro de banco e sem precisar cair no fallback `'unknown'`.

#### Contexto

A migration `048_zapi_media_support.sql` define: `CHECK (media_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'poll', 'location', 'contact', 'unknown'))`. O valor `'reaction'` não está na lista. Gravar `media_type='reaction'` na Edge Function (T05) sem esta migration causaria `ERROR: new row for relation "zapi_messages" violates check constraint`. A nova migration deve: (1) dropar o constraint existente por nome, (2) recriar com `'reaction'` adicionado. Verificar o nome exato do constraint antes de dropar (`048_zapi_media_support.sql` não nomeia explicitamente o CHECK — pode ter nome gerado automaticamente pelo Postgres; model-writer deve confirmar com `\d zapi_messages` ou via `information_schema.table_constraints`).

#### Critérios de aceite

- [ ] Nova migration `049_zapi_reaction_support.sql` (ou número seguinte disponível) criada em `supabase/migrations/`
- [ ] Após aplicar a migration, `INSERT INTO zapi_messages (..., media_type) VALUES (..., 'reaction')` não viola constraint
- [ ] Os demais valores aceitos anteriormente (`text`, `image`, `audio`, etc.) continuam aceitos
- [ ] `'unknown'` continua aceito (fallback para tipos não suportados)
- [ ] Rows existentes com `media_type = 'unknown'` não são alteradas pela migration
- [ ] Migration é idempotente (pode ser reaplicada sem erro em ambiente de desenvolvimento)

#### Hints técnicos (não-prescritivos)

- **Model:** `supabase/migrations/049_zapi_reaction_support.sql` (verificar se 049 é o próximo número disponível — os arquivos existentes vão até 048)
- **Padrão:** `ALTER TABLE zapi_messages DROP CONSTRAINT <nome_gerado>; ALTER TABLE zapi_messages ADD CONSTRAINT chk_zapi_messages_media_type CHECK (media_type IN ('text','image','audio','video','document','sticker','poll','location','contact','reaction','unknown'));`
- **Confirmar nome do constraint:** `SELECT conname FROM pg_constraint WHERE conrelid = 'zapi_messages'::regclass AND contype = 'c' AND conname LIKE '%media_type%';` — se não houver nome específico para media_type, pode ser o constraint inline da coluna (sem nome separado); neste caso usar `ALTER TABLE ... ALTER COLUMN media_type SET CHECK (...)` ou recriar a coluna com `DEFAULT` e novo CHECK.
- **Alternativa mais segura se constraint não tem nome:** adicionar novo constraint nomeado sem dropar o inline, depois testar se Postgres aceita ambos (geralmente não — usar DROP CONSTRAINT IF EXISTS com o nome correto encontrado na inspeção).

#### Test cases

- **Happy path:** após migration, inserir row com `media_type='reaction'` → sem erro
- **Regressão:** inserir row com `media_type='text'` → sem erro; `media_type='unknown'` → sem erro
- **Valor inválido:** `media_type='xyz'` → constraint violada (proteção mantida)
- **Idempotência:** aplicar migration duas vezes → sem erro (IF NOT EXISTS / IF EXISTS guards)

#### Definition of Done

- [ ] Critérios de aceite validados acima
- [ ] Migration aplicada em ambiente de desenvolvimento com sucesso
- [ ] Lint OK
- [ ] Typecheck OK (types.ts gerado/atualizado se necessário)
- [ ] Build OK
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Alterar qualquer outro campo ou tabela
- Migrar dados existentes de `media_type='unknown'` para `'reaction'` (retroativo — não é possível distinguir sem rever os payloads originais)
- Adicionar outros tipos de mídia além de `reaction`

---

### T05 — Processar eventos de reação na Edge Function `zapi-webhook`

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** route (Edge Function)
**Depende de:** T04 (constraint precisa aceitar `'reaction'` antes do primeiro insert)
**WSJF score:** (3 + 3 + 4) / 2 = 5,0

> **Flag Security:** Edge Function com `service_role` + webhook receiver — exige agente Security (pentest automático por gatilho: "Edge Function nova com `service_role`" + "Webhook receiver").

#### User story

Como assessora lendo as mensagens de uma conversa, quero que emojis de reação enviados pelo eleitor sejam corretamente processados e gravados, para que a conversa reflita as reações sem exibir "[Mensagem não suportada]".

#### Contexto

A função `extractMedia` em `supabase/functions/zapi-webhook/index.ts` processa cada tipo de mensagem via `if` encadeados. Não há branch para `reaction`. Eventos de reação chegam pelo webhook e caem no fallback `unknown`. O briefing aponta que o payload pode ter `type === 'reaction'` ou `messageType: 'reactionMessage'` — a estrutura exata precisa ser validada contra a documentação Z-API antes de codificar (risco de feasibility identificado pelo PO). A task inclui pesquisar/confirmar o formato real do payload (parte da task, não spike separado dado que a dificuldade é de investigação pontual, não de arquitetura).

Os campos a gravar: `media_type = 'reaction'`, `media_metadata = { emoji, reaction_message_id, sender }`. O `body` de reações chega vazio ou null — não gravar `body` do payload. Reação com `emoji` null ou string vazia (remoção da reação): gravar `emoji: ''` em `media_metadata` (CA edge case do briefing). Logar o payload completo em `media_metadata` para facilitar diagnóstico retroativo (edge case: payload com estrutura diferente em versões futuras da API).

#### Critérios de aceite

- [ ] Antes de implementar: payload real do evento de reação Z-API confirmado (consultada documentação Z-API ou payload capturado em `zapi_webhook_log`) e documentado em comentário na Edge Function
- [ ] `ZapiPayload` interface estendida com o campo(s) de reação conforme payload real
- [ ] `extractMedia` possui branch para o tipo de reação identificado, que retorna `kind: 'reaction'`, `body: null`, `metadata: { emoji, reaction_message_id, sender }` — sem depender de `body` do payload (que chega vazio)
- [ ] Registro gravado em `zapi_messages` com `media_type='reaction'` e `media_metadata` contendo pelo menos `{ emoji: string, reaction_message_id: string }` (sender quando disponível)
- [ ] `emoji` null ou vazio: gravado como `emoji: ''` em `media_metadata` sem erro
- [ ] Evento de tipo desconhecido (não-`reaction`): continua caindo em `media_type='unknown'` — nenhuma regressão nos tipos existentes
- [ ] Payload completo do evento de reação logado em `media_metadata` para diagnóstico retroativo
- [ ] `zapi_webhook_log` registra o evento com `processing_status='success'` para eventos de reação válidos

#### Hints técnicos (não-prescritivos)

- **Route:** `supabase/functions/zapi-webhook/index.ts` — adicionar campo no `ZapiPayload` interface (ex: `reaction?: { emoji?: string; reactionMessageId?: string }`) e branch em `extractMedia` antes do fallback `unknown`. Ordem importa: branch deve vir antes do `return { kind: 'unknown' }` final.
- **Pesquisa payload:** verificar `zapi_webhook_log` por eventos existentes com `type='reaction'` ou `messageType='reactionMessage'` que possam ter chegado e sido descartados. Consultar docs Z-API (https://developer.z-api.io) na seção de webhooks de recebimento, tipo "Reação".
- **`MediaKind` union:** adicionar `| 'reaction'` ao tipo `MediaKind` (linha ~114 do arquivo) após confirmação do payload.

#### Test cases

- **Happy path:** evento de reação chega no webhook → `zapi_messages` row com `media_type='reaction'`, `media_metadata.emoji='👍'`
- **Emoji vazio (remoção):** `emoji=''` → row gravada com `emoji: ''`; `MessageBubble` renderiza nada ou "Reação removida"
- **Reação a mensagem antiga:** `reaction_message_id` não existe em `zapi_messages` → row gravada normalmente; sem crash
- **Tipos existentes:** evento de texto, imagem, áudio → `media_type` correto, sem regressão
- **Tipo desconhecido não-reaction:** `media_type='unknown'` → fallback mantido
- **Webhook log:** evento processado → `zapi_webhook_log.processing_status = 'success'`

#### Definition of Done

- [ ] Critérios de aceite validados acima
- [ ] Payload real Z-API confirmado e documentado
- [ ] Deploy da Edge Function realizado (`supabase functions deploy zapi-webhook`)
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual: enviar reação em conversa teste, verificar row em `zapi_messages` com `media_type='reaction'`
- [ ] Security agent aprovou (webhook receiver + service_role)
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Agrupar múltiplas reações à mesma mensagem (v2)
- Enviar reações a partir do CRM (só recebimento)
- Retroativamente reclassificar rows `media_type='unknown'` existentes que eram reações

---

### T06 — Renderizar mensagens de reação no `MessageBubble`

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T05 (dados com `media_type='reaction'` precisam existir para validar a UI)
**WSJF score:** (3 + 2 + 2) / 2 = 3,5

#### User story

Como assessora lendo as mensagens de uma conversa, quero que emojis de reação exibidos na timeline apareçam como reações (emoji + horário + remetente quando disponível), para entender o estado emocional/confirmação do eleitor sem ver "[Mensagem não suportada]".

#### Contexto

`MessageBubble.tsx` usa `renderContent()` com `switch(mediaType)`. O caso `'unknown'` retorna `<p className="italic opacity-70">[Mensagem não suportada]</p>`. Com T05, rows de reação têm `media_type='reaction'`. Sem este case, cairiam em `'text'`/`default` (body é null → exibe "[mensagem vazia]") ou em `'unknown'` dependendo do fluxo. Adicionar `case 'reaction'`: ler `media_metadata.emoji` e `media_metadata.sender` do campo `meta`. Renderizar emoji em tamanho maior, remetente em texto secundário (quando disponível), horário via o rodapé já existente do bubble. Reação removida (`emoji === ''`): exibir "Reação removida" em itálico. A interface `MediaMetadata` precisa ser estendida com `emoji?: string; reaction_message_id?: string; sender?: string`.

#### Critérios de aceite

- [ ] `case 'reaction'` adicionado ao switch de `renderContent` em `MessageBubble`
- [ ] Exibe o emoji como texto visível (ex: "👍") em tamanho ligeiramente maior que o texto padrão
- [ ] Exibe horário da reação via rodapé padrão do bubble (já implementado — sem código extra)
- [ ] Quando `meta.sender` está disponível: exibe abaixo do emoji texto secundário menor (ex: "João reagiu 👍" ou remetente separado)
- [ ] Quando `meta.sender` não está disponível: exibe apenas emoji e horário
- [ ] `emoji === ''` ou null: exibe "Reação removida" em itálico
- [ ] Qualquer string Unicode válida de emoji é renderizada sem erro (sem whitelist)
- [ ] A string "[Mensagem não suportada]" nunca aparece para `media_type='reaction'`
- [ ] Demais casos do switch (`text`, `image`, `audio`, etc.) não são afetados

#### Hints técnicos (não-prescritivos)

- **Component:** `src/components/whatsapp/MessageBubble.tsx` — interface `MediaMetadata` (linha ~43): adicionar `emoji?: string; reaction_message_id?: string; sender?: string`. Função `renderContent`: adicionar `case 'reaction'` antes do `case 'unknown'`. `getMetadata(message)` já retorna o objeto `media_metadata` castado.
- **UI:** `<p className="text-2xl leading-tight">{meta?.emoji}</p>` + condicional para sender. Manter o bubble com padding padrão; sem ícone de mídia (reação é só o emoji).

#### Test cases

- **Happy path:** row com `media_type='reaction'`, `emoji='👍'`, `sender='João'` → bubble exibe "👍" + "João reagiu" + horário
- **Sem sender:** `sender` ausente → bubble exibe "👍" + horário apenas
- **Emoji removido:** `emoji=''` → bubble exibe "Reação removida" em itálico
- **Emoji unicode complexo:** `emoji='🫶🏽'` (multi-codepoint) → renderizado corretamente pelo browser
- **Regressão text:** mensagem `media_type='text'` → renderização inalterada
- **Regressão unknown:** mensagem `media_type='unknown'` → "[Mensagem não suportada]" mantido

#### Definition of Done

- [ ] Critérios de aceite validados acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual: com row de reação no banco (criada via T05), abrir conversa e confirmar renderização do emoji
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Agrupar múltiplas reações em indicador visual estilo WhatsApp (v2)
- Exibir miniatura da mensagem original à qual a reação se refere
- Animar a entrada da reação
- Enviar reações via CRM
