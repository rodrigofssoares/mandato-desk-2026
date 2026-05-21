# Backlog — Fase 0 + Fase 1 · Evolução WhatsApp CRM

> Quebra atomizada do `PRD-EVOLUCAO-WHATSAPP.md` (Fases 0 e 1).
> Gerado pelo agente Backlog em 2026-05-17. Total: 12 tasks (~57 pts).

## Ordem de execução (dependências técnicas)

```
T01 — Migration: colunas em zapi_chats, tarefas, zapi_accounts        [Security+Pentest]
T02 — Migration: 4 tabelas novas + RLS                                [Security+Pentest]
T03 — Edge Function: zapi-mark-as-read                                [Security+Pentest]
T04 — Edge Function: zapi-chat-update (status/assign/pin/archive)     [Security+Pentest]
T05 — Hook useAccountFeatures + isFeatureEnabled (C40)
T06 — UI: aba "Recursos" em AccountFormDialog + AccountCard (C40)
T07 — ContactPanel: edição inline (click-to-edit)
T08 — ContactPanel: pop-up de edição completo
T09 — ContactPanel: funil — exibir etapa + mover
T10 — ContactPanel: lista de tarefas + prioridade + concluir
T11 — ContactPanel: criar tarefa rápida
T12 — ContactPanel: criar contato + detecção de duplicado (C39)
```

## FASE 0 — Fundação (T01–T06)

### T01 — Colunas operacionais em zapi_chats, tarefas, zapi_accounts (M)
- `zapi_chats`: `status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_atendimento','aguardando','finalizada'))`, `assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL`, `pinned BOOL NOT NULL DEFAULT false`, `archived BOOL NOT NULL DEFAULT false`, `snoozed_until TIMESTAMPTZ`
- `tarefas`: `prioridade TEXT CHECK (prioridade IN ('baixa','media','alta'))` (nullable)
- `zapi_accounts`: `recursos_config JSONB NOT NULL DEFAULT '{}'`
- Índices: `idx_zapi_chats_status`, `idx_zapi_chats_assigned_to`, parciais `pinned`/`archived`
- Regenerar `types.ts`. Migration `056_zapi_operacional_schema.sql`.

### T02 — 4 tabelas auxiliares + RLS (L)
- `zapi_chat_tags` (junção chat↔tag, UNIQUE chat_id+tag_id)
- `zapi_quick_replies` (account_id, titulo, corpo, categoria, variaveis jsonb, created_by)
- `zapi_chat_notes` (chat_id, autor_id, corpo, mencoes jsonb)
- `zapi_chat_message_flags` (chat_id, message_id, flagged_by, UNIQUE)
- RLS multi-tenant em todas; índices por chat_id/account_id. Migration `057_zapi_tabelas_auxiliares.sql`.

### T03 — Edge Function zapi-mark-as-read (S)
- Substitui o no-op de `useMarkChatAsRead`. UPDATE `unread_count=0` via service_role.
- 400 sem chat_id, 404 chat inexistente, 401 sem JWT. Hook passa a chamar a EF.

### T04 — Edge Function zapi-chat-update (L)
- Patch parcial `{chat_id, patch:{status,assigned_to,pinned,archived,snoozed_until}}`.
- Valida status no enum; valida `assigned_to` existe em `profiles` aprovado; 422 em inválido.

### T05 — useAccountFeatures + isFeatureEnabled (S)
- `isFeatureEnabled(config, feature): boolean` puro em `src/lib/featureFlags.ts` (ausente = false).
- `useAccountFeatures(accountId)` em `src/hooks/useAccountFeatures.ts`. `recursos_config` em SAFE_COLUMNS.

### T06 — Aba "Recursos" em AccountFormDialog + AccountCard (M)
- `Tabs` shadcn: "Conexão" + "Recursos". Switches agrupados (IA / Automação / Engajamento).
- IA com aviso de custo. Default OFF. Badge "X recursos ativos" no AccountCard. Só em modo edição.

## FASE 1 — Conversa vira CRM (T07–T12)

### T07 — ContactPanel edição inline (L)
- Extrair `ContactPanel` para `src/components/whatsapp/ContactPanel.tsx`.
- Click-to-edit nos campos: nome, telefone, whatsapp, email, profissao, origem, observacoes.
- Salva no blur via `useContacts().updateMutation` + validação Zod existente. Toast salvo/erro+rollback.

### T08 — Pop-up de edição completo (M)
- Botão "Editar contato" → modal com todos os campos + tags + campos personalizados (`useCustomFields`).
- Reutilizar form de contato existente; não duplicar lógica.

### T09 — Funil no painel (M)
- Seção "Funil": board + chip etapa (`useContactBoardMemberships`) + Select para mover (`useBoardItems`).
- Multi-board: bloco por board. Sem board: "Sem funil".

### T10 — Tarefas no painel + prioridade (M)
- Lista `useTarefas({contact_id})` com badge prioridade (cinza/amarelo/vermelho) + checkbox concluir.

### T11 — Criar tarefa rápida (S)
- Form inline: titulo, tipo, prioridade, data_agendada. `contact_id` pré-preenchido.

### T12 — Criar contato + dedup C39 (S)
- Valida fluxo "Adicionar no CRM" pós-ref>atoração T07; detecção de duplicado por telefone.
- Após criar, painel entra em modo editável sem navegar.

## Flags de segurança
T01–T04 tocam migration com FK `auth.users`/RLS e Edge Function `service_role` →
**Security + Pentest obrigatórios** antes de concluir a Fase 0.

## Notas para o Fullstack
1. Ordem rígida até T06. T01→T02 e T03→T04 são pares; T05 depois de T01; T06 depois de T05.
2. Regenerar `types.ts` após T01 e após T02, e commitar.
3. T07 extrai `ContactPanel` para arquivo próprio — T08–T12 assumem esse arquivo.
4. Padrão de EF: seguir `supabase/functions/zapi-send-text/index.ts` + `_shared/auth-guard.ts`.
5. Última migration existente: `055_zapi_cleanup_group_chats.sql` → próximas são 056/057.
