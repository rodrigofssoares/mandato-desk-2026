-- Migration: 044_zapi_purge_cron
--
-- Why: Cria 2 jobs pg_cron para purge automático diário de dados antigos do módulo Z-API.
--      Decisão de retenção de 90 dias definida por Rodrigo + Raquel (LGPD).
--      Dados mais antigos que 90 dias não têm valor operacional e aumentam custo de storage.
--
-- Jobs criados:
--   zapi-purge-messages    — apaga zapi_messages com created_at < now() - 90 days (00:00 UTC)
--   zapi-purge-webhook-logs — apaga zapi_webhook_log com received_at < now() - 90 days (00:05 UTC)
--
-- Reference: RAQ-MAND-EM051 — T18 (pg_cron purge 90 dias)
-- Depende de: migration 043_zapi_whatsapp (tabelas zapi_messages e zapi_webhook_log)
--
-- PRÉ-REQUISITO OBRIGATÓRIO:
--   pg_cron deve estar habilitado no Supabase Dashboard antes de aplicar esta migration.
--   Caminho: Supabase Dashboard → Database → Extensions → pg_cron → Enable
--   Se a extensão não estiver habilitada, esta migration FALHARÁ explicitamente
--   (CREATE EXTENSION retornará erro que interrompe o db push — comportamento intencional).
--
-- Rollback:
--   SELECT cron.unschedule('zapi-purge-messages');
--   SELECT cron.unschedule('zapi-purge-webhook-logs');
--   DROP EXTENSION IF EXISTS pg_cron;

-- ─── 1. Habilitar pg_cron ─────────────────────────────────────────────────────
-- Falha de forma clara se pg_cron não estiver disponível no plano Supabase.
-- Supabase Pro e superiores suportam pg_cron. Free tier pode não suportar.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── 2. Remover jobs anteriores (idempotência) ───────────────────────────────
-- Evita erro "already exists" em re-applies da migration.
SELECT cron.unschedule('zapi-purge-messages')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-purge-messages');

SELECT cron.unschedule('zapi-purge-webhook-logs')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-purge-webhook-logs');

-- ─── 3. Job: purge zapi_messages > 90 dias ───────────────────────────────────
-- Executa diariamente às 03:00 UTC (01:00 BRT no horário de verão, 00:00 BRT no inverno).
-- Apaga mensagens mais antigas que 90 dias. Decisão de retenção: Rodrigo + Raquel (LGPD).
-- Horário escolhido para baixo tráfego de webhook (madrugada no Brasil).
SELECT cron.schedule(
  'zapi-purge-messages',
  '0 3 * * *',
  $$
    DELETE FROM public.zapi_messages
    WHERE created_at < now() - INTERVAL '90 days';
  $$
);

COMMENT ON TABLE public.zapi_messages IS
  'Histórico de mensagens WhatsApp por chat. UNIQUE(message_id, account_id) garante '
  'idempotência: a EF usa INSERT ... ON CONFLICT DO NOTHING. '
  'body=NULL para mensagens de mídia (MVP não armazena base64). '
  'Escrita apenas via service_role. '
  'Purge automático: pg_cron job "zapi-purge-messages" apaga registros com '
  'created_at < now() - 90 days às 03:00 UTC diariamente. '
  'Retenção de 90 dias definida por Rodrigo + Raquel (conformidade LGPD).';

-- ─── 4. Job: purge zapi_webhook_log > 90 dias ────────────────────────────────
-- Executa diariamente às 03:05 UTC (5 minutos após o purge de mensagens).
-- Apaga logs de webhook mais antigos que 90 dias.
-- Mantemos a mesma política de retenção: 90 dias (decisão Rodrigo + Raquel, LGPD).
SELECT cron.schedule(
  'zapi-purge-webhook-logs',
  '5 3 * * *',
  $$
    DELETE FROM public.zapi_webhook_log
    WHERE received_at < now() - INTERVAL '90 days';
  $$
);

COMMENT ON TABLE public.zapi_webhook_log IS
  'Log de auditoria de todos os eventos recebidos via webhook Z-API. '
  'account_id NULLABLE: eventos de conta não reconhecida são logados com account_id=NULL. '
  'Escrita apenas via service_role. '
  'Purge automático: pg_cron job "zapi-purge-webhook-logs" apaga registros com '
  'received_at < now() - 90 days às 03:05 UTC diariamente. '
  'Retenção de 90 dias definida por Rodrigo + Raquel (conformidade LGPD).';
