-- ============================================================
-- PASSO 1 de 3 — Limpeza do webhook_logs + ajuste de crons
-- Rode no SQL Editor do Supabase. Abra o arquivo, Ctrl+A, copie,
-- cole no editor e execute. Depois siga para o passo-2.
-- ============================================================

-- Apaga logs de webhook com mais de 7 dias (remove os 2 picos de sync)
DELETE FROM webhook_logs WHERE created_at < now() - interval '7 days';

-- Cron de purga automatica: todo dia 03:30, mantem so 7 dias
SELECT cron.unschedule('purge-webhook-logs-7d')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-webhook-logs-7d');

SELECT cron.schedule('purge-webhook-logs-7d', '30 3 * * *',
  $$DELETE FROM public.webhook_logs WHERE created_at < now() - interval '7 days'$$);

-- Reduz os crons de minuto para cada 2 minutos (metade da carga)
SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'zapi-scheduled-sender'),
  schedule := '*/2 * * * *');

SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname = 'zapi-broadcast-sender'),
  schedule := '*/2 * * * *');
