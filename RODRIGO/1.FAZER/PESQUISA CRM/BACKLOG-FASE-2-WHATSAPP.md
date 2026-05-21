# Backlog — Fase 2 · Iniciar Conversas pelo CRM · Evolução WhatsApp

> Quebra atomizada do `PRD-EVOLUCAO-WHATSAPP.md` (Fase 2 apenas).
> Continuação direta de `BACKLOG-FASE-0-1-WHATSAPP.md` (T01–T12).
> Gerado pelo agente Backlog em 2026-05-17.
> Total: 5 tasks (~22 pts).

---

## Decisões de design registradas

### O que fazer com o NewMessageDialog.tsx existente?

O `NewMessageDialog` atual exige que o operador **saiba o número de cor** e o
digite manualmente. Ele também solicita uma mensagem obrigatória — ou seja, não
permite criar um chat vazio para depois compor o texto. Para a Fase 2 o fluxo
correto é:

1. Operador digita nome ou telefone → **busca em `contacts`** no CRM.
2. Seleciona o contato → sistema abre o chat existente **ou** cria um novo via
   `zapi-send-text` (que já faz UPSERT em `zapi_chats`) e foca o chat.

Conclusão: **não substituir, evoluir**. O `NewMessageDialog` segue existindo como
escape hatch para número avulso não cadastrado. O novo `ConversaPaletteDialog`
(T13) é o fluxo principal que busca em contatos. Isso evita remoção de
funcionalidade existente.

### Como criar um chat sem mensagem?

A `zapi-send-text` já faz UPSERT em `zapi_chats` **antes** de chamar a Z-API.
Isso significa: se o operador quer "abrir" uma conversa com um contato sem
mandar texto ainda, precisa enviar a primeira mensagem. Criar chat só no banco
sem enviar nenhuma mensagem causaria inconsistência — o eleitor não saberia que
foi contactado.

Decisão: o command palette (T13) **não cria chat silencioso**. Ele:
- Se o chat já existe → redireciona para ele (sem mensagem nova).
- Se não existe → redireciona para o chat (que vai aparecer vazio, com o
  composer focado). O UPSERT acontece no momento do envio da primeira mensagem.
  Nenhuma Edge Function nova de "criação de chat vazio" é necessária.

### Busca global vs. busca in-chat

A busca da coluna esquerda (`searchTerm` em `ConversasTabContent.tsx`) já filtra
por `contact_name`, `whatsapp_name` e `phone` client-side. O PRD pede expandir
para empresa e tag (T16). A busca *dentro da conversa* (C4, T17) é diferente —
ela localiza uma mensagem específica num histórico longo.

---

## Ordem de execução (dependências técnicas)

```
T13 — Command palette "+ Nova conversa" (cmdk) + roteamento interno
T14 — Botão "Conversar" em ContactCard e ContactListItem (deep-link /whatsapp?chat=...)
T15 — Whatsapp.tsx: leitura de ?chat= e ?contact= + foco automático no chat
T16 — Busca global expandida na lista de conversas (empresa + tags)
T17 — C4: busca de texto dentro da conversa aberta
```

**Dependências:**
- T13 depende de T15 (precisa da mecânica de roteamento para funcionar end-to-end).
- T14 depende de T15 (o deep-link só é útil quando T15 lê o parâmetro).
- T15 é independente e deve ser implementada primeiro.
- T16 e T17 são independentes entre si e de T13/T14.

**Ordem recomendada de execução: T15 → T13 → T14 → T16 → T17**

---

## Tasks

### T13 — Command palette "+ Nova conversa" (cmdk) com busca de contatos

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T15 (para navegar ao chat após selecionar)
**WSJF score:** (8 + 7 + 5) / 5 = **4.0**
**Segurança:** nao toca EF nova nem migration — sem gatilho Security/Pentest

#### User story

Como atendente do gabinete, quero clicar em "+ Nova conversa" e digitar o nome
ou telefone do eleitor para encontrá-lo no CRM e abrir (ou iniciar) o chat, para
nunca precisar sair do CRM para o WhatsApp externo.

#### Contexto

Atualmente o botão "Nova mensagem" no header de `Whatsapp.tsx` abre o
`NewMessageDialog`, que exige número digitado manualmente. Isso é ineficiente
quando o contato já existe no CRM. A solução é um **command palette** (padrão
cmdk, biblioteca já disponível em `src/components/ui/command.tsx`) que busca em
`contacts` por nome, telefone e WhatsApp conforme o operador digita.

O comportamento ao selecionar um resultado:
- Se já existe um `zapi_chat` com `phone` normalizado igual ao `whatsapp` ou
  `telefone` do contato → seleciona esse chat na lista (sem nova mensagem).
- Se não existe → navega para `/integracoes/whatsapp?tab=conversas&chat=<phone>`
  com o phone do contato; T15 lida com o foco automático.

O `NewMessageDialog` original **não é removido** — continua disponível como
"enviar para número avulso" para os casos em que o número não está cadastrado.

#### Critérios de aceite

- [ ] Botão "+ Nova conversa" (ícone MessageSquarePlus ou equivalente) aparece
  na coluna da lista de conversas em `ConversasTabContent`, ao lado do campo de
  busca existente.
- [ ] Ao clicar, abre um `CommandDialog` shadcn com input focado
  automaticamente.
- [ ] Digitar 2+ caracteres dispara busca nos contatos; resultado aparece em
  <400ms (debounce 300ms).
- [ ] Cada resultado exibe: avatar com iniciais, nome CRM, telefone/WhatsApp
  formatado e até 2 tags.
- [ ] Ao selecionar contato com chat existente na conta ativa: dialog fecha,
  chat é selecionado na lista (scroll até o item se necessário).
- [ ] Ao selecionar contato sem chat existente: dialog fecha, navega para
  `/integracoes/whatsapp?tab=conversas&chat=<phone>` (T15 resolve o foco).
- [ ] Com 0 resultados para o termo buscado: exibe mensagem "Nenhum contato
  encontrado" + link "Enviar para número avulso" que abre o `NewMessageDialog`.
- [ ] Escape ou click fora fecha o dialog sem efeito colateral.
- [ ] Funciona com conta Z-API selecionada (usa o `selectedAccountId` do
  `ConversasTabContent` para verificar se o chat já existe).

#### Hints técnicos (não-prescritivos)

- **Novo arquivo:** `src/components/whatsapp/ConversaPaletteDialog.tsx`
- **Componentes base:** `CommandDialog`, `CommandInput`, `CommandList`,
  `CommandEmpty`, `CommandGroup`, `CommandItem` de `src/components/ui/command.tsx`
- **Hook de busca de contatos:** `useContacts({ search: term, per_page: 20 })`
  de `src/hooks/useContacts.ts`. O campo `search` já busca por nome. Para busca
  por telefone/WhatsApp, passar o termo e o servidor já filtra via `ILIKE` em
  nome — verificar se o filtro `search` já cobre telefone ou se é necessário
  parâmetro adicional. Alternativa: busca client-side nos `chats` já carregados
  para cruzar com contatos.
- **Verificar chat existente:** cruzar `chats` (já no estado de
  `ConversasTabContent`) com `phoneComparisonKey(contact.whatsapp)` de
  `src/lib/normalization.ts`. Evita chamada extra ao banco.
- **Debounce:** `useDebounce` local ou inline com `setTimeout`/`clearTimeout`.
- **Integração com T15:** chamar `navigate('/integracoes/whatsapp?tab=conversas&chat=<phone>')` via `useNavigate` do react-router.
- **Pattern existente:** `CommandDialog` é usado em outros pontos do shadcn;
  seguir o exemplo de `src/components/ui/command.tsx` que já expõe todos os
  primitivos necessários.

#### Test cases

- **Happy path — chat existente:** digitar "João", selecionar "João Silva
  (11) 99999-0001" → dialog fecha, `ChatListItem` de João fica selecionado na
  lista.
- **Happy path — chat novo:** digitar "Maria", selecionar "Maria Souza
  (21) 98888-0002" sem chat → dialog fecha, URL muda para
  `?tab=conversas&chat=5521988880002`, mensagem "Sem mensagens. Comece a
  conversa abaixo." aparece no ChatPanel.
- **Edge — sem resultados:** digitar "xxyyzz" → exibe empty state com link
  "Enviar para número avulso".
- **Edge — sem conta selecionada:** "+ Nova conversa" abre o palette mas avisa
  que não é possível verificar chats existentes sem conta ativa (ou desabilita o
  botão enquanto não há conta).
- **Edge — contato sem telefone nem WhatsApp:** não aparece nos resultados (não
  há como iniciar conversa WA sem número).
- **Edge — escape:** dialog fecha sem selecionar nada; lista não muda.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test descrito no comentário do PR: abrir palette, buscar contato com
  e sem chat, verificar que links e navegação funcionam
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Busca por empresa ou tags (coberta em T16).
- Criar contato novo a partir do palette (coberto em T12 da Fase 1).
- Envio de mensagem inicial dentro do palette — o composer fica na coluna 2.
- Substituir ou remover o `NewMessageDialog` existente.

---

### T14 — Botão "Conversar" no ContactCard e ContactListItem

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T15 (a rota precisa existir para o deep-link funcionar)
**WSJF score:** (7 + 6 + 4) / 2 = **8.5**
**Segurança:** mudança puramente visual + navegação interna — sem gatilho Security

#### User story

Como atendente do gabinete, quero clicar em "Conversar" num card de contato para
ir diretamente à conversa WhatsApp daquele eleitor já aberta, para não precisar
copiar o número e colá-lo manualmente.

#### Contexto

`ContactCard.tsx` e `ContactListItem.tsx` possuem ações de edição e exclusão,
mas nenhum atalho para WhatsApp interno. O PRD item #5 exige deep-link interno —
nunca `wa.me`. O botão só deve aparecer quando o contato tem `whatsapp` ou
`telefone` preenchido (sem número, não é possível iniciar conversa WA).

O destino é `/integracoes/whatsapp?tab=conversas&chat=<phone>` onde `<phone>` é
o número normalizado (dígitos apenas, padrão Z-API). T15 lê esse parâmetro e
foca o chat correspondente.

#### Critérios de aceite

- [ ] Botão "Conversar" (ícone `MessageCircle` ou `MessageSquare`) aparece nas
  ações do `ContactCard` e do `ContactListItem` **somente** quando o contato tem
  `whatsapp` ou `telefone` preenchido.
- [ ] O botão é renderizado antes (ou após) os botões de editar/excluir, sem
  quebrar o layout existente.
- [ ] Ao clicar, navega para `/integracoes/whatsapp?tab=conversas&chat=<phone>`
  usando `useNavigate` (nunca `window.open` para wa.me).
- [ ] O telefone passado no parâmetro `?chat=` usa `whatsapp` do contato; se
  ausente, usa `telefone`. Normalizado para dígitos (sem parênteses, traços,
  espaços).
- [ ] O botão possui `title="Conversar no WhatsApp"` acessível e não dispara o
  `onClick` do card pai (usa `e.stopPropagation()`).
- [ ] Em mobile (`ContactListItem`), o botão aparece na área de actions
  (mesma região dos botões editar/excluir).
- [ ] Visível somente com permissão de acesso ao WhatsApp (verificar se
  `can.accessWhatsapp()` existe em `usePermissions`, usar se disponível;
  caso contrário, renderizar sem guarda — o destino já tem controle de acesso).

#### Hints técnicos (não-prescritivos)

- **Arquivos a editar:** `src/components/contacts/ContactCard.tsx` e
  `src/components/contacts/ContactListItem.tsx`.
- **Normalização:** `phoneComparisonKey` de `src/lib/normalization.ts` ou
  simplesmente `.replace(/\D+/g, '')` antes de passar ao parâmetro.
- **Navegação:** `useNavigate` do `react-router-dom`; destino
  `/integracoes/whatsapp?tab=conversas&chat=<phone>`.
- **Pattern de ícone:** `MessageCircle` já importado em `src/pages/Whatsapp.tsx`;
  lucide-react disponível.
- **Props:** não há prop nova nos componentes — o botão é autossuficiente (não
  precisa de callback do pai).

#### Test cases

- **Happy path:** contato com `whatsapp='11999990001'` → botão aparece; ao
  clicar, URL muda para `/integracoes/whatsapp?tab=conversas&chat=11999990001`;
  aba Conversas abre e foca o chat (via T15).
- **Happy path — só telefone:** contato sem `whatsapp` mas com `telefone` →
  botão aparece usando `telefone` como número.
- **Edge — sem número:** contato sem `whatsapp` e sem `telefone` → botão não
  aparece.
- **Edge — stopPropagation:** clicar em "Conversar" não abre o modal de detalhe
  do contato (click do card pai não é disparado).
- **Edge — permissão:** usuário sem `accessWhatsapp` não vê o botão (se a
  permissão for implementada; caso contrário, é controlado pela rota de destino).

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: abrir `/contacts`, clicar em "Conversar" em contato com WA →
  navegar para `/integracoes/whatsapp` com chat correto selecionado
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Botão "Conversar" no modal de detalhes do contato (extensão futura).
- Indicação visual se o chat já existe ou não.
- Integração com badge de não-lidas no botão.

---

### T15 — Whatsapp.tsx: leitura de ?chat= e ?contact= + foco automático

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component (página + ConversasTabContent)
**Depende de:** — (independente)
**WSJF score:** (8 + 8 + 6) / 2 = **11.0** ← maior WSJF; implementar primeiro
**Segurança:** sem EF nova, sem migration — sem gatilho Security

#### User story

Como atendente do gabinete, quando chego à tela WhatsApp via deep-link de um
contato, quero que a conversa daquele eleitor já esteja selecionada e focada,
para não precisar procurá-la manualmente na lista.

#### Contexto

`Whatsapp.tsx` já usa `useSearchParams` para controlar a aba ativa (`?tab=`).
Para suportar deep-links de T13 e T14, é necessário ler dois parâmetros adicionais:

- `?chat=<phone>` — número normalizado (dígitos); seleciona o chat cujo
  `zapi_chats.phone` bate com o valor.
- `?contact=<uuid>` — UUID do contato no CRM; resolve o telefone pelo contato e
  seleciona o chat correspondente. Útil para futuras extensões.

A seleção automática precisa esperar os chats carregarem (`isLoading` do
`useZapiChats`). Se o chat não existir ainda, o parâmetro é ignorado e a UI
fica na lista vazia com o composer pronto (o UPSERT acontece no primeiro envio
via `zapi-send-text`).

Após a seleção automática, os parâmetros `?chat=` e `?contact=` devem ser
**removidos da URL** com `replace: true` para não persistirem na URL e causarem
re-seleção ao atualizar a página.

#### Critérios de aceite

- [ ] Acessar `/integracoes/whatsapp?tab=conversas&chat=5511999990001` com a
  conta ativa conectada: após carregar os chats, o chat do número
  `5511999990001` é selecionado automaticamente.
- [ ] Acessar com `?contact=<uuid>`: resolve o `whatsapp` do contato e seleciona
  o chat correspondente.
- [ ] Se o chat não existir na lista, a seleção é ignorada silenciosamente (sem
  erro, sem toast).
- [ ] Após a seleção automática, os parâmetros `?chat=` e `?contact=` são
  removidos da URL (`setSearchParams` com `replace: true`), mantendo `?tab=conversas`.
- [ ] Se `?tab=` não for `conversas` quando `?chat=` está presente, força
  `tab=conversas` automaticamente.
- [ ] A seleção automática ocorre apenas uma vez por navegação (sem loop de
  re-seleção).
- [ ] Nenhuma regressão na navegação por abas existente (`contas`, `conversas`,
  `webhooks`, `logs`).

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `src/pages/Whatsapp.tsx` + prop drilling ou state lift
  para `ConversasTabContent` receber `initialChatPhone` e `initialContactId`.
- **Alternativa:** ler `searchParams` diretamente dentro de `ConversasTabContent`
  usando `useSearchParams` — evita prop drilling e é mais simples.
- **Resolução de `?contact=`:** fazer query pontual em `contacts` pelo UUID
  (`useContact(id)`) e extrair `whatsapp ?? telefone`.
- **Normalização de match:** usar mesma lógica de `normalizePhoneForZapi` de
  `src/supabase/functions/_shared/zapi-helpers.ts` adaptada para client — ou
  `replace(/\D+/g, '')` simples. O `zapi_chats.phone` já está em dígitos puros
  (normalizado pelo webhook/EF na ingestão).
- **useEffect de seleção:** executar quando `chats` muda de `isLoading=true`
  para `false` + quando o parâmetro `chat` existe. Usar `useRef` pra flag "já
  selecionei" para não repetir.
- **Limpeza de URL:** `setSearchParams(p => { p.delete('chat'); p.delete('contact'); return p; }, { replace: true })`.

#### Test cases

- **Happy path — ?chat=:** navegar para
  `?tab=conversas&chat=5511999990001` → após 1–2s de carregamento, o chat do
  número aparece selecionado, a conversa aparece na coluna 2, URL limpa para
  `?tab=conversas`.
- **Happy path — ?contact=:** navegar com `?contact=<uuid-válido>` → contato
  resolvido, chat selecionado, URL limpa.
- **Edge — chat inexistente:** `?chat=5519000000000` (não cadastrado) → nenhum
  chat selecionado, sem erro visível, URL limpa.
- **Edge — sem conta selecionada:** se nenhuma conta está ativa, não há chats
  para cruzar → parâmetro ignorado silenciosamente.
- **Edge — tab incorreta:** `?tab=contas&chat=551199...` → muda tab para
  `conversas` e então seleciona o chat.
- **Edge — atualização de página:** depois da limpeza da URL, F5 não re-seleciona
  nada (parâmetros não estão mais na URL).

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: copiar URL com `?chat=<número>` na barra do browser → chat
  selecionado após carregamento
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Scroll automático até o `ChatListItem` na lista (nice-to-have; implementar se
  tempo permitir, mas não é critério de done desta task).
- Parâmetro `?message=` para pré-preencher o composer (Fase 5).

---

### T16 — Busca global expandida na lista de conversas (empresa + tags)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, component
**Depende de:** — (independente; melhora o filtro existente em ConversasTabContent)
**WSJF score:** (6 + 4 + 3) / 2 = **6.5**
**Segurança:** sem EF nova, sem migration — sem gatilho Security

#### User story

Como atendente do gabinete, quero que o campo de busca da lista de conversas
encontre um eleitor pelo nome da empresa onde trabalha ou pela tag associada,
para localizar conversas sem precisar lembrar o nome exato.

#### Contexto

O filtro atual em `ConversasTabContent.tsx` (`filteredChats`, linhas 77–90)
já filtra por `contact_name`, `whatsapp_name` e `phone` client-side. O PRD
item #51 pede expandir para **empresa** e **tag**.

O campo `empresa` não está no tipo `ZapiChat` atual — `useZapiChats` faz
`select('*, contacts:contact_id (nome)')` e retorna apenas o nome do contato.
Para incluir empresa e tags, é necessário expandir o select para trazer esses
campos do JOIN com `contacts` e `contact_tags`.

Cuidado: o select do `useZapiChats` busca apenas `contacts(nome)`. Adicionar
`profissao` (que é o campo de empresa/profissão no modelo) e
`contact_tags(tags(nome))` ao select aumenta o payload mas é aceitável para o
volume esperado (~centenas de conversas por conta, não dezenas de milhares).

#### Critérios de aceite

- [ ] Digitar o nome de uma empresa/profissão de contato no campo de busca da
  lista de conversas filtra e exibe os chats cujo contato tem esse valor em
  `profissao` (ou campo equivalente de empresa).
- [ ] Digitar o nome de uma tag filtra e exibe os chats cujo contato tem essa
  tag associada.
- [ ] Os filtros existentes (nome, WhatsApp, telefone) continuam funcionando sem
  regressão.
- [ ] O placeholder do campo de busca é atualizado para refletir os novos
  critérios: "Buscar por nome, telefone, empresa ou tag..."
- [ ] A busca por tag é case-insensitive e funciona com correspondência parcial
  (ex: "eleitor" encontra tag "Eleitor Ativo").
- [ ] O contador `(X de Y)` continua correto após filtragem expandida.

#### Hints técnicos (não-prescritivos)

- **Arquivo principal a editar:** `src/hooks/useZapiChats.ts` — expandir o
  select: `select('*, contacts:contact_id (nome, profissao, contact_tags(tags(nome)))')`.
- **Tipo `ZapiChat`:** adicionar campos opcionais:
  `contact_profissao?: string | null` e `contact_tags?: { tags: { nome: string } }[] | null`.
- **Mapeamento:** na função `map` do `queryFn`, extrair `profissao` e
  `contact_tags` do JOIN, assim como já se faz com `nome`.
- **Filtro client-side:** ampliar `filteredChats` em `ConversasTabContent.tsx`
  para incluir match em `profissao` e em nomes de tags.
- **Evitar crash:** usar `String.includes` (nunca RegExp sobre input do usuário)
  — padrão já adotado no filtro atual.
- **Performance:** o JOIN em `contact_tags` retorna array; iterar com
  `.some(ct => ct.tags.nome.toLowerCase().includes(term))`.

#### Test cases

- **Happy path — empresa:** contato "João" tem `profissao='Comerciante'`;
  digitar "comerc" na busca → conversa de João aparece.
- **Happy path — tag:** contato "Maria" tem tag "Eleitor Ativo"; digitar
  "eleitor" → conversa de Maria aparece.
- **Happy path — combinado:** busca "saúde" encontra tanto profissão
  "Profissional de Saúde" quanto tag "Saúde".
- **Edge — contato sem profissão nem tags:** conversa aparece normalmente quando
  o termo não bate com nada e outras conversas aparecem; não aparece quando o
  termo só bateria nesses campos ausentes.
- **Edge — caractere especial no termo:** digitar "café" não causa crash
  (String.includes não interpreta regex).
- **Regressão — busca por nome:** digitar "Maria" ainda encontra contatos pelo
  `contact_name` normalmente.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: buscar empresa e tag na lista de conversas com dados reais
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Busca server-side (manter client-side para esta task — a lista de conversas
  por conta raramente passa de poucas centenas).
- Filtro por bairro/zona (Fase 6, C21).
- Filtro salvo / visão salva (Fase 5, C14).

---

### T17 — C4: busca de texto dentro da conversa aberta

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** — (independente)
**WSJF score:** (5 + 3 + 3) / 5 = **2.2** ← implementar por último nesta fase
**Segurança:** sem EF nova, sem migration — sem gatilho Security

#### User story

Como atendente do gabinete, quero digitar um termo na conversa aberta para
localizar a mensagem específica num histórico longo, para não precisar fazer
scroll manual por centenas de mensagens.

#### Contexto

O `ChatPanel` em `ConversasTabContent.tsx` carrega todas as mensagens via
`useZapiMessagesByChat(chat.id)` em ordem cronológica. Para o C4 (PRD), é
necessário uma barra de busca dentro da conversa que filtre visualmente as
mensagens e permita navegar entre os resultados (anterior/próximo).

A busca é **client-side** sobre as mensagens já carregadas (o `useZapiMessagesByChat`
já retorna o histórico completo). Não é necessária nova query ao banco. O realtime
já funciona e continuará funcionando.

A barra de busca dentro da conversa fica acessível via ícone de lupa no header
do `ChatPanel`. Quando ativa, mensagens que **não** contêm o termo ficam com
opacidade reduzida; as que contêm ficam destacadas com o termo marcado (via
`<mark>` ou span com `bg-yellow-100`).

#### Critérios de aceite

- [ ] Um botão de lupa (ícone `Search`) aparece no header do `ChatPanel`, ao
  lado do nome do contato.
- [ ] Ao clicar, uma barra de busca expande inline no header (sem modal);
  o foco vai para o input automaticamente.
- [ ] Digitar 2+ caracteres filtra visualmente: mensagens sem o termo ficam
  com opacidade reduzida; mensagens com o termo ficam normais e com o trecho
  encontrado destacado.
- [ ] Um contador "X de Y" aparece ao lado do input mostrando resultado atual
  e total (ex: "2 de 7").
- [ ] Botões seta pra cima e pra baixo navegam entre as ocorrências (scroll
  automático até o item).
- [ ] Pressionar Escape fecha a barra e restaura a visualização normal.
- [ ] A busca é case-insensitive e funciona com acento (ex: "eleição" encontra
  "Eleição").
- [ ] Busca funciona somente em mensagens de texto (`body` da mensagem); mídias
  sem legenda não geram resultado (sem erro).
- [ ] Ao trocar de chat, a busca é resetada automaticamente.

#### Hints técnicos (não-prescritivos)

- **Arquivo a editar:** `src/components/whatsapp/ConversasTabContent.tsx` —
  `ChatPanel` (subcomponente interno, linhas 245–499).
- **Estado:** `useState<string>` para `searchQuery` e `useState<number>` para
  `currentMatchIndex`. Computar `matchingIndices` com `useMemo` sobre `messages`.
- **Reset ao trocar de chat:** `useEffect([chat.id], () => setSearchQuery(''))`.
- **Highlight:** criar helper `highlightText(body: string, term: string): ReactNode`
  que divide o texto e envolve as ocorrências em `<mark className="bg-yellow-200
  text-yellow-900 rounded-sm px-0.5">`. Cuidado com XSS: usar `.split()` e
  `.map()`, nunca `dangerouslySetInnerHTML`.
- **Navegação entre resultados:** `useRef<HTMLDivElement[]>` para coletar refs
  das mensagens e usar `ref.current[idx]?.scrollIntoView({ behavior: 'smooth',
  block: 'center' })`.
- **Filtragem de tipo:** só processar `body` quando `message.body` é string não
  vazia. Mensagens de mídia sem caption ficam como "sem texto" e não aparecem
  nos resultados.
- **`MessageBubble`:** pode precisar de prop `highlight?: string` para renderizar
  o texto destacado em vez do `body` puro. Avaliar se vale criar prop ou extrair
  o highlight para o componente pai.

#### Test cases

- **Happy path:** conversa com 50 mensagens; digitar "eleitor" → 3 mensagens
  ficam em destaque, contador mostra "1 de 3"; seta para baixo vai para o 2º
  resultado com scroll automático.
- **Happy path — case-insensitive:** digitar "ELEITOR" → mesmos resultados de
  "eleitor".
- **Edge — 0 resultados:** digitar "xxyyzz" → contador "0 de 0", nenhuma
  mensagem destacada, todas com opacidade normal (sem "0 de 0 resultados" vazio
  quebrando layout).
- **Edge — term curto (<2 chars):** digitar "a" → não aplica filtro (aguardar
  2 chars mínimos).
- **Edge — troca de chat:** busca ativa, troca para outra conversa → input
  limpo, visualização normal restaurada.
- **Edge — mensagem de mídia:** áudio/imagem sem caption → não aparece nos
  resultados; não gera erro.
- **Edge — Escape:** fecha a barra e restaura visualização.

#### Definition of Done

- [ ] Critérios de aceite validados manualmente
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: conversa com histórico real, buscar palavra que aparece em
  múltiplas mensagens, navegar com setas
- [ ] Code review aprovado
- [ ] QA aprovou

#### Out of scope

- Busca server-side (ILIKE em `zapi_messages`) — só necessária se o histórico
  tiver >5k mensagens num chat, o que não é o cenário atual.
- Exportar mensagens filtradas (Fase 5, C31).
- Busca em legendas de mídia (extensão futura — a arquitetura de highlight
  funciona; só requer passar `caption` além de `body`).
- Regex avançado ou operadores booleanos.

---

## Flags de segurança

Nenhuma task da Fase 2 cria Edge Function nova nem migration com RLS/FK para
`auth.users`. O fluxo de envio de mensagens usa a `zapi-send-text` já existente
e auditada (Fase 0). **Não há gatilho automático de Security nem Pentest nesta fase.**

Se em T13 o Fullstack decidir adicionar uma Edge Function para "busca de contatos
server-side" (para escalar além dos 50 contatos por página), **este backlog deve
ser atualizado** e a flag de Security ativada para aquela task.

---

## Notas para o Fullstack

1. **Ordem de execução recomendada: T15 → T13 → T14 → T16 → T17.** T15 é o
   "enabler" das outras — sem ela, T13 e T14 funcionam apenas parcialmente.
2. **T13 e T14 podem ser desenvolvidas em paralelo** após T15 estar no ar, pois
   tocam arquivos diferentes (`ConversasTabContent` vs. `ContactCard/ListItem`).
3. **T16 e T17 são independentes** e podem entrar em qualquer ordem.
4. O `NewMessageDialog.tsx` **não deve ser removido** nesta fase. Ele cobre o
   caso de uso "enviar para número avulso" que o command palette não cobre.
5. `phoneComparisonKey` em `src/lib/normalization.ts` é a função canônica de
   normalização de telefone no client. Usar para cruzar `?chat=<phone>` com
   `zapi_chats.phone`.
6. A próxima migration disponível é `060_*` (059 já está ocupada).
7. Nenhuma migration é necessária nesta fase — toda a Fase 2 vive em camadas de
   UI/hook sobre o banco já preparado pelas Fases 0 e 1.
