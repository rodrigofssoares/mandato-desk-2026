# Backlog — Agente de IA Integrado ao CRM

**Cliente:** Raquel — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM075
**Branch:** `rodrigo/feature/RAQ-MAND-EM075-agente-de-ia-integrado-ao-crm-agente`
**Briefing:** `RODRIGO/2.FAZENDO/RAQ-MAND-EM075-PO-refinamento.md`
**Backlog escrito por:** Agente Backlog em 2026-05-21
**Última migration existente:** `085_webhook_logs_purge_and_cron_throttle.sql`

---

## Decisões assumidas (PO deixou em aberto)

| # | Decisão | Assumido |
|---|---|---|
| 1 | Tabela `ai_agents` separada | SIM — tabela nova, nao toca `ai_settings` |
| 2 | Limite favoritos | 500 por usuário |
| 3 | Quem edita agente | Apenas admin (proprietario vê read-only) |
| 4 | OpenRouter modelo | Lista curada de 10 modelos + campo livre "outro model ID" |
| 5 | Anexos do agente | Opcao A — só texto extraído na tabela (sem Storage binario) |
| 6 | LGPD | Opcao A — warning educativo fixo na UI |

> Sinalizar ao Rodrigo antes de T04 começar: confirmar decisão 3 (se proprietario edita ou só vê).

---

## 1. Tabela de Tasks Atomizadas

| ID | US Origem | Título Atômico | Camadas | Depende de | Estimativa | Slice | Aceite Mínimo |
|----|---|---|---|---|---|---|---|
| T01 | US-01 | Criar migration `ai_agents` + RLS + RBAC secao `agente_ia` | model | — | S | 1 | Tabela existe no Supabase; RLS bloqueia leitura de `api_key` para não-admin; secao `agente_ia` inserida em `SECOES` e `permissoes_perfil` |
| T02 | US-01 | Criar hook `useAgentSettings` (query + upsert + audit) | hook | T01 | S | 1 | Hook retorna configuracao do agente; upsert persiste; `api_key` mascarada no retorno; `logActivity` dispara com entity_type `ai_agent` |
| T03 | US-01 | Criar subaba "Agente IA" em Configuracoes (formulário admin) | component | T02 | M | 1 | Admin vê e salva formulário; proprietario vê read-only; assessor/abaixo nao vê a aba; toast de sucesso ao salvar |
| T04 | US-03 | Criar migration `ai_chat_sessions` + `ai_chat_messages` + RLS + cleanup cron 30 dias | model | T01 | M | 1 | Tabelas existem; RLS filtra por `user_id = auth.uid()`; cron deleta sessoes com `expires_at < now()` |
| T05 | US-03 | Criar Edge Function `ai-agent-chat` (inferência + persistência) | route | T01, T04 | M | 1 | POST com `{ session_id, message }` retorna `{ reply, session_id }`; persiste mensagens; lê `api_key` via service_role; retorna erro sem quebrar |
| T06 | US-03 | Criar hooks `useAgentChat` + `useAgentSessions` (react-query v5) | hook | T04, T05 | M | 1 | `sendMessage` chama Edge Function e invalida cache; `sessions` lista as últimas 30 sessoes por usuário; nova sessao criada automaticamente na primeira mensagem |
| T07 | US-03 | Criar pagina `/agente` com interface de chat (mensagens + input + indicador typing) | component | T06 | M | 1 | Chat renderiza; mensagem enviada aparece como bolha user; resposta aparece após retorno da EF; estado "agente inativo" exibido se `is_active = false`; acesso negado se role fora de `allowed_roles` |
| T08 | US-03 | Registrar item "Agente" no menu lateral + rota `/agente` no React Router | component | T01, T07 | S | 1 | Item "Agente" aparece na sidebar quando `is_active = true` e role está em `allowed_roles`; ícone `Bot` do lucide-react; rota funcional |
| T09 | US-05 | Adicionar painel de histórico de sessoes na pagina `/agente` (lista colapsável + CRUD) | component | T06 | M | 1 | Lista as últimas 30 sessoes; clicar carrega a sessao; botao "Nova conversa" cria sessao vazia; botao excluir com confirmacao remove sessao e mensagens |
| T10 | US-06 | Criar migration `ai_chat_favorites` + RLS (limite 500) | model | T04 | S | 1 | Tabela existe; RLS filtra por `user_id`; constraint CHECK `(SELECT count(*) FROM ai_chat_favorites WHERE user_id = NEW.user_id) < 500` |
| T11 | US-06 | Criar hook `useAgentFavorites` (list + create + update nota + delete) | hook | T10 | S | 1 | 4 operacoes CRUD via react-query; limite 500 verificado no hook antes de criar; toast ao atingir limite |
| T12 | US-06 | Adicionar UI de favoritos: estrela em cada mensagem do agente + subaba "Favoritos" | component | T11 | M | 1 | Estrela toggle em cada mensagem; subaba Favoritos com lista, busca, editar nota inline, copiar, excluir |
| T13 | US-02 | Criar migration `ai_agent_attachments` + RLS (texto extraído, sem Storage) | model | T01 | S | 2 | Tabela existe; RLS: admin escreve, leitura bloqueada para usuarios (texto é injetado server-side) |
| T14 | US-02 | Criar Edge Function `ai-agent-extract-text` (parse PDF/DOCX/TXT via Deno) | route | T13 | M | 2 | POST com arquivo base64; extrai texto; persiste em `ai_agent_attachments`; retorna `{ ok, filename, char_count }`; limites de tamanho/tipo validados |
| T15 | US-02 | Adicionar secao "Documentos de contexto" na subaba Agente IA (upload + lista + excluir) | component | T14 | M | 2 | Lista de anexos com nome/tamanho/data; upload com validacao de formato/tamanho; botao desabilitado ao atingir 5; excluir com confirmacao |
| T16 | US-05 | Injetar texto dos anexos no contexto da Edge Function `ai-agent-chat` (Slice 2) | route | T05, T13 | S | 2 | `ai-agent-chat` busca `ai_agent_attachments` do agente e concatena no system_prompt antes de enviar ao provider |
| T17 | US-04 | Adicionar upload de arquivo runtime no chat (ícone clipe + preview + envio multimodal) | component, route | T05, T07 | L | 2 | Ícone clipe no input; preview inline; validacao 10 MB no frontend; arquivo enviado junto ao POST; bolha "arquivo enviado" na conversa; ícone desabilitado se modelo nao suporta multimodal |

**Total Slice 1: 12 tasks (T01–T12) | Total Slice 2: 5 tasks (T13–T17)**
**Estimativa total Slice 1: ~4–5S + ~7M = aproximadamente 30–50h de dev**

---

## 2. Plano de Slicing

### Slice 1 — MVP Walking Skeleton (ordem de execucao)

Walking skeleton: **admin configura agente (T01→T02→T03) → usuário envia mensagem e recebe resposta (T04→T05→T06→T07) → sessao salva (ja incluso em T04/T06) → histórico acessível (T09) → favoritar resposta (T10→T11→T12) → agente aparece no menu (T08)**

| Ordem | Task | Justificativa |
|---|---|---|
| 1 | T01 | Fundacao: tabelas e RBAC (tudo depende disso) |
| 2 | T02 | Hook que T03 precisa para renderizar |
| 3 | T03 | Admin precisa conseguir configurar antes de qualquer uso |
| 4 | T04 | Tabelas de sessao/mensagens (T05 e T06 dependem) |
| 5 | T05 | Edge Function de inferencia (coração da feature) |
| 6 | T06 | Hooks de chat/sessoes para o frontend consumir |
| 7 | T07 | Pagina de chat (UI principal) |
| 8 | T08 | Item no menu + rota (conecta tudo ao app) |
| 9 | T09 | Histórico de sessoes (completa US-05) |
| 10 | T10 | Tabela de favoritos (T11 e T12 dependem) |
| 11 | T11 | Hook de favoritos |
| 12 | T12 | UI de favoritos (completa US-06) |

### Slice 2 — Evolucao (após MVP validado)

| Ordem | Task | Justificativa |
|---|---|---|
| 13 | T13 | Tabela de anexos admin (Slice 2 por risco de PDF parsing) |
| 14 | T14 | Edge Function de extracao de texto |
| 15 | T15 | UI de upload de anexos na subaba |
| 16 | T16 | Injecao de contexto dos anexos na inferencia |
| 17 | T17 | Arquivo runtime no chat (multimodal, mais complexo) |

---

## 3. Mapa de Arquivos Novos a Criar

### Migrations (continuar numeracao a partir de 086)
```
supabase/migrations/086_ai_agent_schema.sql
  → CREATE TABLE ai_agents (...)
  → RLS policies (select restrito: is_active + allowed_roles para usuarios; tudo para admin)
  → Adicionar secao 'agente_ia' em permissoes_perfil via INSERT

supabase/migrations/087_ai_chat_schema.sql
  → CREATE TABLE ai_chat_sessions (id, user_id, title, created_at, last_message_at, expires_at)
  → CREATE TABLE ai_chat_messages (id, session_id, role, content, has_attachment, created_at)
  → RLS policies (user_id = auth.uid() em sessions e messages via JOIN)
  → pg_cron job: DELETE FROM ai_chat_sessions WHERE expires_at < now()

supabase/migrations/088_ai_chat_favorites.sql
  → CREATE TABLE ai_chat_favorites (id, user_id, message_id FK, note, created_at, updated_at)
  → RLS policies (user_id = auth.uid())
  → Trigger/check: limite 500 por usuario

-- Slice 2:
supabase/migrations/089_ai_agent_attachments.sql
  → CREATE TABLE ai_agent_attachments (id, agent_id FK, filename, extracted_text, file_size, created_by, created_at)
  → RLS policies (admin escreve/lê; usuarios nao leem diretamente)
```

### Edge Functions
```
supabase/functions/ai-agent-chat/index.ts
  → POST { session_id, message, attachment? }
  → Lê ai_agents (service_role), valida is_active + allowed_roles
  → Monta context: system_prompt + hist. últimas 10 msgs da sessao
  → Chama provider (openai/anthropic/openrouter) — padrão similar ao zapi-ai-analyze-chat
  → Persiste mensagem user + resposta assistant em ai_chat_messages
  → Atualiza last_message_at em ai_chat_sessions
  → Retorna { reply, session_id, message_id }

-- Slice 2:
supabase/functions/ai-agent-extract-text/index.ts
  → POST multipart com arquivo PDF/DOCX/TXT
  → Extrai texto (Deno — usar pdf.js-extract ou openai files API como fallback)
  → Persiste em ai_agent_attachments
  → Retorna { ok, filename, char_count }
```

### Hooks
```
src/hooks/useAgentSettings.ts
  → useAgentSettings(): query ai_agents singleton
  → useUpsertAgentSettings(): mutation (upsert + logActivity)
  → Tipos: AgentProvider, AgentSettings, AgentSettingsUpdate

src/hooks/useAgentChat.ts
  → useSendAgentMessage(): mutation que chama ai-agent-chat EF
  → useAgentMessages(session_id): query ai_chat_messages por sessao

src/hooks/useAgentSessions.ts
  → useAgentSessions(): query últimas 30 sessoes do usuario
  → useCreateAgentSession(): mutation cria nova sessao
  → useDeleteAgentSession(): mutation deleta sessao + mensagens

src/hooks/useAgentFavorites.ts
  → useAgentFavorites(): query lista de favoritos do usuario
  → useToggleFavorite(): mutation cria/remove favorito
  → useUpdateFavoriteNote(): mutation atualiza nota
```

### Components / Pages
```
src/components/agent/AgentConfigForm.tsx
  → Formulário de config do agente (nome, provider, modelo, api_key, prompt, is_active, allowed_roles)
  → Reutiliza padrão visual do AISettingsTab.tsx

src/components/agent/AgentChatWindow.tsx
  → Área de mensagens com scroll automático
  → Bolhas user (direita) e assistant (esquerda) — tema burgundy
  → Indicador "digitando..." (3 pontos animados com Tailwind)
  → Mensagem de erro inline como mensagem system

src/components/agent/AgentChatInput.tsx
  → Textarea com Ctrl+Enter para enviar
  → Botao Enviar com loading state
  → (Slice 2: icone clipe para anexo)

src/components/agent/AgentSessionsSidebar.tsx
  → Lista colapsável de sessoes (título, data)
  → Botao "Nova conversa"
  → Botao excluir por sessao (com confirmacao Dialog)
  → Estado vazio com CTA

src/components/agent/AgentFavoritesList.tsx
  → Lista de favoritos com busca inline
  → Card por favorito: trecho, data, nota editável, botao copiar, botao excluir
  → Limite 500 — aviso se atingido

src/components/agent/AgentInactiveCard.tsx
  → Card de aviso quando is_active = false
  → Mensagem: "O agente está temporariamente desativado pelo administrador"

src/components/agent/AgentNoAccessCard.tsx
  → Card de acesso negado (padrao dos outros módulos)

-- Slice 2:
src/components/agent/AgentAttachmentsList.tsx
  → Lista de documentos de contexto (admin only)
  → Upload com validacao, botao desabilitado ao atingir 5
```

### Pages
```
src/pages/Agente.tsx
  → Layout: sidebar de sessoes (colapsável) + AgentChatWindow
  → Tabs internas: "Chat" | "Favoritos"
  → Guard: verifica is_active + allowed_roles via useAgentSettings
  → LGPD warning fixo (Alert amarelo no topo do chat)
```

### Tipos e RBAC
```
src/types/permissions.ts  (EDITAR — adicionar 'agente_ia' ao SECOES array e SECAO_LABELS)
src/components/layout/AppSidebar.tsx  (EDITAR — adicionar item Agente + permissao no SECAO_TO_PERMISSION)
src/hooks/usePermissions.tsx  (EDITAR — adicionar can.viewAgente(), can.editAgente())
src/lib/activityLog.ts  (EDITAR — adicionar 'ai_agent' ao union de entity_type)
src/pages/Settings.tsx  (EDITAR — adicionar aba "agente-ia" ao TABS e ao TabsList/TabsContent)
```

---

## 4. Riscos Técnicos por Task

### T01 — Migration `ai_agents` (RLS de leitura parcial)
**Risco:** A policy SELECT para usuarios comuns precisa retornar apenas os campos seguros (`is_active`, `name`, `allowed_roles`) sem expor `api_key` ou `system_prompt`. O Postgres nao tem RLS por coluna — a solucao é criar uma VIEW ou usar Security Definer Function para o frontend ler a versao segura.
**Mitigacao:** Criar `ai_agents_public_view` (VIEW com SECURITY DEFINER) expondo apenas `id, name, is_active, allowed_roles` para usuarios autenticados. Admin lê a tabela direta via service_role na Edge Function.

### T04 — Cron de cleanup de sessoes (pg_cron)
**Risco:** pg_cron pode nao estar habilitado na instancia Supabase do cliente.
**Mitigacao:** Antes de incluir o cron no SQL, verificar com `SELECT * FROM cron.job LIMIT 1`. Se nao funcionar, usar trigger `BEFORE INSERT` que deleta as sessoes mais antigas quando o usuario ultrapassa 200 sessoes (fallback sem cron).

### T05 — Edge Function `ai-agent-chat` (timeout + contexto OpenRouter)
**Risco A:** Respostas longas do provider podem ultrapassar 60s (limite do Supabase Edge Functions).
**Mitigacao A:** Limitar histórico enviado a últimas 10 mensagens. Limitar `max_tokens` a 1024 no MVP.

**Risco B:** OpenRouter exige headers `HTTP-Referer` e `X-Title` obrigatórios — sem eles retorna 401.
**Mitigacao B:** Incluir `'HTTP-Referer': 'https://mandato-desk-2026.pages.dev'` e `'X-Title': 'Mandato Desk 2026'` em todas as chamadas ao OpenRouter.

**Risco C:** O campo `api_key` da `ai_agents` pode chegar null à EF se admin nao configurou ainda.
**Mitigacao C:** Retornar 200 com `{ skipped: true, reason: 'agent_not_configured' }` (padrao já usado nas EFs de IA existentes).

### T10 — Limite de 500 favoritos (constraint no Postgres)
**Risco:** CHECK constraint com subquery pode ser rejeitado no Postgres < 14 ou com RLS ativo gerando loop.
**Mitigacao:** Implementar verificacao no hook (`useAgentFavorites`) antes de chamar o INSERT, além de constraint de checagem no nivel de aplicacao. Usar trigger ao inves de CHECK se constraint com subquery travar.

### T14 — Extracao de texto PDF no Deno (Slice 2)
**Risco:** Deno nao tem suporte nativo a `pdfjs-dist`. Bibliotecas de parse de PDF para Deno ainda sao imaturos (npm:pdf-parse nao funciona em Deno nativamente).
**Mitigacao:** Para MVP do Slice 2 suportar apenas TXT e DOCX (via XML parsing). Para PDF, usar a API OpenAI Files (`/v1/files` + `/v1/file_contents`) se o provider for OpenAI, ou cobrar extensao futura. Documentar limitacao na UI.

### T17 — Upload de arquivo runtime no chat (Slice 2)
**Risco:** APIs de vision/file variam por provider (OpenAI usa `content: [{type: "image_url"}]`, Anthropic usa `source.type: "base64"`, OpenRouter depende do modelo).
**Mitigacao:** Implementar adapter por provider dentro da EF `ai-agent-chat`. Desabilitar o icone clipe se `provider === 'openrouter'` e o model nao for reconhecido como multimodal na lista curada.

---

## 5. Definition of Ready (DoR) — checklist antes de T01 comecar

- [ ] Migration 085 aplicada no banco de producao (confirmado)
- [ ] Branch `rodrigo/feature/RAQ-MAND-EM075-agente-de-ia-integrado-ao-crm-agente` criada e sincronizada
- [ ] Decisao 3 (proprietario edita ou só vê o agente) confirmada por Rodrigo — assumido "só vê" mas deve ser validado
- [ ] Confirmado que pg_cron está habilitado no projeto Supabase (rodar `SELECT * FROM cron.job LIMIT 1` no SQL Editor)
- [ ] Confirmado que a extension `pg_cron` está na lista de extensions ativas (Dashboard > Extensions)
- [ ] Lista dos 10 modelos OpenRouter curados aprovada (ex: `meta-llama/llama-3.3-70b`, `google/gemini-2.5-flash`, `deepseek/deepseek-r1`, `mistralai/mistral-large`, `qwen/qwen-2.5-72b`, `microsoft/phi-4`, `nvidia/llama-3.1-nemotron-70b`, `cohere/command-r-plus`, `perplexity/llama-3.1-sonar-large-128k-online`, `anthropic/claude-3.5-haiku` via OpenRouter)

---

## 6. Definition of Done (DoD) — critérios para cada task

- [ ] Migration aplicada (`npx supabase db push`) e testada no banco remoto
- [ ] Codigo compila sem erros TypeScript (`npm run build` ou `tsc --noEmit`)
- [ ] ESLint sem warnings novos (`npm run lint`)
- [ ] Hook testado manualmente: query retorna dados esperados, mutation persiste no banco
- [ ] Componente renderiza nos 3 estados principais: loading, erro, sucesso
- [ ] RBAC verificado: admin vê/edita, proprietario vê (read-only onde aplicável), assessor sem acesso a config, acesso negado renderiza card correto
- [ ] Toast de sucesso/erro visível nas operacoes de escrita
- [ ] `logActivity` chamado nas mutacoes que alteram dados de agente
- [ ] Chave `api_key` nunca aparece no frontend (mascarada ou ausente)
- [ ] Smoke test manual descrito em comentário do PR
- [ ] Commit semantico em pt-BR com `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## 7. Detalhamento das Tasks (Slice 1)

---

### T01 — Criar migration `ai_agents` + RLS + RBAC secao `agente_ia`

**Tipo:** feature
**Estimativa:** S (2–3h)
**Camadas afetadas:** model
**Depende de:** —

#### User story
Como Rodrigo (admin), quero que o banco tenha a estrutura da tabela `ai_agents` com RLS adequado, para que a configuracao do agente seja armazenada com seguranca sem expor a chave de API para usuarios comuns.

#### Criterios de aceite
- [ ] Tabela `ai_agents` criada com colunas: `id, name, provider, model, api_key, system_prompt, is_active, allowed_roles TEXT[], created_by, updated_by, created_at, updated_at`
- [ ] Constraint CHECK em `provider`: `IN ('openai', 'anthropic', 'openrouter')` ou NULL
- [ ] Policy SELECT para admin: lê todas as colunas incluindo `api_key` (via service_role na EF)
- [ ] View `ai_agents_public_view` (SECURITY DEFINER) expondo apenas `id, name, is_active, allowed_roles` para `authenticated`
- [ ] Policy UPDATE/INSERT restrita a admin com `status_aprovacao = 'ATIVO'`
- [ ] Secao `agente_ia` adicionada ao enum SECOES em `src/types/permissions.ts`
- [ ] INSERT em `permissoes_perfil` para `agente_ia`: admin=`{ver:true,criar:true,editar:true,deletar:true}`, proprietario=`{ver:true,criar:false,editar:false,deletar:false}`, demais=`{ver:false,...}`
- [ ] Linha singleton inserida com `INSERT ... WHERE NOT EXISTS` (como em `ai_settings`)
- [ ] Trigger `updated_at` criado

#### Out of scope
- Tabelas `ai_chat_sessions`, `ai_chat_messages` (T04)
- Tabela `ai_agent_attachments` (T13)

---

### T02 — Criar hook `useAgentSettings`

**Tipo:** feature
**Estimativa:** S (2h)
**Camadas afetadas:** hook
**Depende de:** T01

#### User story
Como desenvolvedor do frontend, quero um hook react-query que leia e atualize a configuracao do agente, para que o componente `AgentConfigForm` nao tenha lógica de acesso ao banco.

#### Criterios de aceite
- [ ] `useAgentSettings()` retorna `{ data: AgentSettings | null, isLoading }`
- [ ] Campo `api_key` retorna mascarado (padrao `maskKey` de `useAISettings.ts`) para admin; `null` para outros
- [ ] `useUpsertAgentSettings()` faz upsert na tabela `ai_agents` (insert se vazio, update se existe)
- [ ] Em `onSuccess`, chama `logActivity({ type: 'update', entity_type: 'ai_agent', ... })` sem incluir `api_key`
- [ ] `api_key` só é incluído no payload se o campo de input nao está vazio (mesmo padrao do `useUpdateAISettings`)
- [ ] Toast `'Agente atualizado'` em sucesso; toast de erro em falha

#### Out of scope
- Hooks de chat/sessoes/favoritos (T06, T11)

---

### T03 — Criar subaba "Agente IA" em Configuracoes

**Tipo:** feature
**Estimativa:** M (4–5h)
**Camadas afetadas:** component
**Depende de:** T02

#### User story
Como Rodrigo (admin), quero uma subaba "Agente IA" em Configuracoes com formulário completo, para configurar o agente de chat sem afetar as configuracoes de IA assistiva existentes.

#### Criterios de aceite
- [ ] Arquivo `src/components/settings/AgentSettingsTab.tsx` criado
- [ ] Aba `agente-ia` adicionada ao array TABS em `src/pages/Settings.tsx` e ao TabsList
- [ ] Aba visível apenas se `can.viewAgente()` retorna true (admin e proprietario por padrao)
- [ ] Formulário com campos: nome, provider (openai/anthropic/openrouter), modelo (lista dinamica por provider), chave API (PasswordInput), prompt de sistema (Textarea, placeholder com dica, limite 32.000 chars), status ativo/inativo (Switch), roles com acesso (multiselect dos 5 roles com Checkbox)
- [ ] Para OpenRouter: lista de 10 modelos curados + campo "Outro model ID" (texto livre)
- [ ] Proprietario vê todos os campos mas nao consegue salvar (botao Salvar desabilitado + campos `readOnly`)
- [ ] Salvar persiste via `useUpsertAgentSettings` com toast de confirmacao
- [ ] Alert de segurança sobre armazenamento da chave (mesmo padrao do AISettingsTab)
- [ ] Alert LGPD fixo: "Nao insira dados pessoais identificáveis (nome, CPF, telefone) na configuracao do agente — use apelidos ou IDs internos."

#### Out of scope
- Secao de anexos (T15)

---

### T04 — Criar migration `ai_chat_sessions` + `ai_chat_messages` + cleanup cron

**Tipo:** feature
**Estimativa:** M (3–4h)
**Camadas afetadas:** model
**Depende de:** T01

#### User story
Como assessora, quero que minhas conversas sejam persistidas por 30 dias, para retomar o contexto sem precisar repetir as informacoes.

#### Criterios de aceite
- [ ] Tabela `ai_chat_sessions`: `id, user_id FK→profiles, title(varchar 60), created_at, last_message_at, expires_at` (calculado: `created_at + INTERVAL '30 days'`)
- [ ] Tabela `ai_chat_messages`: `id, session_id FK→ai_chat_sessions ON DELETE CASCADE, role TEXT CHECK IN ('user','assistant','system'), content TEXT, has_attachment BOOLEAN DEFAULT FALSE, created_at`
- [ ] RLS em `ai_chat_sessions`: `user_id = auth.uid()` para SELECT/INSERT/UPDATE/DELETE
- [ ] RLS em `ai_chat_messages`: SELECT/INSERT/UPDATE/DELETE via `session_id IN (SELECT id FROM ai_chat_sessions WHERE user_id = auth.uid())`
- [ ] pg_cron job: `DELETE FROM ai_chat_sessions WHERE expires_at < now()` — agendado diariamente às 03:00
- [ ] Trigger: ao ultrapassar 200 sessoes por usuario, deleta a(s) mais antigas antes de inserir
- [ ] Indexes: `ai_chat_sessions(user_id, last_message_at DESC)`, `ai_chat_messages(session_id, created_at ASC)`

#### Out of scope
- Tabela `ai_chat_favorites` (T10)

---

### T05 — Criar Edge Function `ai-agent-chat`

**Tipo:** feature
**Estimativa:** M (5–7h)
**Camadas afetadas:** route
**Depende de:** T01, T04

#### User story
Como assessora, quero enviar uma mensagem e receber resposta do agente configurado, para obter orientacoes operacionais sem sair do CRM.

#### Criterios de aceite
- [ ] Arquivo `supabase/functions/ai-agent-chat/index.ts` criado
- [ ] Aceita POST `{ session_id: string | null, message: string }`
- [ ] Se `session_id` for null, cria nova sessao com título = primeiros 60 chars da mensagem
- [ ] Valida que o usuário autenticado tem role na `allowed_roles` do agente — retorna 403 se nao tiver
- [ ] Valida `is_active = true` — retorna 200 `{ skipped: true, reason: 'agent_inactive' }` se nao
- [ ] Monta contexto: system_prompt + últimas 10 mensagens da sessao como histórico
- [ ] Suporta providers: openai (`/v1/chat/completions`), anthropic (`/v1/messages`), openrouter (`https://openrouter.ai/api/v1/chat/completions` com headers `HTTP-Referer` e `X-Title`)
- [ ] Persiste mensagem user e resposta assistant em `ai_chat_messages`
- [ ] Atualiza `last_message_at` na sessao
- [ ] Em erro de provider, retorna 200 `{ error: 'provider_error' }` sem expor detalhes
- [ ] Rate-limit: reutiliza `isRateLimited` / `registerAICall` de `_shared/ai-security.ts`
- [ ] Anti-prompt injection: envolve input do usuario em delimitador (padrao `wrapUserContent`)
- [ ] `max_tokens: 1024` para controle de custo no MVP

#### Out of scope
- Injecao de texto de anexos (T16)
- Suporte a arquivos multimodais (T17)

---

### T06 — Criar hooks `useAgentChat` + `useAgentSessions`

**Tipo:** feature
**Estimativa:** M (3–4h)
**Camadas afetadas:** hook
**Depende de:** T04, T05

#### User story
Como desenvolvedor, quero hooks react-query para sessoes e envio de mensagens, para que o componente de chat nao tenha lógica de acesso a dados.

#### Criterios de aceite
- [ ] `useAgentMessages(sessionId)`: query `ai_chat_messages` ordenado por `created_at ASC`; só dispara se `sessionId` nao é null
- [ ] `useSendAgentMessage()`: mutation que chama EF `ai-agent-chat`; em sucesso, invalida queries `['agent_messages', sessionId]` e `['agent_sessions']`; em erro, nao quebra o estado
- [ ] `useAgentSessions()`: query `ai_chat_sessions` ordenado por `last_message_at DESC LIMIT 30`
- [ ] `useCreateAgentSession()`: mutation insere nova sessao com título "Nova conversa" (título atualiza automaticamente ao enviar primeira mensagem via EF)
- [ ] `useDeleteAgentSession(sessionId)`: mutation deleta sessao; `ai_chat_messages` deletados em CASCADE

#### Out of scope
- Hook de favoritos (T11)

---

### T07 — Criar pagina `/agente` com interface de chat

**Tipo:** feature
**Estimativa:** M (5–7h)
**Camadas afetadas:** component
**Depende de:** T06

#### User story
Como assessora, quero uma interface de chat dentro do CRM, para interagir com o agente sem sair do sistema.

#### Criterios de aceite
- [ ] Arquivo `src/pages/Agente.tsx` criado
- [ ] Guard: se `is_active = false`, renderiza `AgentInactiveCard`; se role nao está em `allowed_roles`, renderiza `AgentNoAccessCard`
- [ ] Layout: sidebar de sessoes colapsável (mobile: oculto, desktop: fixo) + area de chat central
- [ ] Área de mensagens: scroll automático para última mensagem; bolhas user (direita, cor `bg-primary/10`) e assistant (esquerda, cor `bg-muted`)
- [ ] Indicador "digitando..." com 3 pontos animados (Tailwind `animate-bounce`) durante loading da mutation
- [ ] Mensagem de erro aparece como bolha do sistema (fundo amarelo, texto "Erro ao processar. Tente novamente.")
- [ ] Alert LGPD fixo no topo: "Nao insira dados pessoais identificáveis (nome, CPF, telefone) neste chat."
- [ ] Input: Textarea com Ctrl+Enter para enviar; botao Enviar desabilitado durante loading
- [ ] Nome do agente e status "ativo" exibidos no header do chat

#### Out of scope
- Subaba Favoritos (T12)
- Upload de arquivo (T17)

---

### T08 — Registrar item "Agente" no menu lateral + rota no Router

**Tipo:** feature
**Estimativa:** S (1–2h)
**Camadas afetadas:** component
**Depende de:** T01, T07

#### User story
Como assessora, quero ver o item "Agente" no menu lateral quando o agente está ativo para mim, para acessar o chat com um clique.

#### Criterios de aceite
- [ ] `src/types/permissions.ts`: `'agente_ia'` adicionado ao array `SECOES` e ao `SECAO_LABELS`
- [ ] `src/hooks/usePermissions.tsx`: `can.viewAgente()` adicionado (retorna `canView('agente_ia')`)
- [ ] `src/components/layout/AppSidebar.tsx`: item `{ label: 'Agente', icon: Bot, href: '/agente', secao: 'agente_ia', dividerBefore: true }` adicionado ao `NAV_ITEMS`; `SECAO_TO_PERMISSION` mapeado para `can.viewAgente()`
- [ ] Item "Agente" só aparece se `can.viewAgente() === true` E agente está ativo (`is_active`). A verificacao de `is_active` é feita no componente pai via `useAgentSettings` — o item na sidebar usa apenas a permissao RBAC; a pagina `/agente` faz a segunda camada de verificacao
- [ ] Rota `/agente` registrada em `src/App.tsx` apontando para `Agente.tsx`
- [ ] Ícone `Bot` importado de `lucide-react`

#### Out of scope
- Logica de sidebar colapsada (ja existe no `AppSidebar.tsx` por padrao)

---

### T09 — Adicionar painel de histórico de sessoes na pagina `/agente`

**Tipo:** feature
**Estimativa:** M (3–5h)
**Camadas afetadas:** component
**Depende de:** T06

#### User story
Como assessora, quero acessar o histórico de conversas anteriores e criar novas conversas, para retomar contexto ou iniciar um tema novo sem perder o que ja conversei.

#### Criterios de aceite
- [ ] Componente `AgentSessionsSidebar.tsx` integrado na pagina `/agente`
- [ ] Lista as últimas 30 sessoes com: título (60 chars), data relativa (ex: "há 2h")
- [ ] Última sessao aberta automaticamente ao entrar na pagina (sem precisar clicar)
- [ ] Botao "Nova conversa" no topo — cria sessao vazia e abre o chat em branco
- [ ] Clicar em sessao carrega suas mensagens (atualiza `sessionId` no estado da pagina)
- [ ] Sessao ativa destacada visualmente (mesma logica do `isActive` da sidebar principal)
- [ ] Botao excluir (icone trash) por sessao com Dialog de confirmacao "Excluir esta conversa permanentemente?"
- [ ] Estado vazio: "Nenhuma conversa ainda. Envie uma mensagem para comecar."
- [ ] Aviso no topo: "Histórico disponível por 30 dias"
- [ ] Responsividade: em mobile, sidebar de sessoes fica atrás de um botao toggle (Sheet do shadcn)

#### Out of scope
- Exportar histórico (fora de escopo do MVP e Slice 2)

---

### T10 — Criar migration `ai_chat_favorites` + RLS + limite 500

**Tipo:** feature
**Estimativa:** S (2h)
**Camadas afetadas:** model
**Depende de:** T04

#### User story
Como assessora, quero que minhas respostas favoritadas sejam persistidas no banco com RLS individual, para que o banco de favoritos seja privado e nao expire com o histórico.

#### Criterios de aceite
- [ ] Tabela `ai_chat_favorites`: `id, user_id FK→profiles, message_id FK→ai_chat_messages ON DELETE CASCADE, note VARCHAR(200), created_at, updated_at`
- [ ] UNIQUE constraint em `(user_id, message_id)` — sem favoritar duplicado
- [ ] RLS: `user_id = auth.uid()` para SELECT/INSERT/UPDATE/DELETE
- [ ] Trigger `BEFORE INSERT`: conta favoritos do usuario; se >= 500, lanca excecao com mensagem capturável
- [ ] Trigger `updated_at` padrao
- [ ] Index em `(user_id, created_at DESC)`

#### Out of scope
- Tabela de anexos (T13)

---

### T11 — Criar hook `useAgentFavorites`

**Tipo:** feature
**Estimativa:** S (2h)
**Camadas afetadas:** hook
**Depende de:** T10

#### User story
Como desenvolvedor, quero hooks react-query para favoritos, para que a UI de favoritos nao gerencie estado de banco diretamente.

#### Criterios de aceite
- [ ] `useAgentFavorites()`: query todos favoritos do usuario ordenados por `created_at DESC`
- [ ] `useToggleFavorite(messageId)`: verifica se ja é favorito; se sim, deleta; se nao, cria; invalida cache
- [ ] Antes de INSERT, verifica contagem local (cache react-query) — se >= 500, dispara toast de aviso sem chamar o banco
- [ ] `useUpdateFavoriteNote(favoriteId)`: mutation atualiza campo `note` com debounce opcional
- [ ] `useDeleteFavorite(favoriteId)`: mutation deleta favorito com confirmacao no componente (nao no hook)
- [ ] Todos os erros do banco (incluindo excecao do trigger de limite) capturados e exibidos via toast

#### Out of scope
- Busca no frontend (feita no componente via `useMemo` de filtro local)

---

### T12 — Adicionar UI de favoritos: estrela + subaba "Favoritos"

**Tipo:** feature
**Estimativa:** M (4–5h)
**Camadas afetadas:** component
**Depende de:** T11

#### User story
Como assessora, quero favoritar respostas do agente com um clique e acessar meu banco de favoritos numa subaba, para reutilizar respostas úteis rapidamente.

#### Criterios de aceite
- [ ] Cada mensagem do assistant no chat exibe botao de estrela (Star do lucide-react, outline quando nao favoritado, preenchido quando favoritado)
- [ ] Clicar na estrela preenchida abre Dialog "Remover dos favoritos?" antes de desfavoritar
- [ ] Tabs na pagina `/agente`: "Chat" e "Favoritos" (shadcn Tabs)
- [ ] Aba "Favoritos" renderiza `AgentFavoritesList.tsx` com:
  - Campo de busca por conteúdo e por nota
  - Card por favorito: trecho (150 chars com "..."), data, nota (campo editável inline ao clicar em icone de lapis), botao copiar (toast "Copiado!"), botao excluir com confirmacao
- [ ] Ao atingir 500 favoritos, estrela aparece desabilitada com tooltip "Limite de 500 favoritos atingido."
- [ ] Busca filtra localmente via `useMemo` sem nova chamada ao banco

#### Out of scope
- Exportar favoritos (nao está no escopo)
- Compartilhar favorito entre usuarios (histórico é individual)

---

## 8. Tasks do Slice 2 (resumo — detalhar quando MVP estiver validado)

| Task | Descricao | Pre-requisito |
|---|---|---|
| T13 | Migration `ai_agent_attachments` (texto extraído, sem Storage binário) | T01 |
| T14 | Edge Function `ai-agent-extract-text` (parse TXT/DOCX; PDF via OpenAI Files API se provider=openai) | T13 |
| T15 | UI "Documentos de contexto" na subaba Agente IA (upload + lista + excluir) | T14 |
| T16 | Injetar textos dos anexos no system_prompt dentro de `ai-agent-chat` | T05, T13 |
| T17 | Upload runtime no chat (icone clipe + preview + envio multimodal por provider) | T05, T07 |

---

## 9. Resumo de Estimativas

| Scope | Tasks | Estimativa Total (aprox.) |
|---|---|---|
| Slice 1 — MVP | T01–T12 (12 tasks) | ~5 S + ~7 M = 35–55h dev |
| Slice 2 — Evolucao | T13–T17 (5 tasks) | ~1 S + ~3 M + ~1 L = 15–30h dev |
| **Total feature** | **17 tasks** | **~50–85h dev** |

> Estimativas em S=2–3h, M=4–7h, L=8–14h. Nenhuma task excede L; T17 (L) poderia ser quebrada se o Slice 2 for priorizado — mas fica como aviso para o momento.
