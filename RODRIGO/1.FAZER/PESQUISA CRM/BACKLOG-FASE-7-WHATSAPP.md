# Backlog — Fase 7 · Inteligência (IA) + Métricas · Evolução WhatsApp CRM

> Quebra atomizada do `PRD-EVOLUCAO-WHATSAPP.md` (Fase 7 apenas).
> Continuação direta de `BACKLOG-FASE-6-WHATSAPP.md` (T01–T77).
> Gerado pelo agente Backlog em 2026-05-18.
> Total: 18 tasks (~88 pts).

---

## Pesquisa e decisões de arquitetura registradas

### O que já existe — NÃO recriar

- **`ai_settings`** (tabela singleton): `provider`, `model`, `api_key` (salva em texto — issue
  de segurança conhecida, marcada para upgrade), `ai_enabled`, `features (jsonb)`. RLS: somente
  admin lê/escreve. Linha singleton gerada no setup.
- **`useAISettings` + `useUpdateAISettings`** em `src/hooks/useAISettings.ts`: retorna settings
  mascarados (chave nunca exposta ao frontend), `api_key_set: boolean`, `ai_enabled`. Três providers
  suportados: `'anthropic'`, `'openai'`, `'google'`. Features atuais: `resumo_demandas`,
  `sugestao_acoes`, `analise_risco` (contexto de demandas, NÃO WhatsApp — serão ESTENDIDAS).
- **`AISettingsTab`** em `src/components/settings/AISettingsTab.tsx`: UI de configuração global
  de IA (provider, modelo, chave, toggle geral). Suporte a `claude-opus-4-6` / `claude-sonnet-4-6`
  / Anthropic como default. **NÃO recriar — estender `features`**.
- **`isFeatureEnabled` + `FEATURES_CATALOG`** em `src/lib/featureFlags.ts`: catálogo de features
  c33–c38 já cadastrado. `isFeatureEnabled(config, 'c33')` já funciona. `useAccountFeatures` em
  `src/hooks/useAccountFeatures.ts`: hook por conta que lê `recursos_config`. Ambos prontos.
- **`testApiKey`** em `src/lib/ai/testApiKey.ts`: testa chave contra endpoint do provider. Só
  para uso do admin na UI de configuração.
- **`src/lib/featureFlags.ts`**: c33-c38 já no catálogo `FEATURES_CATALOG.ia`.
- **`ContasTabContent`**: multi-conta já gerenciado (CRUD, seletor, `selectedAccountId`).
  `ConversasTabContent` já usa `selectedAccountId` para filtrar chats.
- **`ConversasTabContent`**: seletor de conta (`Select`) no topo da coluna esquerda já existe
  (estado `selectedAccountId`, filtra `useZapiChats(selectedAccountId)`). Multi-conta no CRM
  já funciona — tarefa C26 é sobre **visão consolidada** (todos os números juntos).
- **`zapi_messages`**: tabela com `body`, `direction`, `media_type`, `media_url`, `media_mime`,
  `chat_id`, `account_id`, `sent_at`. Sem coluna de transcrição ainda.
- **`zapi_chats`**: tem `status`, `assigned_to`, `contact_id`, `account_id`, `demand_id`.
  Sem coluna de `ai_summary`, `ai_intent`, `ai_sentiment` ainda.
- **`ContactPanel`**: renderiza seções modulares (`ContactFunnelSection`, `ContactTasksSection`,
  `ChatNotesSection`, `ChatTagsSection`, `ContactOptinSection`, `DemandLinkSection`). Padrão para
  novas seções de IA: criar `AISummarySection`, `AIResponseSuggestion`, `AIInsightsSection`.
- **Última migration aplicada:** `078`. Próximas disponíveis: `079`, `080`, ...
- **Última task numerada:** T77. Tasks desta fase: **T78–T95**.
- **EFs existentes:** `zapi-send-text`, `zapi-send-media`, `zapi-chat-update`, `zapi-mark-as-read`,
  `zapi-webhook`, `zapi-send-reaction`, `zapi-forward-message`, `zapi-send-location`,
  `zapi-instance-status`, `zapi-send-poll`, `zapi-chat-tag-update`, `zapi-schedule-message`,
  `zapi-send-scheduled`, `zapi-bulk-chat-update`, `zapi-broadcast-send`, `zapi-demand-notify`,
  `zapi-relationship-followup`, `zapi-broadcast-create`.

---

### Decisão de arquitetura — Camada de IA: como as EFs acessam o provider

**Contexto:** `ai_settings.api_key` é salva em texto no banco (issue de segurança
conhecida — upgrade para Vault planejado). A EF acessa a chave diretamente via
`service_role` na tabela `ai_settings`. **Nunca** a chave vai ao frontend.

**Fluxo de execução para qualquer recurso de IA:**

```
Frontend (gated por isFeatureEnabled) → chama EF com {chat_id, account_id}
  EF (service_role):
    1. Lê recursos_config da conta via zapi_accounts → verifica isFeatureEnabled(config, 'c3X')
    2. Lê ai_settings → verifica ai_enabled = true + api_key presente
    3. Se qualquer check falhar → retorna 200 com { skipped: true, reason: "..." }
    4. Busca mensagens do chat em zapi_messages (últimas N, text only)
    5. Chama provider (Anthropic/OpenAI/Google) via fetch com a chave
    6. Persiste resultado em coluna dedicada ou tabela
    7. Retorna resultado ao frontend
```

**Dupla validação obrigatória:** A verificação de `isFeatureEnabled` acontece TANTO
no frontend (não renderiza UI) QUANTO na Edge Function (não executa, retorna skipped).
Isso garante zero custo mesmo que o frontend seja bypassado.

**Provider:** usa `ai_settings.provider` e `ai_settings.model`. A EF monta o payload
correto para cada provider. Modelo recomendado para tarefas de análise: `claude-haiku-4-5`
(rápido e barato) — mas respeita o modelo configurado pelo admin.

---

### Decisão — C38 Transcrição de áudio: armazenamento e trigger

**Decisão: coluna `transcription TEXT` em `zapi_messages` + EF `zapi-transcribe-audio`.**

- Coluna nullable em `zapi_messages`: `transcription TEXT`, `transcribed_at TIMESTAMPTZ`.
  Migration `079`.
- Trigger: quando `zapi-webhook` recebe mensagem com `media_type = 'audio'`, encadeia
  chamada à `zapi-transcribe-audio` via `pg_net` (ou o frontend pode chamar na abertura
  da conversa — Fullstack decide o mais simples).
- Opção recomendada: o frontend chama `zapi-transcribe-audio` ao abrir a conversa se
  houver mensagens de áudio sem transcrição (lazy, sob demanda, não automático). Isso
  evita custo em conversas nunca abertas.
- A EF baixa o áudio via `media_url` (já salva), envia para o provider de IA configurado
  (se Anthropic: usa `claude` com mensagem multimodal; se OpenAI: usa Whisper API;
  se Google: usa Gemini multimodal). Salva o texto resultante.

---

### Decisão — C33 Resumo + C35 Classificação + C36 Sentimento: colunas em zapi_chats

**Decisão: colunas em `zapi_chats` + EF `zapi-ai-analyze-chat` que preenche tudo de uma vez.**

Adicionar à `zapi_chats` (migration `080`):
- `ai_summary TEXT` — resumo da conversa gerado por IA
- `ai_intent TEXT` — classificação de assunto/intenção (ex: "solicitação de asfalto", "reclamação")
- `ai_sentiment TEXT CHECK (ai_sentiment IN ('positivo','neutro','negativo','urgente'))`
- `ai_analyzed_at TIMESTAMPTZ` — quando foi analisado (para saber se está stale)

**Por que juntos:** uma única chamada ao LLM pode retornar resumo + classificação + sentimento
em formato JSON estruturado, reduzindo custo 3x em vez de 3 chamadas separadas. A EF
`zapi-ai-analyze-chat` recebe `{chat_id, account_id}`, verifica os flags c33+c35+c36
individualmente e inclui apenas os campos solicitados no prompt, mas sempre faz 1 chamada.

**Reanalise automática:** a EF é chamada pelo frontend quando:
- A conversa é aberta e `ai_analyzed_at IS NULL`
- Ou `ai_analyzed_at < now() - interval '1 hour'` (stale)
- Ou explicitamente pelo botão "Reanalisar" no `AISummarySection`

---

### Decisão — C34 Sugestão de resposta: sem persistência

**Decisão: sem coluna em banco — gerado on-demand, exibido no compositor.**

A sugestão é efêmera: o operador a usa (editada) ou ignora. Não há valor em persistir.
EF `zapi-ai-suggest-reply` recebe `{chat_id, account_id}`, busca as últimas N mensagens
e retorna `{ suggestion: string }`. O frontend exibe no compositor (não no ContactPanel)
como texto rascunho editável com badge "Sugestão IA". O operador edita antes de enviar.

---

### Decisão — C37 Next-best-action: coluna em contacts

**Decisão: coluna `ai_next_action TEXT` + `ai_next_action_at TIMESTAMPTZ` em `contacts`.**

O next-best-action é contextual ao contato (não à conversa). Migration na mesma `079`
ou separada. EF `zapi-ai-next-action` recebe `{contact_id, account_id}`, analisa
histórico de demandas + etapa do funil + última interação WhatsApp.

---

### Decisão — C26 Multi-instância: visão consolidada

**Contexto:** o seletor de conta já existe em `ConversasTabContent`. Quando o usuário
seleciona uma conta, vê só os chats dessa conta. C26 adiciona a opção "Todos os números"
que consolida chats de todas as contas.

**Decisão: estado especial `selectedAccountId = '__all__'` + hook `useAllZapiChats`.**

- `useAllZapiChats()`: busca `zapi_chats` de todas as contas do usuário (sem filtro de
  `account_id`), retorna union com campo `account_name` enriquecido.
- No `ChatListItem`, quando em visão consolidada, exibe badge com o nome da conta/número
  para diferenciação visual.
- Enviar mensagem em visão consolidada usa o `account_id` do chat selecionado
  (transparente para o usuário).
- Sem migration nova — apenas lógica de query e UI.

---

### Decisão — Dashboard de atendimento (#60): view materializada vs query direta

**Decisão: query direta com agregação + view não-materializada.**

Para o porte atual (uma ou poucas contas, centenas de conversas), uma VIEW com
aggregation é suficiente. Sem tabela extra. View `v_dashboard_atendimento` calcula:
- Total de conversas abertas por conta
- Tempo médio de resposta (diferença entre `sent_at` de mensagens `direction='received'`
  e a próxima mensagem `direction='sent'` na mesma conversa)
- Conversas por atendente (`assigned_to`)
- Conversas fechadas hoje/esta semana

Migration `081` cria a view. Hook `useDashboardAtendimento(accountId)` consulta a view.

---

### Decisão — Auditoria (#61): tabela `zapi_audit_log`

**Decisão: nova tabela de auditoria específica para atendimentos.**

`zapi_audit_log` é diferente de `activities` (já existente): é focada em eventos de
atendimento WhatsApp (mudança de status, atribuição, finalização, handoff). Campos:
`id`, `account_id`, `chat_id`, `contact_id`, `event_type TEXT`, `actor_id UUID`,
`old_value JSONB`, `new_value JSONB`, `created_at`.

Trigger ou chamada explícita da EF `zapi-chat-update` registra cada evento relevante.
RLS: admins e o próprio atendente veem seus registros. Sem delete (auditoria imutável).

---

## Ordem de execução (WSJF + dependências)

```
T78 — Migration: schema de IA (colunas zapi_chats + zapi_messages + contacts) [Security]
T79 — EF zapi-ai-analyze-chat (C33 + C35 + C36 consolidada)                  [Security+Pentest]
T80 — UI: AISummarySection no ContactPanel (C33 + C35 + C36)
T81 — EF zapi-ai-suggest-reply (C34)                                          [Security+Pentest]
T82 — UI: sugestão de resposta no compositor (C34)
T83 — EF zapi-transcribe-audio (C38)                                          [Security+Pentest]
T84 — UI: exibir transcrição em MessageBubble (C38)
T85 — EF zapi-ai-next-action (C37)                                            [Security+Pentest]
T86 — UI: AIInsightsSection no ContactPanel (C37)
T87 — UI: visão consolidada multi-instância (C26)
T88 — Migration: view v_dashboard_atendimento + tabela zapi_audit_log         [Security]
T89 — Hook useDashboardAtendimento + useAuditLog
T90 — UI: DashboardAtendimentoPage (rota /whatsapp/dashboard)
T91 — UI: AuditLogPage (rota /whatsapp/auditoria)
T92 — Extender AISettingsTab com features WhatsApp (C33-C38)
T93 — AIFeaturesSettings: onboarding "IA desabilitada" nos pontos de entrada
T94 — Testes E2E de gating de IA (sem chamada quando flag desligada)
T95 — Estender FEATURES_CATALOG + AccountFormDialog com c26 e c40 revisado
```

---

## Tasks

### T78 — Criar schema de banco para IA e auditoria (migration 079–081)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** model
**Depende de:** T77 (última task Fase 6)
**WSJF score:** (8 + 7 + 8) / 5 = 4,6
**[Security obrigatorio]**

#### User story

Como atendente do gabinete, quero que o sistema armazene análises de IA e logs de
auditoria por conversa, para que eu possa consultar resumos e histórico sem precisar
de chamadas repetidas ao provider de IA.

#### Contexto

Fundação de dados para todos os recursos de IA da Fase 7. Sem esta migration, as EFs
e componentes de IA não têm onde persistir resultados. Segue o padrão expand-contract
(adiciona colunas nullable, sem breaking change). Três migrations distintas para separar
responsabilidades e facilitar rollback individual.

#### Critérios de aceite

- [ ] Migration `079`: colunas `transcription TEXT` e `transcribed_at TIMESTAMPTZ` em
      `zapi_messages`; colunas `ai_next_action TEXT` e `ai_next_action_at TIMESTAMPTZ`
      em `contacts`; todas nullable.
- [ ] Migration `080`: colunas `ai_summary TEXT`, `ai_intent TEXT`,
      `ai_sentiment TEXT CHECK (ai_sentiment IN ('positivo','neutro','negativo','urgente'))`,
      `ai_analyzed_at TIMESTAMPTZ` em `zapi_chats`; todas nullable.
- [ ] Migration `081`: VIEW `v_dashboard_atendimento` retornando conversas abertas por conta,
      tempo médio de resposta estimado, conversas por `assigned_to`, finalizadas hoje.
      Tabela `zapi_audit_log(id uuid, account_id uuid, chat_id uuid, contact_id uuid,
      event_type text, actor_id uuid, old_value jsonb, new_value jsonb, created_at timestamptz)`.
      RLS: INSERT via service_role; SELECT para autenticados do mesmo tenant; sem DELETE/UPDATE.
- [ ] `npx supabase db push` executa sem erro.
- [ ] `types.ts` regenerado reflete as novas colunas.
- [ ] Índice em `zapi_audit_log(chat_id)` e `zapi_audit_log(account_id, created_at)`.

#### Hints técnicos (não-prescritivos)

- **Model**: `supabase/migrations/079_zapi_ai_transcription.sql`,
  `080_zapi_chats_ai_columns.sql`, `081_dashboard_audit.sql`
- **Padrão existente**: mesmo padrão expand-contract das migrations `056`–`078`
- **RLS auditoria**: `USING (account_id IN (SELECT id FROM zapi_accounts WHERE ...))` —
  padrão já estabelecido nas outras tabelas Zapi
- **VIEW**: usar LEFT JOIN entre `zapi_chats` e `zapi_messages` para calcular métricas;
  não usar funções window pesadas pois é query síncrona no hook

#### Test cases

- **Happy path**: migrations aplicadas em sequência, banco aceita insert em todas as colunas novas
- **Edge — rollback**: cada migration pode ser revertida sem afetar as outras
- **Edge — RLS auditoria**: usuário não-admin não consegue fazer DELETE em `zapi_audit_log`
- **Edge — constraint sentimento**: insert com valor fora do enum retorna erro de constraint

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual: `npx supabase db push` sem erro, `SELECT * FROM v_dashboard_atendimento` retorna rows
- [ ] Security revisou RLS da `zapi_audit_log`
- [ ] QA aprovou

#### Out of scope

- Índices de performance para escala (milhões de linhas) — não é o porte atual
- Materialização da view — query direta é suficiente
- Histórico de versões de `ai_summary` — só a última análise

---

### T79 — Edge Function zapi-ai-analyze-chat (C33 + C35 + C36)

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route
**Depende de:** T78
**WSJF score:** (9 + 6 + 9) / 8 = 3,0
**[Security + Pentest obrigatorio — EF com service_role chamando provider de IA]**

#### User story

Como atendente do gabinete, quero que a IA analise a conversa e me dê resumo,
classificação de assunto e sentimento do eleitor, para que eu possa retomar um
atendimento ou priorizar filas sem reler toda a conversa.

#### Contexto

EF central de IA para análise de conversas. Uma única chamada ao LLM retorna os três
campos (resumo + intent + sentimento) como JSON estruturado, minimizando custo.
A EF implementa a dupla validação obrigatória: verifica `recursos_config` da conta
(c33/c35/c36) E `ai_settings.ai_enabled` antes de qualquer chamada ao provider.
Se qualquer flag estiver desligada, retorna `{ skipped: true }` sem custo.

#### Critérios de aceite

- [ ] Endpoint: `POST /functions/v1/zapi-ai-analyze-chat` com body `{chat_id, account_id}`.
- [ ] Valida JWT; 401 se ausente. Valida `chat_id` pertence ao `account_id`; 403 se não.
- [ ] Lê `zapi_accounts.recursos_config` da conta; verifica pelo menos um de c33/c35/c36
      está habilitado. Se nenhum habilitado: `{ skipped: true, reason: "features_disabled" }`.
- [ ] Lê `ai_settings`; verifica `ai_enabled = true` e `api_key` presente. Se não:
      `{ skipped: true, reason: "ai_not_configured" }`.
- [ ] Busca últimas 50 mensagens de texto de `zapi_messages` do chat (excluindo media pura).
- [ ] Monta prompt incluindo apenas os campos solicitados pelas flags ativas (se só c33
      habilitado, pede só resumo; se c33+c35+c36, pede os três).
- [ ] Chama o provider configurado (Anthropic/OpenAI/Google) com o modelo de `ai_settings`.
- [ ] Persiste resultados em `zapi_chats`: atualiza `ai_summary`, `ai_intent`, `ai_sentiment`,
      `ai_analyzed_at` conforme flags habilitadas.
- [ ] Retorna `{ summary?, intent?, sentiment?, analyzed_at }`.
- [ ] Em caso de erro do provider (rate limit, timeout): retorna 200 com `{ error: "provider_error", message }` — não quebra a UI.
- [ ] Registra evento `'ai_analysis'` em `zapi_audit_log`.

#### Hints técnicos (não-prescritivos)

- **Route**: `supabase/functions/zapi-ai-analyze-chat/index.ts`
- **Padrão de autenticação**: mesmo padrão de `zapi-chat-update` (Bearer JWT + service_role
  para leitura de `ai_settings` e update de `zapi_chats`)
- **Prompt engineering**: retornar JSON com schema fixo —
  `{ "resumo": "...", "intencao": "...", "sentimento": "positivo|neutro|negativo|urgente" }`.
  Usar `response_format: { type: "json_object" }` no OpenAI; `<json>` tag no Anthropic.
- **Anthropic**: `POST https://api.anthropic.com/v1/messages` com `x-api-key` header
- **OpenAI**: `POST https://api.openai.com/v1/chat/completions`
- **Google**: `POST https://generativelanguage.googleapis.com/v1/models/{model}:generateContent`

#### Test cases

- **Happy path**: chat com 10 mensagens, flags c33+c35+c36 on, ai_enabled on → retorna
  summary + intent + sentiment, persiste nas colunas
- **Edge — flags off**: todos os flags off → retorna `{ skipped: true }` sem chamar provider
- **Edge — ai_enabled off**: flags on mas `ai_settings.ai_enabled = false` → skipped
- **Edge — conversa vazia**: 0 mensagens → retorna `{ skipped: true, reason: "no_messages" }`
- **Edge — provider error**: provider retorna 429 → EF retorna 200 com `{ error: "provider_error" }`
- **Edge — chat de outra conta**: request com `chat_id` de outro `account_id` → 403

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: chamada com flags ligadas retorna JSON válido e persiste; com flags desligadas retorna skipped
- [ ] Security auditou (EF service_role + chave de IA no banco + IDOR check)
- [ ] Pentest auditou (superfície crítica: EF com service_role, acesso à chave de API)
- [ ] QA aprovou

#### Out of scope

- Análise de mídia/imagens (só texto nesta task)
- Histórico de análises anteriores (sobrescreve)
- Cache de resultados além da coluna `ai_analyzed_at`

---

### T80 — UI: seção AISummarySection no ContactPanel (C33 + C35 + C36)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T79
**WSJF score:** (8 + 5 + 6) / 5 = 3,8

#### User story

Como atendente do gabinete, quero ver no painel da conversa o resumo, a classificação
de assunto e o sentimento do eleitor gerados por IA, para que eu possa entender o
contexto rapidamente ao retomar ou transferir o atendimento.

#### Contexto

Componente modular `AISummarySection` seguindo o padrão das outras seções do `ContactPanel`
(`ContactFunnelSection`, `ChatNotesSection`, etc.). Renderiza somente quando pelo menos
um dos flags c33/c35/c36 está habilitado na conta. Chama `zapi-ai-analyze-chat` de forma
lazy ao abrir a conversa (se `ai_analyzed_at` é null ou stale > 1h).

#### Critérios de aceite

- [ ] `AISummarySection` só renderiza quando `isFeatureEnabled(config, 'c33') ||
      isFeatureEnabled(config, 'c35') || isFeatureEnabled(config, 'c36')`.
- [ ] Ao montar (ou ao receber `chat` com `ai_analyzed_at` null/stale), dispara chamada
      à EF `zapi-ai-analyze-chat` com loading spinner discreto.
- [ ] Exibe resumo (c33), classificação de assunto como badge/chip (c35), sentimento como
      badge colorido — positivo=verde, neutro=cinza, negativo=vermelho, urgente=âmbar (c36).
- [ ] Badge de sentimento "urgente" é destacado visualmente (âmbar com ícone).
- [ ] Botão "Reanalisar" força nova chamada à EF independente de `ai_analyzed_at`.
- [ ] Se `skipped: true` (IA não configurada), exibe mensagem "Configure a IA nas
      Configurações para usar este recurso" com link para `/settings`.
- [ ] Se provider error, exibe erro inline sem quebrar o restante do `ContactPanel`.
- [ ] `ai_analyzed_at` exibido em tooltip ("Analisado há X min").
- [ ] Quando c36 (sentimento urgente) está ativo e o sentimento é "urgente", o `ChatListItem`
      exibe badge vermelho/âmbar na lista de conversas.

#### Hints técnicos (não-prescritivos)

- **Component**: `src/components/whatsapp/AISummarySection.tsx`
- **Hook**: `useAIAnalyzeChat(chatId, accountId)` em `src/hooks/useAIAnalyzeChat.ts` —
  wraper da mutação que chama a EF + invalidate `zapi-chats` após successo
- **Padrão**: seguir estrutura de `ChatTagsSection` ou `DemandLinkSection` para o layout
  de seção colapsável no `ContactPanel`
- **`ChatListItem`**: adicionar badge de sentimento urgente quando `chat.ai_sentiment === 'urgente'`

#### Test cases

- **Happy path**: abre conversa, seção carrega spinner, exibe resumo + badges
- **Edge — flags off**: seção não renderiza, sem chamada à EF
- **Edge — IA não configurada**: exibe estado "Configure a IA"
- **Edge — sentimento urgente**: badge âmbar aparece no `ChatListItem`
- **Edge — reanalisar**: botão força nova análise mesmo com `ai_analyzed_at` recente

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual descrito no comentário do QG
- [ ] QA aprovou

#### Out of scope

- Histórico de análises anteriores
- Edição manual do resumo/classificação pelo operador

---

### T81 — Edge Function zapi-ai-suggest-reply (C34)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route
**Depende de:** T78
**WSJF score:** (9 + 7 + 7) / 5 = 4,6
**[Security + Pentest obrigatorio — EF com service_role + provider de IA]**

#### User story

Como atendente do gabinete, quero receber uma sugestão de resposta gerada por IA com
base nas últimas mensagens da conversa, para que eu possa responder mais rápido ao
eleitor sem precisar começar o texto do zero.

#### Contexto

EF efêmera — não persiste resultado no banco. Gerada on-demand quando o operador clica
em "Sugerir resposta" no compositor. Contexto enviado ao LLM inclui as últimas mensagens
e o perfil do eleitor (nome, etapa do funil se disponível). A sugestão respeita o tom
político (objetivo e respeitoso). A dupla validação do flag c34 + ai_enabled é obrigatória.

#### Critérios de aceite

- [ ] Endpoint: `POST /functions/v1/zapi-ai-suggest-reply` com body `{chat_id, account_id}`.
- [ ] Valida JWT; 401 se ausente. Verifica `chat_id` pertence ao `account_id`; 403 se não.
- [ ] Verifica `isFeatureEnabled(config, 'c34')` na conta. Se não: `{ skipped: true }`.
- [ ] Verifica `ai_settings.ai_enabled = true` e `api_key` presente. Se não: `{ skipped: true }`.
- [ ] Busca últimas 20 mensagens do chat + nome do contato (via `contact_id → contacts.nome`).
- [ ] Prompt instrui o LLM a gerar 1 sugestão de resposta curta (1-3 frases), em português,
      tom cordial e objetivo, como assessor parlamentar responderia.
- [ ] Retorna `{ suggestion: string }`.
- [ ] Não persiste nada no banco.
- [ ] Em erro do provider: retorna `{ error: "provider_error" }` sem quebrar.

#### Hints técnicos (não-prescritivos)

- **Route**: `supabase/functions/zapi-ai-suggest-reply/index.ts`
- **Padrão**: mesmo padrão de autenticação e verificação dupla de T79
- **Prompt**: incluir instrução de contexto político (gabinete parlamentar) para evitar
  sugestões genéricas ou inadequadas

#### Test cases

- **Happy path**: chat com mensagens, flag c34 on → retorna suggestion string não-vazia
- **Edge — flag off**: c34 off → `{ skipped: true }`, zero chamada ao provider
- **Edge — conversa sem texto**: só mídia → retorna suggestion genérica ou skipped
- **Edge — provider lento**: timeout após 10s → retorna erro gracioso

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: chamada com flag on retorna suggestion; com flag off retorna skipped
- [ ] Security auditou
- [ ] Pentest auditou
- [ ] QA aprovou

#### Out of scope

- Múltiplas sugestões (só 1 por chamada)
- Sugestão baseada em respostas rápidas existentes (C11 — Fase 5)
- Persistência da sugestão no banco

---

### T82 — UI: sugestão de resposta IA no compositor (C34)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T81
**WSJF score:** (9 + 6 + 6) / 5 = 4,2

#### User story

Como atendente do gabinete, quero ver a sugestão de resposta da IA diretamente no
campo de texto onde escrevo, para que eu possa editá-la e enviá-la sem mudar de
área da tela.

#### Contexto

A sugestão aparece no compositor de mensagens de `ConversasTabContent` como um texto
rascunho com badge "Sugestão IA" e botão para descartá-la. O operador pode editar
livremente antes de enviar. O botão de acionamento fica no toolbar do compositor (ao
lado do emoji/anexo), visível só quando c34 está habilitado na conta.

#### Critérios de aceite

- [ ] Botão "Sugestão IA" (ícone `Sparkles`) no toolbar do compositor, visível somente
      quando `isFeatureEnabled(config, 'c34')` é true para a conta selecionada.
- [ ] Ao clicar, exibe spinner inline (não bloqueia o resto da UI).
- [ ] Ao receber sugestão, preenche o `textarea` do compositor com o texto sugerido +
      exibe badge "Sugestão IA" no canto superior do textarea.
- [ ] Badge tem botão X que limpa o rascunho e o badge.
- [ ] O texto sugerido é editável normalmente (não é somente leitura).
- [ ] Se `skipped: true` ou erro: exibe toast informativo ("IA não disponível neste momento").
- [ ] Botão fica desabilitado durante loading para evitar duplo clique.
- [ ] Não interfere com rascunho persistente (`useDraftPersistence`) — sugestão NÃO é
      salva como rascunho no localStorage.

#### Hints técnicos (não-prescritivos)

- **Component**: adicionar botão no toolbar dentro de `ConversasTabContent.tsx` (área do compositor)
- **Hook**: `useAISuggestReply(chatId, accountId)` — wraper da mutation que chama a EF
- **Padrão**: seguir padrão do botão de localização/poll no toolbar (icon button com tooltip)
- **Feature gate**: `useAccountFeatures(selectedAccountId)` já disponível no componente

#### Test cases

- **Happy path**: clica Sugestão IA → spinner → textarea preenchido com badge
- **Edge — flag off**: botão não aparece na UI
- **Edge — descarta**: clica X no badge → textarea limpa
- **Edge — edita**: edita o texto sugerido e envia normalmente
- **Edge — erro provider**: toast de erro, textarea não muda

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual descrito no comentário do QG
- [ ] QA aprovou

#### Out of scope

- Sugestão automática sem clique (proativa) — risco de custo descontrolado
- Histórico de sugestões anteriores

---

### T83 — Edge Function zapi-transcribe-audio (C38)

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route
**Depende de:** T78
**WSJF score:** (8 + 6 + 8) / 8 = 2,75
**[Security + Pentest obrigatorio — EF com service_role, download de mídia + provider IA]**

#### User story

Como atendente do gabinete, quero ler a transcrição de mensagens de voz recebidas
pelo WhatsApp, para que eu possa entender o pedido do eleitor sem precisar ouvir
o áudio em locais públicos ou com equipamento inadequado.

#### Contexto

Mensagens de áudio ficam armazenadas com `media_type = 'audio'` e `media_url` em
`zapi_messages`. A EF baixa o arquivo de áudio, envia ao provider de IA para
transcrição e persiste o texto na coluna `transcription` (criada em T78). A chamada
é lazy: acionada pelo frontend ao abrir a conversa se houver áudios sem transcrição
(evita custo em conversas nunca abertas).

#### Critérios de aceite

- [ ] Endpoint: `POST /functions/v1/zapi-transcribe-audio` com body
      `{message_id, account_id}`.
- [ ] Valida JWT; 401 se ausente. Verifica `message_id` pertence ao `account_id`; 403 se não.
- [ ] Verifica `isFeatureEnabled(config, 'c38')` na conta. Se não: `{ skipped: true }`.
- [ ] Verifica `ai_settings.ai_enabled = true` e `api_key` presente.
- [ ] Verifica que a mensagem tem `media_type = 'audio'` e `media_url` não-nula; 422 caso contrário.
- [ ] Se `transcription IS NOT NULL` na mensagem, retorna o texto já existente sem nova chamada.
- [ ] Baixa o arquivo de áudio via `fetch(media_url)` (URL pública da Z-API).
- [ ] Para provider `openai`: envia para `POST /v1/audio/transcriptions` (Whisper) com
      `model: 'whisper-1'`, `language: 'pt'`.
- [ ] Para provider `anthropic` ou `google`: usa API multimodal com base64 do arquivo.
- [ ] Persiste texto em `zapi_messages.transcription` e `transcribed_at = now()`.
- [ ] Retorna `{ transcription: string, message_id }`.
- [ ] Em erro de download ou provider: retorna `{ error }`, não persiste nada.
- [ ] Timeout máximo: 30s (áudios longos podem demorar).

#### Hints técnicos (não-prescritivos)

- **Route**: `supabase/functions/zapi-transcribe-audio/index.ts`
- **OpenAI Whisper**: `POST https://api.openai.com/v1/audio/transcriptions` com `multipart/form-data`
- **Anthropic multimodal**: `POST /v1/messages` com `content: [{ type: "document", source: { type: "base64", media_type: "audio/ogg", data: "..." } }]`
- **Google Gemini**: `POST .../models/{model}:generateContent` com `inlineData`
- **Atenção**: Deno Edge Functions têm limite de memória — áudios muito grandes podem
  precisar de streaming. Fullstack avalia se necessário.

#### Test cases

- **Happy path**: áudio de 30s com fala clara → retorna transcrição correta em português
- **Edge — flag off**: c38 off → `{ skipped: true }`
- **Edge — já transcrito**: `transcription IS NOT NULL` → retorna sem nova chamada ao provider
- **Edge — não é áudio**: `media_type != 'audio'` → 422
- **Edge — áudio indisponível**: URL expirada → `{ error: "audio_download_failed" }`
- **Edge — IDOR**: `message_id` de outra conta → 403

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: enviar áudio no WhatsApp, chamar EF, verificar coluna preenchida
- [ ] Security auditou (download de URL externa + armazenamento de dado sensível)
- [ ] Pentest auditou
- [ ] QA aprovou

#### Out of scope

- Transcrição automática no webhook (para evitar custo em todas as mensagens)
- Tradução do áudio transcrito
- Transcrição de vídeos

---

### T84 — UI: exibir transcrição de áudio em MessageBubble (C38)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, component
**Depende de:** T83
**WSJF score:** (8 + 5 + 5) / 2 = 9,0

#### User story

Como atendente do gabinete, quero ver o texto transcrito abaixo de cada mensagem
de áudio na conversa, para que eu possa ler o conteúdo sem precisar reproduzir o áudio.

#### Contexto

`MessageBubble` já renderiza mensagens de áudio com um player. Esta task adiciona,
abaixo do player, o texto de transcrição quando disponível e um botão "Transcrever"
quando a mensagem ainda não foi transcrita (e c38 está habilitado na conta).

#### Critérios de aceite

- [ ] `MessageBubble` exibe `transcription` abaixo do player de áudio quando a mensagem
      tem `media_type = 'audio'` e `transcription IS NOT NULL`.
- [ ] Texto exibido em fonte menor, cor secundária, com ícone `FileText` ou similar.
- [ ] Botão "Transcrever" visível quando `media_type = 'audio'`, `transcription IS NULL`
      e `isFeatureEnabled(config, 'c38')`.
- [ ] Clicar em "Transcrever" chama `zapi-transcribe-audio` para aquela mensagem específica.
- [ ] Após transcrição: texto aparece sem recarregar a página (invalidate da query de mensagens).
- [ ] Botão some após transcrição bem-sucedida.
- [ ] Se erro: toast "Não foi possível transcrever o áudio".
- [ ] Ao abrir a conversa: se há mensagens de áudio sem transcrição e c38 habilitado,
      exibe badge no header da conversa "X áudios sem transcrição" com botão "Transcrever todos".

#### Hints técnicos (não-prescritivos)

- **Component**: `src/components/whatsapp/MessageBubble.tsx` — adicionar seção de transcrição
- **Hook**: `useTranscribeAudio(messageId, accountId)` — mutation que chama a EF +
  `invalidateQueries(['zapi-messages', chatId])`
- **`ConversasTabContent`**: adicionar lógica de detecção de áudios não-transcritos para badge

#### Test cases

- **Happy path**: mensagem de áudio com transcrição → texto exibido abaixo do player
- **Edge — sem transcrição, c38 on**: botão "Transcrever" visível
- **Edge — sem transcrição, c38 off**: botão não aparece
- **Edge — batch**: "Transcrever todos" dispara múltiplas chamadas em série (não paralelo para evitar rate limit)

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual descrito no comentário do QG
- [ ] QA aprovou

#### Out of scope

- Transcrição de vídeo
- Download da transcrição como arquivo
- Edição manual da transcrição

---

### T85 — Edge Function zapi-ai-next-action (C37)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** route
**Depende de:** T78
**WSJF score:** (7 + 4 + 6) / 5 = 3,4
**[Security + Pentest obrigatorio — EF com service_role + provider IA]**

#### User story

Como coordenador do gabinete, quero receber uma sugestão de próxima ação para cada
contato com base no histórico de interações e etapa do funil, para que a equipe saiba
o que fazer a seguir sem precisar revisar todo o histórico manualmente.

#### Contexto

O next-best-action analisa o contexto completo do contato (funil, demandas abertas,
última mensagem recebida, tempo sem interação) e sugere uma ação concreta. Persiste
em `contacts.ai_next_action` (criado em T78). É diferente de `AISummarySection` pois
é por contato, não por conversa, e pode ser usada também fora do WhatsApp (no card do
contato no CRM). Respeita flag c37 da conta associada ao chat.

#### Critérios de aceite

- [ ] Endpoint: `POST /functions/v1/zapi-ai-next-action` com body `{contact_id, account_id}`.
- [ ] Valida JWT; 401 se ausente. Verifica `contact_id` existe e pertence ao tenant; 403 se não.
- [ ] Verifica `isFeatureEnabled(config, 'c37')` na conta. Se não: `{ skipped: true }`.
- [ ] Verifica `ai_settings.ai_enabled = true` e `api_key` presente.
- [ ] Coleta contexto: nome do contato, etapa do funil atual (via `board_items`), demandas
      abertas (via `demands`), última mensagem recebida, dias desde última interação.
- [ ] Gera sugestão curta (1-2 frases) — ex: "Retomar contato: última interação há 15 dias,
      demanda de pavimentação ainda aberta".
- [ ] Persiste em `contacts.ai_next_action` e `ai_next_action_at`.
- [ ] Retorna `{ next_action: string, contact_id }`.

#### Hints técnicos (não-prescritivos)

- **Route**: `supabase/functions/zapi-ai-next-action/index.ts`
- **Padrão**: mesmo padrão de dupla validação de T79/T81

#### Test cases

- **Happy path**: contato com demanda aberta + 10 dias sem resposta → retorna sugestão de follow-up
- **Edge — flag off**: c37 off → `{ skipped: true }`
- **Edge — contato novo, sem histórico**: retorna sugestão genérica de boas-vindas
- **Edge — IDOR**: `contact_id` de outro tenant → 403

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: chamar EF com contato existente, verificar coluna preenchida
- [ ] Security auditou
- [ ] Pentest auditou
- [ ] QA aprovou

#### Out of scope

- Análise preditiva de evasão (C analise_risco de `ai_settings` — escopo de demandas, não WhatsApp)
- Sugestão baseada em calendário/agenda

---

### T86 — UI: AIInsightsSection no ContactPanel (C37)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, component
**Depende de:** T85
**WSJF score:** (7 + 4 + 5) / 2 = 8,0

#### User story

Como atendente do gabinete, quero ver a sugestão de próxima ação para o contato
diretamente no painel lateral da conversa, para que eu possa agir sobre ela sem
precisar abrir o CRM de contatos separado.

#### Contexto

Seção modular `AIInsightsSection` no `ContactPanel`, exibida abaixo de `AISummarySection`
(T80) quando c37 está habilitado. Reutiliza o hook `useAINextAction` que chama a EF
e invalida a query de contato após sucesso.

#### Critérios de aceite

- [ ] `AIInsightsSection` só renderiza quando `isFeatureEnabled(config, 'c37')`.
- [ ] Exibe `contacts.ai_next_action` com ícone `Lightbulb` e label "Próxima ação sugerida".
- [ ] Se `ai_next_action IS NULL` ou `ai_next_action_at` stale (> 24h): dispara chamada
      à EF ao montar (lazy, com spinner).
- [ ] Botão "Reanalisar" força nova chamada.
- [ ] Exibe `ai_next_action_at` em tooltip ("Sugestão gerada há X horas").
- [ ] Se IA não configurada: estado vazio com link para Configurações.

#### Hints técnicos (não-prescritivos)

- **Component**: `src/components/whatsapp/AIInsightsSection.tsx`
- **Hook**: `useAINextAction(contactId, accountId)` — mutation + invalidate `['contact', contactId]`
- **Padrão**: seguir estrutura de `AISummarySection` (T80)

#### Test cases

- **Happy path**: abre conversa com contato vinculado, c37 on → seção carrega e exibe sugestão
- **Edge — flag off**: seção não renderiza
- **Edge — contato não vinculado**: ContactPanel sem `contact_id` → seção não renderiza (sem contato para analisar)

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual descrito no comentário do QG
- [ ] QA aprovou

#### Out of scope

- Exibição do next-action no `ContactCard` (fora do WhatsApp) — tarefa futura

---

### T87 — UI: visão consolidada multi-instância (C26)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T77 (Fase 6 completa)
**WSJF score:** (8 + 5 + 4) / 5 = 3,4

#### User story

Como coordenador do gabinete, quero ver as conversas de todos os números WhatsApp
em uma única lista unificada, para que eu possa monitorar todos os atendimentos sem
precisar alternar entre contas manualmente.

#### Contexto

`ConversasTabContent` já tem seletor de conta (`selectedAccountId`). Adicionar opção
"Todos os números" que usa `useAllZapiChats()` — query sem filtro de `account_id`.
Cada item da lista em modo consolidado mostra um badge com o nome da conta para
identificação visual. Enviar mensagem usa o `account_id` do chat específico (transparente).
Sem migration nova — só lógica de query e UI.

#### Critérios de aceite

- [ ] Seletor de conta exibe opção "Todos os números" como primeiro item (valor `'__all__'`).
- [ ] Ao selecionar "Todos os números", `useAllZapiChats()` busca chats de todas as contas
      ativas do usuário sem filtro de `account_id`.
- [ ] `ChatListItem` em modo consolidado exibe badge com `account.name` da conta associada
      ao chat (cor discreta, tamanho pequeno).
- [ ] Filtros de status, busca e "só minhas" continuam funcionando em modo consolidado.
- [ ] Selecionar um chat em modo consolidado abre a conversa usando o `account_id` correto
      para envio (transparente para o usuário).
- [ ] `isFeatureEnabled` e features de conta usam o `account_id` do chat selecionado
      (não de "todos").
- [ ] `ContasTabContent` exibe badge "Multi-número ativo" quando o usuário tem 2+ contas.
- [ ] `useAllZapiChats` inclui `account_name` via JOIN com `zapi_accounts`.

#### Hints técnicos (não-prescritivos)

- **Hook**: `useAllZapiChats()` em `src/hooks/useZapiChats.ts` — query sem `.eq('account_id', ...)`
  + `select('*, zapi_accounts(name), contacts:contact_id(...)')
- **Component**: modificar `ConversasTabContent.tsx` para aceitar `selectedAccountId = '__all__'`
  e usar hook correto
- **Realtime**: em modo `__all__`, subscrever `zapi_chats` sem filtro de `account_id` (atenção
  ao volume de eventos — potencialmente mais alto)
- **Padrão existente**: seletor já usa shadcn `Select`; adicionar item no topo

#### Test cases

- **Happy path**: 2 contas com chats → "Todos os números" lista chats de ambas com badge de conta
- **Edge — 1 conta**: opção "Todos os números" aparece mas é equivalente ao filtro normal
- **Edge — envio em modo consolidado**: mensagem enviada usa account correto, não mistura
- **Edge — realtime**: nova mensagem em qualquer conta aparece na lista consolidada
- **Edge — filtro "só minhas"**: mostra só chats atribuídos ao usuário logado em todas as contas

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: alternar entre conta específica e "Todos os números", verificar badges
- [ ] QA aprovou

#### Out of scope

- Permissão granular por conta (usuário vê só contas que tem acesso) — RBAC futuro
- Notificação agregada por conta no header

---

### T88 — Migration: view v_dashboard_atendimento + tabela zapi_audit_log

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** model
**Depende de:** T78
**WSJF score:** (7 + 5 + 7) / 5 = 3,8
**[Security obrigatorio — nova tabela com dados de atendimento + RLS]**

> **Nota:** Esta task está parcialmente coberta por T78 (migration `081`). Se T78 já foi
> implementada com a view e a tabela, esta task cobre apenas o refinamento: ajuste da view
> após análise de performance + trigger em `zapi-chat-update` para popular `zapi_audit_log`.

#### User story

Como coordenador do gabinete, quero uma fonte de dados estruturada para o dashboard de
atendimento e para o histórico de auditoria, para que eu possa acompanhar a produtividade
da equipe e auditar mudanças em conversas.

#### Critérios de aceite

- [ ] VIEW `v_dashboard_atendimento` retorna (por `account_id`):
      - `conversas_abertas INT` (status != 'finalizada')
      - `conversas_finalizadas_hoje INT`
      - `conversas_por_atendente JSONB` (array `{assigned_to, nome, count}`)
      - `tempo_medio_resposta_min NUMERIC` (estimado pela diferença `sent_at` entre
        mensagens received → próxima sent no mesmo chat)
- [ ] Tabela `zapi_audit_log` populada automaticamente por `zapi-chat-update` quando
      há mudança em `status`, `assigned_to`, ou `archived`. Campos: `event_type`
      (`'status_change'`, `'assignment'`, `'archive'`, `'finalization'`), `old_value`,
      `new_value`, `actor_id`, `chat_id`, `account_id`.
- [ ] RLS `zapi_audit_log`: SELECT para admins e o próprio `actor_id`; INSERT somente
      service_role; sem UPDATE/DELETE.
- [ ] INDEX em `zapi_audit_log(account_id, created_at DESC)` para queries do dashboard.

#### Hints técnicos (não-prescritivos)

- **Model**: refinamento de `081_dashboard_audit.sql` ou nova migration `082_audit_trigger.sql`
- **EF `zapi-chat-update`**: adicionar INSERT em `zapi_audit_log` ao final de cada mutação
  bem-sucedida (dentro da mesma transação service_role)

#### Test cases

- **Happy path**: mudar status de conversa → linha nova em `zapi_audit_log` com `event_type='status_change'`
- **Edge — RLS**: usuário não-admin não consegue DELETE em `zapi_audit_log`
- **Edge — view com 0 conversas**: retorna rows com contagens zeradas, não 0 linhas
- **Edge — tempo médio**: conversa sem mensagens enviadas → `tempo_medio_resposta_min = NULL`

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: `SELECT * FROM v_dashboard_atendimento WHERE account_id = '...'`
- [ ] Security revisou RLS
- [ ] QA aprovou

#### Out of scope

- Alertas automáticos por SLA (já cobre T27/C28 da Fase 3)
- Exportação de auditoria como CSV

---

### T89 — Hooks useDashboardAtendimento + useAuditLog

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook
**Depende de:** T88
**WSJF score:** (7 + 5 + 5) / 2 = 8,5

#### User story

Como componente de dashboard, preciso de hooks tipados que exponham os dados de
atendimento e auditoria, para que a UI não faça queries SQL diretas e respeite o
padrão do projeto.

#### Critérios de aceite

- [ ] `useDashboardAtendimento(accountId: string | '__all__')` em
      `src/hooks/useDashboardAtendimento.ts`: query de `v_dashboard_atendimento` via
      RPC ou `select` da view; retorna `{ conversas_abertas, conversas_finalizadas_hoje,
      conversas_por_atendente, tempo_medio_resposta_min }`. Quando `'__all__'`, busca
      para todas as contas do usuário e agrega no client.
- [ ] `useAuditLog({ accountId, chatId?, limit? })` em `src/hooks/useAuditLog.ts`:
      query paginada de `zapi_audit_log` ordenada por `created_at DESC`. Inclui
      `actor_profile: { nome }` via join com `profiles`.
- [ ] Ambos os hooks seguem o padrão `useQuery` do react-query v5 com `queryKey` factory.
- [ ] `useDashboardAtendimento` tem `refetchInterval: 60_000` (atualiza a cada minuto).

#### Hints técnicos (não-prescritivos)

- **Hook**: `src/hooks/useDashboardAtendimento.ts`, `src/hooks/useAuditLog.ts`
- **Padrão**: seguir estrutura de `useZapiBroadcasts` (query factory + tipagem explícita)
- **`__all__`**: fazer N queries (uma por conta) e agregar somas no client, ou usar
  query sem filtro se RLS permitir — Fullstack decide

#### Test cases

- **Happy path**: `useDashboardAtendimento('account-id')` retorna dados corretos
- **Edge — sem conversas**: retorna zeros sem erro
- **Edge — audit sem permissão**: usuário não-admin tentando acessar audit de outro → RLS bloqueia

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: hooks retornam dados em dev
- [ ] QA aprovou

#### Out of scope

- Exportação como CSV (tarefa futura)
- Métricas por tag de conversa

---

### T90 — UI: DashboardAtendimentoPage (rota /whatsapp/dashboard)

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** component
**Depende de:** T89
**WSJF score:** (8 + 5 + 4) / 8 = 2,1

#### User story

Como coordenador do gabinete, quero uma tela dedicada com métricas de atendimento
(conversas abertas, tempo médio de resposta, produtividade por atendente), para que
eu possa gerenciar a equipe com dados em vez de intuição.

#### Contexto

Nova rota `/whatsapp/dashboard`. A aba WhatsApp ganha um sub-tab "Dashboard" ao lado
de "Conversas / Contas / Logs / Webhooks". A tela é simples — cards de KPI e uma
tabela de atendentes. Não precisa de gráficos sofisticados nesta entrega (só cards e
tabela). Usa `recharts` apenas se houver tempo.

#### Critérios de aceite

- [ ] Sub-tab "Dashboard" adicionado na aba WhatsApp (ao lado dos existentes).
- [ ] Seletor de conta no topo (inclui opção "Todos os números").
- [ ] Card "Conversas abertas": número total de conversas com status != 'finalizada'.
- [ ] Card "Finalizadas hoje": conversas finalizadas nas últimas 24h.
- [ ] Card "Tempo médio de resposta": em minutos/horas, com formatação amigável.
- [ ] Tabela "Por atendente": nome, avatar, nº de conversas atribuídas, botão "Ver conversas"
      que navega para `/whatsapp?atendente=<id>` com filtro pré-aplicado.
- [ ] Auto-refresh a cada 60s (via `refetchInterval` do hook).
- [ ] Loading skeleton enquanto carrega.
- [ ] Estado vazio com mensagem amigável quando não há dados.
- [ ] Responsivo: em mobile, cards empilham verticalmente.

#### Hints técnicos (não-prescritivos)

- **Component**: `src/pages/WhatsappDashboardPage.tsx` ou aba dentro de `WhatsappPage.tsx`
- **shadcn**: `Card`, `Table`, `Skeleton`, `Badge` — sem dependências novas
- **recharts**: opcional — só adicionar gráfico de linha temporal se não atrasar a entrega

#### Test cases

- **Happy path**: 2 atendentes, 10 conversas abertas → cards exibem números corretos
- **Edge — sem dados**: estado vazio amigável, sem erro
- **Edge — mobile**: cards empilham, tabela rola horizontalmente
- **Edge — refresh**: após 60s, dados atualizam automaticamente

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual descrito no comentário do QG
- [ ] QA aprovou

#### Out of scope

- Gráficos históricos (line chart por dia)
- Exportação do relatório como PDF/XLSX
- Alerta por e-mail quando SLA é ultrapassado

---

### T91 — UI: AuditLogPage (rota /whatsapp/auditoria)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** component
**Depende de:** T89
**WSJF score:** (6 + 4 + 5) / 5 = 3,0

#### User story

Como coordenador do gabinete, quero ver o histórico completo de ações realizadas em
cada conversa (mudanças de status, atribuições, finalizações), para que eu possa
auditar o trabalho da equipe e resolver disputas.

#### Contexto

Sub-tab "Auditoria" na aba WhatsApp, visível apenas para admins (usa `usePermissions`
ou `useUserRole`). Lista paginada de eventos de `zapi_audit_log` com filtros por conta,
tipo de evento e período.

#### Critérios de aceite

- [ ] Sub-tab "Auditoria" visível somente para admins (`isAdmin === true`).
- [ ] Lista paginada (20 por página) de eventos, ordenados por `created_at DESC`.
- [ ] Cada linha exibe: data/hora, tipo de evento (badge colorido), ator (nome do atendente),
      conversa (phone formatado + link para abrir a conversa), valor anterior → valor novo.
- [ ] Filtro por conta (seletor), por tipo de evento (dropdown multi-select), por período
      (date range picker com `date-fns`).
- [ ] Busca por telefone ou nome do atendente.
- [ ] Botão "Exportar CSV" gera arquivo com os eventos filtrados (client-side com dados
      já carregados — não uma query nova).
- [ ] Sem delete/edit — auditoria é imutável.

#### Hints técnicos (não-prescritivos)

- **Component**: `src/pages/WhatsappAuditPage.tsx` ou aba dentro de `WhatsappPage.tsx`
- **shadcn**: `Table`, `Badge`, `Select`, `DateRangePicker` (verificar se existe no projeto
  ou usar 2 `Input type=date`)
- **Exportação**: `papaparse` ou construção manual de CSV string + `URL.createObjectURL`

#### Test cases

- **Happy path**: 50 eventos → lista pagina corretamente, filtro funciona
- **Edge — não-admin**: tab não aparece na UI
- **Edge — sem eventos**: estado vazio amigável
- **Edge — exportação**: clicar "Exportar CSV" → download imediato com dados corretos

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual descrito no comentário do QG
- [ ] QA aprovou

#### Out of scope

- Exportação como PDF
- Alertas em tempo real de eventos suspeitos (segurança avançada)

---

### T92 — Estender AISettingsTab com features de IA para WhatsApp (C33-C38)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, component
**Depende de:** T78
**WSJF score:** (7 + 6 + 5) / 2 = 9,0

#### User story

Como administrador do gabinete, quero configurar quais recursos de IA do WhatsApp estão
ativos (resumo, sugestão, classificação, sentimento, next-action, transcrição), para que
eu possa controlar o custo e habilitar só o que a equipe usa.

#### Contexto

`AISettingsTab` já tem o sistema de features (`AIFeatures` interface) com 3 features de
demandas. Esta task ESTENDE essa interface para incluir as 6 features de WhatsApp (c33-c38).
Importante: features de WhatsApp são GLOBAIS (em `ai_settings.features`) — são diferentes
do gating por conta (`recursos_config`). O fluxo é: (1) admin habilita o recurso
globalmente em `AISettingsTab` e (2) cada conta liga/desliga o recurso em `AccountFormDialog`.
Ambas as verificações devem passar para IA funcionar.

#### Critérios de aceite

- [ ] Interface `AIFeatures` em `useAISettings.ts` estendida com:
      `resumo_conversa: boolean`, `sugestao_resposta: boolean`, `classificacao_assunto: boolean`,
      `analise_sentimento: boolean`, `next_best_action: boolean`, `transcricao_audio: boolean`.
      (Mantém as 3 existentes por retrocompatibilidade.)
- [ ] `AISettingsTab` exibe nova seção "Recursos de IA — WhatsApp" com os 6 checkboxes,
      cada um com label e descrição (ex: "Resumo da conversa — Gera resumo automático ao abrir
      uma conversa com IA").
- [ ] `DEFAULT_FEATURES` atualizado com os 6 novos campos default `false`.
- [ ] As EFs de IA (T79, T81, T83, T85) também verificam `ai_settings.features.{feature}`
      além do `recursos_config` da conta — triple gate: `ai_enabled` + `features.{x}` + `recursos_config.{cX}`.
- [ ] Toast de confirmação ao salvar com indicação dos recursos alterados.

#### Hints técnicos (não-prescritivos)

- **Hook**: `src/hooks/useAISettings.ts` — estender `AIFeatures`
- **Component**: `src/components/settings/AISettingsTab.tsx` — adicionar seção nova
- **Retrocompat**: `DEFAULT_FEATURES` deve inicializar os 6 novos campos como `false`
  para não quebrar contas existentes

#### Test cases

- **Happy path**: admin habilita "Resumo da conversa" → salva, AISummarySection passa a verificar
  `features.resumo_conversa` também
- **Edge — migração de settings existente**: conta sem os novos campos no jsonb → tratada como `false`
- **Edge — triple gate**: conta com c33 on mas `features.resumo_conversa = false` → EF retorna skipped

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: habilitar/desabilitar feature, verificar triple gate
- [ ] QA aprovou

#### Out of scope

- Permissão granular por usuário (admin configura, todos os atendentes usam)
- Limite de uso por conta (custo máximo configurável)

---

### T93 — Estado vazio "IA desabilitada" nos pontos de entrada (onboarding)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T80, T82, T84, T86
**WSJF score:** (6 + 5 + 4) / 2 = 7,5

#### User story

Como atendente do gabinete que encontra um recurso de IA desabilitado, quero ver uma
mensagem clara explicando por que o recurso não está disponível e como habilitá-lo,
para que eu não fique confuso achando que é um bug.

#### Contexto

Todos os componentes de IA (AISummarySection, sugestão no compositor, transcrição,
AIInsightsSection) precisam de estado vazio coerente quando a IA não está configurada
ou o recurso está desabilitado. Esta task padroniza esses estados.

#### Critérios de aceite

- [ ] Componente `AIDisabledState` centralizado com 3 variantes:
      1. `"not_configured"`: "IA não configurada. [Configure nas Configurações]" — link para `/settings#ai`
      2. `"feature_disabled_account"`: "Este recurso está desativado nesta conta. [Ativar em Configurações de Conta]"
      3. `"feature_disabled_global"`: "Este recurso está desativado globalmente. [Ativar em Configurações de IA]"
- [ ] `AISummarySection` usa o estado correto conforme o motivo do `skipped`.
- [ ] Sugestão de resposta no compositor: botão desabilitado com tooltip explicativo quando
      a IA não está configurada (não exibe estado vazio pois é um botão, não uma seção).
- [ ] `MessageBubble` (transcrição): botão "Transcrever" exibe tooltip "IA não configurada"
      quando `ai_settings.ai_enabled = false`.
- [ ] `AIInsightsSection` usa o estado correto.
- [ ] Todos os links dos estados vazios funcionam corretamente.

#### Hints técnicos (não-prescritivos)

- **Component**: `src/components/whatsapp/AIDisabledState.tsx`
- **Padrão**: seguir `EmptyState` de `src/components/ui-system/` para consistência visual

#### Test cases

- **Happy path**: IA configurada e habilitada → estados vazios não aparecem
- **Edge — IA não configurada**: `AIDisabledState` variant `not_configured` exibido
- **Edge — feature global off**: variant `feature_disabled_global`
- **Edge — feature conta off**: variant `feature_disabled_account`

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: testar com ai_enabled=false, verificar estados
- [ ] QA aprovou

#### Out of scope

- Tutorial interativo de configuração
- E-mail de notificação ao admin quando recurso é desabilitado

---

### T94 — Testes de gating de IA (sem chamada quando flag desligada)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** test, route
**Depende de:** T79, T81, T83, T85, T92
**WSJF score:** (8 + 7 + 9) / 5 = 4,8

#### User story

Como desenvolvedor mantendo o projeto, quero testes automatizados que garantam que
nenhuma chamada ao provider de IA ocorre quando os flags estão desligados, para que
eu tenha confiança de que o custo de IA é zero quando esperado e não haja regressão.

#### Contexto

Testes críticos de segurança econômica. O maior risco da Fase 7 é um bug que faça
chamadas ao LLM mesmo com flags desligados. Vitest com mocks das EFs (testes de
integração dos hooks + spy nas chamadas fetch/supabase.functions.invoke).

#### Critérios de aceite

- [ ] Teste: `useAIAnalyzeChat` com `isFeatureEnabled = false` → `supabase.functions.invoke`
      NÃO é chamado.
- [ ] Teste: `useAISuggestReply` com `ai_settings.ai_enabled = false` → invoke NÃO é chamado.
- [ ] Teste: `useTranscribeAudio` com `c38 = false` → invoke NÃO é chamado.
- [ ] Teste: `useAINextAction` com `c37 = false` → invoke NÃO é chamado.
- [ ] Teste EF `zapi-ai-analyze-chat` (Deno test ou integration): com `recursos_config`
      sem c33/c35/c36 → retorna `{ skipped: true }` sem fazer `fetch` ao provider.
- [ ] Todos os testes passam em `npm run test`.

#### Hints técnicos (não-prescritivos)

- **Test**: `src/hooks/__tests__/useAIAnalyzeChat.test.ts` (e equivalentes)
- **Padrão**: seguir padrão de testes de `useZapiBroadcasts` se existir, ou padrão do
  projeto NaMi V2 (Vitest + @testing-library/react + `vi.mock`)
- **Mock**: `vi.mock('@/integrations/supabase/client', ...)` com spy em `functions.invoke`

#### Test cases

- **Happy path dos testes**: todos passam, nenhum invoke é chamado com flag off
- **Edge — regressão**: mudar acidentalmente o guard → teste quebra, detecta regressão

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] `npm run test` passa sem falhas
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] QA aprovou (revisão dos casos de teste)

#### Out of scope

- Testes de integração real com o provider (custoso, não roda em CI)
- Testes de carga das EFs

---

### T95 — Estender FEATURES_CATALOG com c26 + revisar AccountFormDialog

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** action, component
**Depende de:** T87
**WSJF score:** (6 + 4 + 4) / 2 = 7,0

#### User story

Como administrador do gabinete, quero ligar/desligar o recurso de visão consolidada
multi-instância (C26) por conta no painel de recursos, para que eu possa controlar
quais operadores têm acesso à visão unificada de todos os números.

#### Contexto

`FEATURES_CATALOG` em `featureFlags.ts` não tem entrada para `c26`. O `AccountFormDialog`
exibe os recursos do catálogo — sem `c26` no catálogo, o toggle não aparece. Esta task
adiciona `c26` ao catálogo e ao `AccountFormDialog`. Por ser só UI + dados em jsonb
existente, não precisa de migration.

#### Critérios de aceite

- [ ] `FEATURES_CATALOG` em `src/lib/featureFlags.ts` tem nova categoria `multi_instancia`
      com entrada `{ code: 'c26', label: 'Visão consolidada multi-instância' }`.
      (Ou adicionar em categoria `engajamento` — Fullstack decide o mais coerente.)
- [ ] `AccountFormDialog` aba "Recursos" exibe o toggle de c26 com descrição:
      "Permite ver conversas de todos os números em uma lista unificada."
- [ ] `ContasTabContent` exibe badge "Multi-número ativo" quando pelo menos 1 conta tem c26 habilitado.
- [ ] `ConversasTabContent`: opção "Todos os números" só aparece quando pelo menos uma conta
      tem `isFeatureEnabled(config, 'c26')` — ou quando o admin tem permissão implícita.
      (Fullstack decide: pode ser simples `accounts.length > 1` sem gate de feature.)
- [ ] Typecheck OK com `FeatureCode` atualizado.

#### Hints técnicos (não-prescritivos)

- **Action**: `src/lib/featureFlags.ts` — adicionar c26
- **Component**: `src/components/whatsapp/AccountFormDialog.tsx` — seção de recursos
- **`FeatureCode` type**: union type derivado de `FEATURES_CATALOG` — TypeScript infere
  automaticamente após adicionar c26 ao catálogo

#### Test cases

- **Happy path**: habilita c26 em conta → toggle salva, badge aparece em ContasTabContent
- **Edge — sem c26**: opção "Todos os números" não aparece (ou aparece com aviso)
- **Edge — typecheck**: `FeatureCode` inclui `'c26'` sem erro de compilação

#### Definition of Done

- [ ] Critérios de aceite ✅
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: habilitar c26, verificar opção "Todos os números" no seletor
- [ ] QA aprovou

#### Out of scope

- Controle de acesso granular por usuário para c26 (RBAC futuro)
- Analytics de uso por recurso habilitado

---

## Resumo de segurança — tasks que exigem Security + Pentest

| Task | Motivo | Nível |
|---|---|---|
| T78 | Novas tabelas com dados de atendimento + RLS + VIEW | Security |
| T79 | EF service_role + chave de IA no banco + IDOR via chat_id | Security + Pentest |
| T81 | EF service_role + chave de IA + dados de conversa | Security + Pentest |
| T83 | EF service_role + download de URL externa + chave de IA | Security + Pentest |
| T85 | EF service_role + chave de IA + dados pessoais do contato | Security + Pentest |
| T88 | Nova tabela de auditoria + RLS imutável | Security |

---

## Ordem de execução final (WSJF + dependências)

```
T78 — Schema (fundação de tudo)                               [M · 5pt · Security]
T92 — Estender AISettingsTab com features WhatsApp            [S · 2pt]
T89 — Hooks useDashboardAtendimento + useAuditLog             [S · 2pt]
T79 — EF zapi-ai-analyze-chat                                 [L · 8pt · Security+Pentest]
T81 — EF zapi-ai-suggest-reply                                [M · 5pt · Security+Pentest]
T83 — EF zapi-transcribe-audio                                [L · 8pt · Security+Pentest]
T85 — EF zapi-ai-next-action                                  [M · 5pt · Security+Pentest]
T84 — UI: transcrição em MessageBubble                        [S · 2pt]
T80 — UI: AISummarySection                                    [M · 5pt]
T82 — UI: sugestão de resposta no compositor                  [M · 5pt]
T86 — UI: AIInsightsSection                                   [S · 2pt]
T93 — Estados vazios de IA (onboarding)                       [S · 2pt]
T88 — Refinamento view dashboard + trigger auditoria          [M · 5pt · Security]
T87 — UI: visão consolidada multi-instância C26               [M · 5pt]
T95 — FEATURES_CATALOG + AccountFormDialog c26                [S · 2pt]
T90 — UI: DashboardAtendimentoPage                            [L · 8pt]
T91 — UI: AuditLogPage                                        [M · 5pt]
T94 — Testes de gating de IA                                  [M · 5pt]
```

**Total estimado: 18 tasks · ~88 pontos**

**Walking skeleton:** T78 (schema) → T79 (EF análise) → T80 (UI resumo) — entrega o primeiro
recurso de IA visível end-to-end com validação de custo zero quando flag off.
