-- ============================================================================
-- Migration 071: Cron job para processamento de broadcast (C17)
-- ============================================================================
-- Objetivo: Registrar o cron job 'zapi-broadcast-sender' que chama a EF
-- zapi-broadcast-send a cada minuto via pg_net.
--
-- Usa o mesmo padrão de segurança da migration 066:
--   - CRON_SECRET lido do Vault via private.get_cron_secret()
--   - URL pública do projeto (não é secret)
--
-- Idempotência: cron.unschedule IF EXISTS antes de recriar.
-- Referência: RAQ-MAND-EM073 — T64 (Fase 6 Onda A)
-- ============================================================================

-- ─── 1. Garante extensões ─────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── 2. Cron job zapi-broadcast-sender ───────────────────────────────────────
-- Chama a EF zapi-broadcast-send a cada minuto.
-- A EF processa até N targets por broadcast ativo (N = ritmo_por_minuto).

SELECT cron.unschedule('zapi-broadcast-sender')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-broadcast-sender');

SELECT cron.schedule(
  'zapi-broadcast-sender',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://nevgnvrwqaoztefnyqdj.supabase.co/functions/v1/zapi-broadcast-send',
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
  RAISE NOTICE 'Migration 071: '
    'Cron job "zapi-broadcast-sender" registrado (executa a cada minuto via pg_net). '
    'Usa CRON_SECRET do Vault via private.get_cron_secret(). '
    'Referência: T64 Fase 6 Onda A.';
END
$$;
