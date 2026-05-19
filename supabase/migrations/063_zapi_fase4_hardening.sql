-- ============================================================================
-- Migration 063: Hardening pós security audit Fase 4
-- ============================================================================
-- Corrige 3 achados identificados no pentest/security review da Fase 4:
--
--   a) CHECK constraints de tamanho nas colunas novas de zapi_messages (migration 062):
--      quoted_body <= 500, quoted_message_id <= 255, quoted_type <= 64,
--      edited_body <= 4096. Evita inserção de payloads gigantes via webhook.
--
--   b) Corrige policy RLS zapi_message_flags_select em zapi_chat_message_flags:
--      era USING (auth.uid() IS NOT NULL) — qualquer autenticado lia favoritos alheios.
--      Corrigido para USING (flagged_by = auth.uid()) — cada usuário só vê os próprios.
--
-- Idempotência: DROP CONSTRAINT IF EXISTS + DROP POLICY IF EXISTS antes de recriar.
-- ============================================================================

-- ── a. CHECK constraints de tamanho nas colunas Fase 4 ────────────────────────

-- quoted_message_id <= 255 chars
ALTER TABLE public.zapi_messages
  DROP CONSTRAINT IF EXISTS chk_zapi_messages_quoted_message_id_len;

ALTER TABLE public.zapi_messages
  ADD CONSTRAINT chk_zapi_messages_quoted_message_id_len
  CHECK (quoted_message_id IS NULL OR char_length(quoted_message_id) <= 255);

-- quoted_body <= 500 chars
ALTER TABLE public.zapi_messages
  DROP CONSTRAINT IF EXISTS chk_zapi_messages_quoted_body_len;

ALTER TABLE public.zapi_messages
  ADD CONSTRAINT chk_zapi_messages_quoted_body_len
  CHECK (quoted_body IS NULL OR char_length(quoted_body) <= 500);

-- quoted_type <= 64 chars
ALTER TABLE public.zapi_messages
  DROP CONSTRAINT IF EXISTS chk_zapi_messages_quoted_type_len;

ALTER TABLE public.zapi_messages
  ADD CONSTRAINT chk_zapi_messages_quoted_type_len
  CHECK (quoted_type IS NULL OR char_length(quoted_type) <= 64);

-- edited_body <= 4096 chars (espelha o slice feito na Edge Function)
ALTER TABLE public.zapi_messages
  DROP CONSTRAINT IF EXISTS chk_zapi_messages_edited_body_len;

ALTER TABLE public.zapi_messages
  ADD CONSTRAINT chk_zapi_messages_edited_body_len
  CHECK (edited_body IS NULL OR char_length(edited_body) <= 4096);

-- ── b. Corrigir policy zapi_message_flags_select ──────────────────────────────
-- Achado: policy original usava auth.uid() IS NOT NULL — todos os autenticados
-- podiam ler favoritos de qualquer usuário. Corrigido para filtro pelo dono.

DROP POLICY IF EXISTS "zapi_message_flags_select"
  ON public.zapi_chat_message_flags;

CREATE POLICY "zapi_message_flags_select"
  ON public.zapi_chat_message_flags
  FOR SELECT
  USING (flagged_by = auth.uid());

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 063: CHECK constraints de tamanho em zapi_messages (quoted/edited) e policy zapi_message_flags_select corrigida (flagged_by = auth.uid()).';
END
$$;
