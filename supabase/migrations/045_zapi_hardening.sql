-- ============================================================================
-- Migration 045: Hardening Z-API a partir de auditoria de seguranca
-- ============================================================================
-- Aplica fixes do Security agent sobre as migrations 043 + 044:
--   F1 (Alto)   - UPDATE policies sem WITH CHECK em zapi_accounts e
--                 zapi_panel_passwords; admin podia transferir created_by
--                 para outro uuid sem restricao.
--   F2 (Medio)  - CHECK constraints de tamanho em campos TEXT/JSONB para
--                 evitar payload flooding caso a Edge Function falhe em
--                 truncar antes do INSERT.
--   F3 (Medio)  - has_role() sem `SET search_path` ficava vulneravel a
--                 search_path hijacking (CWE-1321). Recria com
--                 search_path fixo e referencias qualificadas.
--   F5 (Baixo)  - Indice idx_zapi_messages_sent_at era global; substituido
--                 por composite (chat_id, sent_at DESC) que cobre query de
--                 historico por conversa sem sort em memoria.
--   F6 (Baixo)  - Indice parcial em zapi_webhook_log para encontrar
--                 rapidamente eventos de conta desconhecida (account_id IS
--                 NULL), que sao exatamente os mais relevantes para debug
--                 de seguranca (replay, payload errado).
--
-- Decisao em aberto (F4): IDOR potencial — qualquer usuario autenticado
-- consegue SELECT em zapi_chats / zapi_messages independente de qual conta.
-- Por hora, aceito como design (mandato single-tenant + senha extra
-- protege a UI). Se Rodrigo decidir isolar, criar tabela de associacao
-- zapi_account_access em migration futura.
-- ============================================================================

-- ── F1: WITH CHECK em UPDATE policies ───────────────────────────────────────
-- Sem WITH CHECK, USING aceita o estado atual mas nao valida o estado pos-
-- update. Permite admin reassinar created_by/account_id silenciosamente.

DROP POLICY IF EXISTS "zapi_accounts_update" ON public.zapi_accounts;
CREATE POLICY "zapi_accounts_update"
  ON public.zapi_accounts
  FOR UPDATE
  USING      (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "zapi_panel_passwords_update" ON public.zapi_panel_passwords;
CREATE POLICY "zapi_panel_passwords_update"
  ON public.zapi_panel_passwords
  FOR UPDATE
  USING      (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- ── F2: CHECK constraints de tamanho ────────────────────────────────────────
-- Defesa em profundidade: a EF deve truncar antes do INSERT, mas o banco
-- ganha um teto rigido caso a EF tenha bug ou seja bypassada via service_role
-- direto. Limites generosos pra nao impactar uso normal.

ALTER TABLE public.zapi_chats
  ADD CONSTRAINT chk_zapi_chats_preview_len
  CHECK (last_message_preview IS NULL OR length(last_message_preview) <= 500);

ALTER TABLE public.zapi_messages
  ADD CONSTRAINT chk_zapi_messages_body_len
  CHECK (body IS NULL OR length(body) <= 4096);

ALTER TABLE public.zapi_webhook_log
  ADD CONSTRAINT chk_zapi_webhook_log_payload_size
  CHECK (octet_length(payload::text) <= 65536);   -- 64 KB

ALTER TABLE public.zapi_webhook_log
  ADD CONSTRAINT chk_zapi_webhook_log_error_len
  CHECK (error_detail IS NULL OR length(error_detail) <= 1000);

-- ── F3: has_role com search_path fixo + referencias qualificadas ────────────
-- Funcao SECURITY DEFINER sem search_path explicito permite escalation
-- via tabela/funcao homonima criada por usuario malicioso no schema public.
-- Mantem assinatura e semantica originais (verificadas em migration 001).
-- Idem para is_user_active (mesmo padrao).

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF _role::text = 'admin' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id
        AND role = 'admin'
        AND status_aprovacao = 'ATIVO'
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = _user_id
        AND status_aprovacao = 'ATIVO'
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.has_role(UUID, app_role) IS
  'Verifica se o usuario tem a role indicada. SECURITY DEFINER com search_path fixado para mitigar CWE-1321 (search_path hijacking). Hardening aplicado em 045.';

-- is_user_active: mesma vulnerabilidade. Recriar com search_path explicito.
-- IMPORTANTE: parameter name deve permanecer `user_id` (sem underscore) — assim
-- esta na migration 001. CREATE OR REPLACE nao pode renomear parametros.
CREATE OR REPLACE FUNCTION public.is_user_active(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
      AND status_aprovacao = 'ATIVO'
  );
END;
$$;

COMMENT ON FUNCTION public.is_user_active(UUID) IS
  'Verifica se o usuario esta ativo. SECURITY DEFINER com search_path fixado (hardening 045).';

-- ── F5: indice composto (chat_id, sent_at DESC) para historico ──────────────
-- Substitui idx_zapi_messages_sent_at global. Query tipica:
--   SELECT * FROM zapi_messages WHERE chat_id = $1 ORDER BY sent_at DESC;
-- Composite evita sort em memoria.

DROP INDEX IF EXISTS public.idx_zapi_messages_sent_at;
CREATE INDEX IF NOT EXISTS idx_zapi_messages_chat_sent
  ON public.zapi_messages (chat_id, sent_at DESC);

-- ── F6: indice parcial para webhooks de conta desconhecida ──────────────────
-- B-tree padrao nao indexa NULLs. Eventos com account_id IS NULL sao
-- exatamente o subconjunto mais critico para debug (replay malicioso,
-- payload errado, conta deletada). Permitir filtragem rapida.

CREATE INDEX IF NOT EXISTS idx_zapi_webhook_log_null_account
  ON public.zapi_webhook_log (received_at DESC)
  WHERE account_id IS NULL;
