-- ============================================================================
-- Migration 057: 4 tabelas auxiliares para o módulo WhatsApp CRM
-- ============================================================================
-- Objetivo (FASE 0 — Fundação):
--   Cria as tabelas de suporte para as fases seguintes:
--   - zapi_chat_tags      : junção chat ↔ tag (etiquetas de conversa)
--   - zapi_quick_replies  : respostas rápidas por conta (snippets com variáveis)
--   - zapi_chat_notes     : notas internas por conversa (com menções @)
--   - zapi_chat_message_flags : mensagens favoritadas por conversa
--
-- RLS: leitura para autenticados. Escrita direta pelo client autenticado:
--   - zapi_chat_tags      : escrita bloqueada no client (somente via service_role/EF)
--   - zapi_quick_replies  : INSERT por qualquer autenticado, UPDATE/DELETE apenas
--                           pelo criador (created_by) ou admin
--   - zapi_chat_notes     : INSERT/UPDATE/DELETE pelo próprio autor; DELETE também
--                           permitido para admin
--   - zapi_chat_message_flags : cada usuário gerencia os próprios favoritos
-- Idempotência: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS.
--
-- Referência: RAQ-MAND — FASE 0 T02
-- ============================================================================

-- ─── 1. zapi_chat_tags ───────────────────────────────────────────────────────
-- Junção many-to-many entre conversas e tags do CRM (tabela `tags`).
-- Permite etiquetar uma conversa com tags já cadastradas no sistema.
CREATE TABLE IF NOT EXISTS public.zapi_chat_tags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID        NOT NULL REFERENCES public.zapi_chats(id)  ON DELETE CASCADE,
  tag_id     UUID        NOT NULL REFERENCES public.tags(id)         ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Cada tag só pode aparecer uma vez por conversa
  CONSTRAINT uq_zapi_chat_tag UNIQUE (chat_id, tag_id)
);

COMMENT ON TABLE public.zapi_chat_tags IS
  'Etiquetas vinculadas a conversas WhatsApp. '
  'FK para tags (tabela existente do CRM) — permite reaproveitar tags já cadastradas. '
  'UNIQUE(chat_id, tag_id) evita duplicidade. Escrita via service_role.';

CREATE INDEX IF NOT EXISTS idx_zapi_chat_tags_chat_id
  ON public.zapi_chat_tags (chat_id);

CREATE INDEX IF NOT EXISTS idx_zapi_chat_tags_tag_id
  ON public.zapi_chat_tags (tag_id);

-- ─── 2. zapi_quick_replies ───────────────────────────────────────────────────
-- Respostas rápidas por conta Z-API. Snippets de texto com suporte a variáveis
-- (ex: {{nome}}, {{bairro}}) e organização por categoria.
CREATE TABLE IF NOT EXISTS public.zapi_quick_replies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES public.zapi_accounts(id) ON DELETE CASCADE,
  titulo      TEXT        NOT NULL,
  corpo       TEXT        NOT NULL,
  categoria   TEXT,
  -- JSONB com array de nomes de variáveis: ["nome", "bairro"]
  -- NULL quando o corpo não tem variáveis
  variaveis   JSONB,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.zapi_quick_replies IS
  'Respostas rápidas (snippets) por conta Z-API. '
  'Corpo suporta variáveis no formato {{nome}} — variaveis[] lista os nomes esperados. '
  'Categoria permite agrupamento na UI (ex: "Triagem", "Encerramento"). '
  'Usado com atalho "/" na caixa de texto da conversa.';

COMMENT ON COLUMN public.zapi_quick_replies.variaveis IS
  'Array JSONB com nomes das variáveis presentes no corpo. Ex: ["nome", "bairro"]. '
  'NULL quando não há variáveis. Usado para renderizar os campos de preenchimento na UI.';

CREATE TRIGGER trg_zapi_quick_replies_updated_at
  BEFORE UPDATE ON public.zapi_quick_replies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_zapi_quick_replies_account_id
  ON public.zapi_quick_replies (account_id);

CREATE INDEX IF NOT EXISTS idx_zapi_quick_replies_categoria
  ON public.zapi_quick_replies (account_id, categoria)
  WHERE categoria IS NOT NULL;

-- ─── 3. zapi_chat_notes ──────────────────────────────────────────────────────
-- Notas internas por conversa — NÃO enviadas ao eleitor.
-- Suporta menções @usuário (mencoes JSONB com array de UUIDs).
CREATE TABLE IF NOT EXISTS public.zapi_chat_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID        NOT NULL REFERENCES public.zapi_chats(id) ON DELETE CASCADE,
  autor_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  corpo      TEXT        NOT NULL,
  -- Array JSONB de UUIDs dos usuários mencionados: ["uuid1", "uuid2"]
  -- NULL quando não há menções
  mencoes    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.zapi_chat_notes IS
  'Notas internas de equipe por conversa — NUNCA enviadas ao eleitor. '
  'Suporta menções @usuário (mencoes: array JSON de UUIDs). '
  'Visível apenas para a equipe interna na área de notas do painel lateral.';

COMMENT ON COLUMN public.zapi_chat_notes.mencoes IS
  'Array JSONB de UUIDs dos usuários mencionados com @. Ex: ["uuid1", "uuid2"]. '
  'NULL quando não há menções. Usado para notificações internas futuras.';

CREATE TRIGGER trg_zapi_chat_notes_updated_at
  BEFORE UPDATE ON public.zapi_chat_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_zapi_chat_notes_chat_id
  ON public.zapi_chat_notes (chat_id);

CREATE INDEX IF NOT EXISTS idx_zapi_chat_notes_autor_id
  ON public.zapi_chat_notes (autor_id);

-- ─── 4. zapi_chat_message_flags ──────────────────────────────────────────────
-- Mensagens favoritadas/sinalizadas por usuário em uma conversa.
-- Cada usuário pode favoritar qualquer mensagem; sem compartilhamento entre usuários.
CREATE TABLE IF NOT EXISTS public.zapi_chat_message_flags (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    UUID        NOT NULL REFERENCES public.zapi_chats(id)    ON DELETE CASCADE,
  message_id TEXT        NOT NULL,  -- message_id da zapi_messages (não UUID — é o id Z-API)
  flagged_by UUID        NOT NULL REFERENCES auth.users(id)           ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Cada usuário só pode favoritar uma vez a mesma mensagem
  CONSTRAINT uq_zapi_message_flag UNIQUE (chat_id, message_id, flagged_by)
);

COMMENT ON TABLE public.zapi_chat_message_flags IS
  'Mensagens favoritadas/sinalizadas por usuário em conversas WhatsApp. '
  'message_id é o ID Z-API (text), não o UUID interno do CRM. '
  'UNIQUE(chat_id, message_id, flagged_by) — cada usuário favorita uma vez por mensagem. '
  'Escrita permitida pelo próprio usuário autenticado (diferente das outras zapi_* tables).';

COMMENT ON COLUMN public.zapi_chat_message_flags.message_id IS
  'ID da mensagem Z-API (mesmo valor de zapi_messages.message_id). '
  'TEXT, não FK, pois a mensagem pode não estar no histórico local (purge cron 044).';

CREATE INDEX IF NOT EXISTS idx_zapi_message_flags_chat_id
  ON public.zapi_chat_message_flags (chat_id);

CREATE INDEX IF NOT EXISTS idx_zapi_message_flags_flagged_by
  ON public.zapi_chat_message_flags (flagged_by);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.zapi_chat_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_quick_replies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_chat_notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_chat_message_flags  ENABLE ROW LEVEL SECURITY;

-- Drop defensivo antes de recriar (idempotência)
DROP POLICY IF EXISTS "zapi_chat_tags_select"  ON public.zapi_chat_tags;
DROP POLICY IF EXISTS "zapi_chat_tags_write"   ON public.zapi_chat_tags;

DROP POLICY IF EXISTS "zapi_quick_replies_select"  ON public.zapi_quick_replies;
DROP POLICY IF EXISTS "zapi_quick_replies_insert"  ON public.zapi_quick_replies;
DROP POLICY IF EXISTS "zapi_quick_replies_update"  ON public.zapi_quick_replies;
DROP POLICY IF EXISTS "zapi_quick_replies_delete"  ON public.zapi_quick_replies;

DROP POLICY IF EXISTS "zapi_chat_notes_select"  ON public.zapi_chat_notes;
DROP POLICY IF EXISTS "zapi_chat_notes_insert"  ON public.zapi_chat_notes;
DROP POLICY IF EXISTS "zapi_chat_notes_update"  ON public.zapi_chat_notes;
DROP POLICY IF EXISTS "zapi_chat_notes_delete"  ON public.zapi_chat_notes;

DROP POLICY IF EXISTS "zapi_message_flags_select"  ON public.zapi_chat_message_flags;
DROP POLICY IF EXISTS "zapi_message_flags_insert"  ON public.zapi_chat_message_flags;
DROP POLICY IF EXISTS "zapi_message_flags_delete"  ON public.zapi_chat_message_flags;

-- ── zapi_chat_tags ────────────────────────────────────────────────────────────
-- Leitura: qualquer autenticado (padrão das tabelas zapi_*)
-- Escrita: somente service_role (as tags de conversa são gerenciadas via EF)
CREATE POLICY "zapi_chat_tags_select"
  ON public.zapi_chat_tags
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "zapi_chat_tags_write"
  ON public.zapi_chat_tags
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ── zapi_quick_replies ────────────────────────────────────────────────────────
-- Leitura: qualquer autenticado.
-- INSERT: qualquer autenticado (created_by = uid garantido pelo WITH CHECK).
-- UPDATE/DELETE: somente o criador ou admin — restringe modificação de outros registros.
CREATE POLICY "zapi_quick_replies_select"
  ON public.zapi_quick_replies
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Criador deve ser o próprio usuário autenticado
CREATE POLICY "zapi_quick_replies_insert"
  ON public.zapi_quick_replies
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Apenas o criador ou admin pode editar
CREATE POLICY "zapi_quick_replies_update"
  ON public.zapi_quick_replies
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- Apenas o criador ou admin pode excluir
CREATE POLICY "zapi_quick_replies_delete"
  ON public.zapi_quick_replies
  FOR DELETE
  USING (has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- ── zapi_chat_notes ───────────────────────────────────────────────────────────
-- Notas internas: leitura para autenticados, escrita pelo próprio autor
CREATE POLICY "zapi_chat_notes_select"
  ON public.zapi_chat_notes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Qualquer autenticado pode criar nota (autor_id = próprio uid garantido pelo check)
CREATE POLICY "zapi_chat_notes_insert"
  ON public.zapi_chat_notes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND autor_id = auth.uid());

-- Apenas o próprio autor pode editar
CREATE POLICY "zapi_chat_notes_update"
  ON public.zapi_chat_notes
  FOR UPDATE
  USING (autor_id = auth.uid());

-- Apenas o próprio autor ou admin pode excluir
CREATE POLICY "zapi_chat_notes_delete"
  ON public.zapi_chat_notes
  FOR DELETE
  USING (autor_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- ── zapi_chat_message_flags ───────────────────────────────────────────────────
-- Favoritos: cada usuário gerencia os próprios favoritos
CREATE POLICY "zapi_message_flags_select"
  ON public.zapi_chat_message_flags
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Usuário só pode criar flag para si mesmo
CREATE POLICY "zapi_message_flags_insert"
  ON public.zapi_chat_message_flags
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND flagged_by = auth.uid());

-- Usuário só pode excluir os próprios favoritos
CREATE POLICY "zapi_message_flags_delete"
  ON public.zapi_chat_message_flags
  FOR DELETE
  USING (flagged_by = auth.uid());

-- ─── Log ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 057: zapi_chat_tags, zapi_quick_replies, zapi_chat_notes, zapi_chat_message_flags criadas com RLS.';
END
$$;
