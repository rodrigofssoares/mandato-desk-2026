-- ============================================================================
-- Migration 066: Hardening de segurança em zapi_scheduled_messages
-- ============================================================================
-- Achados corrigidos:
--
--   CRÍTICA-1: RLS de INSERT em zapi_scheduled_messages permitia que clientes
--     autenticados inserissem diretamente, sem validação de account_id/rate-limit.
--     Corrigido: policy INSERT = WITH CHECK (false) — bloqueia qualquer INSERT
--     direto pelo client. A nova EF zapi-schedule-message insere via service_role.
--
--   CRÍTICA-2: scheduled_at sem CHECK de janela temporal — podia ser no passado
--     (envio imediato) ou arbitrariamente no futuro.
--     Corrigido: CHECK constraint futura + janela máxima de 90 dias.
--
--   MÉDIA-2: Ausência de coluna processing_started_at para dead-letter recovery.
--     Corrigido: coluna adicionada + índice para a query de ressurreição.
--
--   ALTA-1 (infra): o cron job anterior usava service_role_key no GUC do banco
--     (app.service_role_key). Este migration recria o cron job para usar
--     app.cron_secret em vez do service_role_key.
--     O secret NÃO é commitado aqui — deve ser configurado via:
--       npx supabase secrets set CRON_SECRET=<valor>
--       npx supabase db query --linked "ALTER DATABASE postgres SET app.cron_secret = '<valor>'"
--
-- Idempotência: DROP IF EXISTS antes de ADD/CREATE.
-- Referência: RAQ-MAND-EM073 — Security Pentest Fase 5
-- ============================================================================

-- ─── 1. Bloqueia INSERT direto pelo client ─────────────────────────────────────
-- A nova política impede qualquer client autenticado de inserir diretamente.
-- A EF zapi-schedule-message insere via service_role (bypassa RLS).

DROP POLICY IF EXISTS "zapi_scheduled_messages_insert" ON public.zapi_scheduled_messages;

CREATE POLICY "zapi_scheduled_messages_insert"
  ON public.zapi_scheduled_messages
  FOR INSERT
  WITH CHECK (false);

COMMENT ON POLICY "zapi_scheduled_messages_insert" ON public.zapi_scheduled_messages IS
  'INSERT bloqueado no client. Inserção APENAS via EF zapi-schedule-message '
  '(service_role) que valida JWT, permissão, account_id, phone, rate-limit e '
  'janela temporal antes de inserir. Achado CRÍTICA-1 RAQ-MAND-EM073 pentest.';

-- ─── 2. CHECK constraint: scheduled_at deve ser futuro e dentro de 90 dias ──────

-- Drop defensivo (idempotência)
ALTER TABLE public.zapi_scheduled_messages
  DROP CONSTRAINT IF EXISTS chk_scheduled_at_window;

ALTER TABLE public.zapi_scheduled_messages
  ADD CONSTRAINT chk_scheduled_at_window
  CHECK (
    scheduled_at > created_at - interval '2 minutes'
    AND scheduled_at < created_at + interval '90 days'
  );

COMMENT ON CONSTRAINT chk_scheduled_at_window ON public.zapi_scheduled_messages IS
  'scheduled_at deve ser futuro (tolerância de 2 min de clock skew) e dentro '
  'de 90 dias a partir da criação. Impede disparos imediatos via data no passado '
  'e agendamentos excessivamente distantes. Achado CRÍTICA-2 RAQ-MAND-EM073 pentest.';

-- ─── 3. Coluna processing_started_at para dead-letter recovery ──────────────────

ALTER TABLE public.zapi_scheduled_messages
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.zapi_scheduled_messages.processing_started_at IS
  'Timestamp do momento em que o lock otimista foi adquirido (status=processando). '
  'A EF zapi-send-scheduled ressuscita registros com processing_started_at < now() - 5min '
  'revertendo para status=pendente (dead-letter recovery). Achado MÉDIA-2 RAQ-MAND-EM073.';

-- Índice para a query de ressurreição na EF (filtra processando + timeout)
CREATE INDEX IF NOT EXISTS idx_zapi_scheduled_messages_stuck
  ON public.zapi_scheduled_messages (processing_started_at)
  WHERE status = 'processando';

-- ─── 4. Recria cron job usando Vault para o CRON_SECRET ─────────────────────────
-- O service_role_key NÃO deve ficar em GUC do banco (Security Finding 2).
-- O CRON_SECRET é armazenado no Supabase Vault (vault.create_secret) e lido
-- na hora via vault.decrypted_secrets. Isso evita o secret em qualquer GUC,
-- migration ou arquivo commitado.
--
-- Pré-requisito: o secret 'cron_secret' deve existir no Vault antes que o job
-- execute. Foi inserido via:
--   SELECT vault.create_secret('<valor>', 'cron_secret', '...');
-- (executado fora de migration — não commitado).
--
-- A URL da EF usa a env var SUPABASE_URL padrão do Supabase (sempre disponível
-- como current_setting('app.settings.jwt_secret', true) não, mas via pg_net
-- podemos construir a URL a partir do project_ref).
-- Alternativa segura: usar a função auxiliar abaixo que lê do Vault.

-- Schema private para funções internas
CREATE SCHEMA IF NOT EXISTS private;

-- Função auxiliar para leitura do CRON_SECRET do Vault (executada em contexto
-- do cron job — bypassa RLS porque pg_cron roda como postgres).
DROP FUNCTION IF EXISTS private.get_cron_secret();

CREATE FUNCTION private.get_cron_secret()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, pg_catalog
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.get_cron_secret() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_cron_secret() TO postgres;

-- Remove job anterior (usa service_role_key — substituído)
SELECT cron.unschedule('zapi-scheduled-sender')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-scheduled-sender');

-- Recria usando CRON_SECRET lido do Vault em tempo de execução
-- A URL é construída a partir de current_setting('request.headers') não disponível
-- no contexto do cron — usamos a variável de ambiente do projeto que já estava
-- sendo usada: current_setting('app.supabase_url', true).
-- Como esse GUC pode não estar configurado, usamos uma URL literal do projeto
-- que é segura (não é um secret — é a URL pública do projeto Supabase).
SELECT cron.schedule(
  'zapi-scheduled-sender',
  '* * * * *',
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

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 066: zapi_scheduled_messages hardening: '
    'INSERT bloqueado no client (WITH CHECK false), '
    'CHECK constraint scheduled_at_window adicionada (futura + 90 dias), '
    'coluna processing_started_at adicionada (dead-letter recovery), '
    'cron job recriado com CRON_SECRET via Vault (sem service_role_key no GUC), '
    'funcao private.get_cron_secret() criada para leitura segura do Vault.';
END
$$;
