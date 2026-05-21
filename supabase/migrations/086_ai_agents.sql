-- ============================================================================
-- Migration 086: Fundação do Agente de IA — tabela ai_agents + RBAC
-- ============================================================================
-- Cria a tabela singleton `ai_agents` que armazena identidade e configuração
-- base do agente de chat (nome, system_prompt, is_active). É chamada "singleton"
-- porque há exatamente 1 linha por organização neste MVP.
--
-- Separada de `ai_settings` (features assistivas — resumo, sugestão de
-- resposta, etc.) para evitar breaking change nas features existentes e
-- viabilizar evolução independente (multi-agente no futuro).
--
-- RLS: SELECT e UPDATE exclusivos para admin ATIVO. INSERT bloqueado fora de
-- migration (singleton criado via seed ao final). DELETE bloqueado (singleton).
--
-- RBAC: adiciona secao 'agente_ia' na permissoes_perfil com defaults:
--   admin → pode_ver + pode_criar + pode_editar + pode_deletar
--   demais roles → false (admin concede via Matriz de Permissões)
-- ============================================================================

-- ─── Helper is_admin() ───────────────────────────────────────────────────────
-- Verifica se o usuário atual é admin ativo.
-- Usada como helper nas RLS policies de todas as tabelas de IA do agente.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND status_aprovacao = 'ATIVO'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Retorna true se o usuário autenticado é admin com status ATIVO.';

-- ─── Tabela principal: ai_agents ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identidade
  name            TEXT NOT NULL DEFAULT 'Agente IA',
  system_prompt   TEXT CHECK (char_length(system_prompt) <= 32000),
  is_active       BOOLEAN NOT NULL DEFAULT false,

  -- Master switch: se true, bloqueia seleção de modelos multimodais
  text_only_mode  BOOLEAN NOT NULL DEFAULT true,

  -- Auditoria
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_agents IS
  'Singleton por organização (1 linha). Armazena identidade e configuração base do agente de chat de IA. Separada de ai_settings para não afetar as features assistivas existentes.';

COMMENT ON COLUMN public.ai_agents.system_prompt IS
  'Prompt de sistema que define personalidade e escopo do agente. Máx 32.000 chars (seguro para context window dos principais modelos).';

COMMENT ON COLUMN public.ai_agents.text_only_mode IS
  'Master switch: quando true bloqueia seleção de modelos multimodais (vision, áudio). Default true por segurança.';

-- ─── Trigger updated_at ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_agents_updated_at ON public.ai_agents;
CREATE TRIGGER trg_ai_agents_updated_at
  BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;

-- Admin ativo pode ver a linha completa (com system_prompt)
DROP POLICY IF EXISTS "ai_agents: admin pode ver" ON public.ai_agents;
CREATE POLICY "ai_agents: admin pode ver"
  ON public.ai_agents
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin ativo pode atualizar (nunca precisa de INSERT — singleton via seed)
DROP POLICY IF EXISTS "ai_agents: admin pode editar" ON public.ai_agents;
CREATE POLICY "ai_agents: admin pode editar"
  ON public.ai_agents
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- INSERT e DELETE bloqueados para todos via ausência de política permissiva
-- (RLS padrão: nega tudo sem política explícita)

-- ─── VIEW pública (não-admin): só id, name, is_active ────────────────────────
-- Permite que hooks de usuários comuns saibam se o agente está ativo e qual
-- o nome, sem expor system_prompt ou configurações sensíveis.

DROP VIEW IF EXISTS public.ai_agents_public_view;
CREATE OR REPLACE VIEW public.ai_agents_public_view
WITH (security_invoker = false)
AS
  SELECT id, name, is_active
  FROM public.ai_agents;

-- SECURITY DEFINER via GRANTS controlados: apenas autenticados
REVOKE ALL ON public.ai_agents_public_view FROM PUBLIC;
GRANT SELECT ON public.ai_agents_public_view TO authenticated;

COMMENT ON VIEW public.ai_agents_public_view IS
  'Expõe apenas id, name, is_active do agente para usuários não-admin. Nunca expõe system_prompt, chaves ou configurações sensíveis.';

-- ─── RBAC: adicionar secao agente_ia na permissoes_perfil ────────────────────

INSERT INTO public.permissoes_perfil (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, so_proprio, pode_deletar_em_massa)
VALUES
  ('admin',       'agente_ia', true,  true,  true,  true,  false, false),
  ('proprietario','agente_ia', false, false, false, false, false, false),
  ('assessor',    'agente_ia', false, false, false, false, false, false),
  ('assistente',  'agente_ia', false, false, false, false, false, false),
  ('estagiario',  'agente_ia', false, false, false, false, false, false)
ON CONFLICT DO NOTHING;

-- ─── Seed: cria a linha singleton se ainda não existe ────────────────────────

INSERT INTO public.ai_agents (name, is_active, text_only_mode)
SELECT 'Agente IA', false, true
WHERE NOT EXISTS (SELECT 1 FROM public.ai_agents);
