-- ============================================================================
-- Migration 091: Favoritos de chat + Anexos do agente
-- ============================================================================
-- Tabelas:
--
--   ai_chat_favorites: mensagens favoritadas pelo usuário (até 500 por usuário).
--     Favoritos NÃO expiram (permanecem além dos 30 dias do histórico de sessão).
--     Trigger BEFORE INSERT garante limite de 500.
--
--   ai_agent_attachments: arquivos de contexto estático do agente (admin faz
--     upload, texto é extraído e injetado no system_prompt em runtime).
--     Limite: 10 arquivos × 5 MB. Texto extraído salvo na tabela (sem Storage).
--
-- RLS:
--   ai_chat_favorites: user_id = auth.uid() para tudo.
--   ai_agent_attachments: admin CRUD completo; usuários comuns sem acesso
--     (texto é injetado server-side pela Edge Function).
-- ============================================================================

-- ─── Tabela de favoritos ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_chat_favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id  UUID NOT NULL REFERENCES public.ai_chat_messages(id) ON DELETE CASCADE,

  -- Nota opcional (max 200 chars, regra de negócio US-06)
  note        VARCHAR(200),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_chat_favorites IS
  'Mensagens favoritadas pelo usuário (estrela ★). Limite 500 por usuário (trigger before insert). NÃO expiram — permanecem mesmo após a sessão de origem ser deletada (ON DELETE CASCADE na message_id remove o favorito se a mensagem for deletada).';

COMMENT ON COLUMN public.ai_chat_favorites.note IS
  'Nota pessoal opcional do usuário sobre o favorito. Máx 200 chars (US-06).';

-- UNIQUE: usuário não favorita a mesma mensagem duas vezes
CREATE UNIQUE INDEX IF NOT EXISTS ai_chat_favorites_user_message_unique
  ON public.ai_chat_favorites (user_id, message_id);

-- Index para listagem ordenada por data
CREATE INDEX IF NOT EXISTS ai_chat_favorites_user_created_idx
  ON public.ai_chat_favorites (user_id, created_at DESC);

-- ─── Trigger updated_at de favoritos ─────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_ai_chat_favorites_updated_at ON public.ai_chat_favorites;
CREATE TRIGGER trg_ai_chat_favorites_updated_at
  BEFORE UPDATE ON public.ai_chat_favorites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Trigger: limite de 500 favoritos por usuário ────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_chat_favorites_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.ai_chat_favorites
  WHERE user_id = NEW.user_id;

  IF v_count >= 500 THEN
    RAISE EXCEPTION 'favorites_limit_reached'
      USING HINT = 'Limite de 500 favoritos atingido. Remova alguns para adicionar novos.',
            ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_chat_favorites_limit ON public.ai_chat_favorites;
CREATE TRIGGER trg_ai_chat_favorites_limit
  BEFORE INSERT ON public.ai_chat_favorites
  FOR EACH ROW EXECUTE FUNCTION public.ai_chat_favorites_limit_trigger();

-- ─── RLS de favoritos ────────────────────────────────────────────────────────

ALTER TABLE public.ai_chat_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_chat_favorites: usuario ve proprios" ON public.ai_chat_favorites;
CREATE POLICY "ai_chat_favorites: usuario ve proprios"
  ON public.ai_chat_favorites FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_chat_favorites: usuario pode criar" ON public.ai_chat_favorites;
CREATE POLICY "ai_chat_favorites: usuario pode criar"
  ON public.ai_chat_favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_chat_favorites: usuario pode editar proprios" ON public.ai_chat_favorites;
CREATE POLICY "ai_chat_favorites: usuario pode editar proprios"
  ON public.ai_chat_favorites FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_chat_favorites: usuario pode deletar proprios" ON public.ai_chat_favorites;
CREATE POLICY "ai_chat_favorites: usuario pode deletar proprios"
  ON public.ai_chat_favorites FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── Tabela de anexos do agente ───────────────────────────────────────────────
-- Contexto estático configurado pelo admin (PDF/DOCX/TXT).
-- Texto extraído pela Edge Function ai-agent-extract-text (Onda 2).
-- O binário original NÃO é armazenado — apenas o texto extraído.

CREATE TABLE IF NOT EXISTS public.ai_agent_attachments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id         UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,

  filename         TEXT NOT NULL,
  file_type        TEXT NOT NULL
                   CHECK (file_type IN ('pdf', 'docx', 'txt')),
  file_size_bytes  INT CHECK (file_size_bytes <= 5242880),  -- máx 5 MB

  -- Texto extraído pela Edge Function (injetado server-side no system_prompt)
  extracted_text   TEXT,
  tokens_estimated INT DEFAULT 0,

  -- Ciclo de vida do processamento
  status           TEXT NOT NULL
                   CHECK (status IN ('processing', 'ready', 'error'))
                   DEFAULT 'processing',
  error_message    TEXT,

  -- Auditoria
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_attachments IS
  'Arquivos de contexto estático do agente (admin). Texto extraído e injetado no system_prompt em runtime pela EF. Limite: 10 arquivos × 5 MB por agente. O binário original não é armazenado — apenas extracted_text.';

COMMENT ON COLUMN public.ai_agent_attachments.extracted_text IS
  'Texto puro extraído do arquivo pela Edge Function ai-agent-extract-text. Injetado no system_prompt pela EF ai-agent-chat em tempo de inferência.';

COMMENT ON COLUMN public.ai_agent_attachments.tokens_estimated IS
  'Estimativa de tokens do texto extraído (calculada pela EF). Útil para alert quando context window estiver próxima do limite.';

-- Index para listagem por agente
CREATE INDEX IF NOT EXISTS ai_agent_attachments_agent_idx
  ON public.ai_agent_attachments (agent_id, created_at DESC);

-- ─── Trigger: limite de 10 anexos por agente ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_agent_attachments_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.ai_agent_attachments
  WHERE agent_id = NEW.agent_id;

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'attachments_limit_reached'
      USING HINT = 'Limite de 10 documentos atingido. Remova um para adicionar outro.',
            ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_agent_attachments_limit ON public.ai_agent_attachments;
CREATE TRIGGER trg_ai_agent_attachments_limit
  BEFORE INSERT ON public.ai_agent_attachments
  FOR EACH ROW EXECUTE FUNCTION public.ai_agent_attachments_limit_trigger();

-- ─── RLS de anexos ───────────────────────────────────────────────────────────
-- Admin: CRUD completo.
-- Usuários comuns: SEM acesso direto (texto injetado server-side pela EF).

ALTER TABLE public.ai_agent_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_agent_attachments: admin pode ver" ON public.ai_agent_attachments;
CREATE POLICY "ai_agent_attachments: admin pode ver"
  ON public.ai_agent_attachments FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "ai_agent_attachments: admin pode inserir" ON public.ai_agent_attachments;
CREATE POLICY "ai_agent_attachments: admin pode inserir"
  ON public.ai_agent_attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ai_agent_attachments: admin pode editar" ON public.ai_agent_attachments;
CREATE POLICY "ai_agent_attachments: admin pode editar"
  ON public.ai_agent_attachments FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ai_agent_attachments: admin pode deletar" ON public.ai_agent_attachments;
CREATE POLICY "ai_agent_attachments: admin pode deletar"
  ON public.ai_agent_attachments FOR DELETE TO authenticated
  USING (public.is_admin());
