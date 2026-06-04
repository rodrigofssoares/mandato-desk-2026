-- Migration: 109_zapi_panel_grants
--
-- Feature: EM078 — Senha de acesso às conversas do WhatsApp (enforcement real no banco)
--
-- O que muda:
--   1. Cria tabela `zapi_panel_grants` — grant server-side por (user_id, account_id) com TTL.
--      Único mecanismo que prova que um usuário validou a senha de uma conta.
--   2. Revoga e recria as políticas SELECT de `zapi_chats` e `zapi_messages`:
--      era qualquer autenticado → passa a exigir is_admin OU grant ativo pra aquele account_id.
--   3. Limpa grants expirados on-validate via DELETE na EF (sem pg_cron extra — TTL curto de 8h).
--
-- Segurança:
--   - zapi_panel_grants: INSERT/UPDATE/DELETE bloqueados pra usuário (só service_role via EF).
--   - SELECT limitado ao próprio user_id (usuário só vê seus grants).
--   - Granularidade por (user_id, account_id): validar conta X não libera conta Y.
--   - Admin (has_role = 'admin') sempre passa — não precisa de grant.
--
-- Depende de: migrations 043_zapi_whatsapp, 046_zapi_pentest_hardening
-- Reference: RAQ-MAND-EM078 — T1 (banco)

-- ─── 1. Tabela zapi_panel_grants ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zapi_panel_grants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id  UUID        NOT NULL REFERENCES public.zapi_accounts(id) ON DELETE CASCADE,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  -- 1 grant por (user, conta) — upsert renova TTL
  CONSTRAINT uq_panel_grant_user_account UNIQUE (user_id, account_id)
);

-- Índice composto: suporta a condição do RLS (user_id + account_id + expires_at > now())
CREATE INDEX IF NOT EXISTS idx_panel_grants_user_account_expires
  ON public.zapi_panel_grants (user_id, account_id, expires_at);

COMMENT ON TABLE public.zapi_panel_grants IS
  'Grant server-side de acesso às conversas de uma conta Z-API após validação de senha. '
  'Criado/renovado pela EF zapi-validate-panel-password (service_role). '
  'TTL padrão: 8 horas. Expirado → SELECT em zapi_chats/zapi_messages retorna 0 linhas. '
  'Admin (has_role=admin) ignora este grant — tem acesso direto via RLS. '
  'Limpeza: a EF remove grants expirados do próprio usuário on-validate. '
  'Referência: RAQ-MAND-EM078.';

COMMENT ON COLUMN public.zapi_panel_grants.expires_at IS
  'Timestamp UTC em que o grant expira. Após este momento, RLS bloqueia SELECT '
  'em zapi_chats e zapi_messages para este (user_id, account_id). '
  'A EF zapi-validate-panel-password upserta com expires_at = now() + 8h.';

-- ─── 2. RLS em zapi_panel_grants ──────────────────────────────────────────────

ALTER TABLE public.zapi_panel_grants ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seus próprios grants (para que o frontend possa verificar estado)
CREATE POLICY "zapi_panel_grants_select_own"
  ON public.zapi_panel_grants
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT/UPDATE/DELETE bloqueados para usuários — somente service_role via EF
CREATE POLICY "zapi_panel_grants_write_blocked"
  ON public.zapi_panel_grants
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ─── 3. Alterar RLS SELECT de zapi_chats ─────────────────────────────────────
--
-- ANTES: USING (auth.uid() IS NOT NULL)  ← qualquer autenticado, bypassável via API
-- DEPOIS: exige is_admin OU grant ativo para o account_id do chat
--
-- Nota: DROP + CREATE pra evitar "policy already exists" em re-apply idempotente.

DROP POLICY IF EXISTS "zapi_chats_select" ON public.zapi_chats;

CREATE POLICY "zapi_chats_select"
  ON public.zapi_chats
  FOR SELECT
  USING (
    -- Admin sempre passa (role = 'admin' via função has_role)
    has_role(auth.uid(), 'admin')
    OR
    -- Usuário com grant ativo para esta conta específica
    EXISTS (
      SELECT 1
      FROM public.zapi_panel_grants g
      WHERE g.user_id     = auth.uid()
        AND g.account_id  = zapi_chats.account_id
        AND g.expires_at  > now()
    )
  );

-- ─── 4. Alterar RLS SELECT de zapi_messages ──────────────────────────────────
--
-- zapi_messages TEM coluna account_id direto — sem necessidade de join.
-- Mesma regra: admin OU grant ativo.

DROP POLICY IF EXISTS "zapi_messages_select" ON public.zapi_messages;

CREATE POLICY "zapi_messages_select"
  ON public.zapi_messages
  FOR SELECT
  USING (
    -- Admin sempre passa
    has_role(auth.uid(), 'admin')
    OR
    -- Usuário com grant ativo para esta conta específica
    EXISTS (
      SELECT 1
      FROM public.zapi_panel_grants g
      WHERE g.user_id     = auth.uid()
        AND g.account_id  = zapi_messages.account_id
        AND g.expires_at  > now()
    )
  );

-- ─── 5. GRANT SELECT em zapi_panel_grants para authenticated ─────────────────
-- Necessário para que o cliente PostgREST possa ler os próprios grants
-- (a RLS ainda limita a user_id = auth.uid()).

GRANT SELECT ON public.zapi_panel_grants TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.zapi_panel_grants TO service_role;

-- ─── 6. Verificação final ─────────────────────────────────────────────────────
-- Confirma que as novas policies existem com os nomes esperados.

DO $$
BEGIN
  -- zapi_panel_grants
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'zapi_panel_grants'
      AND policyname = 'zapi_panel_grants_select_own'
  ) THEN
    RAISE EXCEPTION 'FALHA: policy zapi_panel_grants_select_own nao criada';
  END IF;

  -- zapi_chats
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'zapi_chats'
      AND policyname = 'zapi_chats_select'
  ) THEN
    RAISE EXCEPTION 'FALHA: policy zapi_chats_select nao recriada';
  END IF;

  -- zapi_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'zapi_messages'
      AND policyname = 'zapi_messages_select'
  ) THEN
    RAISE EXCEPTION 'FALHA: policy zapi_messages_select nao recriada';
  END IF;

  RAISE NOTICE 'Migration 109_zapi_panel_grants aplicada com sucesso.';
END;
$$;
