# Backlog — Fase 3 · Operação em Equipe · Evolução WhatsApp CRM

> Quebra atomizada do `PRD-EVOLUCAO-WHATSAPP.md` (Fase 3 apenas).
> Continuação direta de `BACKLOG-FASE-2-WHATSAPP.md` (T01–T17).
> Gerado pelo agente Backlog em 2026-05-17.
> Total: 13 tasks (~59 pts).

---

## Decisões de design registradas

### O que já existe (NÃO recriar)

- **Colunas em `zapi_chats`**: `status`, `assigned_to`, `pinned`, `archived`,
  `snoozed_until` — migration 056 aplicada.
- **Tabela `zapi_chat_notes`**: `chat_id`, `autor_id`, `corpo`, `mencoes jsonb`
  com RLS (INSERT pelo próprio autor, SELECT para todos autenticados) — migration 057.
- **Edge Function `zapi-chat-update`**: aceita patch parcial de
  `{status, assigned_to, pinned, archived, snoozed_until}`. Valida enum, valida
  `assigned_to` em `profiles` com status ATIVO. Retorna o chat atualizado.
- **Edge Function `zapi-mark-as-read`**: zera `unread_count` de um chat.
- **`useMarkChatAsRead`** em `useZapiChats.ts`: já chama a EF real.
- **`isFeatureEnabled` / `countEnabledFeatures`** em `src/lib/featureFlags.ts`.
- **`FEATURES_CATALOG`**: inclui `c28` (SLA) e `c30` (supervisor) como flags configuráveis.
- **`useUsers()`** em `src/hooks/useUsers.ts`: lista perfis com nome, email, role, status.
- **`usePermissions()`**: inclui `accessWhatsapp()` e `editWhatsapp()`.
- **Realtime** em `useZapiChats`: invalida query em INSERT/UPDATE — novas colunas
  (`status`, `assigned_to`, `pinned`, `archived`) já chegam na atualização em tempo real.

### Marcar não-lida: nova mini-EF ou extensão da existente?

A `zapi-mark-as-read` zera `unread_count`. O inverso (marcar não-lida) precisa
setar `unread_count = 1` — não é o comportamento oposto trivial, pois o contador
real vem do Z-API (não sabemos o número exato). A decisão: **estender**
`zapi-chat-update` com um campo adicional `unread: true | false` no patch, em vez
de criar EF nova. O campo `unread: true` seta `unread_count = 1`; `unread: false`
zera (comportamento de `mark-as-read`). Isso consolida duas EFs num único ponto.
**Esta extensão da EF toca superfície crítica: Security obrigatório.**

### Monitor de saúde Z-API (C25): EF de proxy ou chamada direta?

A Z-API expõe endpoint de status da instância:
`GET https://api.z-api.io/instances/{instance_id}/token/{token}/status`.
O frontend **não pode chamar direto** (expõe instance_token). O caminho correto é
uma **Edge Function de proxy** `zapi-instance-status` que chama a Z-API server-side
e retorna apenas `{connected: bool, state: string, needsQR: bool}` — sem expor tokens.
**Toca superfície crítica (EF nova com chamada à Z-API): Security obrigatório.**

### SLA (C28): onde calcular?

O cálculo de SLA é simples: `now() - last_message_at` (quando a última mensagem
foi do eleitor, não do atendente). Não requer migration — basta usar `last_message_at`
já existente em `zapi_chats` e o campo `direction` de `zapi_messages`. O indicador
visual é **client-side** (calculado no hook), controlado pela feature flag `c28`.
Sem nova EF, sem migration.

### Modo supervisor (C30): o que é "ver todas as conversas"?

A RLS atual de `zapi_chats` permite leitura para qualquer autenticado da organização
(não é multi-tenant por usuário — é por `account_id` que pertence à organização).
Portanto o supervisor já vê todas as conversas — o que falta é:
1. Um filtro "Atribuídas a mim" vs. "Todas" na coluna 1.
2. Métricas de resumo por atendente (contagem de conversas abertas por usuário).
O modo supervisor é um **conjunto de filtros + painel de métricas**, não uma
alteração de RLS. Controlado por `activeRole === 'admin'` + feature flag `c30`.

---

## Ordem de execução (dependências técnicas)

```
T18 — Hook useChatUpdate + useChatNotes (camada de dados da Fase 3)
T19 — Badge de status + seletor de status no header da conversa         [Security]
T20 — Filtros de status + filtro "minhas/todas" na lista de conversas
T21 — Atribuição/transferência de conversa entre usuários               [Security+Pentest]
T22 — Nota de handoff obrigatória ao transferir (C16)
T23 — Notas internas + menções @ (zapi_chat_notes — UI)
T24 — Fixar conversa (pinned) + ordem prioritária na lista
T25 — Arquivar conversa + filtro de arquivadas
T26 — Marcar como não-lida (extensão da zapi-chat-update)              [Security]
T27 — EF zapi-instance-status (proxy de saúde Z-API)                   [Security+Pentest]
T28 — Monitor de saúde C25 (UI: badge + alerta + botão reconectar)
T29 — SLA C28 (indicador visual de conversa parada)
T30 — Modo supervisor C30 (visão admin + métricas por atendente)
```

**Dependências críticas:**
- T18 é o enabler da Fase 3 — T19 a T26 dependem de `useChatUpdate`.
- T19 e T20 podem ser feitas em paralelo após T18.
- T21 depende de T18 e T19 (o status "em_atendimento" deve ser setado junto com a atribuição).
- T22 depende de T21 (o handoff acontece no modal de atribuição).
- T23 depende de T18 apenas (usa hook próprio de notes).
- T24 e T25 dependem de T18 (pinned/archived via patch).
- T26 depende de T18 (extensão do patch na EF).
- T27 é independente (EF pura).
- T28 depende de T27.
- T29 e T30 são independentes entre si e podem entrar após T18.

**Ordem recomendada: T18 → T19 → T20 → T21 → T22 → T23 → T24 → T25 → T26 → T27 → T28 → T29 → T30**

---

## Tasks

### T18 — Hook useChatUpdate + useChatNotes (camada de dados da Fase 3)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook
**Depende de:** — (independente — EFs já existem)
**WSJF score:** (9 + 9 + 7) / 5 = **5.0** — enabler de quase todas as outras tasks

#### User story

Como desenvolvedor mantendo o módulo WhatsApp, quero hooks React que encapsulem
as chamadas às Edge Functions `zapi-chat-update` e `zapi_chat_notes`, para que as
tasks de UI da Fase 3 não dupliquem lógica de chamada de EF.

#### Contexto

A `zapi-chat-update` já existe e aceita patch de qualquer combinação de campos
(`status`, `assigned_to`, `pinned`, `archived`, `snoozed_until`). A tabela
`zapi_chat_notes` já existe com RLS e aceita INSERT direto do client autenticado.
Esta task cria os hooks que as tasks de UI (T19–T26) vão consumir — é o "plano de
água" da Fase 3.

Sem este hook, cada task de UI repetiria a chamada à EF, o pattern de optimistic
update e o `invalidateQueries` — violando DRY e criando divergência de tratamento
de erro.

#### Critérios de aceite

- [ ] `useChatUpdate()` em `src/hooks/useZapiChats.ts` (ou arquivo separado
  `src/hooks/useChatUpdate.ts`) exporta uma `useMutation` que chama
  `supabase.functions.invoke('zapi-chat-update', { body: { chat_id, patch } })`.
- [ ] Mutation faz **optimistic update** no cache `zapiChatKeys.byAccount(accountId)`:
  aplica o patch localmente antes da confirmação da EF; em caso de erro, faz rollback
  e exibe `toast.error()`.
- [ ] Em caso de sucesso, invalida `zapiChatKeys.byAccount(accountId)` para forçar
  sync com o banco.
- [ ] `useChatNotes(chatId)` em `src/hooks/useChatNotes.ts` expõe:
  - `notesQuery`: lista notas de `zapi_chat_notes` onde `chat_id = chatId`,
    ordenadas por `created_at ASC`. Inclui JOIN com `profiles(nome)` para exibir
    o nome do autor.
  - `createNoteMutation`: INSERT direto via `supabase.from('zapi_chat_notes').insert(...)`.
    `autor_id` é definido pelo RLS (sem passar no payload — o banco usa `auth.uid()`).
  - `deleteNoteMutation`: DELETE pelo `id` da nota.
- [ ] Os dois hooks têm tratamento de erro com `toast.error` e tipagem TypeScript
  completa (sem `any`).
- [ ] Exportações nomeadas, sem breaking change em `useZapiChats.ts` existente.

#### Hints técnicos (não-prescritivos)

- **Arquivos prováveis:** `src/hooks/useChatUpdate.ts` (novo) +
  `src/hooks/useChatNotes.ts` (novo).
- **Pattern de optimistic update:** seguir o pattern de `useContacts` existente
  (ex: `onMutate → getQueryData → setQueryData → return context` para rollback).
- **Key factory para notas:** `chatNoteKeys = { byChatId: (id) => ['chat-notes', id] }`.
- **SELECT de notas:** `supabase.from('zapi_chat_notes').select('*, autor:autor_id(nome)').eq('chat_id', chatId).order('created_at')`.
- **Tipo `ChatNote`:** inferir de `Tables<'zapi_chat_notes'>` + `{ autor: { nome: string } }`.
- **accountId no hook:** `useChatUpdate` precisa receber `accountId` como parâmetro
  para saber qual query invalidar no cache.

#### Test cases

- **Happy path — update status:** chamar mutation com `{chat_id, patch:{status:'finalizada'}}`;
  verificar que o cache atualiza otimisticamente e que, após resolução, o chat na lista
  mostra o novo status.
- **Happy path — create note:** `createNoteMutation.mutate({chat_id, corpo:'Observação interna'})`;
  nota aparece na lista de `notesQuery`.
- **Edge — EF retorna 422:** mutation faz rollback do optimistic update; toast.error
  exibe mensagem amigável (sem expor stack da EF).
- **Edge — delete note de outro usuário:** RLS bloqueia; `deleteNoteMutation` lança
  erro com toast.error.
- **Edge — chatId null:** `useChatNotes(null)` não dispara query (enabled: false).

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: verificar no devtools (react-query) que o optimistic update
  aparece e o rollback funciona ao simular erro de rede
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Hook de `unread` (extensão da EF — coberto em T26).
- Hook de `snoozed_until` (Fase 5, snooze).
- Realtime de `zapi_chat_notes` (extensão futura — invalida via polling ou
  `invalidateQueries` manual após create/delete).

---

### T19 — Badge de status + seletor de status no header da conversa

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T18 (useChatUpdate)
**WSJF score:** (8 + 8 + 6) / 5 = **4.4**
**Segurança:** mutação via EF existente (auditada); sem nova surface — sem gatilho Security

#### User story

Como atendente do gabinete, quero ver e alterar o status da conversa (Aberta /
Em atendimento / Aguardando / Finalizada) diretamente no header do chat aberto,
para comunicar à equipe em que etapa aquele eleitor está.

#### Contexto

O header do `ChatPanel` em `ConversasTabContent.tsx` exibe hoje apenas o nome do
contato e ícones de ações. A coluna 1 exibe `ChatListItem` com nome e preview de
mensagem, mas nenhum indicador de status operacional.

O `status` já existe em `zapi_chats` (migration 056) e chega via `useZapiChats`.
A EF `zapi-chat-update` já aceita `{patch: {status: 'finalizada'}}`.
O hook `useChatUpdate` (T18) encapsula a chamada. Esta task é UI pura sobre
infraestrutura já pronta.

O badge de status deve aparecer no `ChatListItem` também (visual secundário) —
sem quebrar o layout compacto existente.

#### Critérios de aceite

- [ ] O header do `ChatPanel` exibe um `Badge` colorido com o status da conversa:
  - "Aberta" → badge cinza/neutro
  - "Em atendimento" → badge azul
  - "Aguardando" → badge amarelo/âmbar
  - "Finalizada" → badge verde
- [ ] Clicar no badge (ou num botão adjacente) abre um `DropdownMenu` com as 4
  opções de status. A opção atual aparece marcada (ícone check).
- [ ] Selecionar novo status chama `useChatUpdate` com o patch `{status: novo}`;
  o badge atualiza otimisticamente antes da confirmação da EF.
- [ ] Toast "Status atualizado para Em atendimento" (ou similar) após sucesso.
  Toast de erro com rollback em caso de falha.
- [ ] O `ChatListItem` exibe um indicador de status secundário (ex: dot colorido
  antes do nome, ou badge XS no canto do avatar) — sem quebrar o layout compacto.
- [ ] A mudança de status propaga via Realtime para outros atendentes que estejam
  com a mesma conta aberta (já funciona via `useZapiChats` subscription existente).
- [ ] O seletor é desabilitado quando `activeChat` é um `PendingChat` (conversa
  ainda não existe no banco — `id === PENDING_CHAT_ID`).

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `ChatPanel` dentro de
  `src/components/whatsapp/ConversasTabContent.tsx` (ou extrair para
  `src/components/whatsapp/ChatPanel.tsx` se o arquivo ficar grande).
- **Componente de badge:** usar `Badge` de `src/components/ui/badge.tsx` com
  `variant` customizado por status via mapeamento:
  `{aberta: 'secondary', em_atendimento: 'default', aguardando: 'outline', finalizada: 'success'}`.
  Verificar se `'success'` existe — se não, usar `className` direto.
- **DropdownMenu:** já importado no arquivo; padrão existente nas ações do header.
- **Hook a usar:** `useChatUpdate(selectedAccountId)` de T18.
- **ChatListItem:** adicionar `dot` de 8px antes do avatar ou usar `cn()` com
  `ring-2` no avatar com cor do status.
- **Guard de PendingChat:** verificar `chat.id === PENDING_CHAT_ID` antes de
  habilitar o seletor.

#### Test cases

- **Happy path:** abrir conversa com status "aberta", clicar no badge, selecionar
  "Finalizada" → badge muda para verde; outro atendente (na mesma conta) vê a mudança
  em <2s via Realtime.
- **Happy path — rollback:** simular erro de rede (devtools offline); ao selecionar
  status, badge reverte após toast de erro.
- **Edge — PendingChat:** conversa pendente (sem ID real) → badge mostra "Aberta"
  mas o seletor está desabilitado.
- **Edge — sem permissão editWhatsapp:** se o usuário tem só leitura, o seletor
  aparece desabilitado (verificar `usePermissions().editWhatsapp()`).

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: abrir 2 abas com contas iguais, mudar status em uma → confirmar
  que reflete na outra em tempo real
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Histórico de mudanças de status (auditoria — Fase 7).
- Mudança automática de status por regras (Fase 5/6).
- Status no `ChatListItem` da lista (apenas dot visual, não seletor interativo).

---

### T20 — Filtros de status + "minhas/todas" na lista de conversas

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T18 (para ter o campo `status` disponível no tipo `ZapiChat`)
**WSJF score:** (8 + 7 + 5) / 5 = **4.0**
**Segurança:** sem EF nova, sem migration — sem gatilho Security

#### User story

Como coordenador do gabinete, quero filtrar a lista de conversas por status
(Abertas / Em atendimento / Aguardando / Finalizadas) e ver apenas as conversas
atribuídas a mim, para gerenciar minha fila sem ruído das outras equipes.

#### Contexto

A coluna 1 de `ConversasTabContent.tsx` tem hoje busca por texto (T16). O PRD
pede filtros por status (#8/#52). A Fase 3 adiciona também a visão
"Atribuídas a mim" — padrão para atendentes, opcional para supervisores.

Os filtros são **client-side** sobre `filteredChats` (já calculado) — não requerem
nova query ao banco, pois `useZapiChats` já retorna todas as conversas da conta com
os campos `status` e `assigned_to` presentes.

O `assigned_to` retornado pelo banco é o UUID do `auth.user`. Para comparar com o
usuário logado, usar `useAuth()` ou `supabase.auth.getUser()`.

#### Critérios de aceite

- [ ] Acima da lista de conversas, um grupo de filtros rápidos (estilo chip/tab):
  "Todas" · "Abertas" · "Em atendimento" · "Aguardando" · "Finalizadas".
  O chip ativo fica destacado. "Todas" é o padrão inicial.
- [ ] Selecionar um chip filtra `filteredChats` para mostrar apenas conversas com
  aquele status. O contador `(X de Y)` reflete o filtro ativo.
- [ ] Um toggle "Só minhas" (Switch ou Checkbox) filtra conversas onde
  `assigned_to === uid_do_usuario_logado`. Combinável com o filtro de status.
- [ ] "Só minhas" desabilitado quando nenhuma conversa está atribuída ao usuário
  logado (ou o switch é exibido mas a lista ficará vazia — com mensagem adequada).
- [ ] Os filtros de status e "só minhas" são independentes e cumulativos com o
  filtro de busca por texto existente (T16).
- [ ] Ao trocar de conta (`selectedAccountId`), os filtros são resetados para
  "Todas" e "Só minhas = false".
- [ ] Conversas arquivadas (`archived = true`) são excluídas de TODAS as visões de
  filtro de status — ficam apenas na aba "Arquivadas" (T25).

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `src/components/whatsapp/ConversasTabContent.tsx` —
  state de `statusFilter: string | null` e `onlyMine: boolean`.
- **uid do usuário logado:** `const { user } = useAuth()` ou
  `supabase.auth.getUser()` — verificar qual contexto está disponível no arquivo.
  Alternativamente, buscar via `useUsers()` e cruzar com `user.id` da sessão.
- **Filtro encadeado:** aplicar na sequência — texto → status → minhas → excluir arquivadas.
- **Chips de status:** usar `Button variant='outline'` com `cn()` condicional
  para destacar o ativo. Ou usar `ToggleGroup` do shadcn se disponível.
- **Reset ao trocar conta:** adicionar `statusFilter` e `onlyMine` ao `useEffect`
  que já reseta `searchTerm` ao mudar `selectedAccountId`.
- **Excluir arquivadas:** adicionar `.filter(c => !c.archived)` como etapa final
  do chain de filtragem (antes de T25 existir) ou como etapa 1 (arquivadas = visão separada).

#### Test cases

- **Happy path — filtro status:** chip "Finalizadas" → lista exibe apenas chats com
  `status='finalizada'`; contador correto.
- **Happy path — só minhas:** toggle ativo → lista exibe apenas chats onde
  `assigned_to === meu_uid`; outros chats somem.
- **Happy path — combinado:** "Em atendimento" + "Só minhas" → só meus chats
  em atendimento aparecem.
- **Edge — 0 resultados:** filtro "Aguardando" sem conversas aguardando → empty state
  "Nenhuma conversa aguardando" (não o estado padrão de "Nenhuma conversa ainda").
- **Edge — trocar conta:** filtros resetam automaticamente.
- **Edge — arquivadas ocultas:** conversas com `archived=true` nunca aparecem nos
  filtros de status.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: criar conversas com status distintos no banco via SQL, verificar
  cada filtro na UI
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Visões salvas de filtro (Fase 5, C14).
- Filtro por atendente específico (além de "só minhas") — modo supervisor em T30.
- Filtro de arquivadas (T25 cria a aba dedicada).

---

### T21 — Atribuição e transferência de conversa entre usuários

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** hook, component
**Depende de:** T18 (useChatUpdate), T19 (status em_atendimento acompanha a atribuição)
**WSJF score:** (9 + 8 + 7) / 8 = **3.0**
**Segurança:** TOCA superfície crítica — `assigned_to` via EF com validação de perfil.
**Flag:** Security obrigatório. Pentest obrigatório (atribuição pode ser usada para
IDOR — um usuário não pode se atribuir conversas de outra organização).

#### User story

Como coordenador do gabinete, quero atribuir ou transferir uma conversa para um
atendente específico da equipe, para que fique claro quem é responsável por aquele
eleitor e evitar que dois atendentes respondam ao mesmo tempo.

#### Contexto

A coluna `assigned_to` (UUID) já existe em `zapi_chats` e a EF `zapi-chat-update`
já valida que o UUID pertence a um perfil ATIVO antes de fazer o UPDATE.

A UI precisa de um seletor de usuário no header do `ChatPanel`. Ao atribuir,
o status da conversa deve mudar automaticamente para "em_atendimento" (a menos
que já esteja em outro status — a EF aceita patch combinado).

Quando há uma atribuição anterior (transferência), a task T22 obriga uma nota de
handoff. Esta task (T21) implementa o seletor; T22 implementa o modal de handoff
que é invocado por T21.

A lista de usuários vem de `useUsers()` existente — filtrar apenas `status_aprovacao === 'ATIVO'`.

#### Critérios de aceite

- [ ] No header do `ChatPanel`, ao lado do badge de status (T19), aparece um
  componente "Atribuído a" que exibe:
  - Avatar com iniciais + nome do atendente atribuído, quando `assigned_to` não é null.
  - "Não atribuído" (ou ícone de usuário vazio), quando `assigned_to` é null.
- [ ] Clicar no componente abre um popover/dropdown com a lista de atendentes
  ativos (de `useUsers()`, filtrados por `status_aprovacao === 'ATIVO'`).
- [ ] Cada atendente na lista mostra avatar com iniciais, nome e role.
- [ ] Selecionar um atendente diferente do atual:
  - Se a conversa **não tinha** atribuição anterior → chama `useChatUpdate` com
    `patch: { assigned_to: novoUid, status: 'em_atendimento' }` diretamente.
  - Se a conversa **tinha** atribuição anterior (transferência) → abre o modal de
    handoff (T22) antes de confirmar.
- [ ] Existe uma opção "Remover atribuição" que seta `assigned_to = null`
  (sem modal de handoff, pois não é transferência para outra pessoa).
- [ ] A atribuição reflete em tempo real para outros atendentes via Realtime
  existente no `useZapiChats`.
- [ ] O componente de atribuição é desabilitado para `PendingChat` (sem ID real no banco).
- [ ] Apenas usuários com `editWhatsapp()` podem alterar a atribuição. Para os
  demais, o campo é read-only (exibe quem está atribuído, sem dropdown).

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `ChatPanel` em `ConversasTabContent.tsx` (ou `ChatPanel.tsx`
  extraído).
- **Hook de usuários:** `useUsers()` de `src/hooks/useUsers.ts` — já retorna
  `{ id, nome, role, status_aprovacao }`.
- **Hook de atualização:** `useChatUpdate(accountId)` de T18.
- **Popover/Combobox:** `Popover` + `Command` (shadcn) para lista de atendentes
  com busca por nome — padrão da `ConversaPaletteDialog` de T13.
- **Checagem de transferência:** `chat.assigned_to !== null && chat.assigned_to !== novoUid`.
- **Permissão:** `usePermissions().editWhatsapp()`.
- **accountId:** disponível como `selectedAccountId` no componente pai.

#### Test cases

- **Happy path — primeira atribuição:** conversa não atribuída; selecionar "Ana Lima"
  → `assigned_to` = UUID da Ana, `status` muda para "em_atendimento"; sem modal.
- **Happy path — transferência:** conversa atribuída à Ana; selecionar "João Silva"
  → modal de handoff (T22) abre; ao confirmar com nota, `assigned_to` muda para João.
- **Happy path — remover atribuição:** clicar "Remover atribuição" → `assigned_to`
  = null; status permanece inalterado.
- **Edge — usuário inativo na lista:** perfis com `status_aprovacao !== 'ATIVO'`
  não aparecem no dropdown.
- **Edge — sem permissão:** usuário sem `editWhatsapp()` vê o nome do atendente mas
  o campo é read-only (sem dropdown).
- **Edge — PendingChat:** seletor desabilitado.
- **Edge — EF rejeita assigned_to:** usuário foi desativado entre a listagem e o
  clique; EF retorna 422; toast de erro + rollback.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: atribuir conversa a outro usuário; verificar que `zapi_chats.assigned_to`
  mudou no banco via Supabase CLI
- [ ] Security review (superfície crítica: atribuição via EF com IDOR potencial)
- [ ] Pentest (verificar que um usuário não pode atribuir conversas de outra org)
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Distribuição automática round-robin (#43 — fora do escopo do PRD por enquanto).
- Notificação push/email ao atendente atribuído (Fase 5/6).
- Múltiplos responsáveis por conversa (modelo 1:1 nesta fase).

---

### T22 — Nota de handoff obrigatória ao transferir conversa (C16)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T21 (a transferência dispara o modal), T23 (usa a mesma infra de notas)
**WSJF score:** (7 + 7 + 5) / 2 = **9.5** — alto WSJF por ser gate bloqueante de T21

#### User story

Como coordenador do gabinete, ao transferir uma conversa para outro atendente,
quero ser obrigado a escrever uma nota de contexto, para que o novo responsável
saiba o que já foi discutido sem ter que ler todo o histórico.

#### Contexto

C16 do PRD: nota de handoff obrigatória ao transferir. Esta task cria o modal que
é invocado por T21 quando detecta uma transferência (atribuição anterior ≠ null).

A nota de handoff é tecnicamente uma `zapi_chat_notes` comum — o que a diferencia
é o contexto (criada no momento da transferência) e a obrigatoriedade. Ao confirmar
no modal, o fluxo:
1. Cria a nota via `createNoteMutation` (T18/T23).
2. Aplica o patch de `assigned_to` + `status` via `useChatUpdate`.
A ordem garante que, se a EF falhar, a nota ainda fica registrada (melhor do que
perder ambos).

#### Critérios de aceite

- [ ] Ao transferir (T21 detecta `assigned_to` anterior ≠ null), um `Dialog`
  abre com título "Nota de transferência" e um campo `Textarea` obrigatório
  ("Descreva o contexto para o próximo atendente...").
- [ ] O botão "Confirmar transferência" fica desabilitado enquanto o campo
  está vazio ou tem menos de 10 caracteres.
- [ ] Ao confirmar: cria nota em `zapi_chat_notes` com o corpo digitado, depois
  aplica o patch de atribuição via `useChatUpdate`.
- [ ] A nota criada pelo handoff fica visível no painel de notas internas (T23)
  com label diferenciado "Nota de transferência" (ex: prefixo no corpo ou campo
  `mencoes` marcando tipo — discussão técnica para o Fullstack).
- [ ] Se o usuário fecha o modal sem confirmar ("Cancelar"), a transferência é
  abortada — o `assigned_to` não é alterado.
- [ ] Loading state no botão durante as duas operações assíncronas.
- [ ] Toast de sucesso "Conversa transferida para [nome]" após ambas as operações
  concluídas.

#### Hints técnicos (não-prescritivos)

- **Componente:** `HandoffNoteDialog.tsx` em `src/components/whatsapp/`.
- **Props:** `{ open, chatId, targetUser: UserProfile, onConfirm(nota), onCancel }`.
- **Ordem das operações:** criar nota primeiro (falha silenciosa, apenas loga),
  depois patch de atribuição.
- **Label de handoff:** o mais simples é prefixar o corpo: `"[Transferência para ${nome}]\n${nota}"`.
  Alternativa: campo `mencoes` com metadata `{ tipo: 'handoff', target_user_id }` —
  decisão para o Fullstack.
- **Hook de notas:** `useChatNotes(chatId).createNoteMutation` de T18.
- **Hook de atualização:** `useChatUpdate(accountId)` de T18.

#### Test cases

- **Happy path:** modal abre ao transferir; digitar "Eleitor aguardando protocolo
  de saúde"; confirmar → nota aparece em `zapi_chat_notes` + `assigned_to` muda.
- **Edge — campo vazio:** botão "Confirmar" desabilitado; não é possível confirmar.
- **Edge — cancelar:** fechar modal → `assigned_to` não muda; sem nota criada.
- **Edge — criar nota falhou mas patch EF ok:** situação degradada aceitável —
  anotar no log, não bloquear o usuário.
- **Edge — patch EF falhou:** toast de erro, mas a nota já foi criada (fica no histórico).

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: transferir conversa, verificar nota em `zapi_chat_notes` via Supabase CLI
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Notificação ao destinatário da transferência (Fase 5/6).
- Nota de handoff ao remover atribuição (sem destinatário — sem contexto obrigatório).
- Diferenciação visual especial da nota de handoff na lista (nice-to-have extensão futura).

---

### T23 — Notas internas + menções @ no painel lateral

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** hook, component
**Depende de:** T18 (useChatNotes)
**WSJF score:** (8 + 6 + 5) / 8 = **2.4**
**Segurança:** escrita direta em `zapi_chat_notes` (RLS já garante autor = uid);
sem nova EF ou nova RLS → sem gatilho automático Security. Fullstack deve validar
que o INSERT não aceita `autor_id` diferente de `auth.uid()` — RLS da migration
057 já garante, mas verificar no teste.

#### User story

Como atendente do gabinete, quero escrever notas internas numa conversa e mencionar
colegas com @, para compartilhar contexto sobre o eleitor sem que ele veja o
conteúdo dessas anotações.

#### Contexto

A coluna 3 do layout de 3 colunas (`ContactPanel`) tem hoje campos de contato.
As notas internas devem ficar numa seção dedicada dentro do `ContactPanel` (ou
`ChatPanel` — decisão do Fullstack) acessível enquanto a conversa está aberta.

A tabela `zapi_chat_notes` já existe com RLS:
- INSERT com `autor_id = auth.uid()` (client direto, sem EF).
- DELETE pelo próprio autor ou admin.
- SELECT para todos autenticados.

A menção `@` é implementada como autocomplete simples: ao digitar `@`, exibe lista
de usuários (`useUsers()`) para seleção; ao selecionar, insere `@nome` no texto
e adiciona o UUID ao array `mencoes`. **Não** é um sistema de notificação push
nesta fase — `mencoes` é apenas metadata para uso futuro.

#### Critérios de aceite

- [ ] O `ContactPanel` (coluna 3) tem uma seção "Notas internas" com:
  - Lista de notas existentes (da `notesQuery` de T18), ordenadas da mais antiga
    para a mais recente.
  - Cada nota exibe: avatar com iniciais do autor, nome do autor, data/hora relativa
    (`há 2 minutos`, `ontem às 14:30`), corpo da nota com menções destacadas.
  - Botão de excluir nota (X) visível ao hover, apenas para o próprio autor ou admin.
- [ ] Abaixo da lista, um campo de texto para nova nota (Textarea de 2-3 linhas)
  com placeholder "Escreva uma nota interna... (@ para mencionar)".
- [ ] Digitar `@` no campo de texto abre um popover com lista de usuários ativos
  filtrada pelo texto após `@`. Selecionar um usuário insere `@nome` no texto e
  adiciona o UUID ao estado de menções local.
- [ ] Botão "Publicar nota" (ou Ctrl+Enter) chama `createNoteMutation` com
  `{ chat_id, corpo, mencoes: [uuid1, uuid2] }`. Após sucesso, limpa o campo e
  atualiza a lista.
- [ ] Se a nota está sendo publicada, o botão exibe loading state.
- [ ] Notas de outros usuários **não** têm botão de excluir (exceto admin).
- [ ] A seção "Notas internas" tem scroll independente da lista de mensagens.
- [ ] Nenhuma nota é enviada ao WhatsApp do eleitor — a UI deve deixar claro
  com label "Apenas a equipe vê estas notas" ou similar.

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `src/components/whatsapp/ContactPanel.tsx` —
  adicionar seção `ChatNotes` ao final.
- **Hook:** `useChatNotes(chat.id)` de T18 expondo `notesQuery`,
  `createNoteMutation`, `deleteNoteMutation`.
- **Componente de menção:** state `[mentionSearch, setMentionSearch]` + `Popover`
  controlado. Detectar `@` com `onKeyDown` / parse do valor do Textarea.
  Padrão simples: ao detectar `@palavra` no final do texto, abrir o popover.
- **Renderizar menções no corpo:** `@uuid_do_nome` → não; o corpo guarda o texto
  literal (`@nome`), o array `mencoes` guarda os UUIDs. Renderizar o corpo como
  texto simples com highlight de tokens `@palavra` (bold ou cor).
- **Data relativa:** `Intl.RelativeTimeFormat` ou biblioteca `date-fns` (verificar
  se `date-fns` está no `package.json` — se não, implementar com `Intl` nativo).
- **useAuth uid:** para mostrar/ocultar botão de delete.
- **Acessibilidade:** botão de delete com `aria-label="Excluir nota"`.

#### Test cases

- **Happy path — criar nota:** digitar "Eleitor pediu retorno sobre pavimentação",
  publicar → nota aparece na lista com nome do autor e horário correto.
- **Happy path — menção:** digitar "@ para avisar a" + `@Ana` → popover com "Ana Lima";
  selecionar → texto vira "@ para avisar a @Ana Lima"; `mencoes` contém UUID da Ana.
- **Happy path — excluir nota própria:** hover na nota própria → X aparece; clicar
  → nota desaparece da lista.
- **Edge — delete nota de outro usuário:** botão X não aparece; tentativa via RLS
  é bloqueada.
- **Edge — nota sem menções:** publicar sem `@` → `mencoes = null`; sem erro.
- **Edge — campo vazio:** botão "Publicar" desabilitado com corpo vazio.
- **Edge — sem chat selecionado:** seção de notas não renderiza (chatId null).
- **Edge — confirmar que nota NÃO vai ao WA:** nenhuma chamada à `zapi-send-text`
  é disparada ao publicar nota.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: criar nota com menção, verificar linha em `zapi_chat_notes` via
  Supabase CLI com `mencoes` correto
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Notificação push/email ao usuário mencionado (Fase 5/6).
- Edição de nota já publicada (extensão futura — RLS permite UPDATE pelo autor).
- Reações a notas internas.
- Rich text / markdown nas notas.

---

### T24 — Fixar conversa (pinned) + ordenação prioritária na lista

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, component
**Depende de:** T18 (useChatUpdate com campo pinned)
**WSJF score:** (6 + 5 + 4) / 2 = **7.5**
**Segurança:** mutação via EF existente — sem nova surface.

#### User story

Como atendente do gabinete, quero fixar uma conversa importante no topo da lista,
para não perder acesso rápido a ela enquanto novas mensagens chegam de outros eleitores.

#### Contexto

A coluna `pinned` (bool, default false) já existe em `zapi_chats` (migration 056).
Há índice parcial `idx_zapi_chats_pinned` para conversas fixadas. A EF
`zapi-chat-update` aceita `patch: {pinned: true|false}`.

A lista de conversas em `ConversasTabContent` ordena por `last_message_at DESC`.
Conversas fixadas devem flutuar **antes** de todas as não-fixadas, independente de
quando chegou a última mensagem. Isso é uma ordenação client-side sobre
`filteredChats` — sem nova query ao banco.

#### Critérios de aceite

- [ ] No `ChatListItem`, ao fazer hover ou long-press mobile, aparece um menu de
  contexto (DropdownMenu ou botão de ação rápida) com opção "Fixar conversa" /
  "Desafixar conversa" dependendo do estado atual.
- [ ] Ao fixar, `useChatUpdate` é chamado com `patch: {pinned: true}`. O
  `ChatListItem` exibe um ícone de pin (ex: `PinIcon` do lucide) ao lado do nome.
- [ ] A lista de `filteredChats` em `ConversasTabContent` é re-ordenada:
  conversas com `pinned = true` aparecem primeiro (separadas com label sutil
  "Fixadas"), seguidas pelas demais (ordenadas por `last_message_at`).
- [ ] Desafixar remove o ícone e o chat volta à posição cronológica normal.
- [ ] A mudança reflete em tempo real para outros atendentes na mesma conta.
- [ ] O menu de contexto também está disponível no header do `ChatPanel` (ação
  rápida de fixar a conversa aberta).

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `src/components/whatsapp/ChatListItem.tsx` (menu de contexto)
  + `ConversasTabContent.tsx` (ordenação de `filteredChats`).
- **Ordenação:** `[...filteredChats].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))`.
  Manter a ordem relativa entre fixadas (por `last_message_at`) e entre não-fixadas.
- **Ícone:** `Pin` de `lucide-react`.
- **Label "Fixadas":** usar `separator` entre o último item fixado e o primeiro não-fixado.
- **DropdownMenu no ChatListItem:** passar `onPin` / `onUnpin` como props de callback,
  ou acessar `useChatUpdate` diretamente no item.

#### Test cases

- **Happy path:** clicar "Fixar" em conversa do meio da lista → ela sobe para o topo,
  ícone pin aparece, outra aba (Realtime) reflete.
- **Happy path — desafixar:** clicar "Desafixar" → chat volta à posição cronológica.
- **Edge — múltiplas fixadas:** fixar 3 conversas → ficam no topo ordenadas por
  `last_message_at` entre elas.
- **Edge — filtro ativo:** filtro "Finalizadas" ativo → apenas fixadas finalizadas aparecem
  no topo; fixadas abertas não aparecem (filtro prevalece sobre pin).
- **Edge — PendingChat:** não tem ação de pin (sem ID real).

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: fixar conversa, verificar `zapi_chats.pinned = true` no banco
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Reordenar manualmente o topo das fixadas (drag-and-drop — Fase 5).
- Número máximo de conversas fixadas (sem limite nesta fase).

---

### T25 — Arquivar conversa + filtro de arquivadas

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, component
**Depende de:** T18 (useChatUpdate com campo archived), T20 (filtros de status excluem arquivadas)
**WSJF score:** (6 + 5 + 4) / 2 = **7.5**
**Segurança:** mutação via EF existente — sem nova surface.

#### User story

Como atendente do gabinete, quero arquivar conversas finalizadas para limpar minha
lista de trabalho ativa, podendo acessar o histórico arquivado quando necessário.

#### Contexto

A coluna `archived` (bool, default false) existe em `zapi_chats` com índice parcial.
A EF `zapi-chat-update` aceita `patch: {archived: true|false}`.

O T20 (filtros de status) já prevê que conversas arquivadas sejam **excluídas** de
todas as visões de status ativas. Esta task implementa:
1. A ação de arquivar (no ChatListItem e no ChatPanel).
2. O filtro/aba "Arquivadas" na coluna 1 para acessar conversas arquivadas.

#### Critérios de aceite

- [ ] No `ChatListItem` (menu de contexto) e no header do `ChatPanel`, opção
  "Arquivar conversa" / "Desarquivar conversa".
- [ ] Ao arquivar, `useChatUpdate` com `patch: {archived: true}`. O chat sai
  imediatamente da lista ativa (filtro excluí `archived=true` das visões padrão).
- [ ] Na coluna 1, ao lado dos chips de status (T20), um chip ou botão "Arquivadas"
  troca a visão para mostrar apenas conversas com `archived = true`.
- [ ] Na visão "Arquivadas", cada item exibe a opção "Desarquivar" que seta
  `archived = false` e o chat volta à lista ativa.
- [ ] A visão "Arquivadas" combina com o filtro de busca por texto (T16) mas não
  com os chips de status (são visões mutuamente exclusivas: ativa vs. arquivada).
- [ ] Toast "Conversa arquivada" após sucesso; botão de desfazer opcional no toast
  (usando `toast` com action do sonner).

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `src/components/whatsapp/ChatListItem.tsx` +
  `ConversasTabContent.tsx`.
- **State adicional:** `showArchived: boolean` (false por padrão). Ao ativar,
  `filteredChats` filtra `archived=true` em vez de excluí-los.
- **Toast com undo:** `toast('Arquivada', { action: { label: 'Desfazer', onClick: () => useChatUpdate.mutate({...archived:false}) } })`.
- **Ícone:** `Archive` de `lucide-react`.
- **Mutuamente exclusivo com chips de status:** ao clicar "Arquivadas", resetar
  `statusFilter = null` e `showArchived = true` e vice-versa.

#### Test cases

- **Happy path:** arquivar conversa ativa → desaparece da lista; acessar "Arquivadas"
  → aparece lá.
- **Happy path — undo:** clicar "Desfazer" no toast → `archived = false`, chat
  volta à lista ativa.
- **Happy path — desarquivar:** dentro de "Arquivadas", clicar "Desarquivar" →
  chat volta à lista ativa.
- **Edge — conversa fixada + arquivada:** pin e archive simultâneos são tecnicamente
  possíveis; a lógica de exibição deve priorizar `archived` (some da lista ativa, fixada ou não).
- **Edge — busca em arquivadas:** digitar nome no campo de busca com "Arquivadas"
  ativo → filtra só entre as arquivadas.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: arquivar, verificar `archived=true` no banco, buscar em arquivadas
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Exclusão permanente de conversas arquivadas (sem suporte nesta fase).
- Arquivamento em massa (Fase 5, C13).

---

### T26 — Marcar como não-lida (extensão de zapi-chat-update)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route (Edge Function), hook, component
**Depende de:** T18 (useChatUpdate — hook de atualização)
**WSJF score:** (6 + 5 + 4) / 5 = **3.0**
**Segurança:** TOCA EF existente — alteração de `zapi-chat-update` para novo campo.
**Flag:** Security obrigatório (mudança em EF de estado crítico).

#### User story

Como atendente do gabinete, quero marcar uma conversa como não-lida mesmo depois
de tê-la aberto, para lembrá-la de que preciso retornar a ela mais tarde.

#### Contexto

A `zapi-mark-as-read` (T03 da Fase 0) zera `unread_count`. O inverso — setar
`unread_count = 1` — não é implementado. A abordagem mais limpa é **estender**
a `zapi-chat-update` com um novo campo de patch `unread: boolean`:
- `unread: true` → seta `unread_count = 1` (marcar como não-lida).
- `unread: false` → zera `unread_count = 0` (equivalente ao mark-as-read).

Isso evita criar uma terceira EF para uma operação simples e mantém `zapi-chat-update`
como o ponto único de mutação de estado de chat.

Na UI, a ação "Marcar como não-lida" aparece no menu de contexto do `ChatListItem`
e no header do `ChatPanel`.

#### Critérios de aceite

- [ ] A EF `zapi-chat-update` aceita `unread` (boolean) no `patch`:
  - `unread: true` → UPDATE `unread_count = 1`.
  - `unread: false` → UPDATE `unread_count = 0`.
  - Validação: deve ser boolean se presente; 400 caso contrário.
- [ ] `hasPatchFields` na EF passa a incluir `'unread' in patch` na checagem.
- [ ] O hook `useChatUpdate` (T18) aceita `unread` no tipo `ChatPatch` sem
  alteração de interface para quem já usa o hook.
- [ ] No `ChatListItem`, menu de contexto exibe "Marcar como não-lida" quando
  `unread_count === 0`; e "Marcar como lida" quando `unread_count > 0`.
- [ ] Ao clicar "Marcar como não-lida", `useChatUpdate` é chamado com
  `patch: {unread: true}`. O badge de não-lidas aparece no `ChatListItem` com
  valor 1.
- [ ] Se a conversa está aberta no momento (chat selecionado = este chat), a ação
  é disponível mas ao clicar e depois abrir a conversa novamente, `mark-as-read`
  será chamado automaticamente (comportamento existente).
- [ ] A ação é desabilitada para `PendingChat`.

#### Hints técnicos (não-prescritivos)

- **Arquivo da EF:** `supabase/functions/zapi-chat-update/index.ts` — adicionar
  `unread?: boolean` ao tipo `ChatPatch` e ao bloco `hasPatchFields`. No `updatePayload`,
  mapear: `if ('unread' in patch) updatePayload.unread_count = patch.unread ? 1 : 0`.
- **Tipo no hook:** adicionar `unread?: boolean` ao tipo `ChatPatch` em
  `src/hooks/useChatUpdate.ts`.
- **`ChatListItem`:** passar `onMarkUnread` / `onMarkRead` como props ou acessar
  o hook diretamente (preferir props para manter o componente testável).
- **Condicional no menu:** `chat.unread_count === 0 ? 'Marcar como não-lida' : 'Marcar como lida'`.

#### Test cases

- **Happy path — marcar não-lida:** conversa com `unread_count = 0`; clicar "Marcar
  como não-lida" → badge "1" aparece no `ChatListItem`.
- **Happy path — marcar lida:** conversa com `unread_count = 5`; clicar "Marcar
  como lida" → badge desaparece.
- **Edge — EF: unread não-boolean:** `patch: {unread: "sim"}` → 400.
- **Edge — EF: unread junto com outros campos:** `patch: {status:'finalizada', unread:true}`
  → ambos aplicados no mesmo UPDATE.
- **Edge — PendingChat:** ação não aparece no menu.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente (incluindo testes da EF)
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: marcar não-lida, verificar `unread_count = 1` no banco via CLI
- [ ] Security review (EF alterada)
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Marcar múltiplas conversas como não-lida em massa (Fase 5, C13).
- Persistir estado de "lida pelo usuário X" (modelo de leitura individual — fora
  do escopo desta fase).

---

### T27 — Edge Function zapi-instance-status (proxy de saúde Z-API)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route (Edge Function nova), integration
**Depende de:** — (independente)
**WSJF score:** (7 + 7 + 6) / 5 = **4.0**
**Segurança:** TOCA EF nova com chamada à Z-API usando tokens da conta.
**Flag:** Security obrigatório. Pentest obrigatório (vazamento de token Z-API,
SSRF via account_id manipulado, acesso a conta de outra organização).

#### User story

Como atendente do gabinete, quero que o sistema consulte automaticamente o status
da conexão Z-API para que eu saiba se a instância está conectada ou se o QR Code
caiu, sem precisar acessar o painel da Z-API separadamente.

#### Contexto

A Z-API expõe o endpoint de status de instância:
`GET https://api.z-api.io/instances/{instance_id}/token/{token}/status`

O frontend **não pode chamar este endpoint diretamente** pois exporia o `instance_token`
e o `client_token`. Uma Edge Function `zapi-instance-status` faz o proxy:
1. Recebe `{account_id}` no body.
2. Valida JWT do chamador (requireAuth).
3. Busca `instance_id` e `instance_token` da conta via `service_role` (sem expor tokens).
4. Chama a Z-API e retorna apenas `{connected, state, needsQR}` ao cliente.

**IMPORTANTE:** investigar se a Z-API retorna um campo `state` ou similar que
indique `CONNECTED`, `DISCONNECTED`, `PAIRING` (QR). A estrutura do response da
Z-API deve ser confirmada antes da implementação (spike de 15min na documentação
Z-API antes de começar o código da EF).

#### Critérios de aceite

- [ ] Nova Edge Function `supabase/functions/zapi-instance-status/index.ts` que:
  - Aceita POST com `{account_id: string}`.
  - Valida JWT (requireAuth) e retorna 401/403 sem JWT válido.
  - Valida `account_id` como UUID; retorna 400 se inválido.
  - Busca `instance_id` + `instance_token` (e `client_token` se a Z-API exigir)
    da tabela `zapi_accounts` via `service_role`.
  - Chama `GET https://api.z-api.io/instances/{instance_id}/token/{token}/status`.
  - Retorna **somente** `{connected: boolean, state: string, needsQR: boolean}`.
    Nunca retorna tokens ou dados brutos da Z-API além desses 3 campos.
  - Em caso de erro da Z-API (timeout, 5xx), retorna `{connected: false, state: 'unknown', needsQR: false}`.
- [ ] Um hook `useZapiInstanceStatus(accountId)` em `src/hooks/useZapiInstanceStatus.ts`
  que faz polling da EF a cada 60 segundos quando a aba de conversas está ativa.
  - Param `accountId: string | null` — desabilitado quando null.
  - Retorna `{connected, state, needsQR, isLoading}`.
  - Polling com `refetchInterval: 60_000` do react-query.
  - Não poleia em background (tab não ativa) — usar `refetchIntervalInBackground: false`.

#### Hints técnicos (não-prescritivos)

- **Arquivo da EF:** `supabase/functions/zapi-instance-status/index.ts`.
- **Pattern:** seguir `_shared/auth-guard.ts` (requireAuth, corsHeaders, jsonResponse)
  e `zapi-send-text/index.ts` (como faz fetch para a Z-API com tokens).
- **Endpoint Z-API de status:** confirmar URL exata na documentação Z-API antes de
  implementar. A URL provável é
  `GET https://api.z-api.io/instances/{instance_id}/token/{client_token}/status`
  (o client_token é o bearer, não o instance_token em alguns endpoints).
- **Timeout:** adicionar `signal: AbortSignal.timeout(8000)` no fetch para evitar
  que a EF fique pendurada por timeout da Z-API.
- **Hook:** `queryKey: ['zapi-instance-status', accountId]`; `staleTime: 30_000`.
- **Evitar cold start delay:** a EF pode levar 1-2s na primeira chamada; o hook
  deve tratar `isLoading` como "desconhecido" (não exibir alerta durante loading).

#### Test cases

- **Happy path — conectada:** Z-API retorna estado conectado → hook retorna
  `{connected: true, state: 'CONNECTED', needsQR: false}`.
- **Happy path — desconectada/QR:** Z-API retorna estado QR → hook retorna
  `{connected: false, state: 'PAIRING', needsQR: true}`.
- **Edge — account_id inválido:** UUID malformado → 400 da EF.
- **Edge — conta não encontrada:** `account_id` não existe no banco → 404 da EF.
- **Edge — timeout Z-API:** fetch para Z-API estoura 8s → EF retorna
  `{connected: false, state: 'unknown', needsQR: false}` sem 500.
- **Edge — sem JWT:** 401 da EF.
- **Segurança — tokens não vazam:** o response da EF nunca contém `instance_token`
  ou `client_token` mesmo que a Z-API retorne esses campos.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK (EF deployada)
- [ ] Smoke test: chamar EF via curl com conta real; verificar response shape
- [ ] Security review (EF nova com tokens, SSRF, IDOR potencial)
- [ ] Pentest (tentar passar `account_id` de outra conta/organização)
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Reconexão automática via Z-API (botão manual na UI — T28).
- Status de múltiplas instâncias em paralelo (polling por conta ativa — T28 decide isso).
- Cache de status além do `staleTime` do react-query.

---

### T28 — Monitor de saúde C25 (UI: badge + alerta + botão reconectar)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T27 (useZapiInstanceStatus)
**WSJF score:** (7 + 7 + 5) / 5 = **3.8**
**Segurança:** sem nova EF ou mutation — sem gatilho Security.

#### User story

Como atendente do gabinete, quero ver claramente quando a instância Z-API perdeu
conexão (e precisa de QR Code) para acionar o reconhecimento antes que o atendimento
seja prejudicado.

#### Contexto

O hook `useZapiInstanceStatus` (T27) faz polling a cada 60s. Esta task consome
o hook e exibe os indicadores visuais:

1. **Badge de status da conta** no seletor de conta (coluna 1): indicador colorido
   `Connected` / `QR Code` / `Desconectado` ao lado do nome da conta.
2. **Banner de alerta** no topo do `ChatPanel` quando a conta ativa está desconectada.
3. **Botão "Reconectar"** que abre o painel Z-API (aba Contas) ou exibe o QR Code
   (se a Z-API expuser um endpoint de QR). **Investigar se a Z-API tem endpoint de
   QR Code para renderizar no CRM.** Se não tiver, o botão redireciona para a aba
   "Contas" com instrução de reconectar pelo painel Z-API externo.

#### Critérios de aceite

- [ ] O `Select` de conta na coluna 1 exibe ao lado de cada conta um dot colorido:
  - Verde → `connected = true`.
  - Âmbar → `state = 'PAIRING'` (aguardando QR).
  - Vermelho → `connected = false` (fora do ar).
  - Cinza → status desconhecido / loading.
- [ ] Quando a conta ativa perde conexão (`connected = false`), um `Alert` shadcn
  aparece no topo da coluna 2 com ícone de alerta e mensagem
  "Conexão com Z-API perdida. Mensagens não serão entregues."
- [ ] O banner tem um botão "Reconectar" que:
  - Se `needsQR = true`: abre modal com QR Code renderizado (se a EF suportar) ou
    exibe instrução "Acesse o painel Z-API para escanear o QR Code" + link externo.
  - Se `needsQR = false`: instrução genérica de reconexão.
- [ ] O banner só aparece quando `!isLoading && !connected` — não pisca durante
  o loading do polling.
- [ ] O polling ocorre apenas quando a aba WhatsApp (`/integracoes/whatsapp`) está
  ativa (o hook `useZapiInstanceStatus` já gerencia isso com `refetchIntervalInBackground: false`).
- [ ] O badge de status no seletor de conta atualiza a cada ciclo de polling (60s).

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `ConversasTabContent.tsx` — adicionar badge no `SelectItem`
  de conta e `Alert` no topo do `ChatPanel`.
- **Hook:** `useZapiInstanceStatus(selectedAccountId)` de T27.
- **Alert shadcn:** `Alert` + `AlertDescription` de `src/components/ui/alert.tsx`.
- **Dot no Select:** `<span className="h-2 w-2 rounded-full bg-green-500 inline-block mr-1" />`.
- **QR Code:** pesquisar endpoint `GET /instances/{id}/token/{token}/qrcode/image/base64`
  da Z-API — se existir, criar rota adicional na EF ou endpoint separado
  `zapi-instance-qrcode`. Se não existir, exibir link para o painel externo.
- **Fallback sem QR:** link para `https://app.z-api.io` como escape hatch.

#### Test cases

- **Happy path — conectada:** dot verde no Select; sem banner.
- **Happy path — desconectada:** dot vermelho; banner de alerta aparece; botão
  "Reconectar" funciona (modal ou instrução).
- **Happy path — QR:** dot âmbar; banner com instrução de QR.
- **Edge — loading inicial:** dot cinza; sem banner durante loading.
- **Edge — conta não selecionada:** sem polling, sem badge, sem banner.
- **Edge — Z-API offline por >5 min:** polling continua; banner permanece; sem
  erros no console (EF retorna `unknown` graciosamente — T27).

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: desconectar instância Z-API no painel → aguardar até 60s → verificar
  que o banner aparece no CRM
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Notificação push/email quando conexão cai (Fase 5/6).
- Reconexão automática sem intervenção humana (sem suporte na Z-API não-oficial).
- Monitor de múltiplas contas simultaneamente (apenas a conta ativa é monitorada).

---

### T29 — Indicador de SLA C28 (conversa parada sem resposta)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T18 (precisa de `accountId` para `useChatUpdate`), T20 (filtros)
**WSJF score:** (6 + 5 + 4) / 5 = **3.0**
**Segurança:** sem nova EF, sem migration, sem RLS — sem gatilho Security.
Controlado pela feature flag `c28` (`isFeatureEnabled(config, 'c28')`).

#### User story

Como coordenador do gabinete, quero ver quais conversas estão sem resposta há
mais de X minutos, para priorizar o atendimento e evitar que eleitores esperem
tempo demais.

#### Contexto

O SLA é calculado com base em `last_message_at` e `direction` da última mensagem.
O campo `last_message_at` em `zapi_chats` é atualizado pelo webhook a cada nova
mensagem. Para saber se a última mensagem foi do eleitor ou do atendente, é
necessário consultar a última entrada em `zapi_messages` com `direction`.

Abordagem simplificada (sem nova query complexa): o `ChatListItem` exibe um
indicador visual quando:
- `status` da conversa é `'aberta'` ou `'em_atendimento'` (não finalizada/aguardando).
- `last_message_at` está há mais de `SLA_THRESHOLD_MINUTES` minutos (configurável —
  sugestão: 30min padrão, configurável por conta futuramente).

Esta abordagem não diferencia direção da última mensagem — é uma simplificação
aceitável para esta fase (se a última mensagem do atendente foi há 2h, o SLA
também dispara, o que serve como lembrete). Versão mais sofisticada (com `direction`)
pode ser adicionada na Fase 7.

O indicador é gated pela feature flag `c28` — só aparece se a conta tem `c28 = true`
em `recursos_config`.

#### Critérios de aceite

- [ ] Quando `isFeatureEnabled(accountConfig, 'c28')` é `true`, o `ChatListItem`
  exibe um ícone de relógio âmbar/vermelho quando:
  - `chat.status` é `'aberta'` ou `'em_atendimento'`, E
  - `chat.last_message_at` está há mais de 30 minutos.
- [ ] O ícone tem tooltip "Sem resposta há Xh Ymin" (calculado client-side com
  `Date.now() - new Date(last_message_at)`).
- [ ] Conversas com SLA estourado ficam destacadas na lista (ex: borda âmbar à
  esquerda, ou ícone `Clock` âmbar ao lado do timestamp).
- [ ] O cálculo de SLA é atualizado a cada 60 segundos na UI (sem nova query —
  re-render periódico via `setInterval` ou `useInterval`).
- [ ] Quando `c28 = false` para a conta, nenhum elemento de SLA aparece na UI
  (sem renderização, sem cálculo).
- [ ] Conversas finalizadas, arquivadas ou em "aguardando" não exibem o indicador
  de SLA (SLA não faz sentido nesses estados).

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `src/components/whatsapp/ChatListItem.tsx` +
  `ConversasTabContent.tsx` (para passar `slaEnabled` como prop).
- **Feature flag:** `isFeatureEnabled(selectedAccount?.recursos_config, 'c28')` —
  `selectedAccount` já está disponível em `ConversasTabContent` via `useZapiAccounts`.
- **Cálculo de SLA:** `Math.floor((Date.now() - new Date(chat.last_message_at!).getTime()) / 60_000)` → minutos.
- **Threshold:** constante `SLA_THRESHOLD_MINUTES = 30` no topo do arquivo ou em
  `src/lib/zapi-format.ts`.
- **Atualização periódica:** `useEffect` com `setInterval(forceUpdate, 60_000)`.
  Alternativa: `useInterval` de um utilitário ou inline. `forceUpdate` pode ser
  implementado com `useState` de um contador de ticks.
- **Ícone:** `Clock` de `lucide-react` com `className="text-amber-500"`.
- **Tooltip:** `title="Sem resposta há Xh Ymin"` simples ou Tooltip shadcn.

#### Test cases

- **Happy path — SLA estourado:** conta com `c28=true`; conversa `aberta` com
  `last_message_at` = 45min atrás → ícone âmbar aparece.
- **Happy path — SLA ok:** conversa com `last_message_at` = 10min atrás → sem ícone.
- **Edge — c28 desabilitado:** conta com `c28=false` → nenhum ícone de SLA,
  independente do tempo.
- **Edge — conversa finalizada:** sem ícone SLA mesmo com `last_message_at` antigo.
- **Edge — `last_message_at` null:** conversa sem mensagens → sem ícone SLA (guard
  contra `null`).
- **Edge — atualização automática:** esperar 60s com a aba aberta → ícone aparece
  em conversa que cruzou o threshold durante a sessão.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: habilitar `c28` na conta via aba Recursos; criar conversa com
  `last_message_at` antigo via SQL; verificar ícone na UI
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- SLA baseado em direção da última mensagem (Fase 7 — requer join com `zapi_messages`).
- Threshold de SLA configurável por conta na UI (Fase 5/6).
- Alerta/notificação push quando SLA estoura (Fase 5/6).

---

### T30 — Modo supervisor C30 (visão admin + métricas por atendente)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T20 (filtros de lista), T18 (estrutura de atribuição)
**WSJF score:** (7 + 5 + 5) / 5 = **3.4**
**Segurança:** sem nova EF; leitura de dados já acessíveis pelo RLS — sem gatilho Security.
Controlado por `activeRole === 'admin'` + feature flag `c30`.

#### User story

Como coordenador do gabinete (admin), quero ver em tempo real quantas conversas
cada atendente tem abertas e em atendimento, para redistribuir a carga quando alguém
está sobrecarregado.

#### Contexto

A RLS de `zapi_chats` permite leitura para qualquer usuário autenticado da
organização — o supervisor já vê todas as conversas. O que falta é:
1. Filtro "Todas as conversas" que anula o toggle "Só minhas" (T20).
2. Filtro por atendente específico (quem está atribuído).
3. Painel de métricas de resumo por atendente.

O modo supervisor é visível apenas para `activeRole === 'admin'` **e** quando
`isFeatureEnabled(accountConfig, 'c30')` é `true`. Para usuários não-admin, os
controles de supervisor ficam ocultos.

Métricas calculadas client-side sobre os chats já carregados (sem nova query ao banco):
- Total de conversas abertas por atendente.
- Total em atendimento por atendente.
- Total aguardando por atendente.

#### Critérios de aceite

- [ ] Quando `activeRole === 'admin'` E `c30 = true` para a conta, aparece um
  painel "Supervisor" expansível (Accordion ou seção separada) na coluna 1, acima
  da lista de conversas.
- [ ] O painel de supervisor exibe uma tabela/lista de atendentes com:
  - Nome + avatar com iniciais.
  - Contagem de conversas: Abertas | Em atend. | Aguardando.
  - Badge total de não-lidas (soma de `unread_count` das conversas atribuídas).
- [ ] Clicar no nome de um atendente no painel aplica o filtro "Atribuídas a [nome]"
  na lista de conversas.
- [ ] Um botão/chip "Todas" no painel de supervisor desfaz o filtro por atendente.
- [ ] O painel de supervisor inclui uma linha "Não atribuídas" para conversas onde
  `assigned_to IS NULL`.
- [ ] Para usuários não-admin ou quando `c30 = false`, o painel de supervisor não
  é renderizado (sem elemento vazio, sem placeholder).
- [ ] As métricas são calculadas sobre `filteredChats` com filtro de status em
  "Todas" (excluindo arquivadas) — snapshot em tempo real do que está carregado.

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `src/components/whatsapp/ConversasTabContent.tsx` —
  adicionar componente `SupervisorPanel` (pode ser inline ou arquivo separado
  `src/components/whatsapp/SupervisorPanel.tsx`).
- **Dados de atendentes:** `useUsers()` filtrado por `status_aprovacao === 'ATIVO'`.
- **Cálculo de métricas:** `useMemo` sobre `chats` (não `filteredChats` — para
  métricas globais) agrupando por `assigned_to`.
- **Filtro por atendente:** adicionar state `filterByAssignee: string | null`
  ao `ConversasTabContent`; aplicar no chain de filtragem.
- **Feature flag:** `isFeatureEnabled(selectedAccount?.recursos_config, 'c30')`.
- **Role check:** `usePermissions().accessWhatsapp()` + `useImpersonation().activeRole === 'admin'`.
- **Accordion shadcn:** `Accordion` para o painel expansível — não ocupa espaço
  quando colapsado.

#### Test cases

- **Happy path — admin com c30:** painel supervisor aparece; exibe Ana (2 abertas,
  1 em atend.) e João (0 abertas, 3 em atend.); clicar em "Ana" → lista filtra só
  as conversas da Ana.
- **Happy path — não-atribuídas:** linha "Não atribuídas" com contagem correta.
- **Edge — c30 desabilitado:** conta com `c30=false` → painel não aparece mesmo
  para admin.
- **Edge — usuário não-admin:** painel não aparece.
- **Edge — atendente sem conversas:** aparece na lista com zeros (se estiver ativo).
  Ou: opção de ocultar atendentes sem conversas (decisão do Fullstack).
- **Edge — filtro combinado:** filtro por atendente + filtro status "Abertas" →
  conversas da Ana que estão abertas.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: conta com `c30=true`; logar como admin; verificar painel com
  contagens corretas vs. banco (via Supabase CLI)
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Dashboard de métricas históricas por atendente (Fase 7, #60).
- Métricas de tempo médio de atendimento (Fase 7).
- Exportação do painel de supervisor (Fase 6).
- Intervir na conversa de outro atendente via supervisor (já possível — a atribuição
  em T21 cobre isso).

---

## Flags de segurança

| Task | Tipo de surface | Cadeia obrigatória |
|---|---|---|
| T21 | Mutação `assigned_to` via EF existente; IDOR potencial | Security + Pentest |
| T26 | Extensão de EF `zapi-chat-update` (campo novo) | Security |
| T27 | EF nova com acesso a tokens Z-API da conta | Security + Pentest |

T18, T19, T20, T22, T23, T24, T25, T28, T29, T30: sem EF nova, sem migration com
RLS nova, sem escrita em `auth.users` — **sem gatilho automático de Security/Pentest**.

---

## Notas para o Fullstack

1. **Ordem rígida até T21:** T18 é prerequisito de T19, T20, T21, T24, T25, T26.
   T21 é prerequisito de T22. T27 é prerequisito de T28.

2. **T18 é a maior alavanca:** implementá-la bem (optimistic update + rollback)
   evita repetição em todas as tasks seguintes. Vale o esforço extra.

3. **Não há nova migration na Fase 3** — toda a fundação de dados foi feita nas
   migrations 056–059. Esta fase é UI + hooks + 2 EFs (T26 = extensão de EF
   existente; T27 = EF nova de proxy).

4. **Realtime já funciona** — `useZapiChats` já tem subscription em INSERT/UPDATE
   em `zapi_chats`. Todas as mudanças de `status`, `assigned_to`, `pinned`,
   `archived` propagam em tempo real sem código adicional.

5. **`useUsers()` retorna todos os perfis** — filtrar por `status_aprovacao === 'ATIVO'`
   antes de exibir na lista de atendentes (T21, T23, T30).

6. **Feature flags C28 e C30** já estão no `FEATURES_CATALOG` de `featureFlags.ts`.
   Usar `isFeatureEnabled(selectedAccount?.recursos_config, 'c28')` no hook ou
   componente.

7. **`activeRole` e `usePermissions()`** — o contexto de role já está disponível
   via `useImpersonation()` e `usePermissions()`. Não recriar lógica de role.

8. **A próxima migration disponível é `060_*`** — a Fase 3 não requer migration
   nova, mas se o Fullstack identificar necessidade (ex: índice adicional), usar
   `060_` como prefix.

9. **`PendingChat` guard** — vários componentes desta fase devem verificar
   `chat.id === PENDING_CHAT_ID` antes de habilitar ações que requerem um chat
   real no banco (atribuição, status, pin, archive, unread, notas).

10. **Investigação de QR Code Z-API (T27/T28):** antes de implementar T28, verificar
    se existe endpoint de QR na Z-API. Se existir, criar EF separada
    `zapi-instance-qrcode` (não embutir na `zapi-instance-status`) para separar
    concerns. Se não existir, o botão "Reconectar" redireciona para instrução externa.
