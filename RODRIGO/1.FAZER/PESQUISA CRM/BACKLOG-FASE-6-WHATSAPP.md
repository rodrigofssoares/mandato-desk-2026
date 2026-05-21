# Backlog — Fase 6 · CRM Político · Evolução WhatsApp CRM

> Quebra atomizada do `PRD-EVOLUCAO-WHATSAPP.md` (Fase 6 apenas).
> Continuação direta de `BACKLOG-FASE-5-WHATSAPP.md` (T01–T57).
> Gerado pelo agente Backlog em 2026-05-18.
> Total: 20 tasks (~97 pts).

---

## Pesquisa e decisões de arquitetura registradas

### O que já existe — NÃO recriar

- `contacts.bairro TEXT` e `contacts.zona_eleitoral TEXT`: colunas presentes no schema
  (`types.ts` confirma — linhas 676, 726). Não precisam de migration para C21.
- `contacts.logradouro`, `contacts.lat`, `contacts.lng`, `contacts.pin_color`: todos
  existentes. `LeadsMap` (`src/pages/LeadsMap.tsx`) + `useMapContacts` + `LeafletMap`
  usam essas colunas. C21 é sobre exibir/editar bairro/zona no `ContactPanel`,
  não sobre geocodificação.
- `useBirthdays()` em `src/hooks/useDashboard.ts`: retorna `today` e `next7`. Já busca
  `id, nome, data_nascimento`. C19 reutiliza esse hook no contexto WhatsApp.
- `PollDialog` em `src/components/whatsapp/PollDialog.tsx`: envia enquete para 1 contato
  via `useSendZapiPoll`. C23 estende o conceito para N contatos (broadcast de enquete).
- `useDemands` / `useCreateDemand` / `useUpdateDemand` em `src/hooks/useDemands.ts`:
  tabela `demands` com `status ('open'|'in_progress'|'resolved')`, `contact_id`, `title`.
  C18 precisa de coluna `protocolo` em `demands` + coluna `demand_id` em `zapi_chats`.
- `zapi_chat_tags` e `zapi_quick_replies`: tabelas existentes (migration 057).
- `isFeatureEnabled` + `useAccountFeatures`: existentes desde Fase 0 (T05/T06). Todos
  os recursos novos desta fase devem ser gated por feature flag da conta.
- `pg_cron`: habilitado (migration 044). Próximas migrations disponíveis: `067`, `068`...
- EFs existentes: `zapi-send-text`, `zapi-send-media`, `zapi-chat-update`,
  `zapi-mark-as-read`, `zapi-webhook`, `zapi-send-reaction`, `zapi-forward-message`,
  `zapi-send-location`, `zapi-instance-status`, `zapi-send-poll`, `zapi-chat-tag-update`,
  `zapi-schedule-message`, `zapi-send-scheduled`, `zapi-bulk-chat-update`.
- Última migration aplicada: `066`. Última task numerada: T57. Tasks desta fase: **T58–T77**.

---

### C24 — Opt-in LGPD: onde persistir e qual granularidade?

**Decisão: colunas em `contacts`, migration dedicada.**

Colunas a adicionar:
- `optin_whatsapp BOOLEAN NOT NULL DEFAULT false` — consentimento WhatsApp
- `optin_data TIMESTAMPTZ` — quando foi registrado
- `optin_origem TEXT` — como foi registrado (`'manual'`, `'formulario'`, `'mensagem'`)

Razão para colunas em `contacts` (não tabela separada): o opt-in é um atributo
estável do contato, não um histórico de eventos. Simples de filtrar no broadcast.
Se no futuro for necessário histórico de consentimentos, adiciona tabela de auditoria.

**Regra crítica:** o broadcast (C17) usa `optin_whatsapp = true` como filtro
obrigatório antes de enfileirar qualquer target. Isso é verificado tanto no backend
(Edge Function) quanto no frontend (contagem de elegíveis antes de confirmar envio).
Filtro duplo: UI avisa e EF bloqueia.

**Segurança:** coluna em `contacts` com dado pessoal LGPD + lida/escrita por EF
e também por client autenticado → Security obrigatório.

---

### C17 — Broadcast: arquitetura de fila + ritmo anti-ban

**Decisão: tabela `zapi_broadcasts` + tabela `zapi_broadcast_targets` + cron pg_cron.**

Arquitetura em 3 camadas:
1. **`zapi_broadcasts`**: a campanha em si — `title`, `body`, `account_id`, `segment_filters jsonb`
   (tags/bairro/zona), `status ('rascunho'|'agendado'|'enviando'|'concluido'|'cancelado')`,
   `ritmo_por_minuto INT NOT NULL DEFAULT 10 CHECK (ritmo_por_minuto BETWEEN 1 AND 30)`,
   `scheduled_at TIMESTAMPTZ`, `started_at`, `finished_at`, `total_targets INT`,
   `sent_count INT DEFAULT 0`, `failed_count INT DEFAULT 0`, `created_by`.
2. **`zapi_broadcast_targets`**: 1 linha por contato alvo — `broadcast_id`, `contact_id`,
   `phone TEXT`, `status ('pendente'|'enviado'|'falha'|'bloqueado')`, `sent_at`,
   `error_msg`. Bloqueado = sem opt-in ou contato merged.
3. **Edge Function `zapi-broadcast-send`**: chamada pelo cron a cada minuto. Lê targets
   `status='pendente'` com limite = `ritmo_por_minuto` do broadcast pai. Chama
   `zapi-send-text` internamente. Atualiza contadores em `zapi_broadcasts`.
4. **Edge Function `zapi-broadcast-create`**: recebe `{broadcast_id}`, resolve o
   segmento (filtros → lista de contatos com `optin_whatsapp=true`), insere os targets,
   muda status para `'agendado'` ou `'enviando'`.

**Regra anti-ban:** `ritmo_por_minuto` máximo de 30 (padrão 10). Com 30/min = 1800/hora.
Para bases maiores, o cron distribui automaticamente. Isso não garante zero-ban — Z-API
não-oficial tem risco intrínseco — mas reduz muito o risco.

**Segurança:** novas tabelas com `user_id` + 2 EFs com `service_role` + pg_cron —
Security + Pentest obrigatórios. Broadcast + LGPD = superfície crítica máxima desta fase.

---

### C18 — Protocolo de demanda: vinculação conversa↔demanda + retorno automático

**Decisão: coluna `demand_id` em `zapi_chats` + coluna `protocolo` em `demands` +
trigger de notificação via Edge Function.**

- `demands.protocolo TEXT UNIQUE`: gerado automaticamente por trigger no INSERT
  (`'MAND-' || LPAD(nextval('demands_protocolo_seq')::text, 6, '0')`).
- `zapi_chats.demand_id UUID REFERENCES demands(id) ON DELETE SET NULL`: vínculo
  conversa↔demanda (N:1 — uma conversa pode ter uma demanda ativa).
- **Trigger de notificação:** quando `demands.status` muda, um trigger chama
  `zapi-demand-notify` (nova EF) que envia mensagem ao eleitor via `zapi-send-text`.
  A mensagem usa template configurável por status:
  - `open → in_progress`: "Seu pedido {protocolo} foi recebido e está em atendimento."
  - `in_progress → resolved`: "Seu pedido {protocolo} foi resolvido. Obrigado."
  O trigger é condicional: só dispara se `zapi_chats.demand_id IS NOT NULL` (o chat
  do contato existe) e se a conta tem `isFeatureEnabled(config, 'c18')`.

**Atenção:** o trigger chama uma EF via `pg_net` — padrão já usado no cron (migration 064).

**Segurança:** nova EF `service_role` + trigger PG → EF → Z-API → eleitor —
Security + Pentest obrigatórios.

---

### C19 — Aniversariantes: integração com conversa (sem nova migration)

**Decisão: widget no `ContactPanel` + aba "Aniversariantes" na lista de conversas.**

`useBirthdays()` já busca a data de aniversário de todos os contatos. Para o contexto
WhatsApp, precisamos de:
1. Badge "Aniversariante hoje" no `ChatListItem` quando `contact.data_nascimento` cai
   no dia de hoje (cálculo client-side, sem nova query).
2. Seção "Aniversário" no `ContactPanel` exibindo a data + botão "Enviar parabéns"
   (abre composer pré-preenchido com mensagem padrão, editável antes de enviar).
3. Sem migration — `data_nascimento` já existe em `contacts`.

---

### C20 — Convite a evento: nova entidade ou campo manual?

**Decisão: evento simples como tabela `mandato_events` (migration dedicada) + EF.**

Após análise do schema, não existe entidade de eventos/agenda no projeto. Criar
tabela mínima: `mandato_events(id, title, descricao, data_evento TIMESTAMPTZ,
local TEXT, account_id, created_by, created_at)`. Convidar = enviar mensagem
pré-formatada com os dados do evento. RSVP = tag de status no contato (simples:
`contact_event_rsvps(event_id, contact_id, status 'pendente'|'confirmado'|'recusado',
respondido_em)` — registra a confirmação quando o eleitor responde).

**Simplificação deliberada:** não há integração com Google Calendar ou sistema de
agenda complexo nesta entrega. Evento é apenas dados + mensagem + registro de RSVP.
CRUD completo de eventos (criar, listar, editar, excluir) + envio de convite +
registro de RSVP.

**Regra Rodrigo:** feature com inserção = 4 tasks (criar, listar, editar, excluir).
Mas como evento + RSVP são intimamente ligados ao WhatsApp, o CRUD de eventos é
empacotado em 2 tasks (CRUD gestão + envio/RSVP), priorizando a entrega de valor.

**Segurança:** novas tabelas com `user_id` → Security obrigatório.

---

### C21 — Bairro/zona eleitoral no painel: exibir e editar

**Decisão: seção no `ContactPanel` + integração com LeadsMap (link direto).**

`contacts.bairro` e `contacts.zona_eleitoral` já existem. O trabalho é:
- Exibir/editar inline no `ContactPanel` (seguindo padrão click-to-edit de T07).
- Botão "Ver no mapa" que navega para `/mapa?bairro=<bairro>` (deep-link para
  `LeadsMap` com filtro pré-aplicado).
- Exibir bairro/zona no `ChatListItem` como informação secundária (subtitle).
- Sem migration nova.

---

### C22 — Régua de relacionamento: cadência automática

**Decisão: tabela `zapi_relationship_rules` + cron + EF.**

A régua define: "se contato está na etapa X do funil por mais de N dias sem resposta,
enviar mensagem Y". Precisa de:
- Tabela `zapi_relationship_rules(id, account_id, nome, etapa_funil_id, dias_sem_resposta INT,
  mensagem_template TEXT, ativo BOOL DEFAULT true, created_by)`.
- Cron job que roda diariamente: consulta chats onde `status != 'finalizada'` e a
  última mensagem recebida tem mais de `dias_sem_resposta` dias, aplica a régua.
- EF `zapi-relationship-followup`: executada pelo cron, busca candidatos e envia
  follow-up via `zapi-send-text`. Usa `service_role`.

**Escopo limitado:** apenas follow-up por etapa do funil (não por tag ou outros atributos).
Estender no futuro. Por ser cron + EF com `service_role`, Security + Pentest obrigatórios.

---

### C23 — Campanha temática / pesquisa de opinião segmentada

**Decisão: extensão do fluxo de broadcast (C17) com tipo `'enquete'`.**

Adicionar campo `tipo TEXT NOT NULL DEFAULT 'mensagem' CHECK (tipo IN ('mensagem', 'enquete'))`
em `zapi_broadcasts`. Quando `tipo='enquete'`, o payload inclui `poll_question TEXT`
e `poll_options JSONB`. A EF `zapi-broadcast-send` usa `zapi-send-poll` ao invés de
`zapi-send-text`. Consolidar respostas: a EF de webhook (`zapi-webhook`) já recebe
votos de enquete — adicionar lógica para associar voto ao `broadcast_id` quando o
chat tem uma campanha de enquete ativa.

**Depende de:** T58 (opt-in) e T59–T62 (broadcast) estarem prontos.

---

### C29 — CSAT: pesquisa de satisfação ao finalizar conversa

**Decisão: trigger na mudança de status para `'finalizada'` + enquete CSAT.**

Quando `zapi_chats.status` muda para `'finalizada'`, se a conta tem `isFeatureEnabled(config, 'c29')`,
a EF `zapi-chat-update` pode disparar uma mensagem de CSAT (pesquisa de satisfação
de 1 a 5 estrelas via enquete). Implementado como opção no fluxo de finalização
(não automático puro — atendente clica "Finalizar e enviar CSAT").

**Simplificação:** CSAT como enquete WhatsApp (sem link externo, sem formulário web).
Respostas ficam nas mensagens da conversa — sem tabela de agregação nesta entrega.

---

## Decisão de sequenciamento — por que esta ordem

```
C24 (opt-in) PRIMEIRO — é pré-requisito de C17 (broadcast) e C23 (enquete segmentada).
C18 (protocolo) SEGUNDO — enabler de valor imediato; integra com demandas existentes.
C17 (broadcast infra) TERCEIRO — tabelas + EF + cron antes da UI.
C17 (UI de campanha) QUARTO — depende da infra.
C21 (bairro/zona) QUINTO — sem migration, entrega rápida de valor visual.
C19 (aniversariantes) SEXTO — sem migration, widget + botão de ação.
C20 (eventos CRUD) SÉTIMO — nova entidade, entrega valor político tangível.
C22 (régua) OITAVO — cron complexo, depende de funil estar em uso (Fase 1/T09).
C23 (enquete segmentada) NONO — extensão do broadcast, depende de T59-T62.
C29 (CSAT) DÉCIMO — menor esforço, depende de status "finalizada" (Fase 3/T25 aprox).
```

---

## Ordem de execução (WSJF + dependências)

```
T58 — Migration: opt-in LGPD em contacts (C24)                        [Security]
T59 — UI: registro de opt-in/opt-out no ContactPanel (C24)            [Security]
T60 — Migration: protocolo + demand_id + sequence (C18)               [Security+Pentest]
T61 — EF zapi-demand-notify + trigger PG (C18)                        [Security+Pentest]
T62 — UI: vincular conversa a demanda + badge protocolo (C18)
T63 — Migration: tabelas broadcast + targets (C17)                    [Security+Pentest]
T64 — EF zapi-broadcast-create + zapi-broadcast-send + cron (C17)     [Security+Pentest]
T65 — UI: tela de gestão de campanhas broadcast (C17)                  (depende T63+T64)
T66 — UI: composer de campanha + filtros de segmento (C17)             (depende T65)
T67 — UI: bairro/zona no ContactPanel + link para mapa (C21)
T68 — UI: badge aniversariante no ChatListItem + seção no painel (C19)
T69 — Migration: mandato_events + contact_event_rsvps (C20)           [Security]
T70 — CRUD de eventos do mandato (C20)                                  (depende T69)
T71 — UI: enviar convite de evento + registrar RSVP (C20)              (depende T70)
T72 — Migration: zapi_relationship_rules (C22)                         [Security+Pentest]
T73 — EF zapi-relationship-followup + cron diário (C22)               [Security+Pentest]
T74 — UI: gestão de réguas de relacionamento (C22)                     (depende T72+T73)
T75 — Broadcast tipo enquete + consolidação de votos (C23)             [Security+Pentest] (depende T63+T64)
T76 — UI: botão "Finalizar e enviar CSAT" (C29)                        (depende Fase 3 T25-aprox)
T77 — Feature flags: registrar c17/c18/c19/c20/c21/c22/c23/c24/c29 em AccountFormDialog
```

**Dependências críticas:**
- T58 (migration opt-in) deve vir antes de T59 (UI opt-in) e antes de T64 (EF broadcast usa opt-in).
- T60 (migration protocolo) deve vir antes de T61 (EF trigger) e T62 (UI vínculo).
- T63 (migration broadcast) deve vir antes de T64 (EFs broadcast) e T65 (UI).
- T64 deve vir antes de T65, T66 e T75.
- T69 (migration eventos) deve vir antes de T70 (CRUD) e T71 (convite/RSVP).
- T72 (migration réguas) deve vir antes de T73 (EF cron) e T74 (UI).
- T75 depende de T63+T64 (broadcast infra) estar pronto.
- T77 pode ser feito a qualquer momento após T58, mas recomendado ao final.

---

## Tasks

### T58 — Migration: colunas opt-in LGPD em contacts (C24)

**Tipo:** feature (infraestrutura)
**Estimativa:** S (2pt)
**Camadas afetadas:** model
**Depende de:** — (independente)
**WSJF score:** (9 + 9 + 9) / 2 = **13.5** — pré-requisito bloqueante de broadcast
**Segurança:** coluna com dado pessoal LGPD em `contacts` — Security obrigatório

#### User story

Como Raquel (mandatária responsável pela conformidade LGPD), quero que o banco de dados
registre se cada eleitor deu consentimento para receber mensagens no WhatsApp e quando
isso aconteceu, para que o broadcast (C17) só envie para quem autorizou e a organização
tenha evidência de consentimento.

#### Contexto

C24 é o alicerce de conformidade de toda a Fase 6. Sem opt-in registrado, o broadcast
C17 não pode operar de forma legalmente segura. A tabela `contacts` já existe com
`aceita_whatsapp BOOL` (migration 007) — mas esse campo não registra data nem origem
do consentimento. As novas colunas são complementares (não substituem `aceita_whatsapp`,
que pode continuar sendo usado para outra finalidade). A migration usa expand-contract
(adiciona colunas nullable, sem downtime).

#### Critérios de aceite

- [ ] Migration `067_contacts_optin_lgpd.sql` aplicada sem erro (`npx supabase db push` ok).
- [ ] Coluna `optin_whatsapp BOOLEAN NOT NULL DEFAULT false` adicionada em `contacts`.
- [ ] Coluna `optin_data TIMESTAMPTZ` adicionada (nullable — null = nunca registrado).
- [ ] Coluna `optin_origem TEXT CHECK (optin_origem IN ('manual', 'formulario', 'mensagem'))` adicionada (nullable).
- [ ] Índice `idx_contacts_optin_whatsapp` em `(optin_whatsapp) WHERE optin_whatsapp = true` (usado pelo broadcast).
- [ ] RLS: UPDATE de `optin_whatsapp/optin_data/optin_origem` permitido por usuário autenticado da mesma organização (herda RLS existente de `contacts`).
- [ ] `types.ts` regenerado e commitado.
- [ ] Idempotência: rodar migration duas vezes não gera erro.

#### Hints técnicos (não-prescritivos)

- **Arquivo:** `supabase/migrations/067_contacts_optin_lgpd.sql`
- **Pattern:** seguir migration 007 (`add_aceita_whatsapp`) para a sintaxe ALTER TABLE.
- **Não remover** `aceita_whatsapp` — pode estar em uso em outras partes do código.
- **Índice parcial** é fundamental para performance do broadcast (filtra só os TRUE).

#### Test cases

- **Happy path:** `SELECT optin_whatsapp FROM contacts LIMIT 1` retorna `false` (default).
- **Update:** usuário autenticado atualiza `optin_whatsapp=true, optin_data=now(), optin_origem='manual'` → sucesso.
- **Idempotência:** migration rodada duas vezes → sem erro.
- **Índice:** `EXPLAIN SELECT id FROM contacts WHERE optin_whatsapp = true` usa o índice parcial.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] `types.ts` atualizado no commit
- [ ] QA aprovou

#### Out of scope

- UI de opt-in (é T59)
- Histórico de mudanças de consentimento (audit log futuro)
- Integração com formulário externo de captação

---

### T59 — UI: registrar opt-in/opt-out no ContactPanel (C24)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T58
**WSJF score:** (9 + 9 + 8) / 5 = **5.2**
**Segurança:** escrita de dado pessoal LGPD — Security obrigatório

#### User story

Como atendente do gabinete, quero registrar no painel lateral da conversa se o eleitor
autorizou receber mensagens de WhatsApp, para que o broadcast respeite o consentimento
e a organização tenha evidência de LGPD.

#### Contexto

Com a migration T58 no ar, o `ContactPanel` precisa exibir e editar o status de opt-in.
A seção fica visível sempre (não apenas quando `isFeatureEnabled`) — é dado de conformidade
que todo atendente deve poder registrar. O padrão de edição inline do T07 (click-to-edit)
aplica-se aqui via `useUpdateContact` (já existente).

#### Critérios de aceite

- [ ] Seção "Consentimento LGPD" visível no `ContactPanel` abaixo das informações de contato.
- [ ] Exibe o estado atual: "Autorizado em DD/MM/AAAA (manual)" ou "Não autorizado".
- [ ] Toggle (Switch shadcn) para ligar/desligar `optin_whatsapp`; ao ligar, registra `optin_data = now()` e `optin_origem = 'manual'`; ao desligar, limpa `optin_data` e `optin_origem`.
- [ ] Ao salvar, toast "Consentimento atualizado" (sucesso) ou toast com mensagem de erro (falha).
- [ ] Rollback otimista: se a mutation falhar, o toggle volta ao estado anterior.
- [ ] Campo de origem exibe texto legível ("Registrado manualmente", "Via formulário", "Via mensagem").
- [ ] Estado de loading no Switch durante a mutation.

#### Hints técnicos (não-prescritivos)

- **Hook:** `useUpdateContact` em `src/hooks/useContacts.ts` (mutation existente).
- **Component:** `src/components/whatsapp/ContactPanel.tsx` — adicionar seção após as seções existentes.
- **UI:** `Switch` + `Label` do shadcn/ui; badge colorido (verde = autorizado, cinza = não autorizado).
- **Pattern:** seguir padrão de edição inline de T07 (blur → save).

#### Test cases

- **Happy path:** toggle para ON → toast "Consentimento atualizado" → seção mostra "Autorizado em [hoje]".
- **Toggle OFF:** toggle para OFF → seção mostra "Não autorizado" → `optin_data` fica null.
- **Erro de rede:** mutation falha → toast de erro → toggle volta ao estado anterior.
- **Contato sem data_nascimento:** seção aparece independentemente de outros dados do contato.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] Smoke test: abrir conversa → painel → toggle opt-in → verificar no banco
- [ ] QA aprovou

#### Out of scope

- Opt-in via formulário externo ou link (origem 'formulario'/'mensagem' — futuro)
- Exportação de lista de opt-ins para auditoria

---

### T60 — Migration: protocolo em demands + demand_id em zapi_chats (C18)

**Tipo:** feature (infraestrutura)
**Estimativa:** M (5pt)
**Camadas afetadas:** model
**Depende de:** — (independente)
**WSJF score:** (8 + 7 + 7) / 5 = **4.4**
**Segurança:** nova sequence + trigger PG + FK entre tabelas — Security + Pentest obrigatórios

#### User story

Como desenvolvedor mantendo o módulo WhatsApp, quero que a tabela `demands` tenha
número de protocolo único legível e que `zapi_chats` tenha FK para `demands`, para
que C18 (retorno automático ao eleitor) possa referenciar a demanda correta ao
disparar mensagem.

#### Contexto

C18 integra o sistema de demandas (existente desde as migrações iniciais) com o
WhatsApp. O protocolo é a "identidade pública" da demanda — o que o eleitor vê
("seu protocolo MAND-000042"). Precisa ser gerado automaticamente e ser único. A
vinculação `zapi_chats.demand_id` permite que a EF de notificação saiba qual chat
usar para enviar a mensagem de retorno.

O trigger de notificação (EF `zapi-demand-notify`) é implementado em T61, separado
desta migration para respeitar slicing vertical.

#### Critérios de aceite

- [ ] Migration `068_demands_protocolo_and_chat_link.sql` aplicada sem erro.
- [ ] Sequence `demands_protocolo_seq` criada.
- [ ] Coluna `protocolo TEXT UNIQUE` adicionada em `demands` (nullable para registros existentes).
- [ ] Trigger `set_demand_protocolo` no INSERT em `demands`: preenche `protocolo = 'MAND-' || LPAD(nextval('demands_protocolo_seq')::text, 6, '0')` se NULL.
- [ ] Registros existentes em `demands` recebem protocolo retroativamente via `UPDATE demands SET protocolo = 'MAND-' || LPAD(nextval('demands_protocolo_seq')::text, 6, '0') WHERE protocolo IS NULL`.
- [ ] Coluna `demand_id UUID REFERENCES demands(id) ON DELETE SET NULL` adicionada em `zapi_chats` (nullable).
- [ ] Índice `idx_zapi_chats_demand_id` em `zapi_chats(demand_id) WHERE demand_id IS NOT NULL`.
- [ ] `types.ts` regenerado e commitado.
- [ ] Idempotência: `CREATE SEQUENCE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.

#### Hints técnicos (não-prescritivos)

- **Arquivo:** `supabase/migrations/068_demands_protocolo_and_chat_link.sql`
- **Pattern trigger:** seguir padrão do trigger `set_demand_protocolo` similar aos triggers existentes na migration 036 (`trigger_sync_multiplicador_to_leader`).
- **Retroativo:** o UPDATE de protocolos existentes deve ser idempotente (`WHERE protocolo IS NULL`).
- **zapi_chats:** `demand_id` é nullable — conversa não precisa ter demanda.

#### Test cases

- **Nova demanda:** INSERT em `demands` sem protocolo → trigger preenche `MAND-000001`.
- **Demanda existente:** retroativo → todos os registros existentes têm protocolo único.
- **Vínculo:** UPDATE `zapi_chats SET demand_id = '<id>'` → sucesso.
- **Cascata:** DELETE demand → `zapi_chats.demand_id` vira NULL (ON DELETE SET NULL).
- **UNIQUE:** inserir 2 demandas → protocolos diferentes.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] `types.ts` atualizado
- [ ] QA aprovou

#### Out of scope

- EF de notificação (é T61)
- UI de vinculação (é T62)
- Templates de mensagem configuráveis por status

---

### T61 — Edge Function zapi-demand-notify + trigger PG (C18)

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** model, route
**Depende de:** T60
**WSJF score:** (8 + 7 + 8) / 8 = **2.9**
**Segurança:** EF nova com `service_role` + trigger PG → net.http_post → Z-API → eleitor real — Security + Pentest obrigatórios

#### User story

Como eleitor cujo pedido foi registrado no sistema, quero receber uma mensagem
automática no WhatsApp quando o status da minha demanda mudar, para saber que minha
solicitação está sendo tratada sem precisar ligar para o gabinete.

#### Contexto

A notificação automática é o núcleo do C18. Quando o operador muda o status de uma
demanda (ex: `open → in_progress`, ou `in_progress → resolved`), um trigger PG
detecta a mudança e chama a EF `zapi-demand-notify` via `pg_net.http_post`. A EF
verifica: (a) a conta tem `isFeatureEnabled(config, 'c18')`; (b) o chat vinculado
existe (`zapi_chats.demand_id = demands.id`); (c) o contato tem `aceita_whatsapp=true`.
Se todas as condições passam, envia a mensagem ao eleitor.

Padrão idêntico ao cron de `zapi-send-scheduled` (migration 064 + EF existente).

#### Critérios de aceite

- [ ] Migration `069_demand_notify_trigger.sql` com trigger `on_demand_status_change` em `demands` AFTER UPDATE OF status.
- [ ] Trigger usa `pg_net.http_post` para chamar `zapi-demand-notify` somente quando `NEW.status != OLD.status`.
- [ ] EF `zapi-demand-notify` criada em `supabase/functions/zapi-demand-notify/index.ts`.
- [ ] EF recebe `{demand_id, old_status, new_status}`.
- [ ] EF busca: `demands.protocolo`, `demands.contact_id`, `zapi_chats` vinculado, conta Z-API do chat, configuração da conta.
- [ ] EF verifica `isFeatureEnabled(config, 'c18')` — se falso, retorna 200 sem enviar.
- [ ] EF verifica `contact.aceita_whatsapp = true` — se falso, registra log e retorna 200.
- [ ] Templates de mensagem por transição de status:
  - `open → in_progress`: "Olá {nome}! Seu pedido com protocolo {protocolo} foi recebido e está sendo analisado. Em breve retornaremos."
  - `in_progress → resolved`: "Olá {nome}! Seu pedido com protocolo {protocolo} foi concluído. Agradecemos o contato!"
  - Outras transições: sem envio (silencioso).
- [ ] Em caso de erro no envio Z-API, registra em log (não lança exception — trigger não deve falhar).
- [ ] EF protegida com `Authorization: Bearer <service_role>` na query string (padrão do projeto).
- [ ] Smoke test: alterar status de demand vinculada → mensagem recebida no WhatsApp do eleitor.

#### Hints técnicos (não-prescritivos)

- **Arquivos:** `supabase/migrations/069_demand_notify_trigger.sql` + `supabase/functions/zapi-demand-notify/index.ts`
- **Pattern trigger→EF:** seguir migration 064 (pg_net.http_post com service_role).
- **Pattern EF:** seguir `zapi-send-scheduled` — busca conta, chama `zapi-send-text`, trata erros sem lançar.
- **Variáveis:** `{nome}` = `contacts.nome`, `{protocolo}` = `demands.protocolo`.

#### Test cases

- **Happy path:** demand com chat vinculado, conta com c18 ativo, contato com `aceita_whatsapp=true` → muda status → mensagem enviada.
- **c18 desativado:** mesma situação mas `isFeatureEnabled=false` → sem envio, sem erro.
- **Sem opt-in:** contato com `aceita_whatsapp=false` → sem envio.
- **Sem chat vinculado:** `demand.chat_id = null` → sem envio, sem erro.
- **Erro Z-API:** Z-API retorna 500 → EF registra log, retorna 200, demand status atualizado normalmente.
- **Transição irrelevante (ex: reopen):** sem envio.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] QA aprovou (smoke test com demand real)

#### Out of scope

- Templates configuráveis via UI (futuro — hardcoded nesta entrega)
- Notificação de outros eventos além de mudança de status
- Histórico de mensagens enviadas pelo trigger

---

### T62 — UI: vincular conversa a demanda + badge de protocolo (C18)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T60, T61
**WSJF score:** (8 + 7 + 6) / 5 = **4.2**

#### User story

Como atendente do gabinete, quero vincular uma conversa WhatsApp a uma demanda
existente e ver o número de protocolo no painel, para que o eleitor receba o retorno
automático quando o status da demanda mudar.

#### Contexto

Com a infra de T60+T61 no ar, o operador precisa de UI para fazer a vinculação
conversa↔demanda. O painel do contato (`ContactPanel`) recebe uma seção "Demanda
vinculada". O vínculo é opcional — nem toda conversa tem demanda.

O campo `zapi_chats.demand_id` é escrito pela EF `zapi-chat-update` (já existente —
aceita patch genérico). Assim, não é necessária nova EF para o vínculo.

#### Critérios de aceite

- [ ] Seção "Demanda vinculada" no `ContactPanel`, visível quando `isFeatureEnabled(config, 'c18')`.
- [ ] Quando `chat.demand_id` é null: botão "Vincular demanda" abre Combobox para buscar demandas do contato atual (`useDemands({contact_id: chat.contact_id})`).
- [ ] Quando `chat.demand_id` está preenchido: exibe título da demanda + badge com `protocolo` (ex: "MAND-000042") + status da demanda + botão "Desvincular".
- [ ] Vincular: chama `zapi-chat-update` com `{demand_id: id}` — toast "Demanda vinculada".
- [ ] Desvincular: chama `zapi-chat-update` com `{demand_id: null}` — toast "Demanda desvinculada".
- [ ] Badge do protocolo é copiável (click → copia para clipboard + toast "Copiado!").
- [ ] Combobox filtra demandas por busca de texto (título); mostra status como badge colorido.

#### Hints técnicos (não-prescritivos)

- **Hook:** `useDemands` (filtro por `contact_id`) + `useChatUpdate` (existente em `src/hooks/useChatUpdate.ts`).
- **Component:** `src/components/whatsapp/ContactPanel.tsx` + novo subcomponente `DemandLinkSection.tsx`.
- **UI:** `Combobox` shadcn (Command + Popover) para busca de demanda; `Badge` para protocolo.
- **Pattern:** seguir `ContactFunnelSection.tsx` (seção de funil no painel) para a estrutura.

#### Test cases

- **Happy path:** conversa sem demanda → buscar demanda → vincular → protocolo aparece.
- **Desvincular:** protocolo desaparece, seção volta ao estado "não vinculada".
- **Copiar protocolo:** clica no badge → toast "Copiado!" → protocolo está no clipboard.
- **Feature desabilitada:** `isFeatureEnabled(config, 'c18') = false` → seção não aparece.
- **Demanda não encontrada:** busca sem resultados → mensagem "Nenhuma demanda encontrada".

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] Smoke test: vincular demanda → mudar status da demanda → confirmar mensagem no WhatsApp
- [ ] QA aprovou

#### Out of scope

- Criar nova demanda a partir da conversa (já existe T11 na Fase 1 para criar demanda rápida)
- Múltiplas demandas por conversa (N:1 nesta entrega)

---

### T63 — Migration: tabelas zapi_broadcasts + zapi_broadcast_targets (C17)

**Tipo:** feature (infraestrutura)
**Estimativa:** M (5pt)
**Camadas afetadas:** model
**Depende de:** T58 (opt-in deve existir antes)
**WSJF score:** (9 + 8 + 9) / 5 = **5.2**
**Segurança:** novas tabelas com `user_id` + broadcast é superfície crítica máxima — Security + Pentest obrigatórios

#### User story

Como desenvolvedor mantendo o módulo WhatsApp, quero as tabelas de campanhas broadcast
e seus targets no banco, com RLS restritiva e audit trail básico, para que a feature C17
possa ser construída com rastreabilidade e controle de envio.

#### Contexto

O broadcast é o recurso de maior risco de ban e de maior impacto em privacidade neste
projeto. A arquitetura de 2 tabelas (campanha + targets) garante rastreabilidade total:
quem foi alvo, o que foi enviado, qual o status de cada envio. O campo `ritmo_por_minuto`
é o controle anti-ban. O campo `tipo` suporta tanto mensagem de texto (C17) quanto
enquete (C23).

#### Critérios de aceite

- [ ] Migration `070_zapi_broadcast_schema.sql` aplicada sem erro.
- [ ] Tabela `zapi_broadcasts`:
  - `id UUID PK DEFAULT gen_random_uuid()`
  - `account_id UUID NOT NULL REFERENCES zapi_accounts(id) ON DELETE CASCADE`
  - `title TEXT NOT NULL`
  - `body TEXT NOT NULL`
  - `tipo TEXT NOT NULL DEFAULT 'mensagem' CHECK (tipo IN ('mensagem', 'enquete'))`
  - `poll_question TEXT` (nullable, obrigatório quando tipo='enquete')
  - `poll_options JSONB` (nullable)
  - `segment_filters JSONB NOT NULL DEFAULT '{}'`
  - `status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','agendado','enviando','concluido','cancelado','falha'))`
  - `ritmo_por_minuto INT NOT NULL DEFAULT 10 CHECK (ritmo_por_minuto BETWEEN 1 AND 30)`
  - `scheduled_at TIMESTAMPTZ`
  - `started_at TIMESTAMPTZ`, `finished_at TIMESTAMPTZ`
  - `total_targets INT NOT NULL DEFAULT 0`
  - `sent_count INT NOT NULL DEFAULT 0`, `failed_count INT NOT NULL DEFAULT 0`
  - `created_by UUID NOT NULL REFERENCES auth.users(id)`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- [ ] Tabela `zapi_broadcast_targets`:
  - `id UUID PK DEFAULT gen_random_uuid()`
  - `broadcast_id UUID NOT NULL REFERENCES zapi_broadcasts(id) ON DELETE CASCADE`
  - `contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL`
  - `phone TEXT NOT NULL`
  - `status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','falha','bloqueado'))`
  - `bloqueio_motivo TEXT` (nullable — ex: 'sem_optin', 'merged', 'invalid_phone')
  - `sent_at TIMESTAMPTZ`, `error_msg TEXT`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- [ ] RLS em `zapi_broadcasts`: SELECT/DELETE por `created_by = auth.uid()`; INSERT/UPDATE bloqueados no client (apenas service_role).
- [ ] RLS em `zapi_broadcast_targets`: SELECT por usuário autenticado da conta (via JOIN broadcasts); INSERT/UPDATE/DELETE bloqueados no client (apenas service_role).
- [ ] Índices: `idx_zapi_broadcast_targets_pendente(broadcast_id, status) WHERE status='pendente'`; `idx_zapi_broadcasts_account(account_id, status)`.
- [ ] `types.ts` regenerado e commitado.
- [ ] CHECK: `body` max 4096 chars; `title` max 255 chars.
- [ ] Constraint: quando `tipo='enquete'`, `poll_question` deve ser NOT NULL (CHECK com `(tipo != 'enquete' OR poll_question IS NOT NULL)`).

#### Hints técnicos (não-prescritivos)

- **Arquivo:** `supabase/migrations/070_zapi_broadcast_schema.sql`
- **Pattern RLS:** seguir migration 066 (INSERT bloqueado no client — `WITH CHECK (false)`).
- **Constraint condicional:** `CHECK (tipo != 'enquete' OR poll_question IS NOT NULL)`.

#### Test cases

- **Schema:** `\d zapi_broadcasts` e `\d zapi_broadcast_targets` mostram todas as colunas.
- **RLS INSERT bloqueado:** cliente autenticado tenta INSERT direto → erro de RLS.
- **RLS SELECT:** cliente lê broadcasts dos quais é `created_by` → sucesso.
- **Constraint ritmo:** INSERT com `ritmo_por_minuto = 31` → erro de CHECK.
- **Constraint enquete:** INSERT com `tipo='enquete'` e `poll_question=NULL` → erro de CHECK.
- **Idempotência:** migration rodada duas vezes → sem erro.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] `types.ts` atualizado
- [ ] QA aprovou

#### Out of scope

- EFs de broadcast (é T64)
- UI de gestão de campanhas (é T65+T66)
- Relatório de resultados de campanha

---

### T64 — EF zapi-broadcast-create + zapi-broadcast-send + cron (C17)

**Tipo:** feature
**Estimativa:** XL (13pt)
**Camadas afetadas:** route, model
**Depende de:** T58, T63
**WSJF score:** (9 + 8 + 9) / 13 = **2.0** — grande mas bloqueante de T65/T66
**Segurança:** 2 EFs novas `service_role` + cron job + envio em massa → Security + Pentest obrigatórios. Esta é a task de maior risco de segurança da Fase 6.

#### User story

Como assessor de comunicação, quero que o sistema resolva automaticamente quem deve
receber uma campanha (com base nos filtros e no opt-in), enfileire os envios e os
processe no ritmo configurado, para que o broadcast chegue a toda a base segmentada
sem risco de ban do número.

#### Contexto

Esta task implementa o motor do broadcast. `zapi-broadcast-create` resolve o segmento
(aplica filtros sobre `contacts` com `optin_whatsapp=true`) e cria os targets. Impede
que qualquer contato sem opt-in seja enfileirado — esta verificação acontece no backend,
não apenas no frontend. `zapi-broadcast-send` processa N targets por minuto (N =
`ritmo_por_minuto`). O cron job chama `zapi-broadcast-send` a cada minuto.

A separação em 2 EFs é deliberada: `create` é chamada pelo usuário (UI), `send` é
chamada pelo cron (automático). Isso evita que o usuário espere o envio completo na
UI.

#### Critérios de aceite

- [ ] EF `zapi-broadcast-create` criada em `supabase/functions/zapi-broadcast-create/index.ts`.
  - Recebe: `{broadcast_id: string}`.
  - Lê o broadcast e os `segment_filters` (pode conter `tags: string[]`, `bairro: string`, `zona_eleitoral: string`).
  - Busca contatos que satisfazem os filtros E têm `optin_whatsapp = true` E `merged_into IS NULL`.
  - Cria registros em `zapi_broadcast_targets` para cada contato elegível.
  - Para contatos encontrados pelos filtros mas sem `optin_whatsapp`, cria target com `status='bloqueado'` e `bloqueio_motivo='sem_optin'`.
  - Atualiza `zapi_broadcasts.total_targets = count(targets com status!='bloqueado')`.
  - Muda `status` do broadcast para `'agendado'` se `scheduled_at > now()`, ou `'enviando'` se `scheduled_at IS NULL` ou `<= now()`.
  - 400 se `broadcast_id` inválido; 422 se broadcast não está em `'rascunho'`.
- [ ] EF `zapi-broadcast-send` criada em `supabase/functions/zapi-broadcast-send/index.ts`.
  - Chamada pelo cron (sem body necessário) ou via HTTP para testes.
  - Busca broadcasts com `status = 'enviando'`.
  - Para cada broadcast ativo: lê N targets `status='pendente'` (N = `ritmo_por_minuto`).
  - Chama `zapi-send-text` (ou `zapi-send-poll` quando `tipo='enquete'`) para cada target.
  - Atualiza target `status='enviado'` ou `status='falha'` + `error_msg`.
  - Atualiza contadores `sent_count` / `failed_count` em `zapi_broadcasts`.
  - Quando `sent_count + failed_count = total_targets`: muda broadcast `status='concluido'` e registra `finished_at`.
  - Erros individuais de envio não param o processamento (continua para o próximo target).
- [ ] Migration `071_zapi_broadcast_cron.sql` com cron job `'zapi-broadcast-sender'` a cada minuto via `pg_net.http_post`.
- [ ] `zapi-broadcast-send` protegida: aceita apenas chamadas com `Authorization: Bearer <service_role>`.
- [ ] `zapi-broadcast-create` protegida: aceita JWT de usuário autenticado (verifica `created_by = auth.uid()`).
- [ ] Verificação de opt-in dupla: bloqueio tanto na fase de criação de targets quanto no envio (double-check antes de chamar Z-API).
- [ ] Limite de taxa: implementar controle no cron para não processar mais de 1 broadcast de alta prioridade de uma vez (evitar sobrecarga).

#### Hints técnicos (não-prescritivos)

- **Arquivos:** `supabase/functions/zapi-broadcast-create/index.ts`, `supabase/functions/zapi-broadcast-send/index.ts`, `supabase/migrations/071_zapi_broadcast_cron.sql`
- **Pattern:** seguir `zapi-send-scheduled` para a lógica do cron. Seguir `zapi-bulk-chat-update` para operações em lote.
- **Filtros de segmento:** usar `.in('contact_tags.tag_id', tags)` com `!inner` para filtro de tags server-side (lição de `useMapContacts`).
- **Double-check opt-in:** `AND optin_whatsapp = true` na query de busca de contatos E antes de chamar Z-API.

#### Test cases

- **Happy path:** broadcast criado → `create` chamada → targets criados → cron chama `send` → mensagens enviadas → broadcast `status='concluido'`.
- **Segmentação por tag:** somente contatos com a tag especificada e opt-in recebem.
- **Bloqueio sem opt-in:** contatos sem opt-in → target criado com `status='bloqueado'` → não enviado.
- **Ritmo:** com `ritmo_por_minuto=5` e 20 targets, após 1 execução do cron → 5 enviados (não 20).
- **Falha individual:** 1 target falha → demais continuam → `failed_count` incrementado.
- **Broadcast concluído:** após todos enviados → `status='concluido'`, `finished_at` preenchido.
- **Double-check:** contato perde opt-in entre create e send → bloqueado na fase de send.
- **Proteção EF:** chamada sem service_role → 401.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] Smoke test: broadcast de teste para 3 contatos com opt-in → 3 mensagens recebidas
- [ ] QA aprovou (incluindo teste de opt-in bloqueado)

#### Out of scope

- UI de campanhas (é T65+T66)
- Cancelamento de broadcast em andamento (futuro)
- Relatório de taxa de abertura (Z-API não-oficial não suporta leitura confiável)
- Opt-in via resposta do eleitor (origem 'mensagem' — futuro)

---

### T65 — UI: tela de gestão de campanhas broadcast (C17)

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** hook, component
**Depende de:** T63, T64
**WSJF score:** (9 + 8 + 7) / 8 = **3.0**

#### User story

Como assessor de comunicação, quero uma tela para ver todas as campanhas broadcast —
rascunhos, em andamento e concluídas — com o status de envio em tempo real, para
gerenciar as comunicações do mandato.

#### Contexto

A tela de gestão é o painel de controle de campanhas. Não fica dentro do chat individual
— é uma aba dedicada no módulo WhatsApp (ou uma nova página em `/whatsapp/campanhas`).
Mostra a lista de broadcasts, seus status e contadores. Um broadcast em `'enviando'`
deve atualizar contadores em tempo real (Supabase Realtime já está disponível no projeto).

#### Critérios de aceite

- [ ] Nova aba "Campanhas" (ou página `/whatsapp/campanhas`) acessível a partir da aba WhatsApp, visível apenas quando `isFeatureEnabled(config, 'c17')` em pelo menos uma conta ativa.
- [ ] Lista de campanhas com colunas: título, conta, tipo (mensagem/enquete), status (badge colorido), `sent_count/total_targets`, data de criação.
- [ ] Filtros: por status, por conta.
- [ ] Status badges coloridos: rascunho=cinza, agendado=azul, enviando=amarelo animado, concluido=verde, cancelado=vermelho, falha=vermelho.
- [ ] Campanha em `'enviando'`: barra de progresso `sent_count/total_targets`.
- [ ] Botão "Ver detalhes" abre painel/drawer com lista de targets (phone, status, sent_at, error_msg).
- [ ] Botão "Nova campanha" abre o fluxo de composição (T66).
- [ ] Estado vazio: "Nenhuma campanha criada. Crie a primeira campanha de comunicação."
- [ ] Realtime: `sent_count` e `status` atualizam sem reload (subscribing no canal Supabase Realtime).

#### Hints técnicos (não-prescritivos)

- **Hook:** novo `useZapiBroadcasts(accountId?)` em `src/hooks/useZapiBroadcasts.ts` — `listQuery` + `cancelMutation`.
- **Component:** `src/components/whatsapp/BroadcastsTabContent.tsx` ou `src/pages/WhatsappBroadcasts.tsx`.
- **Realtime:** seguir padrão de `useZapiChats` (subscribe em canal Supabase Realtime).
- **Tabela de targets:** `useZapiBroadcastTargets(broadcastId)` separado — só carrega ao abrir detalhes.

#### Test cases

- **Happy path:** lista mostra broadcasts criados com status correto.
- **Realtime:** broadcast em andamento → `sent_count` aumenta sem reload.
- **Feature desabilitada:** conta sem `c17` ativo → aba não aparece.
- **Empty state:** nenhuma campanha → mensagem de empty state.
- **Detalhes:** clicar em "Ver detalhes" → lista de targets com status.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] QA aprovou

#### Out of scope

- Edição de campanha em andamento (cancelar primeiro)
- Exportação de resultados de campanha

---

### T66 — UI: composer de campanha + filtros de segmento (C17)

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** hook, component
**Depende de:** T64, T65
**WSJF score:** (9 + 8 + 6) / 8 = **2.9**

#### User story

Como assessor de comunicação, quero compor uma campanha escolhendo o texto, segmentando
por tag/bairro/zona e configurando o ritmo de envio, e ver quantos contatos elegíveis
(com opt-in) serão atingidos antes de confirmar o disparo, para garantir que só envio
para quem autorizou e no ritmo seguro.

#### Contexto

O composer de campanha é um wizard de 3 passos: (1) conteúdo — título, texto/enquete;
(2) segmentação — filtros de tag/bairro/zona + preview da contagem de elegíveis;
(3) configuração — ritmo, agendamento + confirmação. A contagem de elegíveis (step 2)
é uma chamada client-side ao banco (`COUNT contacts WHERE optin_whatsapp=true AND filtros`)
— não chama a EF ainda. A EF só é chamada ao confirmar no step 3.

#### Critérios de aceite

- [ ] Dialog/Sheet de composição com 3 passos (stepper visual).
- [ ] **Step 1 — Conteúdo:**
  - Campo título (obrigatório).
  - Toggle tipo: "Mensagem" ou "Enquete".
  - Se mensagem: textarea com contador de caracteres (max 4096).
  - Se enquete: campos de pergunta + opções (reutilizar lógica do `PollDialog`).
  - Preview da mensagem renderizada (mostra como chegará ao eleitor).
- [ ] **Step 2 — Segmentação:**
  - Multi-select de tags (`useTags()`).
  - Campo bairro (texto livre ou select dos bairros distintos da base).
  - Campo zona eleitoral (texto livre).
  - Contador "X contatos elegíveis (com opt-in)" — atualiza ao mudar filtros (debounce 500ms).
  - Aviso em destaque se elegíveis = 0: "Nenhum contato com consentimento neste segmento."
  - Aviso: "Y contatos neste segmento não têm opt-in e serão bloqueados."
- [ ] **Step 3 — Configuração:**
  - Slider de ritmo (1–30 mensagens/minuto; padrão 10).
  - Toggle "Enviar agora" vs "Agendar" (DateTimePicker se agendar).
  - Resumo: "X contatos | Y msg/min | Tempo estimado: Z min".
  - Botão "Confirmar e disparar" → chama `zapi-broadcast-create` → toast "Campanha iniciada".
- [ ] Validação de step: não avança se campos obrigatórios ausentes; botão "Próximo" desabilitado.
- [ ] Após confirmar: dialog fecha, lista de campanhas (T65) atualiza.
- [ ] Contagem de elegíveis usa `optin_whatsapp=true` — não é estimativa, é valor real do banco.

#### Hints técnicos (não-prescritivos)

- **Hook:** `useZapiBroadcasts` (create mutation chama `zapi-broadcast-create`) + query de contagem de elegíveis inline.
- **Component:** `src/components/whatsapp/BroadcastComposerDialog.tsx`.
- **Reutilizar:** lógica de opções do `PollDialog` para o step de enquete.
- **Slider:** `Slider` do shadcn/ui.
- **DateTimePicker:** composição de `Input type="date"` + `Input type="time"` (sem lib extra).
- **Contagem:** `SELECT count(*) FROM contacts WHERE optin_whatsapp=true AND [filtros]` — query direta do Supabase client.

#### Test cases

- **Happy path:** compor mensagem → segmentar → ver contagem → confirmar → campanha aparece em T65.
- **Contagem zero:** filtrar bairro sem contatos → aviso "Nenhum contato elegível" → botão confirmar desabilitado.
- **Enquete:** step 1 com tipo enquete → campos de pergunta/opções → step funciona normalmente.
- **Agendamento:** toggle "Agendar" → selecionar data futura → confirmar → broadcast com `scheduled_at` e `status='agendado'`.
- **Validação:** tentar avançar step sem título → botão desabilitado + mensagem de erro.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] Smoke test: campanha de teste para 1 contato opt-in → mensagem recebida
- [ ] QA aprovou

#### Out of scope

- Templates de mensagem salvos (respostas rápidas já cobrem isso)
- A/B testing de mensagens
- Importar lista de números externos (fora do CRM)

---

### T67 — UI: bairro/zona eleitoral no ContactPanel + link para mapa (C21)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** — (colunas já existem, infra já está no ar)
**WSJF score:** (7 + 5 + 5) / 2 = **8.5** — sem migration, entrega imediata de valor

#### User story

Como atendente do gabinete, quero ver e editar o bairro e a zona eleitoral do eleitor
diretamente no painel lateral da conversa, e ter um link rápido para ver esse eleitor
no mapa, para trabalhar o contexto geográfico sem trocar de tela.

#### Contexto

`contacts.bairro` e `contacts.zona_eleitoral` existem no schema desde migration 001.
O `ContactPanel` (T07/T08 da Fase 1) já editou outros campos — bairro e zona são
adicionados na mesma seção de localização. O LeadsMap (`/mapa`) aceita filtro por
`bairro` via state. O botão "Ver no mapa" pode usar `useNavigate` com state ou
query parameter.

#### Critérios de aceite

- [ ] Campo "Bairro" editável inline no `ContactPanel` (click-to-edit, padrão T07).
- [ ] Campo "Zona eleitoral" editável inline no `ContactPanel`.
- [ ] Ambos salvam via `useUpdateContact` no blur com toast de confirmação.
- [ ] Botão "Ver no mapa" visível quando `contact.bairro` está preenchido; navega para `/mapa` com filtro `bairro` pré-aplicado.
- [ ] `ChatListItem` exibe `contact.bairro` como texto secundário (subtítulo) quando preenchido.
- [ ] Rollback otimista se a mutation falhar.

#### Hints técnicos (não-prescritivos)

- **Hook:** `useUpdateContact` (existente).
- **Component:** `ContactPanel.tsx` (adicionar campos na seção de localização existente) + `ChatListItem.tsx` (adicionar bairro como subtítulo).
- **Navegação:** `useNavigate` do React Router com `{state: {bairro: contact.bairro}}` ou query param `/mapa?bairro=<bairro>`. Verificar como `MapFilters` é inicializado em `LeadsMap.tsx`.

#### Test cases

- **Happy path:** editar bairro → blur → toast "Salvo" → bairro aparece no ChatListItem.
- **Ver no mapa:** contato com bairro → botão "Ver no mapa" → `/mapa` abre com filtro.
- **Sem bairro:** botão "Ver no mapa" não aparece; ChatListItem não mostra subtítulo vazio.
- **Rollback:** mutation falha → campo volta ao valor anterior.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] QA aprovou

#### Out of scope

- Autocompletar bairros a partir da lista de bairros da base (melhoria futura)
- Edição de endereço completo (logradouro, CEP etc.) — já existe no modal de edição completa (T08)

---

### T68 — UI: badge de aniversariante no ChatListItem + seção no ContactPanel (C19)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** — (sem migration, `data_nascimento` já existe)
**WSJF score:** (7 + 6 + 5) / 5 = **3.6**

#### User story

Como atendente do gabinete, quero ser alertado quando um eleitor faz aniversário hoje
diretamente na lista de conversas, e ter um botão de 1 clique para enviar parabéns,
para não perder a oportunidade de relacionamento sem precisar consultar o dashboard.

#### Contexto

`useBirthdays()` em `src/hooks/useDashboard.ts` já retorna `today` e `next7` buscando
`id, nome, data_nascimento`. No contexto WhatsApp, o `ChatListItem` pode verificar
se `chat.contact?.data_nascimento` cai no dia de hoje (cálculo client-side, sem nova
query). `ContactPanel` exibe a data de aniversário e o botão de ação. O botão pré-preenche
o composer com mensagem padrão ("Parabéns, {nome}! O gabinete deseja um feliz aniversário!"),
editável antes de enviar.

#### Critérios de aceite

- [ ] `ChatListItem` exibe badge "Aniversariante hoje" (ícone de bolo + texto) quando `contact.data_nascimento` é hoje (mês + dia, sem ano).
- [ ] Badge é visível mesmo com outras informações no item (não sobrepõe nome).
- [ ] Seção "Aniversário" no `ContactPanel` exibe a data formatada ("DD de mês — X anos") quando `data_nascimento` preenchida.
- [ ] Botão "Enviar parabéns" no `ContactPanel` (visível somente em aniversários da semana — hoje + próximos 7 dias): abre o composer de texto pré-preenchido com a mensagem padrão e foco no campo de texto para edição antes de enviar.
- [ ] Mensagem padrão usa `contact.nome` (variável real, não placeholder literal).
- [ ] O badge em `ChatListItem` usa apenas cálculo client-side (sem chamada extra ao banco).
- [ ] Seção de aniversário no painel é somente leitura (a data é editável via modal de contato T08, não aqui).

#### Hints técnicos (não-prescritivos)

- **Cálculo:** `getMonth(new Date(dataNascimento)) === getMonth(today) && getDate(new Date(dataNascimento)) === getDate(today)` — cuidado com timezone (usar `parseISO` do date-fns para datas de banco).
- **Component:** `ChatListItem.tsx` (badge) + `ContactPanel.tsx` (seção aniversário).
- **Composer pré-preenchido:** expor prop `initialText` ou similar no composer; seguir padrão de respostas rápidas (T47 da Fase 5).
- **Ícone:** `Cake` do lucide-react (já importado em `BirthdaySection.tsx`).

#### Test cases

- **Aniversariante hoje:** contato com `data_nascimento` = hoje → badge visível no ChatListItem.
- **Não aniversariante:** data diferente → sem badge.
- **Botão parabéns:** clica → composer abre com "Parabéns, [nome]! O gabinete deseja um feliz aniversário!" pré-preenchido.
- **Próximos 7 dias:** contato com aniversário em 3 dias → seção no painel mostra "em 3 dias" + botão ativo.
- **Sem data:** campo vazio → seção não aparece no painel; sem badge no ChatListItem.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] QA aprovou

#### Out of scope

- Envio automático de parabéns (sem intervenção do atendente — risco de spam)
- Exibir aniversariantes como aba separada (BirthdaySection do dashboard já faz isso)

---

### T69 — Migration: tabelas mandato_events + contact_event_rsvps (C20)

**Tipo:** feature (infraestrutura)
**Estimativa:** S (2pt)
**Camadas afetadas:** model
**Depende de:** — (independente)
**WSJF score:** (6 + 5 + 5) / 2 = **8.0**
**Segurança:** novas tabelas com `user_id` — Security obrigatório

#### User story

Como desenvolvedor mantendo o módulo WhatsApp, quero as tabelas de eventos do mandato
e de confirmações de presença (RSVP), para que a feature C20 (convite a evento) possa
armazenar os dados necessários.

#### Critérios de aceite

- [ ] Migration `072_mandato_events.sql` aplicada sem erro.
- [ ] Tabela `mandato_events`:
  - `id UUID PK DEFAULT gen_random_uuid()`
  - `title TEXT NOT NULL`
  - `descricao TEXT`
  - `data_evento TIMESTAMPTZ NOT NULL`
  - `local TEXT`
  - `account_id UUID NOT NULL REFERENCES zapi_accounts(id) ON DELETE CASCADE`
  - `created_by UUID NOT NULL REFERENCES auth.users(id)`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- [ ] Tabela `contact_event_rsvps`:
  - `id UUID PK DEFAULT gen_random_uuid()`
  - `event_id UUID NOT NULL REFERENCES mandato_events(id) ON DELETE CASCADE`
  - `contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE`
  - `status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmado','recusado'))`
  - `respondido_em TIMESTAMPTZ`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `UNIQUE(event_id, contact_id)`
- [ ] RLS em `mandato_events`: SELECT/INSERT/UPDATE/DELETE por usuário autenticado (owner = `created_by`).
- [ ] RLS em `contact_event_rsvps`: SELECT para autenticados; INSERT/UPDATE/DELETE pelo serviço ou owner do evento.
- [ ] Índice `idx_mandato_events_account(account_id, data_evento)`.
- [ ] Índice `idx_contact_event_rsvps_event(event_id, status)`.
- [ ] `types.ts` regenerado e commitado.

#### Hints técnicos (não-prescritivos)

- **Arquivo:** `supabase/migrations/072_mandato_events.sql`
- **Pattern:** seguir estrutura de `demands` (tabela simples com contact + status + FK).

#### Test cases

- **Schema:** `\d mandato_events` e `\d contact_event_rsvps` corretos.
- **UNIQUE:** 2 RSVPs para o mesmo event+contact → erro de constraint.
- **Cascata:** deletar evento → RSVPs deletados em cascata.
- **Idempotência:** migration rodada duas vezes → sem erro.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] `types.ts` atualizado
- [ ] QA aprovou

#### Out of scope

- CRUD de eventos (é T70)
- Envio de convite e RSVP (é T71)

---

### T70 — CRUD de eventos do mandato (C20)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T69
**WSJF score:** (6 + 5 + 5) / 5 = **3.2**

#### User story

Como assessor de comunicação, quero criar, listar, editar e excluir eventos do mandato
(data, local, descrição), para ter uma agenda centralizada de onde disparar convites
pelo WhatsApp.

#### Contexto

CRUD completo de `mandato_events`. Segue a Regra Rodrigo: feature com inserção = criar
+ listar + editar + excluir. A interface pode ser uma aba ou seção dentro do módulo
WhatsApp (aba "Eventos") ou uma tela dedicada. O CRUD é independente do envio de
convites (que é T71).

#### Critérios de aceite

- [ ] Hook `useMandatoEvents(accountId?)` em `src/hooks/useMandatoEvents.ts` com `listQuery`, `createMutation`, `updateMutation`, `deleteMutation`.
- [ ] Tela/aba "Eventos" acessível no módulo WhatsApp com listagem de eventos futuros + passados.
- [ ] Formulário de criação: título (obrigatório), data/hora (obrigatório), local (opcional), descrição (opcional), conta Z-API (select — conta de onde convites serão enviados).
- [ ] Inline edit ou modal de edição com os mesmos campos.
- [ ] Exclusão com `AlertDialog` de confirmação ("Excluir evento exclui também as confirmações de presença").
- [ ] Lista ordenada por `data_evento ASC` (próximos primeiro).
- [ ] Badge de contagem de confirmados em cada evento da lista.
- [ ] Estado vazio: "Nenhum evento criado. Crie um evento para disparar convites."

#### Hints técnicos (não-prescritivos)

- **Hook:** `src/hooks/useMandatoEvents.ts` — seguir padrão de `useDemands.ts`.
- **Component:** `src/components/whatsapp/EventosTabContent.tsx` ou similar.
- **DateTimePicker:** `Input type="datetime-local"` + conversão para TIMESTAMPTZ.
- **Badge confirmados:** query `contact_event_rsvps` com `COUNT(*) WHERE status='confirmado'` — pode ser embutida no select do evento.

#### Test cases

- **Criar:** form preenchido → submit → evento aparece na lista.
- **Editar:** clicar editar → modal abre com dados → alterar → salvar → reflete na lista.
- **Excluir:** clicar excluir → AlertDialog → confirmar → evento some.
- **Ordenação:** eventos futuros aparecem antes dos passados.
- **Empty state:** sem eventos → mensagem de empty state.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] QA aprovou (criar + editar + excluir)

#### Out of scope

- Envio de convite pelo WhatsApp (é T71)
- Integração com Google Calendar
- Notificação de lembrete de evento

---

### T71 — UI: enviar convite de evento + registrar RSVP (C20)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T69, T70
**WSJF score:** (6 + 5 + 6) / 5 = **3.4**

#### User story

Como atendente do gabinete, quero enviar um convite de evento pelo WhatsApp diretamente
da conversa e marcar a resposta do eleitor (confirmado/recusado), para gerenciar
presenças sem sair do CRM.

#### Contexto

O convite de evento a partir da conversa é um caso de uso de 1 contato. O atendente,
dentro do `ContactPanel` ou do menu de ações da conversa, seleciona o evento e envia
uma mensagem pré-formatada. O RSVP é registrado manualmente pelo atendente (baseado
na resposta do eleitor na conversa — não é automático por parsing de mensagem).

#### Critérios de aceite

- [ ] Botão "Enviar convite de evento" no `ContactPanel` (visível quando `isFeatureEnabled(config, 'c20')` e há eventos futuros para a conta).
- [ ] Abre `EventInviteDialog`: lista de eventos futuros da conta + preview da mensagem de convite.
- [ ] Mensagem padrão do convite: "Olá {nome}! Você está convidado(a) para {título} em {data} às {hora}, no local: {local}. Confirme sua presença respondendo SIM ou NÃO."
- [ ] Botão "Enviar convite" → usa `useSendZapiText` para enviar a mensagem + cria `contact_event_rsvps` com `status='pendente'`.
- [ ] Na seção de evento do `ContactPanel` (ou no painel de detalhes do evento T70): exibir status do RSVP do contato atual + botões "Confirmado" / "Recusado" para atualizar manualmente.
- [ ] Atualizar RSVP: `updateMutation` em `useMandatoEvents` / hook de RSVPs.
- [ ] Toast de confirmação ao enviar convite e ao atualizar RSVP.
- [ ] Se contato já tem RSVP para o evento: "Convite já enviado — Status: [status]" (sem enviar duplicado sem confirmação).

#### Hints técnicos (não-prescritivos)

- **Hook:** `useContactEventRsvps(contactId)` para ler/atualizar RSVPs do contato; `useSendZapiText` para envio.
- **Component:** `src/components/whatsapp/EventInviteDialog.tsx` (dialog de seleção + preview) + seção no `ContactPanel`.
- **Formato de data:** `format(new Date(evento.data_evento), "dd/MM/yyyy 'às' HH:mm", {locale: ptBR})`.

#### Test cases

- **Happy path:** clicar "Enviar convite" → selecionar evento → ver preview → enviar → mensagem na conversa + RSVP criado.
- **RSVP já existente:** botão mostra estado atual + permite atualizar (não reenvia duplicado silenciosamente).
- **Marcar confirmado:** clicar "Confirmado" → status atualiza → `respondido_em` preenchido.
- **Feature desabilitada:** `isFeatureEnabled=false` → botão não aparece.
- **Sem eventos futuros:** dialog abre com "Nenhum evento futuro. Crie um evento primeiro."

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] QA aprovou

#### Out of scope

- RSVP automático por parsing de resposta do eleitor (ex: detectar "SIM" na mensagem)
- Envio em massa de convite para segmento (esse caso é coberto pelo broadcast C17)
- Exportar lista de confirmados como PDF

---

### T72 — Migration: tabela zapi_relationship_rules (C22)

**Tipo:** feature (infraestrutura)
**Estimativa:** S (2pt)
**Camadas afetadas:** model
**Depende de:** — (independente, mas valor só emerge com funil da Fase 1 em uso)
**WSJF score:** (6 + 5 + 6) / 2 = **8.5**
**Segurança:** nova tabela + cron job automático de follow-up — Security + Pentest obrigatórios

#### User story

Como desenvolvedor mantendo o módulo WhatsApp, quero a tabela de réguas de
relacionamento e sua infraestrutura de dados, para que a feature C22 (follow-up
automático por etapa de funil) possa ser implementada.

#### Critérios de aceite

- [ ] Migration `073_zapi_relationship_rules.sql` aplicada sem erro.
- [ ] Tabela `zapi_relationship_rules`:
  - `id UUID PK DEFAULT gen_random_uuid()`
  - `account_id UUID NOT NULL REFERENCES zapi_accounts(id) ON DELETE CASCADE`
  - `nome TEXT NOT NULL`
  - `board_stage_id UUID REFERENCES board_stages(id) ON DELETE SET NULL` (nullable — null = todas as etapas)
  - `dias_sem_resposta INT NOT NULL CHECK (dias_sem_resposta >= 1)`
  - `mensagem_template TEXT NOT NULL`
  - `ativo BOOL NOT NULL DEFAULT true`
  - `created_by UUID NOT NULL REFERENCES auth.users(id)`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- [ ] RLS: SELECT/INSERT/UPDATE/DELETE por usuário autenticado owner (`created_by`).
- [ ] Índice `idx_zapi_relationship_rules_account(account_id) WHERE ativo = true`.
- [ ] `types.ts` regenerado e commitado.
- [ ] Verificar se tabela `board_stages` existe no schema para FK correta (ou usar `board_id` + `stage_id` separados conforme schema real).

#### Hints técnicos (não-prescritivos)

- **Arquivo:** `supabase/migrations/073_zapi_relationship_rules.sql`
- **Verificar FK:** `board_stages` — confirmar nome da tabela em `types.ts` antes de criar FK.
- **Template:** `mensagem_template` usa variáveis `{nome}`, `{protocolo}` como nos outros templates do projeto.

#### Test cases

- **Schema:** `\d zapi_relationship_rules` correto.
- **CHECK:** `dias_sem_resposta = 0` → erro; `dias_sem_resposta = 1` → sucesso.
- **Idempotência:** migration rodada duas vezes → sem erro.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] `types.ts` atualizado
- [ ] QA aprovou

#### Out of scope

- EF de follow-up (é T73)
- UI de gestão de réguas (é T74)

---

### T73 — Edge Function zapi-relationship-followup + cron diário (C22)

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route, model
**Depende de:** T72
**WSJF score:** (6 + 5 + 7) / 8 = **2.3**
**Segurança:** EF nova `service_role` + cron que envia mensagens automaticamente — Security + Pentest obrigatórios

#### User story

Como coordenador do gabinete, quero que o sistema envie automaticamente uma mensagem
de follow-up para eleitores que não responderam há N dias conforme a régua configurada,
para manter o relacionamento ativo sem depender de ação manual do atendente.

#### Contexto

A régua de relacionamento é executada diariamente (não por minuto, como o broadcast).
A EF consulta `zapi_relationship_rules` ativas, busca chats cujos contatos estão
na etapa correspondente do funil e a última mensagem recebida tem mais de `dias_sem_resposta`
dias. Envia a mensagem via `zapi-send-text`. Inclui proteção contra re-envio (não
re-envia se já enviou follow-up nas últimas 24h para o mesmo chat+rule).

#### Critérios de aceite

- [ ] EF `zapi-relationship-followup` criada em `supabase/functions/zapi-relationship-followup/index.ts`.
- [ ] Busca todas as `zapi_relationship_rules` com `ativo=true`.
- [ ] Para cada regra: busca `zapi_chats` onde `status != 'finalizada'` E a última mensagem recebida (`FROM != 'me'`) tem timestamp mais antigo que `now() - interval '<dias_sem_resposta> days'`.
- [ ] Se `board_stage_id` na regra: filtra apenas contatos naquela etapa (join com `board_items`).
- [ ] Proteção anti-duplicata: não envia se já existe mensagem saída (`FROM = 'me'`) com conteúdo igual ao template nas últimas 24h naquele chat.
- [ ] Substitui variáveis `{nome}` e `{protocolo}` no template (protocolo da demand vinculada, se existir).
- [ ] Verifica `isFeatureEnabled(config, 'c22')` para a conta.
- [ ] Verifica `aceita_whatsapp=true` do contato antes de enviar.
- [ ] Migration `074_zapi_relationship_cron.sql` com cron job diário `'0 8 * * *'` (8h da manhã).
- [ ] EF protegida com `Authorization: Bearer <service_role>`.
- [ ] Máximo de 50 chats processados por execução (evitar timeout de EF).

#### Hints técnicos (não-prescritivos)

- **Arquivos:** `supabase/functions/zapi-relationship-followup/index.ts` + `supabase/migrations/074_zapi_relationship_cron.sql`
- **Última mensagem recebida:** query em `zapi_messages` com `chat_id = chat.id AND from_me = false ORDER BY timestamp DESC LIMIT 1`.
- **Pattern:** seguir `zapi-relationship-followup` similar ao `zapi-send-scheduled` mas com lógica de seleção de candidatos.

#### Test cases

- **Happy path:** contato sem resposta há 3 dias, regra com `dias_sem_resposta=3` → EF envia follow-up.
- **Ainda dentro do prazo:** 2 dias sem resposta, regra com 3 → sem envio.
- **Anti-duplicata:** EF executada 2x no mesmo dia → sem segundo envio.
- **Feature desabilitada:** `isFeatureEnabled(config, 'c22') = false` → sem envio.
- **Sem opt-in:** `aceita_whatsapp=false` → sem envio.
- **Chat finalizado:** `status='finalizada'` → não é candidato.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] Smoke test: regra criada → última mensagem com timestamp > N dias → executar EF manualmente → mensagem enviada
- [ ] QA aprovou

#### Out of scope

- Follow-up por tag (não por etapa de funil) — versão futura
- Relatório de follow-ups enviados pela régua
- Configuração de horário de envio por regra (é sempre às 8h na versão inicial)

---

### T74 — UI: gestão de réguas de relacionamento (C22)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** hook, component
**Depende de:** T72, T73
**WSJF score:** (6 + 5 + 5) / 5 = **3.2**

#### User story

Como coordenador do gabinete, quero criar, listar, ativar/desativar e excluir réguas
de follow-up, para controlar quando o sistema entra em contato automaticamente com
eleitores sem resposta.

#### Critérios de aceite

- [ ] Hook `useRelationshipRules(accountId)` em `src/hooks/useRelationshipRules.ts` com `listQuery`, `createMutation`, `updateMutation`, `deleteMutation`.
- [ ] Seção "Régua de Relacionamento" na aba de configuração WhatsApp (ou aba própria), visível quando `isFeatureEnabled(config, 'c22')`.
- [ ] Lista de réguas com: nome, etapa do funil, dias sem resposta, preview do template, toggle ativo/inativo.
- [ ] Formulário de criação: nome, select de etapa do funil (boards + stages via `useBoardItems`), dias sem resposta (número), textarea de template com hints de variáveis.
- [ ] Inline toggle ativo/inativo (Switch) salva via `updateMutation`.
- [ ] Exclusão com `AlertDialog` de confirmação.
- [ ] Estado vazio: "Nenhuma régua configurada. Configure follow-ups automáticos."

#### Hints técnicos (não-prescritivos)

- **Hook:** `src/hooks/useRelationshipRules.ts` — seguir padrão de `useDemands`.
- **Component:** `src/components/whatsapp/RelationshipRulesSection.tsx`.
- **Select de etapas:** reutilizar `useBoards` + `useBoardItems` para montar hierarquia funil > etapa.

#### Test cases

- **Criar:** nome + 3 dias + template → submit → aparece na lista.
- **Toggle ativo/inativo:** switch → persiste no banco.
- **Excluir:** AlertDialog → confirmar → some da lista.
- **Empty state:** sem réguas → mensagem.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] QA aprovou (criar + toggle + excluir)

#### Out of scope

- Preview do número de chats que seriam afetados pela régua
- Histórico de follow-ups enviados por régua

---

### T75 — Broadcast tipo enquete + consolidação de votos (C23)

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** route, hook, component
**Depende de:** T63, T64 (infra broadcast) + T65 (UI gestão) + T66 (composer)
**WSJF score:** (7 + 6 + 6) / 8 = **2.4**
**Segurança:** extensão do broadcast (superfície crítica) — Security + Pentest obrigatórios

#### User story

Como assessor de comunicação, quero disparar uma enquete de opinião para um segmento
de eleitores e ver a consolidação das respostas em tempo real, para entender o
posicionamento da base sem precisar cruzar dados manualmente.

#### Contexto

C23 é uma extensão do C17. A infra das tabelas já suporta `tipo='enquete'` (campo
adicionado em T63). Esta task implementa: (a) a lógica de envio via `zapi-send-poll`
na EF `zapi-broadcast-send` quando `tipo='enquete'`; (b) a coleta de respostas: o
`zapi-webhook` já recebe votos de enquete — precisa associar o voto ao `broadcast_id`
quando o chat tem uma campanha de enquete ativa; (c) tela de resultados com gráfico
de barras dos votos por opção.

#### Critérios de aceite

- [ ] EF `zapi-broadcast-send` usa `zapi-send-poll` quando `broadcast.tipo = 'enquete'` (usando `poll_question` e `poll_options`).
- [ ] Migration `075_zapi_broadcast_poll_votes.sql` com tabela `zapi_broadcast_poll_votes(id, broadcast_id, contact_id, phone, option_voted TEXT, received_at TIMESTAMPTZ)`.
- [ ] EF `zapi-webhook` identifica votos de enquete (`messageType = 'pollUpdateMessage'`) e, se o chat tem broadcast ativo do tipo 'enquete' (`zapi_broadcasts` com `status IN ('enviando','concluido')` vinculado à conta), insere em `zapi_broadcast_poll_votes`.
- [ ] Tela de resultados da campanha (botão "Ver resultados" em T65): exibe gráfico de barras (recharts, já disponível) com % de votos por opção.
- [ ] Total de participantes (votos únicos por contato) + total de votos.
- [ ] Resultados atualizam em tempo real via Supabase Realtime.
- [ ] O composer (T66) já suporta tipo 'enquete' — apenas validação que `poll_options` está preenchido antes de disparar.

#### Hints técnicos (não-prescritivos)

- **Migration:** `supabase/migrations/075_zapi_broadcast_poll_votes.sql`.
- **zapi-webhook:** verificar estrutura do payload de `pollUpdateMessage` no Z-API (pode variar — usar `console.log` defensivo para capturar estrutura real).
- **Gráfico:** `BarChart` do recharts (já presente no projeto — ver `src/pages/Dashboard.tsx`).
- **Realtime:** subscribe em `zapi_broadcast_poll_votes` filtrado por `broadcast_id`.

#### Test cases

- **Happy path:** broadcast tipo enquete disparado → eleitor vota → voto aparece nos resultados.
- **Múltiplos votos:** 3 eleitores votam opções diferentes → gráfico mostra 3 barras.
- **Realtime:** voto chegou → gráfico atualiza sem reload.
- **Broadcast texto:** não interfere — `zapi-webhook` só coleta votos para broadcasts do tipo 'enquete'.
- **Segmentação:** votos apenas de targets da campanha (não de outras enquetes do chat).

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] Smoke test: broadcast de enquete para 2 contatos → ambos votam → resultados corretos
- [ ] QA aprovou

#### Out of scope

- Análise cruzada de votos por bairro/tag (relatório avançado — futuro)
- Export de CSV de respostas

---

### T76 — UI: botão "Finalizar e enviar CSAT" (C29)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** component
**Depende de:** Fase 3 (status de conversa "finalizada" deve existir — T25-aprox da Fase 3); T63/T64 (usa a mesma infraestrutura de envio de poll)
**WSJF score:** (5 + 4 + 5) / 5 = **2.8**

#### User story

Como atendente do gabinete, quero ter a opção de enviar uma pesquisa de satisfação
ao eleitor quando finalizo o atendimento, para coletar feedback sem precisar fazer
isso manualmente a cada conversa.

#### Contexto

C29 é o recurso de menor dependência de infra desta fase — não requer nova EF nem
migration. A pesquisa CSAT é uma enquete WhatsApp de 1 pergunta com opções de 1 a 5
estrelas. O atendente escolhe entre "Finalizar apenas" ou "Finalizar e enviar CSAT".
Respostas ficam nas mensagens da conversa (sem aggregação nesta entrega).

#### Critérios de aceite

- [ ] Ao clicar "Finalizar conversa" (ação já existente de mudança de status para 'finalizada'), exibir `AlertDialog` com 3 opções: "Finalizar apenas", "Finalizar e enviar CSAT", "Cancelar".
- [ ] Opção "Finalizar e enviar CSAT" (visível apenas quando `isFeatureEnabled(config, 'c29')`): muda status para 'finalizada' E envia enquete CSAT via `useSendZapiPoll`.
- [ ] Enquete CSAT padrão: pergunta "Como você avalia o atendimento do gabinete?", opções ["⭐ Muito ruim", "⭐⭐ Ruim", "⭐⭐⭐ Regular", "⭐⭐⭐⭐ Bom", "⭐⭐⭐⭐⭐ Excelente"].
- [ ] Se feature desabilitada: botão "Finalizar conversa" funciona normalmente sem AlertDialog CSAT.
- [ ] Toast "Atendimento finalizado + CSAT enviado" ou "Atendimento finalizado" conforme escolha.
- [ ] `allow_multiple_answers: false` na enquete CSAT.

#### Hints técnicos (não-prescritivos)

- **Hook:** `useSendZapiPoll` (existente) + `useChatUpdate` (existente) para mudar status.
- **Component:** modificar o botão/ação de finalizar em `ConversasTabContent.tsx` ou onde o status é atualizado (verificar onde `zapi-chat-update` é chamado com `status='finalizada'`).
- **AlertDialog:** componente shadcn já existente (usado em T62 e outros).

#### Test cases

- **Com feature ativa:** finalizar → AlertDialog com opção CSAT → escolher CSAT → enquete enviada + conversa finalizada.
- **Com feature inativa:** finalizar → sem AlertDialog CSAT → finaliza diretamente.
- **Cancelar:** AlertDialog → "Cancelar" → conversa permanece aberta.
- **CSAT resposta:** eleitor vota na enquete → voto aparece na conversa como mensagem normal.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] QA aprovou

#### Out of scope

- Aggregação/relatório de notas CSAT (futuro — integrar com C23 ou dashboard Fase 7)
- Envio de CSAT automático sem confirmação do atendente

---

### T77 — Feature flags: registrar c17–c24/c29 em AccountFormDialog (C40 extensão)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T05/T06 (Fase 0 — `useAccountFeatures` e aba "Recursos" já existem)
**WSJF score:** (8 + 6 + 5) / 2 = **9.5** — enabler de todos os recursos da fase

#### User story

Como Raquel (mandatária), quero poder ligar e desligar individualmente cada recurso
de CRM político (broadcast, protocolo, aniversários, eventos, régua, CSAT, LGPD) por
conta Z-API, para controlar quais funcionalidades estão ativas sem precisar de
implantação de código.

#### Contexto

A aba "Recursos" em `AccountFormDialog` (T06 da Fase 0) já existe com switches para
os recursos das Fases 0–5. Esta task adiciona os switches da Fase 6. Os recursos devem
ser agrupados em "CRM Político" dentro da aba. Default seguro: todos OFF.

#### Critérios de aceite

- [ ] Grupo "CRM Político" adicionado na aba "Recursos" de `AccountFormDialog`.
- [ ] Switches com labels claras para cada recurso:
  - `c17` — "Broadcast / Comunicados em massa" (aviso de risco de ban visível)
  - `c18` — "Protocolo de demanda com retorno automático"
  - `c19` — "Lembrete de aniversário do eleitor"
  - `c20` — "Convite a eventos e RSVP"
  - `c21` — "Bairro e zona eleitoral no painel" (este pode ser ON por default — sem risco)
  - `c22` — "Régua de relacionamento automática"
  - `c23` — "Campanhas de pesquisa de opinião"
  - `c24` — "Consentimento LGPD (opt-in)" (este deve ser ON por default — conformidade)
  - `c29` — "CSAT ao finalizar atendimento"
- [ ] `c17` exibe aviso em destaque: "Broadcast usa Z-API não-oficial. Envio em excesso pode causar banimento do número. Use com responsabilidade."
- [ ] `c24` exibe aviso: "Requerido para broadcast. Ativar registra consentimento dos eleitores."
- [ ] Todos os defaults `false` exceto `c24` e `c21` (que são `true` por default).
- [ ] `isFeatureEnabled(config, 'c17')` etc. retornam `false` para contas sem configuração explícita — exceto c24/c21 que retornam `true` se ausentes (default true no helper).
- [ ] Salva via `useAccountFeatures` existente (persiste em `recursos_config JSONB`).

#### Hints técnicos (não-prescritivos)

- **Component:** `src/components/whatsapp/AccountFormDialog.tsx` (aba "Recursos" existente).
- **Helper:** `src/lib/featureFlags.ts` — `isFeatureEnabled` pode aceitar `defaultValue` para `c24`/`c21`.
- **Pattern:** seguir switches já existentes na aba "Recursos" (mesma estrutura, novo grupo).

#### Test cases

- **Default false:** nova conta sem `recursos_config` → `isFeatureEnabled(config, 'c17')` retorna false.
- **c24 default true:** nova conta → `isFeatureEnabled(config, 'c24')` retorna true.
- **Ligar c17:** toggle ON → salvar → `recursos_config.c17 = true` no banco.
- **Aviso broadcast:** toggle de c17 visível com aviso de risco.

#### Definition of Done

- [ ] Critérios de aceite validados
- [ ] Lint OK / Typecheck OK / Build OK
- [ ] QA aprovou

#### Out of scope

- Feature flags granulares por usuário (é por conta Z-API)
- Auditoria de quem ligou/desligou cada recurso

---

## Flags de segurança por task

| Task | Toca superfície crítica? | Security | Pentest |
|------|--------------------------|----------|---------|
| T58 — Migration opt-in LGPD | dado pessoal LGPD em contacts | obrigatório | — |
| T59 — UI opt-in | escrita dado pessoal | obrigatório | — |
| T60 — Migration protocolo + demand_id | FK + trigger PG | obrigatório | obrigatório |
| T61 — EF zapi-demand-notify + trigger | EF service_role + trigger → Z-API | obrigatório | obrigatório |
| T62 — UI vínculo demanda | escrita via EF existente | — | — |
| T63 — Migration broadcast | novas tabelas user_id, superfície crítica LGPD | obrigatório | obrigatório |
| T64 — EF broadcast-create + send + cron | 2 EFs service_role + cron broadcast | obrigatório | obrigatório |
| T65 — UI gestão campanhas | leitura, Realtime | — | — |
| T66 — UI composer campanha | cria campanha via EF | — | — |
| T67 — UI bairro/zona | UPDATE em contacts | — | — |
| T68 — UI aniversariante | leitura + envio via hook existente | — | — |
| T69 — Migration eventos + RSVP | novas tabelas user_id | obrigatório | — |
| T70 — CRUD eventos | INSERT/UPDATE/DELETE client-side | — | — |
| T71 — Envio convite + RSVP | INSERT RSVP client-side + send-text | — | — |
| T72 — Migration réguas | nova tabela user_id + cron | obrigatório | obrigatório |
| T73 — EF relationship-followup + cron | EF service_role + cron diário automático | obrigatório | obrigatório |
| T74 — UI réguas | INSERT/UPDATE/DELETE client-side | — | — |
| T75 — Broadcast enquete + votos | extensão broadcast + novo INSERT em webhook | obrigatório | obrigatório |
| T76 — UI CSAT | usa hooks existentes | — | — |
| T77 — Feature flags Fase 6 | escrita em zapi_accounts (existente) | — | — |

**Superfície crítica consolidada da Fase 6:**
T58, T59 (LGPD), T60, T61 (demanda+trigger), T63, T64 (broadcast — máximo risco),
T69 (eventos), T72, T73 (régua cron automático), T75 (enquete segmentada).

---

## Resumo estimativo

| Grupo | Tasks | Pontos |
|-------|-------|--------|
| C24 — Opt-in LGPD | T58, T59 | 7pt |
| C18 — Protocolo demanda | T60, T61, T62 | 18pt |
| C17 — Broadcast | T63, T64, T65, T66 | 34pt |
| C21 — Bairro/zona | T67 | 2pt |
| C19 — Aniversários | T68 | 5pt |
| C20 — Eventos | T69, T70, T71 | 12pt |
| C22 — Régua | T72, T73, T74 | 15pt |
| C23 — Enquete segmentada | T75 | 8pt |
| C29 — CSAT | T76 | 5pt |
| Feature flags Fase 6 | T77 | 2pt |
| **Total** | **20 tasks** | **~108pt** |

> Nota: T64 (XL, 13pt) é a task mais pesada da fase. Se o Fullstack considerar excessiva,
> pode ser dividida em T64a (EF broadcast-create) e T64b (EF broadcast-send + cron) —
> ambas com dependência entre si mas entregáveis separadamente.
