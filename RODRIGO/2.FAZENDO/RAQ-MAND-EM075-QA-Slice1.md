# QA — RAQ-MAND-EM075 Agente de IA — Slice 1

**Data:** 2026-05-21
**Branch:** `rodrigo/feature/RAQ-MAND-EM075-agente-de-ia-integrado-ao-crm-agente`
**Commits analisados:** `5049166` (HEAD) — Ondas 1+2+3+4
**Build:** `npm run build` — OK (sem erros TypeScript, 1 warning xlsx chunk size esperado)
**Dev server:** porta 3001 (`npm run dev`)
**Modalidades:** Code Review Estático + Playwright (BLOCKED por credenciais) + Claude Vision (login screen)

---

## Escopo

- Critérios de aceite: 12 tasks (T01–T12) da Slice 1
- Test cases mapeados: 14 (CT01–CT14)
- Test cases executados via Playwright: BLOCKED — senha `QA-Temp-2026!` retorna HTTP 400 no Supabase `nevgnvrwqaoztefnyqdj` (este é um Supabase separado, não o do NaMi/outros projetos)
- Cobertura alternativa: análise estática profunda de todos os componentes, hooks, edge function e migrations

---

## Limitação Principal

**BLOCKER DE TESTE E2E:** Credencial `rodrigofssoares@gmail.com / QA-Temp-2026!` invalida para este Supabase.
A senha `QA-Temp-2026!` foi criada e funciona em outros projetos Antigravity, mas não neste banco (`nevgnvrwqaoztefnyqdj`).
**Consequência:** CTs que dependem de sessão autenticada (CT01–CT14) não puderam ser executados via Playwright.
**Mitigação:** 100% dos componentes e hooks foram lidos e analisados estaticamente. 3 findings foram identificados via inspeção de código.

---

## Casos testados

### CT01 — Item "Agente" na sidebar BLOCKED
- **Given:** usuário admin logado
- **When:** visualiza o menu lateral
- **Then:** item "Agente" com ícone `Bot` aparece após "WhatsApp", antes de "Configurações"
- **Análise estática:** `AppSidebar.tsx` linha 67: `{ label: 'Agente', icon: Bot, href: '/agente', secao: 'agente_ia' }` — código correto. Gate de permissão `agente_ia: (can) => can.viewAgente()` referencia `canView('agente_ia')` via `usePermissions.tsx`.
- **Status:** BLOCKED (sem login)

### CT02 — Aba "Agente" no Settings com badge "novo" BLOCKED
- **Given:** admin logado em /settings
- **When:** vê a lista de abas
- **Then:** aba "Agente" aparece com badge dourado "novo", gate `editAgente()`
- **Análise estática:** `Settings.tsx` linhas 99–106: gate correto `{canEditAgente && (<TabsTrigger value="agente"> Agente <span ...>novo</span>)}`. Badge com `bg-[hsl(40,62%,55%)]` (dourado vinho — alinhado ao design system).
- **Status:** BLOCKED (sem login)

### CT03 — Step 1 Identidade (budget strip, toggle, nome, prompt, dropzone) BLOCKED
- **Given:** admin em Settings > aba Agente > Step 1
- **When:** visualiza identidade do agente
- **Then:** budget strip sticky, toggle is_active, input nome, textarea prompt com contador 0/32000, dropzone de upload
- **Análise estática:**
  - `BudgetStripSticky.tsx`: gradiente vinho `from-[hsl(351,61%,30%)]`, DollarSign icon dourado — correto
  - `IdentityStep.tsx`: toggle `#agente-ativo` com `aria-label="Ativar ou desativar o agente"`, `htmlFor="agent-name"`, `htmlFor="agent-prompt"` — a11y correta
  - `FileUploadDropzone.tsx`: presente e usado em `IdentityStep`
  - Contador: `{promptLength.toLocaleString('pt-BR')}/{MAX_PROMPT.toLocaleString('pt-BR')}` com `MAX_PROMPT = 32000` — correto
- **Status:** BLOCKED (sem login)

### CT04 — Step 2 Conexões: 3 cards de provider BLOCKED
- **Given:** admin em Settings > aba Agente > Step 2
- **When:** visualiza providers
- **Then:** 3 cards (OpenAI verde `#10A37F`, Anthropic laranja `#D77655`, OpenRouter vinho `hsl(351,61%,30%)`), cada um com PasswordInput, botão Testar, link "Gerar chave"
- **Análise estática:** `ConnectionsStep.tsx` — `PROVIDERS` array correto com 3 entries. Cores hardcoded corretas. `ProviderCard` tem `PasswordInput`, botões "Testar" e "Salvar sem testar", link externo com `rel="noopener noreferrer"` (correto a11y/segurança). `handleTest` salva a chave após teste bem-sucedido — fluxo UX correto.
- **Status:** BLOCKED (sem login)

### CT05 — Step 3 Modelos: banner text-only, presets, botão Adicionar BLOCKED
- **Given:** admin em Settings > aba Agente > Step 3
- **When:** visualiza modelos
- **Then:** banner azul "Apenas modelos de texto" com switch, 3 preset boxes (Econômico/Balanceado/Premium), botões Adicionar que abrem dropdown popup
- **Análise estática:** `ModelsStep.tsx` — banner correto com `role="dialog" aria-label="Adicionar modelo ao preset"` no picker, `Switch` com `aria-label="Ativar modo apenas modelos de texto"`. 11 modelos disponíveis na lista curada.
- **Finding MÉDIO:** Lógica `text_only_mode` bloqueia modelos multimodais (Gemini 2.5 Pro) mas somente via flag `multimodal: true` na lista AVAILABLE_MODELS. Se usuário adiciona model_id personalizado que é multimodal, não há bloqueio.
- **Status:** BLOCKED (sem login)

### CT06 — Step 4 Orçamento: sliders, alertas, simulador BLOCKED
- **Given:** admin em Settings > aba Agente > Step 4
- **When:** visualiza orçamento
- **Then:** sliders de tokens/mensagens/custo, alertas 70%/90%/100% com switches, simulador com 4 cenários clicáveis
- **Análise estática:** `BudgetStep.tsx` — 4 sliders com `aria-label` corretos. Switches de alerta com `aria-label` explícitos. Simulador com `SCENARIOS` array de 4 itens, `setActiveScenario` ao clicar — projeção em tempo real via `calcMonthlyCost`. `isDirty` corretamente controla visibilidade do botão "Salvar orçamento".
- **Status:** BLOCKED (sem login)

### CT07 — Guard agente inativo exibe AgentInactiveCard BLOCKED
- **Given:** agente `is_active = false` (seed da migration 086)
- **When:** usuário navega /agente
- **Then:** `AgentInactiveCard` renderizado com "Agente temporariamente desativado"
- **Análise estática:** `Agente.tsx` linha 121: `if (agentSettings && !agentSettings.is_active) return <AgentInactiveCard />;` — guard correto. `AgentInactiveCard` tem estrutura de card centrada com ícone Bot + AlertCircle.
- **Status:** BLOCKED (sem login)

### CT08 — Ativar agente via Settings → welcome screen BLOCKED
- **Given:** admin ativa toggle em Settings > Agente > Step 1
- **When:** navega /agente
- **Then:** welcome screen visível com H1 "Como posso ajudar hoje?"
- **Análise estática:** `useUpsertAgentSettings` invalida `['agent_settings']` após mutação, `Agente.tsx` re-faz query — fluxo correto.
- **Status:** BLOCKED (sem login)

### CT09 — Welcome screen: elementos visuais BLOCKED
- **Given:** agente ativo, 0 mensagens
- **When:** carrega /agente
- **Then:** eyebrow Cinzel "Mandato Desk · 2026", H1 "Como posso ajudar hoje?", 4 prompts em grid, pills (modelo, tokens se >0, LGPD), avatar Bot quadrado com dot verde
- **Análise estática:** `AgentWelcome.tsx` — todos os elementos presentes e corretos.
- **Finding ALTO — BUG RESPONSIVIDADE:** `grid-cols-2 sm:grid-cols-1` na linha 81. Em Tailwind mobile-first: `sm:` = `@media (min-width: 640px)`. O código faz 2 colunas em <640px (mobile) e 1 coluna em >=640px (tablet/desktop). Comportamento correto seria `grid-cols-1 sm:grid-cols-2` (1 coluna mobile, 2 colunas desktop).
- **Status:** BLOCKED (sem login) + Finding registrado

### CT10 — Drawer histórico (hambúrguer, Nova conversa, footer 30 dias) BLOCKED
- **Given:** página /agente aberta
- **When:** clica botão histórico (aria-label "Abrir histórico")
- **Then:** Sheet esquerdo abre, título "Histórico", botão "Nova conversa", footer "30 dias", sessões agrupadas por Hoje/Ontem/Semana/Antigas
- **Análise estática:** `AgentDrawerSessions.tsx` — Sheet Radix (tem focus trap nativo). Agrupamento `GROUP_ORDER = ['hoje', 'ontem', 'semana', 'antigas']` em `Cinzel` uppercase. Footer linha 279–281 correto. Botão "Nova conversa" linha 233–238 correto. `SessionItem` tem rename inline e delete com confirm.
- **Status:** BLOCKED (sem login)

### CT11 — Drawer favoritos (estrela, search, empty state) BLOCKED
- **Given:** página /agente aberta, 0 favoritos
- **When:** clica botão favoritos (aria-label "Abrir favoritas (N)")
- **Then:** Sheet direito, título "Favoritas 0/500", search input, empty state "Você ainda não favoritou respostas."
- **Análise estática:** `AgentDrawerFavorites.tsx` — `FAVORITES_LIMIT = 500`, título com `{count} / {FAVORITES_LIMIT}`. Empty state condicional correto. Search filtra por `message_content` e `note`.
- **Status:** BLOCKED (sem login)

### CT12 — Envio de mensagem: optimistic bubble + typing indicator BLOCKED
- **Given:** agente ativo, campo de texto preenchido
- **When:** pressiona Enter ou botão enviar
- **Then:** bolha user aparece imediatamente (optimistic), indicador typing aparece (3 dots bouncing), resposta chega com markdown renderizado
- **Análise estática:**
  - `useAgentChat.ts` — `onMutate`: insere `optimisticMsg` no cache antes da resposta. `onSuccess`: invalida cache para buscar do banco. `onError`: reverte snapshot. Padrão correto.
  - `AgentChatMessages.tsx` — `TypingIndicator`: 3 spans com `agentBounce` animation (definida em `index.css` linha 435).
  - `AgentMarkdown.tsx` — ReactMarkdown + remark-gfm + SEM rehype-raw (XSS prevention correto).
  - `AgentInput.tsx` — Enter envia, Shift+Enter quebra linha, auto-resize.
- **Finding MÉDIO — UX:** Quando provider não configurado, EF retorna `{ skipped: true, reason: 'provider_not_configured' }` com status 200. O hook lança `throw new Error('Resposta inválida do agente')` porque `result.reply` é undefined. O toast exibe "Erro ao enviar mensagem: Resposta inválida do agente" — mensagem genérica. Usuário não sabe que precisa configurar chave de API.
- **Status:** BLOCKED (sem login) + Finding registrado

### CT13 — Responsividade mobile 375px BLOCKED
- **Given:** viewport 375×667
- **When:** carrega /agente
- **Then:** header colapsa (pills ocultas), welcome funciona, drawers ocupam quase tela toda
- **Análise estática:**
  - `AgentHeader.tsx` linha 106: `<div className="flex gap-2 md:hidden">` — as pills estão dentro de `md:hidden`, portanto visíveis apenas em <768px. Isso é **correto para mobile** (pills visíveis em mobile, ocultas em desktop).
  - Porém o briefing diz "Header colapsa (pills somem em mobile)" — há ambiguidade interpretativa. A implementação atual mostra pills em mobile (375px) e oculta em desktop (>768px). Se o design deseja pills em desktop e sumir em mobile, a classe deveria ser `md:flex` (visível apenas em >=768px).
  - Sheet com `max-w-[90vw]` — ocupa 90% da tela em mobile.
- **Finding MÉDIO — AMBIGUIDADE DE SPEC:** Pills do header visíveis em mobile mas ocultas em desktop. Verificar com Rodrigo se isso é intencional ou bug.
- **Status:** BLOCKED (sem login) + Finding registrado

### CT14 — Acessibilidade: aria-labels e focus BLOCKED
- **Given:** página /agente e /settings
- **When:** inspeciona aria attributes
- **Then:** switches têm aria-label, inputs têm htmlFor, drawers têm focus trap (Radix), botões críticos têm aria-label
- **Análise estática:**
  - `AgentHeader.tsx`: `aria-label="Abrir histórico"` (linha 57), `aria-label={Abrir favoritas (${favoritesCount})}` (linha 148) — corretos.
  - `AgentInput.tsx`: `aria-label="Mensagem para o agente"` (linha 78), `aria-label="Enviar mensagem"` (linha 108) — corretos.
  - `IdentityStep.tsx`: `aria-label="Ativar ou desativar o agente"` (linha 119), `htmlFor="agent-name"`, `htmlFor="agent-prompt"` — corretos.
  - Sheet usa Radix Dialog — focus trap nativo (Escape fecha, foco retorna ao trigger).
  - `ModelRow`: `aria-label` e `aria-pressed` nos botões Padrão e Switch — corretos.
- **Status:** PASS via análise estática (sem evidências visuais)

---

## Heurísticas exploratórias aplicadas (análise estática)

| Heurística | Status | Observação |
|---|---|---|
| Boundaries (0, 1, max) | Aplicado | MAX_PROMPT=32000, FAVORITES_LIMIT=500 — validados no código |
| CRUD ordering | Parcial | Sessões: criar/renomear/deletar — todos implementados em AgentDrawerSessions |
| Pause/Resume | Identificado | `isDirty` em AgentSettingsTab e BudgetStep preserva estado via RHF |
| Concurrency (2 abas) | Não testado | Realtime sub ausente — página recarrega dados em staleTime 30s |
| State transitions (inativo→ativo) | Aplicado | Guard em Agente.tsx correto |
| Empty/Null | Aplicado | Empty states em Drawer histórico, Drawer favoritos, lista de presets |
| i18n (acentos, emojis) | Parcial | Campos texto sem limite de charset explícito — deve funcionar (UTF-8 Supabase) |
| Permissions | Aplicado estático | viewAgente/editAgente em 3 guards distintos |
| Network | Não testado | onError reverte optimistic update — código correto |
| Mobile 375px | Parcial | Análise estática apenas |

---

## Regressão verificada (análise estática)

- [x] AppSidebar — nav items existentes não foram alterados (apenas adição de "Agente")
- [x] Settings page — abas existentes preservadas; AgentSettingsTab adicionada sem quebrar outras
- [x] usePermissions — funções existentes intactas; viewAgente/editAgente adicionadas no final
- [x] Supabase types — código usa cast `as never` em tabelas novas (não quebra types existentes)
- [ ] Realtime subscriptions — não verificado se novas tabelas interferem em subs existentes

---

## Sumário de findings

| # | Severidade | CT | Tipo | Descrição |
|---|---|---|---|---|
| F01 | ALTO | CT09 | Bug responsividade | `grid-cols-2 sm:grid-cols-1` inverte layout: 2 colunas em mobile, 1 coluna em desktop. Correto seria `grid-cols-1 sm:grid-cols-2` |
| F02 | MÉDIO | CT12 | UX/Error message | Provider não configurado retorna mensagem genérica "Resposta inválida do agente" em vez de "Configure a chave API nas Configurações" |
| F03 | MÉDIO | CT13 | Ambiguidade spec | Pills do header com `md:hidden` ficam visíveis em mobile (<768px) e ocultas em desktop (>768px) — pode ser intencional ou invertido |
| F04 | BAIXO | CT05 | Edge case | `text_only_mode` não bloqueia model_ids personalizados não presentes na lista `AVAILABLE_MODELS` |
| F05 | BLOCKER AMBIENTE | Todos | Infra | Credencial `QA-Temp-2026!` inválida neste Supabase — todos os CTs E2E ficaram BLOCKED |

---

## Screenshots

- `screenshots/qa-RAQ-MAND-EM075/mandato-login-screen.png` — tela de login do Mandato Desk (app funcional na porta 3001)
- `screenshots/qa-RAQ-MAND-EM075/ERRO-GLOBAL.png` — screenshot do estado de login após tentativa com senha incorreta

---

## Veredicto

**APROVADO COM RESERVAS** — condicionado a:

1. Rodrigo confirmar/corrigir F01 (grid responsivo dos prompts sugeridos — provável bug)
2. Rodrigo decidir sobre F03 (pills em mobile — ambiguidade de spec)
3. F02 é sugestão de UX — pode ir como issue separada

**Blocking real para executar testes E2E completos:** Rodrigo precisa fornecer credencial válida para o banco `nevgnvrwqaoztefnyqdj`. Após isso, re-executar `node scripts/qa-em075-slice1.mjs` para validar fluxos funcionais completos.

**Análise de código:** implementação segue os critérios de aceite do Backlog tasks (T01–T12). Lógica de guards, optimistic updates, hooks, edge function e migrations estão corretos. A11y implementada adequadamente com aria-labels e focus trap via Radix. O build passa sem erros TypeScript.
