# Pesquisa Aprofundada — Recursos de um CRM Integrado ao WhatsApp

> **Projeto:** Mandato Desk 2026 (CRM político — cliente Raquel)
> **Contexto:** integração Z-API em andamento (task RAQ-MAND-EM051)
> **Data:** 2026-05-16
> **Objetivo:** mapear os recursos obrigatórios e desejáveis para que o CRM seja
> comercialmente viável e competitivo no uso diário, transformando a tela de
> conversa num ambiente operacional completo.

---

## 1. Sumário executivo

Um "CRM com WhatsApp" não é um CRM que *manda mensagem*. É um CRM em que a **tela
de conversa vira o centro de trabalho do operador** — ele conversa, atualiza
cadastro, cria tarefa, move o lead no funil e registra informação **sem trocar
de tela**. Esse é o padrão consolidado pelo mercado (Kommo, HubSpot, Pipedrive,
Bitrix24, RD Station, respond.io, Rasayel). Quem não entrega isso é percebido
como "mais uma caixa de entrada", não como CRM.

A pesquisa abaixo organiza **62 recursos** em três níveis de prioridade
(`MUST` / `SHOULD` / `COULD`), confronta cada um com o **estado atual do Mandato
Desk 2026** e propõe um **roadmap em 5 fatias**.

**Diagnóstico rápido do estado atual:**

- ✅ Já existe: troca de mensagens em tempo real, mídia/áudio/documento/enquete,
  identificação automática de contato pelo telefone, layout de 3 colunas
  (lista · conversa · painel do contato), realtime via Supabase.
- ❌ Falta o "tecido conjuntivo" que transforma isso em CRM: iniciar conversa por
  busca, botão "Conversar" no card do contato, edição do contato dentro da
  conversa (inline/popup), criação de tarefa no painel lateral, status de
  conversa, atribuição/transferência, fixar/arquivar, etiquetas na conversa,
  ações de funil e respostas rápidas.

A conclusão central: **o produto está ~35% do caminho.** O que existe é a camada
de mensageria. O que falta é a camada de *operação comercial dentro da conversa*
— e é exatamente essa camada que diferencia um CRM viável de um chat avulso.

---

## 2. Metodologia e fontes

Pesquisa baseada em: (a) documentação e páginas de produto das plataformas de
referência citadas no briefing; (b) guias de mercado de WhatsApp CRM 2025-2026;
(c) leitura do código atual do Mandato Desk 2026 (`ConversasTabContent.tsx`,
`useZapiChats`, `useContacts`, `useTarefas`, schema Supabase); (d) memória de
projeto da task EM051.

Plataformas analisadas como benchmark de UX: **Kommo, HubSpot, Pipedrive,
Bitrix24, RD Station CRM, Zendesk, Intercom, respond.io, Rasayel, Freshsales**.

Fontes ao final do documento (seção 13).

---

## 3. O conceito: o que torna um CRM+WhatsApp "viável"

O mercado convergiu para três princípios. Eles são a régua para avaliar qualquer
recurso:

### 3.1 Conversa como ambiente operacional (não como tela isolada)
A tela de conversa precisa conter, ao alcance do operador, **tudo que ele
precisaria abrir em outra tela**: dados do contato, funil, tarefas, histórico,
anexos. O padrão visual é o **layout de 3 painéis**:

```
┌─────────────┬───────────────────────────┬──────────────────┐
│  PAINEL 1   │        PAINEL 2           │     PAINEL 3     │
│   Lista de  │       Conversa            │  Contexto do     │
│   conversas │   (mensagens + composer)  │  contato/negócio │
│             │                           │                  │
│  busca,     │  header c/ status,        │  dados editáveis │
│  filtros,   │  atribuição, ações        │  funil, tarefas, │
│  status,    │  bolhas de mensagem       │  tags, histórico │
│  não-lidas  │  composer + resp. rápidas │  ações rápidas   │
└─────────────┴───────────────────────────┴──────────────────┘
```

> O Mandato Desk **já tem esse layout de 3 colunas** (`ConversasTabContent.tsx`,
> grid `320px_1fr_280px`). O esqueleto está certo. O que falta é *recheio* no
> painel 1 (status/filtros) e no painel 3 (edição, funil, tarefas).

### 3.2 Sincronização bidirecional automática
Toda mensagem (entrada e saída) é registrada sozinha no histórico do contato.
Nenhum log manual. O contato é **identificado pelo telefone**; se não existir, o
CRM **cria automaticamente**. — *Já implementado no Mandato Desk via `contact_id`
em `zapi_chats` + normalização do 9º dígito BR.*

### 3.3 Redução máxima de cliques
O custo de um CRM ruim é medido em *cliques por atendimento* e em *trocas de
tela*. Edição inline, pop-ups rápidos, atalhos de teclado e "criar X a partir da
conversa" existem para colapsar fluxos de 5 cliques em 1.

---

## 4. Benchmark de mercado (referência de UX)

| Plataforma | O que faz de referência | Padrão a copiar |
|---|---|---|
| **Kommo** | CRM "messenger-first". Chatbot preenche o lead card sozinho e move pelo funil. Painel do lead reúne contatos, tarefas, notas, chats e ligações. | Lead card unificado; Salesbot por etapa; follow-up automático de quem não respondeu. |
| **HubSpot** | Inbox de conversas com **painel direito contextual**; botão **"Create deal"** dentro do inbox; mensagem WhatsApp vira *activity* na timeline do registro. | Painel direito contextual; criar negócio/tarefa direto da conversa; timeline unificada. |
| **Pipedrive** | Sincroniza histórico de chat com leads/deals; cria negócio a partir do chat sem sair do Pipedrive. | "Criar negócio a partir do chat". |
| **Bitrix24** | Contact Center: roteamento, filas, transferência, regras de distribuição, supervisor. | Distribuição automática + transferência + supervisão. |
| **RD Station CRM** | Foco no funil + automação de follow-up integrada ao WhatsApp (mercado BR). | Automação de cadência ligada à etapa do funil. |
| **Zendesk / Intercom** | Padrão-ouro de *help desk*: status de ticket, SLA visível, macros (respostas prontas), notas internas, atribuição. | Status + SLA + macros + notas internas + menções `@`. |
| **respond.io / Rasayel** | Inbox de equipe puro-WhatsApp: atribuição (round-robin / skill-based), tags acionáveis, snooze, ciclo de vida do contato. | Regras de atribuição; tags acionáveis; snooze/aguardando. |
| **Freshsales** | Sugestão de próxima ação por IA; score de lead dentro da conversa. | Camada de IA: next-best-action, score. |

**Síntese do benchmark:** todos sem exceção entregam **(1)** painel de contexto
editável ao lado da conversa, **(2)** status/atribuição da conversa, **(3)** criar
tarefa/negócio a partir da conversa e **(4)** respostas rápidas. Esses quatro são
o "piso" competitivo — abaixo disso o produto não é percebido como CRM.

---

## 5. Catálogo de recursos OBRIGATÓRIOS (`MUST` / `SHOULD`)

Legenda de prioridade:
- **`MUST`** — sem isso o CRM não é viável comercialmente. É o piso de mercado.
- **`SHOULD`** — esperado por qualquer comprador; ausência é percebida como produto incompleto.
- **`COULD`** — agrega valor, mas pode ficar para fase posterior.

Legenda de estado no Mandato Desk 2026:
- 🟢 pronto · 🟡 parcial · 🔴 ausente

### 5.1 Gestão de conversas WhatsApp

| # | Recurso | Prior. | Estado | Observação |
|---|---|---|---|---|
| 1 | Enviar/receber mensagens em tempo real | MUST | 🟢 | Realtime via Supabase channel + Edge Functions. |
| 2 | Identificar contato existente pelo telefone | MUST | 🟢 | `contact_id` em `zapi_chats` + normalização 9º dígito. |
| 3 | Histórico completo da conversa vinculado ao contato | MUST | 🟡 | Mensagens existem; falta consolidar na *timeline* do contato no CRM. |
| 4 | **Iniciar conversa por busca rápida** | MUST | 🔴 | Botão "Nova conversa" → busca contato por nome/telefone → abre/cria chat. |
| 5 | **Abrir conversa pelo card do contato** ("Conversar no WhatsApp") | MUST | 🔴 | Botão no `ContactCard` / perfil → deep-link para a conversa Z-API (não `wa.me`). |
| 6 | Criar contato automaticamente quando o número não existe | MUST | 🟡 | Hoje só instrui a cadastrar manualmente. Era *MVP-fora* na EM051 — **precisa entrar**. |
| 7 | Múltiplos atendentes na mesma conexão | MUST | 🟡 | Tecnicamente possível (CRM multiplexa 1 número); falta atribuição p/ não pisarem uns nos outros. |
| 8 | **Status da conversa** (Aberta · Em atendimento · Aguardando resposta · Finalizada) | MUST | 🔴 | Coluna `status` em `zapi_chats` + filtros no painel 1 + badge no header. |
| 9 | **Atribuição/transferência** de conversa entre usuários/equipes | MUST | 🔴 | Coluna `assigned_to`; ação "Atribuir/Transferir" no header da conversa. |
| 10 | Marcar conversa com etiquetas/tags | SHOULD | 🔴 | Reusar tabela de tags do CRM; tabela de junção `zapi_chat_tags`. |
| 11 | Fixar conversas importantes | SHOULD | 🔴 | Flag `pinned`; ordenação prioritária no topo da lista. |
| 12 | Arquivar conversas | SHOULD | 🔴 | Flag `archived` + filtro; não apagar (retenção 90d já existe). |
| 13 | Marcar como lida / não-lida | MUST | 🟡 | `unread_count` existe; `useMarkChatAsRead` é **no-op** — falta Edge Function. |
| 14 | Indicador de não-lida / contadores na lista | MUST | 🟢 | `unread_count` exibido no `ChatListItem`. |
| 15 | Notificação de nova mensagem (som / badge / título) | SHOULD | 🔴 | Badge no item de menu "WhatsApp" + som opcional. |

### 5.2 Integração Conversa ↔ CRM (painel lateral) — **núcleo do pedido**

| # | Recurso | Prior. | Estado | Observação |
|---|---|---|---|---|
| 16 | Exibir dados do contato ao lado da conversa | MUST | 🟡 | `ContactPanel` mostra nome/telefone/última atividade — **só leitura**. |
| 17 | **Editar contato sem sair da conversa (inline)** | MUST | 🔴 | Campo vira editável ao clicar; salva no blur. Sem trocar de tela. |
| 18 | **Pop-up rápido de edição** de dados do contato | MUST | 🔴 | Botão "Editar" → modal compacto (subset do form de contato). |
| 19 | Adicionar redes sociais / observações / empresa / cargo / origem / tags | MUST | 🟡 | Schema já tem `instagram`, `profissao`, `origem`, `tags`; falta UI no painel. |
| 20 | Campos personalizados editáveis no painel | SHOULD | 🟡 | `useCustomFields` existe; falta renderizá-los no painel da conversa. |
| 21 | **Click-to-extract:** clicar num trecho da mensagem e jogar num campo do CRM | SHOULD | 🔴 | Selecionar texto na bolha → menu "Salvar como… (nome / e-mail / observação)". Diferencial forte. |
| 22 | Copiar e colar informação direto nos campos | MUST | 🔴 | Decorre do #17/#18 — campos precisam ser inputs reais e colaveis. |
| 23 | Atualização do contato refletida em tempo real | MUST | 🟡 | react-query já invalida; garantir que o painel reflita a edição na hora. |
| 24 | **Ver funil/pipeline atual do contato** no painel | MUST | 🔴 | `useContactBoardMemberships` já existe — exibir etapa atual. |
| 25 | **Mover etapa do funil** sem sair da conversa | MUST | 🔴 | Select de etapas no painel → `useBoardItems` mutation. |
| 26 | Link "Ver no CRM" (perfil completo) | SHOULD | 🟢 | Já existe (`Link to="/contacts"`). Manter como saída para o cadastro completo. |

> **Este bloco é o coração do briefing do usuário.** O painel 3 hoje é uma
> "ficha de leitura". Precisa virar uma **ficha de trabalho**: campos editáveis
> inline, botão de pop-up, seção de funil e seção de tarefas (5.3).

### 5.3 Gestão de tarefas integrada à conversa

| # | Recurso | Prior. | Estado | Observação |
|---|---|---|---|---|
| 27 | **Criar tarefa dentro da conversa** | MUST | 🔴 | Botão no painel/menu lateral → form rápido de tarefa. |
| 28 | Menu lateral dedicado a tarefas da conversa | MUST | 🔴 | Sheet/drawer ou aba dentro do painel 3. |
| 29 | Definir responsável, prazo, prioridade, observações | MUST | 🟡 | `TarefaInsert` já tem `responsavel_id`, `data_agendada`, `descricao`. Falta campo `prioridade`. |
| 30 | Vincular tarefa ao contato | MUST | 🟢 | `tarefas.contact_id` já existe — só pré-preencher na criação via conversa. |
| 31 | Vincular tarefa à oportunidade/pipeline | SHOULD | 🟡 | `tarefas.board_item_id` já existe. Pré-preencher quando houver negócio. |
| 32 | Histórico de tarefas do contato no painel | SHOULD | 🟡 | `useTarefas({ contact_id })` já filtra. Falta renderizar no painel. |
| 33 | Concluir tarefa rapidamente (checkbox) | MUST | 🟡 | Mutation existe; expor o checkbox no painel da conversa. |
| 34 | Lembretes automáticos / notificações internas | SHOULD | 🔴 | pg_cron + notificação in-app quando `data_agendada` chega. |

> **Boa notícia:** a tabela `tarefas` já suporta `contact_id` e `board_item_id`.
> A integração tarefa↔conversa é **majoritariamente trabalho de UI** — o modelo
> de dados está pronto. Único gap de schema: campo `prioridade`.

### 5.4 Gestão comercial e pipeline a partir da conversa

> ⚠️ Para um CRM **político** (Mandato Desk), o "pipeline" é geralmente um funil
> de relacionamento com o eleitor / encaminhamento de demandas, não vendas. Os
> recursos abaixo valem, **traduzidos para o domínio político**: "oportunidade"
> ≈ demanda/solicitação do eleitor; "proposta" ≈ encaminhamento/ofício.

| # | Recurso | Prior. | Estado | Observação |
|---|---|---|---|---|
| 35 | Criar oportunidade/demanda a partir da conversa | SHOULD | 🟡 | `useDemands` / `useBoardItems` existem; falta ação na conversa. |
| 36 | Mover lead entre etapas (ver #25) | MUST | 🔴 | Mesmo recurso do #25. |
| 37 | Ver valor / etapa / responsável / último contato da oportunidade | SHOULD | 🟡 | Dados existem; expor resumo no painel. |
| 38 | Criação rápida de proposta/orçamento (ofício, no contexto político) | COULD | 🔴 | Avaliar relevância real para o mandato antes de priorizar. |
| 39 | Registrar atividade comercial / interação | SHOULD | 🟡 | `logActivity` já existe; mensagem WhatsApp deveria gerar atividade. |

### 5.5 Automação e produtividade

| # | Recurso | Prior. | Estado | Observação |
|---|---|---|---|---|
| 40 | **Mensagens rápidas / templates** (respostas prontas) | MUST | 🔴 | Tabela `zapi_quick_replies`; atalho `/` no composer. Piso de mercado. |
| 41 | Respostas automáticas (saudação, fora do horário) | SHOULD | 🔴 | Regra simples no webhook de inbound. |
| 42 | Automação por gatilho (nova msg, sem resposta, mudança de etapa, novo lead) | COULD | 🔴 | Motor de automação — fase avançada. |
| 43 | Distribuição automática de atendimentos | COULD | 🔴 | Round-robin entre atendentes ativos. |
| 44 | Chatbot inicial (triagem) | COULD | 🔴 | Fase avançada; cuidado com tom em contexto político. |
| 45 | Envio de arquivos (PDF, imagem, vídeo, documento) | MUST | 🟢 | Já implementado (`AttachmentPreviewDialog`). |
| 46 | Gravação/envio de áudio | SHOULD | 🟡 | Envio de áudio existe; gravação in-app a confirmar. |
| 47 | Menções internas entre equipe (`@fulano`) + notas internas | SHOULD | 🔴 | Notas internas não enviadas ao eleitor; só visíveis à equipe. |

### 5.6 Experiência operacional

| # | Recurso | Prior. | Estado | Observação |
|---|---|---|---|---|
| 48 | Conversa centralizada + painel lateral | MUST | 🟢 | Layout 3 colunas pronto. |
| 49 | Edição rápida sem troca de tela | MUST | 🔴 | Decorre de 5.2. |
| 50 | Carregamento rápido das conversas | MUST | 🟡 | OK p/ volume atual; paginar quando crescer. |
| 51 | **Busca global** (nome, telefone, empresa, tag) | MUST | 🔴 | Busca dentro da lista de conversas + busca p/ iniciar conversa (#4). |
| 52 | Filtros na lista (status, atribuído a mim, não-lidas) | MUST | 🔴 | Barra de filtros no topo do painel 1. |
| 53 | Atalhos de teclado | COULD | 🟡 | Enter envia já existe; faltam navegação ↑↓, busca `/`. |
| 54 | Indicadores visuais (não-lida, SLA, responsável, prioridade) | SHOULD | 🟡 | Não-lida ✅; faltam SLA / responsável / prioridade. |
| 55 | Layout preparado para operação contínua (responsivo, denso) | MUST | 🟢 | Grid responsivo já existe. |

---

## 6. Recursos DESEJÁVEIS / estratégicos (`COULD` — fase posterior)

### 6.1 Inteligência comercial (camada de IA)
| # | Recurso | Observação |
|---|---|---|
| 56 | Sugestão automática de resposta | Há `useAISettings` no projeto — base para evoluir. |
| 57 | Resumo automático da conversa | Útil em transferência de atendimento. |
| 58 | Identificação de intenção / análise de sentimento | Bom para priorizar fila. |
| 59 | Sugestão de próxima ação (next-best-action) | Padrão Freshsales/Kommo. |

### 6.2 Métricas e gestão
| # | Recurso |
|---|---|
| 60 | Dashboard de atendimento (conversas abertas, tempo médio de resposta, taxa de conversão por atendente, produtividade) |
| 61 | Histórico de auditoria de atendimentos |

### 6.3 Segurança e controle
| # | Recurso | Observação |
|---|---|---|
| 62 | Controle de permissões / acesso por equipe / logs de atendimento | Projeto já tem RBAC + senha extra por painel Z-API. Estender para escopo de conversas (atendente só vê o que lhe foi atribuído). |

---

## 7. Padrões de UX detalhados (os pedidos específicos do briefing)

Esta seção detalha *como* implementar os 5 fluxos que o usuário descreveu
explicitamente.

### 7.1 Iniciar conversa por busca rápida (#4)
**Fluxo:** botão **"+ Nova conversa"** no topo do painel 1 → abre um *command
palette* (estilo `cmdk`) → operador digita nome ou telefone → busca em `contacts`
→ ao escolher, o sistema verifica se já existe `zapi_chat` para aquele telefone;
se sim, abre; se não, cria o chat e foca o composer.
- **Antipadrão a evitar:** mandar para o `wa.me` externo. Isso quebra o princípio
  3.1 (sair do ambiente operacional).

### 7.2 Botão "Conversar no WhatsApp" no card/perfil do contato (#5)
**Fluxo:** no `ContactCard` e no perfil do contato (`/contacts`), botão verde
**"Conversar"** visível **somente quando há telefone/WhatsApp**. Clique → navega
para `WhatsApp → Conversas` com a conversa daquele contato já aberta (rota com
parâmetro, ex.: `/whatsapp?chat=<telefone>`).
- Deep-link **interno**, nunca `wa.me`.
- Se não houver chat ainda, cria na hora (mesma lógica do #4).

### 7.3 Edição do contato dentro da conversa — inline + pop-up (#17, #18, #22)
Dois modos coexistindo (o usuário pediu os dois):

**Modo inline:** cada campo do painel 3 é um *click-to-edit* — texto estático que
vira `input`/`select` ao clicar, salva no `blur` ou `Enter`, com feedback de
"salvo". Ideal para ajuste pontual de 1 campo.

**Modo pop-up:** botão **"Editar contato"** abre um modal compacto com um subset
do formulário (nome, telefone, WhatsApp, Instagram, profissão, origem, tags,
observações, campos personalizados). Ideal para preencher vários campos de uma
vez — o caso de "a pessoa copia e cola / preenche tudo".
- Ambos reaproveitam `useContacts().updateMutation` e a validação Zod existente
  (`contactValidation`).
- Campos devem ser inputs reais (coláveis) — requisito #22.

```
┌─ Painel 3 — Contato ───────────────┐
│ 👤 Maria Silva           [Editar] │  ← botão abre pop-up
│ 📞 (61) 98429-9707                │
│ ─────────────────────────────────│
│ Instagram   [ @____ ]  ✎          │  ← click-to-edit inline
│ Profissão   [ professora ] ✎      │
│ Origem      [ WhatsApp ▾ ]        │
│ Tags        🏷 Eleitor  + Add     │
│ ─────────────────────────────────│
│ 🗂 Funil: Triagem ▾  (mover etapa)│
│ ─────────────────────────────────│
│ ✅ Tarefas (2)            [+ Nova]│
│   ☐ Ligar p/ confirmar — amanhã   │
│   ☐ Enviar ofício — 20/05         │
└────────────────────────────────────┘
```

### 7.4 Click-to-extract — clicar na mensagem e salvar num campo (#21)
**Fluxo:** operador seleciona um trecho de texto numa bolha de mensagem → aparece
um mini-menu contextual → "Salvar como nome / Salvar como observação / Adicionar
como tag / Salvar em campo personalizado…". O valor é gravado no contato vinculado.
- Diferencial competitivo real — poucas plataformas BR fazem bem.
- Implementação: `window.getSelection()` na bolha + popover posicionado.

### 7.5 Tarefas no menu lateral da conversa (#27, #28)
**Fluxo:** seção "Tarefas" no painel 3 (ou um *drawer* lateral) listando as
tarefas do contato (`useTarefas({ contact_id })`). Botão **"+ Nova tarefa"** abre
form rápido **com `contact_id` já pré-preenchido** (e `board_item_id` se houver
oportunidade vinculada). Checkbox conclui na hora.
- O modelo de dados já suporta tudo isso — é trabalho de UI.

---

## 8. Diagnóstico — Mandato Desk 2026 vs. requisitos

### 8.1 Placar geral

| Categoria | 🟢 Pronto | 🟡 Parcial | 🔴 Ausente |
|---|---|---|---|
| 5.1 Conversas | 3 | 5 | 7 |
| 5.2 Conversa ↔ CRM | 1 | 6 | 4 |
| 5.3 Tarefas | 1 | 5 | 2 |
| 5.4 Comercial/Pipeline | 0 | 4 | 1 |
| 5.5 Automação | 1 | 1 | 5 |
| 5.6 Operacional | 3 | 3 | 2 |
| **Total (55 MUST/SHOULD)** | **9** | **24** | **21** |

**Leitura:** ~16% pronto, ~44% parcial, ~38% ausente. A camada de **mensageria**
está sólida; a camada de **operação CRM dentro da conversa** mal começou.

### 8.2 Os 3 maiores gaps (resolver primeiro)

1. **Painel lateral é só leitura.** O `ContactPanel` exibe nome/telefone e um link
   "Ver no CRM". Falta toda a edição inline/pop-up, funil e tarefas. → É o maior
   bloco de valor não entregue e o foco central do briefing.
2. **Não há como iniciar conversa de dentro do CRM.** Sem busca para iniciar (#4)
   e sem botão no card do contato (#5), o operador ainda precisa do WhatsApp
   externo — o problema que o projeto existe para resolver.
3. **Conversa não tem estado de trabalho.** Sem status, sem atribuição, sem
   filtros — múltiplos atendentes vão se atropelar. Inviável para uso em equipe.

### 8.3 Pontos fortes a preservar
- Layout de 3 colunas correto desde o início.
- Identificação automática de contato + normalização do 9º dígito BR (bug já
  resolvido — commit `c2ae697`).
- Mídia completa (imagem/vídeo/áudio/documento/enquete).
- Realtime via Supabase channel.
- `tarefas` já tem `contact_id` e `board_item_id` — integração de tarefas é barata.
- RBAC + senha extra por painel já existentes.

### 8.4 Conflito de escopo a sinalizar
A memória da EM051 lista como **"MVP fora"**: *criação de contato a partir da
conversa, supervisor, RBAC granular*. O novo briefing **exige criação de contato
a partir da conversa** (#6) e fortemente sugere supervisão/atribuição. → É preciso
**reabrir o escopo do MVP** com o cliente: o que era "fase 2" agora é requisito de
viabilidade. Recomenda-se promover #6 para dentro do escopo imediato.

---

## 9. Considerações técnicas (específicas do Mandato Desk / Z-API)

1. **Z-API é gateway não-oficial** (WhatsApp Web via QR), não a API oficial da
   Meta. Consequências:
   - Não há aprovação de *templates HSM* nem janela de 24h da Meta. "Respostas
     rápidas" (#40) são **snippets de texto do lado do CRM**, não templates
     aprovados.
   - **Risco de banimento** por volume/spam é real. Evitar disparo em massa não
     solicitado; respostas automáticas devem ser comedidas.
2. **Multi-atendente = o CRM multiplexa 1 número.** O WhatsApp não tem o conceito
   de "atendente". Status, atribuição, "em atendimento" e transferência vivem
   **100% no banco do CRM** (`zapi_chats`). É a única fonte de verdade da operação.
3. **`useMarkChatAsRead` está no-op.** RLS bloqueia escrita do client em
   `zapi_chats`. Precisa de Edge Function `zapi-mark-as-read` (já previsto no
   código). Mesmo padrão valerá para status/atribuição/pin/archive — todas as
   mutações de estado de conversa via Edge Function `service_role`.
4. **Webhook Z-API não aceita header customizado** — segredo vai na query string
   (`?secret=`). Já resolvido; manter o padrão para qualquer endpoint novo.
5. **Realtime já existe** (`useZapiChats` faz subscribe em `postgres_changes`).
   Reaproveitar para status/atribuição: quando um atendente assume, os demais
   veem na hora.
6. **LGPD** (pendência aberta na memória EM051): mensagens de eleitores são dados
   pessoais. Antes do go-live, confirmar com a cliente que a política de
   privacidade cobre o armazenamento de 90 dias.
7. **Gaps de schema a criar:**
   - `zapi_chats`: `status`, `assigned_to`, `pinned`, `archived`.
   - `tarefas`: `prioridade`.
   - Novas tabelas: `zapi_chat_tags` (junção), `zapi_quick_replies`,
     `zapi_chat_notes` (notas internas/menções).

---

## 10. Roadmap recomendado (5 fatias)

Ordenado por **viabilidade comercial** — cada fatia deixa o produto utilizável num
nível superior. Estimativas relativas (P/M/G).

### Fatia A — "Tornar a conversa um CRM" *(prioridade máxima)*  — G
Resolve o gap #1 e o coração do briefing.
- Painel lateral editável: edição inline (#17) + pop-up (#18/#22).
- Seções de funil (#24/#25) e tarefas (#27-#33) no painel.
- Criar contato a partir da conversa (#6).
- *Entrega:* operador trabalha o cadastro inteiro sem sair da conversa.

### Fatia B — "Iniciar conversas de dentro do CRM"  — M
Resolve o gap #2.
- Botão "+ Nova conversa" com busca (#4).
- Botão "Conversar" no card/perfil do contato (#5).
- Busca global na lista de conversas (#51).

### Fatia C — "Operação em equipe"  — M
Resolve o gap #3 — habilita uso por mais de um atendente.
- Status da conversa (#8) + filtros no painel 1 (#52).
- Atribuição/transferência (#9).
- Marcar lida/não-lida real via Edge Function (#13).
- Fixar (#11) e arquivar (#12).
- Notas internas + menções (#47).

### Fatia D — "Produtividade"  — M
- Respostas rápidas / templates com atalho `/` (#40).
- Etiquetas na conversa (#10).
- Click-to-extract (#21).
- Atalhos de teclado (#53) e indicadores visuais (#54).
- Respostas automáticas simples (#41).

### Fatia E — "Inteligência e gestão" *(estratégico)*  — G
- Dashboard de atendimento + métricas (#60).
- Camada de IA: sugestão de resposta, resumo, next-best-action (#56-#59).
- Automação por gatilho + distribuição automática (#42/#43).
- Auditoria (#61).

> Recomendação: **A → B → C** entrega um CRM+WhatsApp comercialmente viável.
> D e E são diferenciação competitiva, não viabilidade.

---

## 11. Riscos e armadilhas

| Risco | Mitigação |
|---|---|
| Banimento do número pela Meta (Z-API não-oficial) | Sem disparo em massa não solicitado; respostas automáticas comedidas; aquecer o número. |
| Atendentes pisando na mesma conversa | Fatia C (status + atribuição) é pré-requisito de uso em equipe — não pular. |
| Painel lateral virar "formulário gigante" | Mostrar subset essencial; "Ver no CRM" continua sendo a porta para o cadastro completo. |
| Edição inline com perda de dado (salvar no blur) | Feedback visual de "salvando/salvo"; otimistic update + rollback do react-query. |
| Escopo MVP da EM051 conflita com o novo briefing | Realinhar com a cliente: #6 (criar contato) sai de "fase 2" e entra no escopo. |
| LGPD — dados de eleitores | Confirmar política de privacidade antes do go-live (pendência aberta). |
| Performance da lista com muitas conversas | Paginar/virtualizar a lista quando passar de algumas centenas. |

---

## 12. Conclusão

O Mandato Desk 2026 tem uma **base de mensageria sólida** (envio/recebimento,
mídia, realtime, identificação de contato) e o **layout de 3 painéis correto**.
O que falta — e o que o briefing pede — é a **camada que transforma a tela de
conversa num ambiente operacional de CRM**: painel lateral editável, funil e
tarefas dentro da conversa, formas de iniciar conversa pelo CRM, e estado de
conversa para trabalho em equipe.

Em termos de mercado: hoje o produto é uma boa *caixa de entrada de WhatsApp*.
Com as Fatias A, B e C ele passa a ser um **CRM com WhatsApp** de fato — no mesmo
patamar de UX de Kommo / HubSpot / respond.io que o briefing usa como referência.

O caminho crítico é claro e a maior parte do modelo de dados (`tarefas`,
`contacts`, `boards`) **já existe** — boa parte do trabalho restante é de UI e de
Edge Functions de mutação de estado.

---

## 13. Fontes

- [The 7 Best WhatsApp CRMs 2026 — Clientify](https://clientify.com/en/blog/crm/the-7-best-crm-with-whatsapp-to-sell-more)
- [WhatsApp CRM Integration — HubSpot](https://www.hubspot.com/products/whatsapp-integration)
- [Connect a WhatsApp channel to the conversations inbox — HubSpot Knowledge Base](https://knowledge.hubspot.com/inbox/connect-whatsapp-to-the-conversations-inbox)
- [Associate activities with records — HubSpot Knowledge Base](https://knowledge.hubspot.com/records/associate-activities-with-records)
- [Guide to WhatsApp CRM system in 2026 — NetHunt CRM](https://nethunt.com/blog/whatsapp-crm/)
- [WhatsApp CRM Integration in 3 Steps — respond.io](https://respond.io/blog/whatsapp-crm)
- [WhatsApp CRM Integration: How It Works, Benefits & Features — Rasayel](https://learn.rasayel.io/en/blog/whatsapp-crm/)
- [WhatsApp Team Inbox: Benefits, Use Cases and Best Practices — Rasayel](https://learn.rasayel.io/en/blog/whatsapp-team-inbox/)
- [CRM With WhatsApp Integration: A Complete Guide — LeadSquared](https://www.leadsquared.com/learn/sales/crm-with-whatsapp-integration/)
- [Kommo’s Guide to WhatsApp CRM](https://www.kommo.com/blog/whatsapp-crm/)
- [WhatsApp CRM — Kommo](https://www.kommo.com/whatsapp/)
- [WhatsApp chatbot: A complete guide — Kommo](https://www.kommo.com/blog/whatsapp-chatbot/)
- [Pipedrive x HubSpot: WhatsApp integration — folk](https://www.folk.app/articles/Pipedrive-vs-Hubspot-whatsapp)
- [The 6 best WhatsApp CRMs of 2026 — folk](https://www.folk.app/articles/best-whatsapp-crm)
- [WhatsApp Shared Inbox: Complete Guide — Zixflow](https://zixflow.com/blog/whatsapp-shared-inbox/)
- [WhatsApp Team Inbox Guide 2026 — Greenbubble.io](https://www.greenbubble.io/blog/whatsapp-team-inbox-guide/)
- [WhatsApp team inbox and better customer conversations — Infobip](https://www.infobip.com/blog/whatsapp-team-inbox)
- [Best CRM for WhatsApp 2026 — CRM.org](https://crm.org/news/best-whatsapp-crm)

> Fontes internas do projeto: `ConversasTabContent.tsx`, `useZapiChats.ts`,
> `useContacts.ts`, `useTarefas.ts`, schema Supabase (`types.ts`), memória de
> projeto `em051_zapi_progress`, `RAQ-MAND-EM051-Backlog-tasks.md`.
