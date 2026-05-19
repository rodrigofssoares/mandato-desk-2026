-- ============================================================================
-- Migration 058: hardening das tabelas auxiliares Z-API (FASE 0)
-- ============================================================================
-- Objetivo:
--   Adiciona CHECK constraints de tamanho nos campos TEXT/JSONB para limitar
--   payloads abusivos, e força FORCE ROW LEVEL SECURITY nas 4 tabelas novas.
--
-- Single-tenant — decisão de design documentada:
--   Este projeto é SINGLE-TENANT: um projeto Supabase = um mandato político.
--   SELECT global em tabelas zapi_* é design aceito (ver migration 045, nota F4).
--   Isolamento por conta Z-API (zapi_account_members, FK assigned_to) fica para
--   a Fase 3 (modo supervisor / RBAC granular).
--
-- Idempotência:
--   Cada ADD CONSTRAINT é precedido de DROP CONSTRAINT IF EXISTS para permitir
--   reaplicação sem erro (ex: db push em ambiente de desenvolvimento).
--
-- Referência: RAQ-MAND — FASE 0 T02 (hardening pós-security audit)
-- ============================================================================

-- ─── 1. CHECK constraints em zapi_quick_replies ──────────────────────────────

ALTER TABLE public.zapi_quick_replies
  DROP CONSTRAINT IF EXISTS chk_quick_replies_titulo_len;
ALTER TABLE public.zapi_quick_replies
  ADD CONSTRAINT chk_quick_replies_titulo_len
  CHECK (char_length(titulo) <= 200);

ALTER TABLE public.zapi_quick_replies
  DROP CONSTRAINT IF EXISTS chk_quick_replies_corpo_len;
ALTER TABLE public.zapi_quick_replies
  ADD CONSTRAINT chk_quick_replies_corpo_len
  CHECK (char_length(corpo) <= 5000);

ALTER TABLE public.zapi_quick_replies
  DROP CONSTRAINT IF EXISTS chk_quick_replies_categoria_len;
ALTER TABLE public.zapi_quick_replies
  ADD CONSTRAINT chk_quick_replies_categoria_len
  CHECK (categoria IS NULL OR char_length(categoria) <= 100);

ALTER TABLE public.zapi_quick_replies
  DROP CONSTRAINT IF EXISTS chk_quick_replies_variaveis_size;
ALTER TABLE public.zapi_quick_replies
  ADD CONSTRAINT chk_quick_replies_variaveis_size
  CHECK (variaveis IS NULL OR octet_length(variaveis::text) <= 4096);

-- ─── 2. CHECK constraints em zapi_chat_notes ─────────────────────────────────

ALTER TABLE public.zapi_chat_notes
  DROP CONSTRAINT IF EXISTS chk_chat_notes_corpo_len;
ALTER TABLE public.zapi_chat_notes
  ADD CONSTRAINT chk_chat_notes_corpo_len
  CHECK (char_length(corpo) <= 5000);

ALTER TABLE public.zapi_chat_notes
  DROP CONSTRAINT IF EXISTS chk_chat_notes_mencoes_size;
ALTER TABLE public.zapi_chat_notes
  ADD CONSTRAINT chk_chat_notes_mencoes_size
  CHECK (mencoes IS NULL OR octet_length(mencoes::text) <= 4096);

-- ─── 3. CHECK constraint em zapi_accounts ────────────────────────────────────
-- Limita recursos_config a 4KB e garante que seja um objeto JSON (não array/string).

ALTER TABLE public.zapi_accounts
  DROP CONSTRAINT IF EXISTS chk_recursos_config_size;
ALTER TABLE public.zapi_accounts
  ADD CONSTRAINT chk_recursos_config_size
  CHECK (
    pg_column_size(recursos_config) <= 4096
    AND jsonb_typeof(recursos_config) = 'object'
  );

-- ─── 4. FORCE ROW LEVEL SECURITY nas 4 tabelas novas ─────────────────────────
-- Garante que mesmo superuser/service_role respeitem as policies (ou estejam
-- explicitamente configurados para bypass via set_config). Princípio de
-- least-privilege como segunda camada de defesa.

ALTER TABLE public.zapi_chat_tags           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_quick_replies       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_chat_notes          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_chat_message_flags  FORCE ROW LEVEL SECURITY;

-- ─── Log ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 058: CHECK constraints de tamanho + FORCE RLS aplicados nas tabelas zapi auxiliares.';
END
$$;
