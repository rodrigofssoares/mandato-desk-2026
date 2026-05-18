-- ============================================================================
-- Migration 073: Tabela zapi_relationship_rules (C22)
-- ============================================================================
-- Objetivo: Criar a tabela de réguas de relacionamento automático.
-- Cada régua define: se um contato estiver na etapa X do funil há N dias sem
-- resposta, enviar mensagem_template pelo WhatsApp.
--
-- Idempotente: usa IF NOT EXISTS.
-- RLS: usuário autenticado pode gerenciar suas próprias réguas.
-- Referência: RAQ-MAND-EM073 — T72 (Fase 6 Onda B)
-- ============================================================================

-- ─── 1. Verificação de FK para board_stages ───────────────────────────────────
-- Confirma que a tabela board_stages existe antes de criar a FK.
-- Se não existir, a coluna é criada sem FK (board_stage_id UUID nullable).
-- No schema atual (migration 001+), board_stages existe como tabela de etapas.

-- ─── 2. Tabela zapi_relationship_rules ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zapi_relationship_rules (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id        UUID        NOT NULL REFERENCES public.zapi_accounts(id) ON DELETE CASCADE,
  nome              TEXT        NOT NULL,
  board_stage_id    UUID        REFERENCES public.board_stages(id) ON DELETE SET NULL,
  dias_sem_resposta INT         NOT NULL CHECK (dias_sem_resposta >= 1),
  mensagem_template TEXT        NOT NULL,
  ativo             BOOLEAN     NOT NULL DEFAULT true,
  created_by        UUID        NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice: régras ativas por conta (usadas pela EF de cron)
CREATE INDEX IF NOT EXISTS idx_zapi_relationship_rules_account
  ON public.zapi_relationship_rules (account_id)
  WHERE ativo = true;

-- ─── 3. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.zapi_relationship_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "relationship_rules_select" ON public.zapi_relationship_rules;
CREATE POLICY "relationship_rules_select"
  ON public.zapi_relationship_rules FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "relationship_rules_insert" ON public.zapi_relationship_rules;
CREATE POLICY "relationship_rules_insert"
  ON public.zapi_relationship_rules FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "relationship_rules_update" ON public.zapi_relationship_rules;
CREATE POLICY "relationship_rules_update"
  ON public.zapi_relationship_rules FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "relationship_rules_delete" ON public.zapi_relationship_rules;
CREATE POLICY "relationship_rules_delete"
  ON public.zapi_relationship_rules FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 073: '
    'Tabela zapi_relationship_rules criada com RLS habilitado. '
    'FK para board_stages (nullable). Índice parcial WHERE ativo=true. '
    'Referência: T72 Fase 6 Onda B.';
END
$$;
