-- ============================================================================
-- Migration 074: Cron job para régua de relacionamento diária (C22)
-- ============================================================================
-- Objetivo: Registrar o cron job 'zapi-relationship-followup-daily' que chama
-- a EF zapi-relationship-followup às 8h da manhã, todos os dias.
--
-- Usa o mesmo padrão de segurança das migrations 066 e 071:
--   - CRON_SECRET lido do Vault via private.get_cron_secret()
--
-- Idempotência: cron.unschedule IF EXISTS antes de recriar.
-- Referência: RAQ-MAND-EM073 — T73 (Fase 6 Onda B)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── Cron job: executa às 8h diariamente ─────────────────────────────────────

SELECT cron.unschedule('zapi-relationship-followup-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-relationship-followup-daily');

SELECT cron.schedule(
  'zapi-relationship-followup-daily',
  '0 8 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://nevgnvrwqaoztefnyqdj.supabase.co/functions/v1/zapi-relationship-followup',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || private.get_cron_secret()
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 074: '
    'Cron job "zapi-relationship-followup-daily" registrado (executa às 8h diariamente). '
    'Usa CRON_SECRET do Vault via private.get_cron_secret(). '
    'Referência: T73 Fase 6 Onda B.';
END
$$;
