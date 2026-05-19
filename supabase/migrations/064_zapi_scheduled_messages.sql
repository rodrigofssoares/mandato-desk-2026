-- ============================================================================
-- Migration 064: Tabela de mensagens agendadas + cron job pg_cron (C9)
-- ============================================================================
-- Objetivo: Infraestrutura server-side para agendamento de envio de mensagens.
-- A conversa deve ser enviada mesmo que o browser esteja fechado — requer
-- persistência no servidor. O cron job processa a fila a cada minuto via pg_net.
--
-- Arquitetura:
--   1. Tabela zapi_scheduled_messages: fila de mensagens a enviar.
--   2. Cron job "zapi-scheduled-sender": dispara a EF a cada minuto via pg_net.
--
-- RLS:
--   - SELECT: apenas pelo criador (created_by = auth.uid()).
--   - INSERT: qualquer autenticado (created_by = auth.uid() garantido por WITH CHECK).
--   - UPDATE: bloqueado no client (apenas service_role via cron).
--   - DELETE: apenas se status = 'pendente' AND created_by = auth.uid().
--
-- Segurança:
--   - nova tabela com user_id + nova EF com service_role.
--   - pg_net chama a EF com Bearer service_role_key.
--   - A URL e a key são lidas de app.settings (parâmetros configurados no DB).
--
-- Referência: RAQ-MAND-EM073 — T42
-- ============================================================================

-- ─── 1. Extensão pg_net (chamada HTTP do cron) ────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── 2. Tabela zapi_scheduled_messages ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zapi_scheduled_messages (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID        NOT NULL REFERENCES public.zapi_accounts(id) ON DELETE CASCADE,
  chat_id            UUID        REFERENCES public.zapi_chats(id) ON DELETE SET NULL,
  phone              TEXT        NOT NULL CHECK (char_length(phone) BETWEEN 1 AND 32),
  body               TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4096),
  quoted_message_id  TEXT        CHECK (char_length(quoted_message_id) <= 255),
  scheduled_at       TIMESTAMPTZ NOT NULL,
  status             TEXT        NOT NULL DEFAULT 'pendente'
                                 CHECK (status IN ('pendente', 'processando', 'enviado', 'falha', 'cancelado')),
  sent_at            TIMESTAMPTZ,
  error_msg          TEXT        CHECK (char_length(error_msg) <= 1024),
  created_by         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.zapi_scheduled_messages IS
  'Fila de mensagens agendadas para envio via Z-API. '
  'O cron job "zapi-scheduled-sender" processa registros com status=''pendente'' '
  'e scheduled_at <= now() a cada minuto. Escrita de UPDATE apenas via service_role. '
  'Referência: RAQ-MAND-EM073 T42 / T43.';

COMMENT ON COLUMN public.zapi_scheduled_messages.status IS
  'Estado da mensagem: pendente (aguardando), processando (lock otimista), '
  'enviado (Z-API confirmou), falha (Z-API retornou erro), cancelado (usuário cancelou).';

-- ─── 3. Índices ───────────────────────────────────────────────────────────────

-- Índice principal usado pelo cron job (seleciona pendentes vencidos)
CREATE INDEX IF NOT EXISTS idx_zapi_scheduled_messages_pendente
  ON public.zapi_scheduled_messages (scheduled_at)
  WHERE status = 'pendente';

-- Índice para listagem por conta/status na UI
CREATE INDEX IF NOT EXISTS idx_zapi_scheduled_messages_account
  ON public.zapi_scheduled_messages (account_id, status);

-- Índice para listagem por chat (UI: "1 mensagem agendada" no chat)
CREATE INDEX IF NOT EXISTS idx_zapi_scheduled_messages_chat
  ON public.zapi_scheduled_messages (chat_id, status)
  WHERE status = 'pendente';

-- ─── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.zapi_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Drop defensivo para idempotência
DROP POLICY IF EXISTS "zapi_scheduled_messages_select" ON public.zapi_scheduled_messages;
DROP POLICY IF EXISTS "zapi_scheduled_messages_insert" ON public.zapi_scheduled_messages;
DROP POLICY IF EXISTS "zapi_scheduled_messages_update" ON public.zapi_scheduled_messages;
DROP POLICY IF EXISTS "zapi_scheduled_messages_delete" ON public.zapi_scheduled_messages;

-- SELECT: apenas os próprios registros
CREATE POLICY "zapi_scheduled_messages_select"
  ON public.zapi_scheduled_messages
  FOR SELECT
  USING (created_by = auth.uid());

-- INSERT: qualquer autenticado, desde que created_by = uid
CREATE POLICY "zapi_scheduled_messages_insert"
  ON public.zapi_scheduled_messages
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- UPDATE: bloqueado no client (service_role bypassa RLS)
CREATE POLICY "zapi_scheduled_messages_update"
  ON public.zapi_scheduled_messages
  FOR UPDATE
  USING (false);

-- DELETE: apenas pendentes do próprio criador (cancelamento)
CREATE POLICY "zapi_scheduled_messages_delete"
  ON public.zapi_scheduled_messages
  FOR DELETE
  USING (created_by = auth.uid() AND status = 'pendente');

-- ─── 5. Cron job zapi-scheduled-sender ───────────────────────────────────────
-- Chama a EF zapi-send-scheduled a cada minuto via pg_net.http_post.
-- A URL e a service_role_key são lidas de current_setting para evitar
-- hard-code de segredos na migration.
--
-- PREREQUISITO: Configurar os parâmetros no banco (via Supabase Dashboard → SQL):
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<ref>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';
--
-- Alternativa: se os parâmetros não estiverem configurados, o job falha
-- silenciosamente (pg_net retorna erro sem afetar o banco).

-- Habilita pg_cron (já habilitado desde migration 044, mas IF NOT EXISTS é seguro)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove job anterior (idempotência)
SELECT cron.unschedule('zapi-scheduled-sender')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-scheduled-sender');

-- Cria job: a cada minuto, chama a EF via pg_net
SELECT cron.schedule(
  'zapi-scheduled-sender',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url', true) || '/functions/v1/zapi-send-scheduled',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 064: zapi_scheduled_messages criada com RLS. Cron job "zapi-scheduled-sender" registrado (executa a cada minuto via pg_net).';
END
$$;
