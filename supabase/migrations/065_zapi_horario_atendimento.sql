-- ============================================================================
-- Migration 065: Coluna horario_atendimento em zapi_accounts (C27)
-- ============================================================================
-- Objetivo: Persistir configuração de horário de atendimento por conta Z-API.
-- A estrutura JSONB armazena 7 dias da semana com faixas de horário.
--
-- RLS: UPDATE permitido via client autenticado pelo owner da conta
--      (herda RLS existente de zapi_accounts — UPDATE pelo próprio criador/admin).
--
-- Escrita: direto via client autenticado com useZapiAccounts().updateMutation
-- (sem nova EF — a tabela zapi_accounts já tem RLS adequada).
--
-- Schema JSONB esperado:
--   {
--     "seg": { "inicio": "08:00", "fim": "18:00", "ativo": true },
--     "ter": { "inicio": "08:00", "fim": "18:00", "ativo": true },
--     "qua": { "inicio": "08:00", "fim": "18:00", "ativo": true },
--     "qui": { "inicio": "08:00", "fim": "18:00", "ativo": true },
--     "sex": { "inicio": "08:00", "fim": "18:00", "ativo": true },
--     "sab": { "inicio": "09:00", "fim": "12:00", "ativo": false },
--     "dom": { "inicio": "09:00", "fim": "12:00", "ativo": false }
--   }
--
-- NULL = feature desligada (sem banner de fora do expediente).
-- Referência: RAQ-MAND-EM073 — T50
-- ============================================================================

ALTER TABLE public.zapi_accounts
  ADD COLUMN IF NOT EXISTS horario_atendimento JSONB DEFAULT NULL;

COMMENT ON COLUMN public.zapi_accounts.horario_atendimento IS
  'Configuração de horário de atendimento por dia da semana. NULL = desabilitado. '
  'Estrutura: { "seg": {"inicio":"08:00","fim":"18:00","ativo":true}, ... }. '
  'Dias: seg, ter, qua, qui, sex, sab, dom. '
  'Cálculo de isOpen é client-side (JS puro). Requer feature flag c27 habilitada.';

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 065: horario_atendimento JSONB adicionada em zapi_accounts (DEFAULT NULL).';
END
$$;
