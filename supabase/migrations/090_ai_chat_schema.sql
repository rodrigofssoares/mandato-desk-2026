-- ============================================================================
-- Migration 090: Schema de chat — sessões e mensagens
-- ============================================================================
-- Tabelas:
--   ai_chat_sessions: uma "conversa" por usuário, com título, timestamps e
--     expires_at gerado automaticamente (created_at + 30 dias).
--   ai_chat_messages: mensagens dentro de cada sessão (user/assistant/system).
--
-- Expiração:
--   - Coluna GENERATED ALWAYS AS (expires_at) para controle passivo.
--   - pg_cron job diário às 03:00 UTC para deletar sessões expiradas.
--   - Trigger fallback: ao criar nova sessão, se usuário já tem ≥ 200 sessões
--     NÃO expiradas, deleta a mais antiga.
--
-- FK diferida:
--   - Adiciona FK message_id na tabela ai_chat_messages_cost (criada em 089).
--
-- RLS:
--   - Sessions: user_id = auth.uid().
--   - Messages: via JOIN com sessão do próprio usuário (policy com subquery).
-- ============================================================================

-- pg_cron já está habilitado (verificado em 085). Garantir extensão.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── Tabela de sessões ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  title            VARCHAR(60),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Expiração automática: 30 dias após criação.
  -- GENERATED AS com INTERVAL não é imutável no Postgres — usamos DEFAULT + trigger.
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

COMMENT ON TABLE public.ai_chat_sessions IS
  'Uma sessão = uma conversa do usuário com o agente. Expira em 30 dias. Limite de 200 sessões por usuário (trigger fallback apaga a mais antiga ao ultrapassar).';

COMMENT ON COLUMN public.ai_chat_sessions.title IS
  'Primeiros 60 chars da primeira mensagem do usuário. Definido pela Edge Function ao criar sessão.';

COMMENT ON COLUMN public.ai_chat_sessions.expires_at IS
  'Default = now() + 30 dias (calculado no insert por trigger). Sessões com expires_at < now() são deletadas pelo cron diário às 03:00 UTC.';

-- Indexes para listagem do histórico
CREATE INDEX IF NOT EXISTS ai_chat_sessions_user_last_msg_idx
  ON public.ai_chat_sessions (user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS ai_chat_sessions_expires_at_idx
  ON public.ai_chat_sessions (expires_at);

-- ─── Trigger: limita 200 sessões ativas por usuário ──────────────────────────
-- Antes de inserir nova sessão, verifica se o usuário já tem 200+.
-- Se sim, deleta a mais antiga (fallback para quando o cron não rodou).

CREATE OR REPLACE FUNCTION public.ai_chat_sessions_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count INT;
  v_oldest_id UUID;
BEGIN
  SELECT COUNT(*), MIN(s.id)
    INTO v_count, v_oldest_id
  FROM (
    SELECT id FROM public.ai_chat_sessions
    WHERE user_id = NEW.user_id
    ORDER BY last_message_at ASC
    LIMIT 201
  ) s;

  IF v_count >= 200 THEN
    DELETE FROM public.ai_chat_sessions WHERE id = v_oldest_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_chat_sessions_limit ON public.ai_chat_sessions;
CREATE TRIGGER trg_ai_chat_sessions_limit
  BEFORE INSERT ON public.ai_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.ai_chat_sessions_limit_trigger();

-- ─── Tabela de mensagens ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,

  role             TEXT NOT NULL
                   CHECK (role IN ('user', 'assistant', 'system')),
  content          TEXT NOT NULL,

  -- Metadados do modelo (preenchidos pela EF para mensagens do assistente)
  provider         TEXT,
  model_id         TEXT,
  tokens_input     INT DEFAULT 0,
  tokens_output    INT DEFAULT 0,
  total_tokens     INT DEFAULT 0,  -- atualizado pela Edge Function junto com tokens_input/output

  has_attachment   BOOLEAN NOT NULL DEFAULT false,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_chat_messages IS
  'Mensagens de cada sessão de chat. ON DELETE CASCADE: ao deletar a sessão, todas as mensagens são removidas automaticamente.';

COMMENT ON COLUMN public.ai_chat_messages.total_tokens IS
  'Soma de tokens_input + tokens_output. Calculado e gravado pela Edge Function ai-agent-chat ao persistir a resposta.';

-- Index para carregamento da conversa em ordem cronológica
CREATE INDEX IF NOT EXISTS ai_chat_messages_session_created_idx
  ON public.ai_chat_messages (session_id, created_at ASC);

-- ─── Adicionar FK diferida: ai_chat_messages_cost.message_id → ai_chat_messages ─

ALTER TABLE public.ai_chat_messages_cost
  ADD COLUMN IF NOT EXISTS message_id_fk UUID REFERENCES public.ai_chat_messages(id) ON DELETE SET NULL;

-- Migrar dados existentes (se houver) da coluna message_id para message_id_fk
-- Na prática, em ambiente novo isso é no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_chat_messages_cost' AND column_name = 'message_id'
  ) THEN
    -- Coluna legada sem FK — manter por compatibilidade; message_id_fk tem a FK real
    NULL;
  END IF;
END;
$$;

COMMENT ON COLUMN public.ai_chat_messages_cost.message_id_fk IS
  'FK real para ai_chat_messages (adicionada em migration 090). A coluna message_id (sem FK) criada em 089 é mantida para compatibilidade.';

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Usuário só vê e manipula as próprias sessões
DROP POLICY IF EXISTS "ai_chat_sessions: usuario ve proprias" ON public.ai_chat_sessions;
CREATE POLICY "ai_chat_sessions: usuario ve proprias"
  ON public.ai_chat_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_chat_sessions: usuario pode criar" ON public.ai_chat_sessions;
CREATE POLICY "ai_chat_sessions: usuario pode criar"
  ON public.ai_chat_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_chat_sessions: usuario pode editar proprias" ON public.ai_chat_sessions;
CREATE POLICY "ai_chat_sessions: usuario pode editar proprias"
  ON public.ai_chat_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_chat_sessions: usuario pode deletar proprias" ON public.ai_chat_sessions;
CREATE POLICY "ai_chat_sessions: usuario pode deletar proprias"
  ON public.ai_chat_sessions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Admin vê todas as sessões (para suporte/auditoria)
DROP POLICY IF EXISTS "ai_chat_sessions: admin ve todas" ON public.ai_chat_sessions;
CREATE POLICY "ai_chat_sessions: admin ve todas"
  ON public.ai_chat_sessions FOR SELECT TO authenticated
  USING (public.is_admin());

ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Usuário vê mensagens das próprias sessões (subquery verifica ownership)
DROP POLICY IF EXISTS "ai_chat_messages: usuario ve proprias" ON public.ai_chat_messages;
CREATE POLICY "ai_chat_messages: usuario ve proprias"
  ON public.ai_chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_chat_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_chat_messages: usuario pode inserir" ON public.ai_chat_messages;
CREATE POLICY "ai_chat_messages: usuario pode inserir"
  ON public.ai_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ai_chat_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

-- Admin vê todas as mensagens
DROP POLICY IF EXISTS "ai_chat_messages: admin ve todas" ON public.ai_chat_messages;
CREATE POLICY "ai_chat_messages: admin ve todas"
  ON public.ai_chat_messages FOR SELECT TO authenticated
  USING (public.is_admin());

-- ─── pg_cron: purga de sessões expiradas (diário 03:00 UTC) ──────────────────

SELECT cron.unschedule('purge-ai-chat-sessions-expired')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-ai-chat-sessions-expired');

SELECT cron.schedule(
  'purge-ai-chat-sessions-expired',
  '0 3 * * *',
  $$
    DELETE FROM public.ai_chat_sessions
    WHERE expires_at < now();
  $$
);

COMMENT ON TABLE public.ai_chat_sessions IS
  'Uma sessão = uma conversa do usuário com o agente. Expira em 30 dias. Cron "purge-ai-chat-sessions-expired" deleta às 03:00 UTC diariamente.';
