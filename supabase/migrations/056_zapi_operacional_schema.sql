-- ============================================================================
-- Migration 056: colunas operacionais em zapi_chats, tarefas e zapi_accounts
-- ============================================================================
-- Objetivo (FASE 0 — Fundação):
--   Adiciona campos de estado operacional para a evolução do módulo WhatsApp:
--   - zapi_chats: status, assigned_to, pinned, archived, snoozed_until
--   - tarefas: prioridade
--   - zapi_accounts: recursos_config (feature flags por conta — C40)
--
-- Padrão: ADD COLUMN IF NOT EXISTS (idempotente, pode ser reaplicada).
-- Índices: IF NOT EXISTS garante idempotência.
--
-- Referência: RAQ-MAND — FASE 0 T01
-- ============================================================================

-- ─── 1. zapi_chats — colunas operacionais ───────────────────────────────────

ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'em_atendimento', 'aguardando', 'finalizada'));

ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS assigned_to UUID
    REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS pinned BOOL NOT NULL DEFAULT false;

ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS archived BOOL NOT NULL DEFAULT false;

ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ;

COMMENT ON COLUMN public.zapi_chats.status IS
  'Estado operacional da conversa: aberta (padrão), em_atendimento, aguardando, finalizada. '
  'Mutações apenas via Edge Function zapi-chat-update (service_role) — RLS bloqueia client.';

COMMENT ON COLUMN public.zapi_chats.assigned_to IS
  'UUID do usuário responsável pela conversa. NULL = não atribuída. '
  'FK para auth.users com ON DELETE SET NULL — remover usuário não apaga o chat.';

COMMENT ON COLUMN public.zapi_chats.pinned IS
  'Conversa fixada no topo da lista. Default false.';

COMMENT ON COLUMN public.zapi_chats.archived IS
  'Conversa arquivada (oculta da lista padrão). Default false.';

COMMENT ON COLUMN public.zapi_chats.snoozed_until IS
  'Quando definido, a conversa é suprimida da lista ativa até este timestamp (snooze). '
  'NULL = sem snooze ativo.';

-- ─── 2. tarefas — campo de prioridade ───────────────────────────────────────

ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS prioridade TEXT
    CHECK (prioridade IN ('baixa', 'media', 'alta'));

COMMENT ON COLUMN public.tarefas.prioridade IS
  'Prioridade da tarefa: baixa, media ou alta. Nullable — tarefas sem prioridade definida.';

-- ─── 3. zapi_accounts — configuração de recursos (C40) ──────────────────────

ALTER TABLE public.zapi_accounts
  ADD COLUMN IF NOT EXISTS recursos_config JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.zapi_accounts.recursos_config IS
  'Feature flags por conta (C40 — Painel de Recursos). '
  'Objeto JSON: chave = código do recurso (ex: "c33", "c34"), valor = boolean. '
  'Default seguro: {} = todos os recursos opcionais desligados. '
  'Recursos de IA (c33-c38) e broadcast precisam ser habilitados explicitamente.';

-- ─── 4. Índices ──────────────────────────────────────────────────────────────

-- Filtro por status (ex: listar só conversas abertas ou em_atendimento)
CREATE INDEX IF NOT EXISTS idx_zapi_chats_status
  ON public.zapi_chats (status);

-- Filtro por atendente atribuído
CREATE INDEX IF NOT EXISTS idx_zapi_chats_assigned_to
  ON public.zapi_chats (assigned_to)
  WHERE assigned_to IS NOT NULL;

-- Índice parcial: conversas fixadas (pinned=true normalmente < 1% do total)
CREATE INDEX IF NOT EXISTS idx_zapi_chats_pinned
  ON public.zapi_chats (account_id, last_message_at DESC)
  WHERE pinned = true;

-- Índice parcial: conversas arquivadas (filtro padrão as exclui)
CREATE INDEX IF NOT EXISTS idx_zapi_chats_archived
  ON public.zapi_chats (account_id, last_message_at DESC)
  WHERE archived = true;

-- ─── 5. Log ──────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 056: colunas operacionais adicionadas a zapi_chats, tarefas e zapi_accounts.';
END
$$;
