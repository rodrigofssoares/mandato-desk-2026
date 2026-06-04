-- Migration: 111_em080_whatsapp_access_control
--
-- Feature: EM080 — Controle de acesso no WhatsApp
--
-- O que muda:
--   1. Helper `is_zapi_privileged(_uid)` — verifica se usuário é admin/proprietário ATIVO
--      sem usar has_role (bug conhecido: has_role retorna true pra qualquer ATIVO quando role≠admin).
--   2. Tabela `zapi_account_users` — vínculo N:N entre conta Z-API e usuário.
--      Restrito (assessor/assistente/estagiário) só enxerga contas vinculadas.
--      Privilegiado (admin/proprietário) vê todas as contas.
--   3. Tabela `zapi_panel_settings` — singleton de configuração global.
--      Toggle `require_password_for_privileged` (default false): quando true, até
--      admin/proprietário precisam de grant (senha) para ler conversas.
--   4. Helper `zapi_require_password_for_privileged()` — leitura segura do toggle.
--   5. RLS SELECT de `zapi_accounts` reescrita: privilegiado vê todas; restrito só vinculadas.
--   6. RLS SELECT de `zapi_chats` e `zapi_messages` reescritas com toggle:
--      quando toggle=false, privilegiado lê sem grant; quando toggle=true, todos precisam grant.
--   7. [P-01 FIX] RLS SELECT de `zapi_webhook_log` restrita a admin-only (era qualquer
--      autenticado — buraco lateral que vazava texto de mensagens sem senha/vínculo).
--   8. [P-03 FIX] Trigger `force_created_by` em `zapi_account_users` — espelha o padrão
--      de `zapi_accounts` (migration 046): impede mass-assignment de auditoria.
--   9. [P-04 FIX] `TO authenticated` em todas as policies novas — reduz blast-radius de
--      futuros GRANTs a anon/service_role.
--  10. [N-01 FIX] RLS SELECT de `zapi_chat_notes` reescrita: privilegiado vê todas as notas;
--      restrito vê apenas notas de chats cujas contas estão vinculadas a ele
--      (migration 057 tinha USING (auth.uid() IS NOT NULL) — vetor lateral de conteúdo derivado).
--
-- Segurança:
--   - is_zapi_privileged: SECURITY DEFINER, faz lookup direto em profiles.
--     NÃO usa has_role pra role≠admin (bug em 001_complete_schema.sql:63-82 retorna
--     true pra qualquer usuário ATIVO quando role≠admin, tornando has_role('proprietario')
--     inútil como gate de segurança).
--   - zapi_account_users: admin gerencia; usuário comum vê só os próprios vínculos.
--   - zapi_panel_settings: qualquer autenticado lê (frontend precisa saber o toggle);
--     somente admin altera.
--   - zapi_webhook_log: somente admin lê (aba Logs já é admin-only no frontend).
--
-- Depende de: 043_zapi_whatsapp, 110_zapi_panel_grants
-- Referência: RAQ-MAND-EM080

-- ─── 1. Helper de privilégio ──────────────────────────────────────────────────
--
-- Substitui o uso de has_role(uid,'proprietario') que tem bug documentado.
-- Bug: has_role em 001_complete_schema.sql:63-82 só funciona corretamente para role='admin'.
-- Para qualquer outra role, a função retorna true para QUALQUER usuário ATIVO,
-- tornando-a inutilizável como gate de segurança para 'proprietario', 'assessor', etc.
-- Por isso, fazemos lookup direto na tabela profiles aqui.

CREATE OR REPLACE FUNCTION public.is_zapi_privileged(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _uid
      AND role IN ('admin', 'proprietario')
      AND status_aprovacao = 'ATIVO'
  );
$$;

COMMENT ON FUNCTION public.is_zapi_privileged(uuid) IS
  'Retorna true se o usuário é admin ou proprietário com status ATIVO. '
  'NÃO usa has_role() pois há bug documentado: has_role(uid, role≠admin) retorna true '
  'pra qualquer usuário ATIVO (001_complete_schema.sql:63-82). '
  'Referência: RAQ-MAND-EM080.';

GRANT EXECUTE ON FUNCTION public.is_zapi_privileged(uuid) TO authenticated;

-- ─── 2. Tabela de vínculo conta↔usuário ──────────────────────────────────────
--
-- Controla quais contas Z-API cada usuário restrito pode enxergar.
-- Privilegiados (admin/proprietário) não dependem desta tabela — a RLS de
-- zapi_accounts concede acesso direto via is_zapi_privileged().
-- Admin gerencia os vínculos (INSERT/UPDATE/DELETE via has_role='admin').
-- Usuário comum pode apenas ver os próprios vínculos (SELECT user_id=auth.uid()),
-- o que permite ao frontend saber quais contas ele tem acesso sem expor as demais.

CREATE TABLE IF NOT EXISTS public.zapi_account_users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid        NOT NULL REFERENCES public.zapi_accounts(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid        REFERENCES auth.users(id),
  CONSTRAINT uq_zapi_account_user UNIQUE (account_id, user_id)
);

-- Índice composto: suporta RLS lookup (user_id + account_id) e JOIN reverso
CREATE INDEX IF NOT EXISTS idx_zapi_account_users_user
  ON public.zapi_account_users (user_id, account_id);

COMMENT ON TABLE public.zapi_account_users IS
  'Vínculo N:N entre contas Z-API e usuários restritos (assessor/assistente/estagiário). '
  'Determina quais contas um restrito pode enxergar no seletor de Conversas. '
  'Privilegiados (admin/proprietário) têm acesso direto via is_zapi_privileged() — '
  'não dependem desta tabela. Admin gerencia via CRUD na área de Equipe (Usuários). '
  'Referência: RAQ-MAND-EM080.';

COMMENT ON COLUMN public.zapi_account_users.account_id IS
  'Conta Z-API liberada para o usuário.';

COMMENT ON COLUMN public.zapi_account_users.user_id IS
  'Usuário que receberá acesso à conta. Geralmente role assessor/assistente/estagiário.';

COMMENT ON COLUMN public.zapi_account_users.created_by IS
  'Admin que criou o vínculo (auditoria).';

ALTER TABLE public.zapi_account_users ENABLE ROW LEVEL SECURITY;

-- Privilegiado vê todos os vínculos (admin gerencia; proprietário visualiza).
-- Restrito vê apenas os próprios (frontend precisa saber quais contas tem acesso).
DROP POLICY IF EXISTS "zapi_account_users_select" ON public.zapi_account_users;
CREATE POLICY "zapi_account_users_select"
  ON public.zapi_account_users
  FOR SELECT
  TO authenticated
  USING (
    public.is_zapi_privileged(auth.uid())
    OR user_id = auth.uid()
  );

-- Apenas admin cria vínculos
DROP POLICY IF EXISTS "zapi_account_users_insert" ON public.zapi_account_users;
CREATE POLICY "zapi_account_users_insert"
  ON public.zapi_account_users
  FOR INSERT
  TO authenticated
  WITH CHECK ( has_role(auth.uid(), 'admin') );

-- Apenas admin atualiza vínculos
DROP POLICY IF EXISTS "zapi_account_users_update" ON public.zapi_account_users;
CREATE POLICY "zapi_account_users_update"
  ON public.zapi_account_users
  FOR UPDATE
  TO authenticated
  USING  ( has_role(auth.uid(), 'admin') )
  WITH CHECK ( has_role(auth.uid(), 'admin') );

-- Apenas admin remove vínculos
DROP POLICY IF EXISTS "zapi_account_users_delete" ON public.zapi_account_users;
CREATE POLICY "zapi_account_users_delete"
  ON public.zapi_account_users
  FOR DELETE
  TO authenticated
  USING ( has_role(auth.uid(), 'admin') );

-- GRANT: RLS faz o gate; precisamos liberar as operações para a camada PostgREST
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapi_account_users TO authenticated;

-- ─── FIX P-03: trigger force_created_by em zapi_account_users ────────────────
--
-- Espelha o padrão de zapi_accounts (migration 046: zapi_accounts_force_created_by).
-- Impede que admin forje created_by para outro UUID — garante trilha de auditoria
-- não-repudiável de "quem liberou qual conta para qual usuário".
-- SECURITY DEFINER: função roda com privilégios de definidor para acessar auth.uid().

CREATE OR REPLACE FUNCTION public.zapi_account_users_force_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.zapi_account_users_force_created_by() IS
  'Força created_by = auth.uid() em INSERT, impedindo mass-assignment de auditoria. '
  'Espelha zapi_accounts_force_created_by (migration 046). '
  'Referência: RAQ-MAND-EM080 fix P-03.';

DROP TRIGGER IF EXISTS trg_zapi_account_users_force_created_by ON public.zapi_account_users;
CREATE TRIGGER trg_zapi_account_users_force_created_by
  BEFORE INSERT ON public.zapi_account_users
  FOR EACH ROW
  EXECUTE FUNCTION public.zapi_account_users_force_created_by();

-- ─── 3. Singleton de configuração global ─────────────────────────────────────
--
-- Controla se privilegiados (admin/proprietário) também precisam de grant (senha)
-- para ler as conversas. Default false = acesso direto para privilegiados.
-- Quando true, TODOS os usuários (incluindo admin) precisam de grant via senha.
-- Singleton garantido pela constraint CHECK (id = true) com PRIMARY KEY boolean.

CREATE TABLE IF NOT EXISTS public.zapi_panel_settings (
  id                              boolean     PRIMARY KEY DEFAULT true,
  require_password_for_privileged boolean     NOT NULL DEFAULT false,
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  updated_by                      uuid        REFERENCES auth.users(id),
  CONSTRAINT zapi_panel_settings_singleton CHECK (id = true)
);

COMMENT ON TABLE public.zapi_panel_settings IS
  'Configuração global do painel WhatsApp. Singleton (uma única linha, id=true). '
  'require_password_for_privileged: quando false (padrão), admin e proprietário '
  'acessam conversas sem digitar senha. Quando true, todos (incl. admin) precisam '
  'de grant via zapi-validate-panel-password. '
  'Referência: RAQ-MAND-EM080.';

COMMENT ON COLUMN public.zapi_panel_settings.require_password_for_privileged IS
  'Toggle global: quando true, exige senha de painel até para admin e proprietário. '
  'Default false = acesso direto para privilegiados (comportamento original EM078 corrigido). '
  'Alterado apenas por admin via RLS.';

-- Garante que a linha singleton existe (INSERT ... ON CONFLICT = idempotente)
INSERT INTO public.zapi_panel_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.zapi_panel_settings ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado lê (frontend precisa saber se exige senha do privilegiado)
-- USING (true): TO authenticated já gateia para usuários autenticados —
-- auth.uid() IS NOT NULL seria redundante (question 8 do CR).
DROP POLICY IF EXISTS "zapi_panel_settings_select" ON public.zapi_panel_settings;
CREATE POLICY "zapi_panel_settings_select"
  ON public.zapi_panel_settings
  FOR SELECT
  TO authenticated
  USING ( true );

-- Somente admin atualiza (has_role funciona corretamente para 'admin')
DROP POLICY IF EXISTS "zapi_panel_settings_update" ON public.zapi_panel_settings;
CREATE POLICY "zapi_panel_settings_update"
  ON public.zapi_panel_settings
  FOR UPDATE
  TO authenticated
  USING  ( has_role(auth.uid(), 'admin') )
  WITH CHECK ( has_role(auth.uid(), 'admin') );

-- Sem policy de INSERT/DELETE: singleton — a linha foi inserida acima, nunca muda de estrutura.
-- Usuário não pode inserir nem apagar. service_role pode se necessário.

GRANT SELECT, UPDATE ON public.zapi_panel_settings TO authenticated;

-- Helper de leitura do toggle — chamado nas RLS de zapi_chats e zapi_messages
-- SECURITY DEFINER + STABLE: execução segura e cacheável dentro da transação.
CREATE OR REPLACE FUNCTION public.zapi_require_password_for_privileged()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT require_password_for_privileged FROM public.zapi_panel_settings WHERE id = true),
    false
  );
$$;

COMMENT ON FUNCTION public.zapi_require_password_for_privileged() IS
  'Retorna o valor do toggle global require_password_for_privileged. '
  'Usado nas RLS de zapi_chats e zapi_messages. '
  'STABLE + SECURITY DEFINER: cacheável e seguro (usuário não acessa tabela diretamente). '
  'Referência: RAQ-MAND-EM080.';

GRANT EXECUTE ON FUNCTION public.zapi_require_password_for_privileged() TO authenticated;

-- ─── 4. Reescrever RLS SELECT de zapi_accounts ───────────────────────────────
--
-- ANTES: USING (auth.uid() IS NOT NULL) → qualquer autenticado vê todas as contas
-- DEPOIS:
--   - Privilegiado (admin/proprietário ATIVO) → vê todas as contas
--   - Restrito → vê apenas as contas vinculadas via zapi_account_users
--
-- As policies de INSERT/UPDATE/DELETE permanecem como estão (admin-only).

DROP POLICY IF EXISTS "zapi_accounts_select" ON public.zapi_accounts;
CREATE POLICY "zapi_accounts_select"
  ON public.zapi_accounts
  FOR SELECT
  TO authenticated
  USING (
    -- Privilegiado (admin ou proprietário ATIVO) vê todas as contas
    public.is_zapi_privileged(auth.uid())
    OR
    -- Restrito vê apenas as contas explicitamente vinculadas a ele
    EXISTS (
      SELECT 1
      FROM public.zapi_account_users au
      WHERE au.account_id = zapi_accounts.id
        AND au.user_id = auth.uid()
    )
  );

-- ─── 5. Reescrever RLS SELECT de zapi_chats ──────────────────────────────────
--
-- ANTES (110): has_role(admin) OU grant ativo
--   → Problema: proprietário precisava de senha (tratado como restrito), mas o
--     has_role(uid,'proprietario') tem bug e retornaria true pra todos.
--
-- DEPOIS (111): toggle-aware
--   - Toggle OFF (padrão): privilegiado lê sem grant; restrito precisa de grant
--   - Toggle ON: TODOS (incl. admin/proprietário) precisam de grant ativo

DROP POLICY IF EXISTS "zapi_chats_select" ON public.zapi_chats;
CREATE POLICY "zapi_chats_select"
  ON public.zapi_chats
  FOR SELECT
  TO authenticated
  USING (
    -- Privilegiado sem toggle de senha: acesso direto
    ( NOT public.zapi_require_password_for_privileged() AND public.is_zapi_privileged(auth.uid()) )
    OR
    -- Grant ativo para esta conta específica (cobre restritos E privilegiados quando toggle=true)
    EXISTS (
      SELECT 1
      FROM public.zapi_panel_grants g
      WHERE g.user_id    = auth.uid()
        AND g.account_id = zapi_chats.account_id
        AND g.expires_at > now()
    )
  );

-- ─── 6. Reescrever RLS SELECT de zapi_messages ───────────────────────────────
--
-- Mesma lógica de zapi_chats. zapi_messages tem coluna account_id direto.

DROP POLICY IF EXISTS "zapi_messages_select" ON public.zapi_messages;
CREATE POLICY "zapi_messages_select"
  ON public.zapi_messages
  FOR SELECT
  TO authenticated
  USING (
    -- Privilegiado sem toggle de senha: acesso direto
    ( NOT public.zapi_require_password_for_privileged() AND public.is_zapi_privileged(auth.uid()) )
    OR
    -- Grant ativo para esta conta específica (cobre restritos E privilegiados quando toggle=true)
    EXISTS (
      SELECT 1
      FROM public.zapi_panel_grants g
      WHERE g.user_id    = auth.uid()
        AND g.account_id = zapi_messages.account_id
        AND g.expires_at > now()
    )
  );

-- ─── 7. [P-01 FIX] Restringir RLS SELECT de zapi_webhook_log a admin-only ─────
--
-- PROBLEMA (Pentest P-01 CRÍTICO): migration 043 criou a policy SELECT de
-- zapi_webhook_log com USING (auth.uid() IS NOT NULL) — qualquer autenticado
-- lia o payload JSONB, que contém text.message (corpo textual) de TODAS as contas.
-- Isso anulava o controle de acesso inteiro do EM080: restrito sem vínculo e sem
-- grant obtinha texto das conversas com uma única GET ao PostgREST, sem senha.
--
-- CORREÇÃO: alinhar ao mesmo modelo da aba Logs no frontend (admin-only, Whatsapp.tsx:211).
-- Log de auditoria expõe payload bruto — não faz sentido para restrito/proprietário.
-- Se proprietário precisar ver logs no futuro: trocar USING por is_zapi_privileged().
-- Regressão zero: a aba Logs já era isAdmin — nenhum fluxo legítimo é quebrado.

DROP POLICY IF EXISTS "zapi_webhook_log_select" ON public.zapi_webhook_log;
CREATE POLICY "zapi_webhook_log_select"
  ON public.zapi_webhook_log
  FOR SELECT
  TO authenticated
  USING ( has_role(auth.uid(), 'admin') );

-- ─── 8. [N-01 FIX] Restringir RLS SELECT de zapi_chat_notes ao modelo EM080 ───
--
-- PROBLEMA (Pentest N-01 MÉDIA): migration 057 criou a policy SELECT de
-- zapi_chat_notes com USING (auth.uid() IS NOT NULL) — qualquer autenticado
-- lia o `corpo` (notas internas por conversa) de TODAS as conversas, inclusive
-- de contas não vinculadas. Mesma classe de vetor lateral do P-01, conteúdo
-- derivado (anotação que parafraseia o diálogo com o eleitor).
--
-- CORREÇÃO: alinhar ao modelo de acesso EM080.
--   - Privilegiado (admin/proprietário ATIVO): acesso direto via is_zapi_privileged().
--     NÃO exige grant: notas são internas de equipe, não conteúdo de eleitor
--     (diferente de zapi_chats/messages que têm o toggle de senha).
--   - Restrito: vê apenas notas de chats cuja conta ele tem vinculada
--     (via zapi_account_users — mesma lógica de zapi_accounts_select).
--   - INSERT/UPDATE/DELETE de notas: NÃO alteradas (autor_id = auth.uid() já garante
--     que restrito só cria/edita/apaga as próprias notas — sem regressão).
--
-- FK: zapi_chat_notes.chat_id → zapi_chats.id (confirmado em migration 057:90).
-- Referência: RAQ-MAND-EM080 N-01.

DROP POLICY IF EXISTS "zapi_chat_notes_select" ON public.zapi_chat_notes;
CREATE POLICY "zapi_chat_notes_select"
  ON public.zapi_chat_notes
  FOR SELECT
  TO authenticated
  USING (
    -- Privilegiado (admin/proprietário ATIVO) vê todas as notas
    public.is_zapi_privileged(auth.uid())
    OR
    -- Restrito vê apenas notas de conversas de contas vinculadas a ele
    EXISTS (
      SELECT 1
      FROM public.zapi_chats c
      JOIN public.zapi_account_users au ON au.account_id = c.account_id
      WHERE c.id = zapi_chat_notes.chat_id
        AND au.user_id = auth.uid()
    )
  );

-- ─── 9. Verificação final ─────────────────────────────────────────────────────

DO $$
BEGIN
  -- is_zapi_privileged
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_zapi_privileged'
  ) THEN
    RAISE EXCEPTION 'FALHA: função is_zapi_privileged não criada';
  END IF;

  -- zapi_account_users
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'zapi_account_users'
  ) THEN
    RAISE EXCEPTION 'FALHA: tabela zapi_account_users não criada';
  END IF;

  -- zapi_panel_settings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'zapi_panel_settings'
  ) THEN
    RAISE EXCEPTION 'FALHA: tabela zapi_panel_settings não criada';
  END IF;

  -- zapi_require_password_for_privileged
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'zapi_require_password_for_privileged'
  ) THEN
    RAISE EXCEPTION 'FALHA: função zapi_require_password_for_privileged não criada';
  END IF;

  -- zapi_accounts_select
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'zapi_accounts'
      AND policyname = 'zapi_accounts_select'
  ) THEN
    RAISE EXCEPTION 'FALHA: policy zapi_accounts_select não criada';
  END IF;

  -- zapi_chats_select
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'zapi_chats'
      AND policyname = 'zapi_chats_select'
  ) THEN
    RAISE EXCEPTION 'FALHA: policy zapi_chats_select não recriada';
  END IF;

  -- zapi_messages_select
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'zapi_messages'
      AND policyname = 'zapi_messages_select'
  ) THEN
    RAISE EXCEPTION 'FALHA: policy zapi_messages_select não recriada';
  END IF;

  -- zapi_webhook_log_select (P-01 fix: deve ser admin-only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'zapi_webhook_log'
      AND policyname = 'zapi_webhook_log_select'
  ) THEN
    RAISE EXCEPTION 'FALHA: policy zapi_webhook_log_select não recriada (P-01 fix ausente)';
  END IF;

  -- zapi_account_users_force_created_by (P-03 fix: trigger anti-mass-assignment)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'zapi_account_users_force_created_by'
  ) THEN
    RAISE EXCEPTION 'FALHA: função zapi_account_users_force_created_by não criada (P-03 fix ausente)';
  END IF;

  -- zapi_chat_notes_select (N-01 fix: notas internas alinhadas ao modelo EM080)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'zapi_chat_notes'
      AND policyname = 'zapi_chat_notes_select'
  ) THEN
    RAISE EXCEPTION 'FALHA: policy zapi_chat_notes_select não recriada (N-01 fix ausente)';
  END IF;

  -- trg_zapi_account_users_force_created_by (QA F03: confirma que o trigger existe, não só a função)
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_zapi_account_users_force_created_by'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'FALHA: trigger trg_zapi_account_users_force_created_by não criado (P-03 fix ausente)';
  END IF;

  RAISE NOTICE 'Migration 111_em080_whatsapp_access_control aplicada com sucesso (fixes P-01, P-03, P-04, N-01 incluídos).';
END;
$$;
