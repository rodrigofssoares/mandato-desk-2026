-- ============================================================================
-- Migration 085: Purga do webhook_logs + redução de carga dos crons
-- ============================================================================
-- Contexto: incidente de 2026-05-18 — o banco saturou na instância mínima e
-- o sistema ficou fora do ar. Causa: a tabela `webhook_logs` acumulou 215 MB
-- (102.800 linhas — 80% do banco) por não ter cron de purga, e dois crons
-- rodavam a cada minuto disparando Edge Functions.
--
-- Esta migration torna permanente a correção aplicada em produção:
--   1. Purga pontual do webhook_logs (mantém só 7 dias).
--   2. Cron de purga diária do webhook_logs (retenção 7 dias).
--   3. Reduz os crons zapi-scheduled-sender e zapi-broadcast-sender de
--      1 em 1 minuto para 2 em 2 minutos (metade da carga de base).
--
-- Observação: o `zapi-purge-webhook-logs` (migration anterior) purga a tabela
-- `zapi_webhook_log` — outra tabela. A `webhook_logs` não tinha purga nenhuma.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── 1. Purga pontual: remove logs de webhook com mais de 7 dias ─────────────

DELETE FROM public.webhook_logs WHERE created_at < now() - INTERVAL '7 days';

-- ─── 2. Cron de purga diária do webhook_logs (03:30, retenção 7 dias) ────────

SELECT cron.unschedule('purge-webhook-logs-7d')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-webhook-logs-7d');

SELECT cron.schedule(
  'purge-webhook-logs-7d',
  '30 3 * * *',
  $$DELETE FROM public.webhook_logs WHERE created_at < now() - INTERVAL '7 days'$$
);

-- ─── 3. Crons de envio: de 1min para 2min ────────────────────────────────────
-- Recriados (unschedule + schedule) para fixar o schedule '*/2 * * * *'.
-- Comandos idênticos aos das migrations 066/071 — apenas a frequência muda.

SELECT cron.unschedule('zapi-scheduled-sender')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-scheduled-sender');

SELECT cron.schedule(
  'zapi-scheduled-sender',
  '*/2 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://nevgnvrwqaoztefnyqdj.supabase.co/functions/v1/zapi-send-scheduled',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || private.get_cron_secret()
      ),
      body    := '{}'::jsonb
    );
  $$
);

SELECT cron.unschedule('zapi-broadcast-sender')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-broadcast-sender');

SELECT cron.schedule(
  'zapi-broadcast-sender',
  '*/2 * * * *',
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
  RAISE NOTICE 'Migration 085: '
    'webhook_logs purgado (retenção 7 dias) + cron de purga diária criado. '
    'Crons zapi-scheduled-sender e zapi-broadcast-sender reduzidos para 2min. '
    'Referência: incidente de saturação do banco em 2026-05-18.';
END
$$;
