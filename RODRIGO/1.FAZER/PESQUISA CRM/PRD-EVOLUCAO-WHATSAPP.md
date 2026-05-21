# PRD — Evolução da Aba WhatsApp · Mandato Desk 2026

> **Produto:** Mandato Desk 2026 (CRM político — cliente Raquel)
> **Módulo:** Aba WhatsApp (Conversas / Contas / Logs / Webhooks)
> **Escopo aprovado:** Versão 3 — Plataforma de Engajamento (40 complementos) +
> Fatias A→E da `PESQUISA-CRM-WHATSAPP.md`
> **Data:** 2026-05-17 · **Autor:** Claude Code (orquestrador QG)
> **Status:** PRD para execução

---

## 1. Visão e objetivo

Transformar a aba WhatsApp de uma **caixa de entrada de mensagens** em um
**ambiente operacional de CRM político**: a tela de conversa onde o operador
atende, cadastra, encaminha demandas, move o eleitor no funil, dispara
comunicados segmentados e usa IA — tudo sem trocar de tela.

**Métrica de sucesso (norte):** reduzir o nº de telas que o operador precisa
abrir por atendimento de ~4 para ~1, e permitir que múltiplos atendentes
trabalhem o mesmo número sem se atropelar.

---

## 2. Personas

| Persona | Papel | Necessidade central |
|---|---|---|
| **Atendente do gabinete** | Recebe e responde eleitores | Atender rápido, cadastrar/atualizar o eleitor e criar tarefa sem sair da conversa |
| **Coordenador / supervisor** | Gerencia a equipe | Distribuir conversas, ver SLA, métricas por atendente, intervir |
| **Assessor de comunicação** | Comunicação do mandato | Disparar comunicados segmentados por bairro/tag com segurança anti-ban |
| **Raquel (mandatária)** | Dona do mandato | Visão do relacionamento com a base; garantir conformidade (LGPD) |

---

## 3. Estado atual (baseline)

**Pronto (camada de mensageria):** envio/recebimento em tempo real, mídia
(imagem/vídeo/áudio/documento/enquete), identificação automática de contato pelo
telefone, normalização do 9º dígito BR, layout de 3 colunas, realtime via
Supabase, gestão de contas Z-API (`ContasTabContent`), logs e webhooks.

**Ausente (camada de operação CRM):** painel lateral editável, status/atribuição
de conversa, iniciar conversa pelo CRM, tarefas/funil na conversa, respostas
rápidas, interações nativas (responder/reagir/encaminhar), broadcast, IA.

Diagnóstico da pesquisa: **~35% do caminho**. A base existe; falta a operação.

---

## 4. Escopo

**Dentro do escopo:** os 40 complementos da V3 (`C1`–`C40`) + os recursos
`MUST`/`SHOULD` das Fatias A→E da pesquisa original.

**Fora do escopo (não fazer agora):**
- API oficial da Meta / templates HSM (o projeto usa Z-API não-oficial).
- Chatbot de triagem autônomo (#44) — risco de tom em contexto político.
- Distribuição automática round-robin (#43) — entra só se houver demanda real.
- Integração com telefonia/ligações.

**Premissas:**
- Z-API permanece o gateway. Toda mutação de estado de conversa vive no banco do
  CRM (`zapi_chats`) — é a fonte de verdade da operação.
- Mutações de estado passam por **Edge Functions** com `service_role` (RLS
  bloqueia escrita do client).
- Recursos opcionais e de IA são **liga/desliga por conta** (recurso `C40`).

---

## 5. Plano de execução — 8 fases

As fases estão **ordenadas por dependência técnica**. Cada fase é um marco
testável. A regra de ouro: **não construir um recurso antes da fundação onde ele
se apoia.**

### Ordem resumida

```
Fase 0  Fundação (dados + toggles + Edge Functions)   ← FAZER PRIMEIRO
Fase 1  Conversa vira CRM (painel editável)
Fase 2  Iniciar conversas pelo CRM
Fase 3  Operação em equipe
Fase 4  Interações nativas do WhatsApp
Fase 5  Produtividade
Fase 6  CRM político (broadcast, protocolo, LGPD)
Fase 7  Inteligência (IA) + métricas
```

---

### FASE 0 — Fundação · *fazer primeiro* 🟥

**Por que primeiro:** todas as fases seguintes leem/escrevem nas estruturas
criadas aqui. Sem isto, nada se sustenta. Inclui o `C40`, que é a "tomada" da IA.

**O que fazer:**
1. **Migrations de schema:**
   - `zapi_chats`: `status` (text, default `'aberta'`), `assigned_to` (uuid →
     `auth.users`), `pinned` (bool), `archived` (bool), `snoozed_until` (timestamptz).
   - `tarefas`: `prioridade` (text: `baixa`/`media`/`alta`).
   - `zapi_accounts`: `recursos_config` (jsonb, default `'{}'`).
   - Novas tabelas: `zapi_chat_tags` (junção chat↔tag), `zapi_quick_replies`
     (snippets), `zapi_chat_notes` (notas internas/menções), `zapi_chat_message_flags`
     (favoritar mensagem).
   - Índices: `zapi_chats(status)`, `zapi_chats(assigned_to)`, parciais para
     `pinned`/`archived`.
2. **RLS** em todas as tabelas novas (multi-tenant + escopo por usuário).
3. **Edge Functions de mutação de estado** (padrão `service_role` + secret na
   query string): `zapi-mark-as-read` (substitui o no-op atual), `zapi-chat-update`
   (status/assign/pin/archive/snooze genérico).
4. **`C40` — Painel de recursos por conta:** aba "Recursos" no `AccountFormDialog`
   / `AccountCard`; hook `useAccountFeatures(accountId)`; helper `isFeatureEnabled()`.
   Default seguro: IA e broadcast **desligados**.

**Entregável:** banco preparado, toggles funcionando, Edge Functions de estado
no ar. **Sem mudança visível na conversa ainda** — é infraestrutura.

**Critério de pronto:** migrations aplicadas sem erro; `npx supabase db push` ok;
aba "Recursos" liga/desliga e persiste; `useMarkChatAsRead` real (não mais no-op).

**Segurança:** Security + Pentest obrigatórios (migration com `user_id`/RLS +
Edge Function com `service_role` — gatilhos automáticos da Camada 2).

---

### FASE 1 — Conversa vira CRM 🟧

**Depende de:** Fase 0. **Resolve:** o maior gap da pesquisa (painel só-leitura).

**O que fazer:**
1. **Painel lateral editável** (`ContactPanel`):
   - Edição **inline** (`click-to-edit`, salva no blur) — #17.
   - **Pop-up** de edição (modal compacto, subset do form de contato) — #18/#22.
   - Campos: nome, telefone, WhatsApp, Instagram, profissão, origem, tags,
     observações + campos personalizados (`useCustomFields`) — #19/#20.
   - Reaproveita `useContacts().updateMutation` + validação Zod existente.
2. **Funil no painel:** etapa atual (`useContactBoardMemberships`) + mover etapa
   sem sair da conversa (`useBoardItems`) — #24/#25.
3. **Tarefas no painel:** lista de tarefas do contato (`useTarefas({contact_id})`),
   criar tarefa rápida com `contact_id` pré-preenchido, concluir via checkbox,
   campo `prioridade` — #27 a #33.
4. **Criar contato a partir da conversa** — #6 — com `C39` (detecção de duplicado
   reaproveitando `useDuplicates`/`ContactMergeModal`).

**Entregável:** o operador trabalha o cadastro inteiro dentro da conversa.

**Critério de pronto:** editar um campo inline reflete no `/contacts`; pop-up
salva múltiplos campos; mover etapa atualiza o board; criar tarefa aparece em
`/tarefas`; criar contato novo dispara checagem de duplicado.

---

### FASE 2 — Iniciar conversas pelo CRM 🟨

**Depende de:** Fase 0. **Resolve:** o operador ainda depende do WhatsApp externo.

**O que fazer:**
1. **"+ Nova conversa"** — command palette (`cmdk`) que busca em `contacts` por
   nome/telefone; abre o chat se existir, cria se não — #4.
2. **Botão "Conversar"** no `ContactCard` e perfil — deep-link **interno**
   (`/whatsapp?chat=<telefone>`), nunca `wa.me` — #5.
3. **Busca global** na lista de conversas (nome/telefone/empresa/tag) — #51.
4. **`C4` — busca de texto dentro da conversa.**

**Critério de pronto:** iniciar conversa por busca funciona com contato existente
e novo; botão "Conversar" abre a conversa certa; busca global filtra a lista.

---

### FASE 3 — Operação em equipe 🟩

**Depende de:** Fase 0. **Resolve:** múltiplos atendentes se atropelando.

**O que fazer:**
1. **Status da conversa** (Aberta · Em atendimento · Aguardando · Finalizada) +
   badge no header + filtros no painel 1 — #8/#52.
2. **Atribuição/transferência** entre usuários — #9 — com `C16` (nota de handoff
   obrigatória ao transferir).
3. **Marcar lida/não-lida** real (Edge Function da Fase 0) — #13.
4. **Fixar** (#11) e **arquivar** (#12) conversas.
5. **Notas internas + menções `@`** (`zapi_chat_notes`) — #47.
6. **`C25`** monitor de saúde da conexão Z-API (status, alerta de QR caído).
7. **`C28`** SLA + alerta de conversa parada. **`C30`** modo supervisor.

**Critério de pronto:** atribuir conversa reflete em tempo real para os demais;
status filtra a lista; nota interna não vai ao eleitor; alerta dispara quando a
conexão cai.

---

### FASE 4 — Interações nativas do WhatsApp 🟦

**Depende de:** Fase 0. **Resolve:** o "óbvio" que todo usuário de WhatsApp espera.

**O que fazer:** `C1` responder/citar mensagem · `C2` reagir com emoji (enviar) ·
`C3` encaminhar mensagem · `C5` favoritar mensagem (`zapi_chat_message_flags`) ·
`C6` recibos de leitura + "digitando…" · `C7` mensagem de localização · `C8`
refletir edição/exclusão.

**Critério de pronto:** responder citando mostra o trecho citado; reação enviada
aparece no WhatsApp do eleitor; encaminhar leva a mídia a outra conversa.

---

### FASE 5 — Produtividade 🟪

**Depende de:** Fases 0–3.

**O que fazer:** respostas rápidas com atalho `/` (#40) + `C11` variáveis
(`{{nome}}`) + `C12` categorias · `C9` agendar envio · `C10` snooze · `C13` ações
em massa · `C14` visões salvas · `C15` rascunho persistente · `C27` horário de
atendimento · `C31` exportar conversa (PDF) · `C32` fila de reenvio · etiquetas na
conversa (#10) · click-to-extract (#21) · atalhos de teclado (#53).

**Critério de pronto:** `/` abre respostas rápidas com variáveis preenchidas;
agendar envia no horário; ações em massa aplicam a várias conversas.

---

### FASE 6 — CRM político 🟫

**Depende de:** Fases 0–3. **É o diferencial competitivo.**

**O que fazer:** `C17` broadcast segmentado por tag/bairro com ritmo anti-ban ·
`C18` protocolo de demanda com retorno automático ao eleitor · `C19` aniversário ·
`C20` convite a evento · `C21` bairro/zona no painel (integra `LeadsMap`) · `C22`
régua de relacionamento · `C23` campanhas/pesquisa de opinião · `C24` opt-in LGPD ·
`C29` CSAT.

**Regra crítica:** `C17` só envia para contatos com `C24` (opt-in) registrado;
ritmo controlado para reduzir risco de banimento.

**Critério de pronto:** broadcast respeita opt-in e ritmo; mudança de status da
demanda dispara mensagem ao eleitor; broadcast bloqueia quem não consentiu.

---

### FASE 7 — Inteligência (IA) + métricas 🟥

**Depende de:** Fase 0 (`C40` toggles) + Fases 1–3. **Pode entrar por último.**

**O que fazer:** `C33` resumo da conversa · `C34` sugestão de resposta · `C35`
classificação de assunto · `C36` sentimento · `C37` next-best-action · `C38`
transcrição de áudio · `C26` multi-número · dashboard de atendimento (#60) ·
auditoria (#61).

**Regra crítica:** **todo recurso de IA respeita o toggle do `C40`** — se a conta
está com IA desligada, o código de IA **não roda** (sem custo, sem chamada).

**Critério de pronto:** com IA ligada na conta, resumo/transcrição funcionam; com
IA desligada, nenhum recurso de IA aparece nem é chamado.

---

## 6. Modelo de dados (consolidado)

| Tabela | Mudança |
|---|---|
| `zapi_chats` | + `status`, `assigned_to`, `pinned`, `archived`, `snoozed_until` |
| `zapi_accounts` | + `recursos_config` (jsonb) |
| `tarefas` | + `prioridade` |
| `zapi_chat_tags` | **nova** — junção chat ↔ tag |
| `zapi_quick_replies` | **nova** — respostas rápidas (com categoria e variáveis) |
| `zapi_chat_notes` | **nova** — notas internas + menções |
| `zapi_chat_message_flags` | **nova** — mensagens favoritas |
| `zapi_broadcasts` / `zapi_broadcast_targets` | **novas** (Fase 6) — campanhas |
| `contacts` | + `optin_whatsapp`, `optin_data` (Fase 6, LGPD) |

Todas as tabelas novas com **RLS** multi-tenant. Expand-contract nas alterações
de tabela existente (sem downtime).

---

## 7. Considerações técnicas

1. **Z-API não-oficial:** sem templates HSM; "respostas rápidas" são snippets do
   CRM. Risco de ban real → broadcast com ritmo controlado + opt-in.
2. **RLS bloqueia escrita do client** em `zapi_chats` → toda mutação de estado via
   Edge Function `service_role`.
3. **Webhook Z-API** não aceita header customizado → secret na query string.
4. **Realtime** já existe (`useZapiChats`) → reaproveitar para status/atribuição.
5. **LGPD:** mensagens de eleitores são dados pessoais. Confirmar política de
   privacidade antes do go-live; `C24` registra consentimento.
6. **IA:** todo recurso de IA é gated pelo `C40`. `useAISettings` já existe.

---

## 8. Cadeia de qualidade por fase

Cada fase passa pela cadeia QG: **PO → Backlog → Fullstack → Security → Code
Review → QA**. `Pentest` dispara automaticamente nas fases que tocam superfície
crítica (Fase 0 — migration+RLS+Edge Function `service_role`; Fase 3 — atribuição;
Fase 6 — broadcast/LGPD).

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Banimento do número (Z-API) | Broadcast com ritmo + opt-in obrigatório (`C24`) |
| Atendentes colidindo | Fase 3 (status+atribuição) é pré-requisito de uso em equipe |
| Edição inline perder dado | Optimistic update + rollback react-query + feedback "salvo" |
| Custo de IA descontrolado | `C40` desliga IA por conta; default desligado |
| Escopo grande sem checkpoint | Entrega **fase a fase**, cada fase testável |
| LGPD | `C24` + confirmação de política antes do go-live |

---

## 10. Sequenciamento final

**Fazer primeiro, sem exceção: FASE 0.** Depois, a ordem recomendada de valor:
**Fase 1 → 2 → 3** entrega um CRM+WhatsApp comercialmente viável. **Fase 4 → 5**
agrega produtividade. **Fase 6** entrega o diferencial político. **Fase 7** (IA)
fecha como plataforma premium e pode ser a última sem prejuízo de viabilidade.

> Cada fase é um **marco testável**. Recomenda-se teste do cliente ao fim de cada
> fase (ou, no mínimo, ao fim das Fases 0+1 juntas — o primeiro marco com tela
> visível).
