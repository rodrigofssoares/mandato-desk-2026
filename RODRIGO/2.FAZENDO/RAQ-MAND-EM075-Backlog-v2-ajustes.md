# RAQ-MAND-EM075 — Atualização v2 do Backlog (pós-mockups)

**Data:** 2026-05-21
**Contexto:** Rodrigo escolheu Layout 3 (chat institucional) + Layout E (config com sub-tabs e presets). Este documento ajusta o backlog `RAQ-MAND-EM075-Backlog-tasks.md` refletindo as decisões finais.

---

## 1. Escolhas finais consolidadas

### Tela do agente (rota `/agente`)
- **Layout 3 — Institucional**: header com glassmorphism, avatar quadrado com gradiente, eyebrows em Cinzel, welcome screen com 4 prompts sugeridos, drawers laterais (esquerda = histórico, direita = favoritos), badges LGPD/modelo/tokens
- Sem streaming no Slice 1 (manter como Slice 3 evolutivo)

### Tela de Configurações (subaba "Agente" em Settings)
- **Layout E — Wizard com 4 sub-tabs internas**:
  - **Passo 1** Identidade — nome, prompt, **upload de arquivos de referência (drag&drop)**, switch ativo
  - **Passo 2** Conexões — 3 cards lado-a-lado: OpenAI, Anthropic, OpenRouter — cada um com chave API + botão Testar + link Gerar chave
  - **Passo 3** Modelos — master switch "Apenas texto" + 3 caixas de preset (🪙 Econômico / ⚖️ Balanceado / ✨ Premium) com toggle granular individual por modelo + botão Adicionar com dropdown
  - **Passo 4** Orçamento — limites mensais + alertas 70/90/100% + caps por usuário + simulador 4 cenários
- **Budget strip sticky** no topo em todas as sub-tabs
- **Sem "Quem pode usar"** no formulário — delegado à Matriz de Permissões global (RBAC)

---

## 2. Mudanças no backlog original

### T03 (Subaba Configurações) — REESCREVER

**Antes:** formulário único com nome, provider, model, api_key, prompt, is_active, allowed_roles.

**Agora:** wizard com 4 sub-tabs + stepper visual + budget strip sticky. **Estimativa sobe de M (4-5h) para L (10-14h)** ou quebra em sub-tasks T03a/T03b/T03c/T03d:

| Sub-task | Descrição | Estimativa |
|----------|-----------|------------|
| T03a | Sub-aba Identidade — form básico + upload de arquivos (front-only, sem RAG ainda) | M (3-4h) |
| T03b | Sub-aba Conexões — 3 cards de provedor com chave API + teste + persistência | M (4-5h) |
| T03c | Sub-aba Modelos — master switch + 3 presets com toggle granular + dropdown adicionar | M (5-7h) |
| T03d | Sub-aba Orçamento — sliders + thresholds + simulador + budget strip sticky | M (4-5h) |

### Tasks novas que surgem do Layout E

| ID | Título | Camadas | Slice | Estim. | Depende de |
|----|--------|---------|-------|--------|------------|
| **T18** | Migration `ai_provider_credentials` — 1 linha por provider, RLS admin, chave por provider | model | 1 | S (2h) | T01 |
| **T19** | Hook `useProviderCredentials` — CRUD por provider + teste de chave via EF | hook | 1 | S (2-3h) | T18 |
| **T20** | Edge Function `ai-test-provider-key` — testa chave do provider antes de salvar | route | 1 | S (2h) | T18 |
| **T21** | Migration `ai_agent_model_presets` — preset por agente (Econômico/Balanceado/Premium + lista de modelos) | model | 1 | S (2h) | T01 |
| **T22** | Seed dos 3 presets default (Econômico, Balanceado, Premium) na migration | model | 1 | S (1h) | T21 |
| **T23** | Hook `useAgentPresets` — listar, escolher preset ativo, toggle modelos individuais, adicionar modelo customizado | hook | 1 | S (3h) | T21 |
| **T24** | Migration `ai_agent_budget` — orçamento + thresholds + caps por usuário | model | 1 | S (2h) | T01 |
| **T25** | Hook `useAgentBudget` + `useAgentBudgetCurrent` (gasto mês corrente) | hook | 1 | S (2-3h) | T24 |
| **T26** | Componente `BudgetStripSticky` — barra horizontal sticky no topo da página de Settings/Agente | component | 1 | S (2h) | T25 |
| **T27** | Componente `BudgetSimulator` — 4 cenários clicáveis com cálculo client-side | component | 1 | S (2-3h) | T25 |
| **T28** | Hook `useAgentBudgetEnforce` — middleware que bloqueia EF `ai-agent-chat` ao atingir 100% | route, hook | 1 | M (3-4h) | T05, T24 |
| **T29** | Trigger Postgres: registrar `total_tokens` × preço em `ai_chat_messages_cost` ao inserir mensagem | model | 1 | S (2h) | T04 |

### T13 (Anexos do agente) — PROMOVER pro Slice 1

**Justificativa:** o upload de arquivos foi requisito explícito do Rodrigo na revisão dos mockups ("agente tem que ler arquivos como o GPT do OpenAI"). Não é mais Slice 2 — passa pra MVP.

**Mantém escopo:** PDF/DOCX/TXT, texto extraído na tabela (sem Storage binário), máx 10 arquivos × 5 MB.

**Implicação técnica:** T14 (extração PDF no Deno) entra no caminho crítico. Mitigação: TXT/DOCX direto, PDF via OpenAI Files API quando provider for OpenAI; documentar limitação se não tiver provider OpenAI conectado.

### T03 antigo → DELETAR (substituído por T03a/T03b/T03c/T03d)

---

## 3. Slice 1 reordenado (com tasks novas)

| Ordem | Task | Justificativa |
|-------|------|---------------|
| 1 | T01 | Migration `ai_agents` + RBAC `agente_ia` |
| 2 | T18 | Migration `ai_provider_credentials` (chaves por provider) |
| 3 | T21 | Migration `ai_agent_model_presets` + T22 seed |
| 4 | T24 | Migration `ai_agent_budget` + thresholds |
| 5 | T29 | Trigger de custo por mensagem |
| 6 | T13 | Migration `ai_agent_attachments` (PROMOVIDA) |
| 7 | T02 | Hook `useAgentSettings` |
| 8 | T19 | Hook `useProviderCredentials` |
| 9 | T23 | Hook `useAgentPresets` |
| 10 | T25 | Hook `useAgentBudget` |
| 11 | T20 | Edge Function `ai-test-provider-key` |
| 12 | T14 | Edge Function `ai-agent-extract-text` (PROMOVIDA) |
| 13 | T03a | Sub-aba Identidade + upload files |
| 14 | T03b | Sub-aba Conexões |
| 15 | T03c | Sub-aba Modelos |
| 16 | T26 | `BudgetStripSticky` |
| 17 | T27 | `BudgetSimulator` |
| 18 | T03d | Sub-aba Orçamento |
| 19 | T04 | Migration sessões/mensagens |
| 20 | T05 | Edge Function `ai-agent-chat` |
| 21 | T28 | Middleware budget enforce |
| 22 | T16 | Injetar anexos no system_prompt (PROMOVIDA) |
| 23 | T06 | Hooks de chat/sessões |
| 24 | T07 | Página `/agente` (Layout 3) |
| 25 | T08 | Item "Agente" na sidebar |
| 26 | T09 | Painel de histórico de sessões |
| 27 | T10 | Migration `ai_chat_favorites` |
| 28 | T11 | Hook de favoritos |
| 29 | T12 | UI de favoritos |

**Total Slice 1: 29 tasks · estimativa ~80-110h dev** (subiu de 35-55h por causa das novidades).

### Slice 2 reduzido
- T17 — Upload de arquivo runtime no chat (multimodal) — fica fora do MVP

---

## 4. Decisões assumidas atualizadas

| # | Decisão | Status |
|---|---------|--------|
| 1 | Tabela `ai_agents` separada | ✅ confirmado |
| 2 | Limite favoritos | **AGUARDA RODRIGO** — assumido 500 |
| 3 | Quem edita agente | ✅ admin only (proprietario removido — vai pra Permissões global) |
| 4 | OpenRouter | ✅ lista curada + campo livre |
| 5 | Anexos do agente | ✅ Opção A (só texto) **+ PROMOVIDA pro Slice 1** |
| 6 | LGPD | ✅ warning educativo no chat |
| **7** | **Quem pode usar o agente** | ✅ **delegado à Matriz de Permissões global** (não fica no form do agente) |
| **8** | **Orçamento default** | **AGUARDA RODRIGO** — assumido R$ 100/mês |
| **9** | **Thresholds default** | **AGUARDA RODRIGO** — assumido 70% / 90% / 100% (bloqueio automático) |
| **10** | **Caps por usuário default** | **AGUARDA RODRIGO** — assumido 50 msg/dia, R$ 25/usuário/mês |

---

## 5. Decisões fechadas (respondidas em 2026-05-21)

| Q | Pergunta | Resposta |
|---|----------|----------|
| Q1 | Limite de favoritos | **500 por usuário** (PO sugeriu) |
| Q2 | Orçamento mensal default | **R$ 50/mês** (conservador — pode subir depois) |
| Q3 | Comportamento ao atingir 100% | **Bloqueio rígido** — agente para até admin liberar ou virar o mês |

---

## 6. Estratégia de execução em 4 ondas

| Onda | Escopo | Estimativa | Status |
|------|--------|------------|--------|
| 1 | Fundação DB (migrations 086-091) + RLS + RBAC + hooks de leitura | ~15-20h | **🚧 em execução** |
| 2 | 4 Edge Functions (test-key, extract-text, chat, budget enforce) | ~15-20h | pendente |
| 3 | UI Configurações (Layout E sub-tabs) + BudgetStrip + Simulator | ~20-25h | pendente |
| 4 | UI Chat (Layout 3) + sidebar + drawer favoritos + RBAC sidebar | ~20-25h | pendente |

Cada onda passa por: **Fullstack → Security (se toca auth/dados) → Code Review → QA**. Commits semânticos em pt-BR a cada task.
