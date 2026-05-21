-- ============================================================================
-- Migration 098: RPC parametrizada ai_count_user_messages_today
-- ============================================================================
-- ALTA-02 (RAQ-MAND-EM075 Onda 2):
-- Substitui o filtro PostgREST com interpolacao de string na Edge Function
-- ai-agent-chat (ai-agent-chat/index.ts:214):
--
--   .filter('session_id', 'in', `(SELECT id FROM ai_chat_sessions WHERE user_id = '${userId}')`)
--
-- Esse padrao e intrinsecamente fragil: qualquer refator que troque a origem
-- do userId por valor nao-validado vira SQL injection real.
--
-- Fix: substituir por RPC parametrizada com tipos UUID — o banco garante que
-- p_user_id e tratado como dado, nunca como SQL.
--
-- A funcao usa SECURITY DEFINER + SET search_path = '' para evitar
-- search_path hijacking, e STABLE para permitir cache no planner.
-- GRANT somente a service_role (Edge Functions) — authenticated nao chama diretamente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_count_user_messages_today(p_user_id UUID)
  RETURNS INT
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT count(*)::INT
  FROM public.ai_chat_messages m
  JOIN public.ai_chat_sessions s ON s.id = m.session_id
  WHERE s.user_id = p_user_id
    AND m.role = 'user'
    AND m.created_at >= current_date;
$$;

-- Revoga acesso publico (default do postgres e public = todos)
REVOKE EXECUTE ON FUNCTION public.ai_count_user_messages_today(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_count_user_messages_today(UUID) FROM authenticated;

-- Concede somente a service_role (Edge Functions ai-agent-chat)
GRANT EXECUTE ON FUNCTION public.ai_count_user_messages_today(UUID) TO service_role;

COMMENT ON FUNCTION public.ai_count_user_messages_today(UUID) IS
  'Conta mensagens do role "user" enviadas hoje pelo usuario p_user_id. '
  'Usada pela Edge Function ai-agent-chat para verificar o cap diario por usuario. '
  'SECURITY DEFINER + search_path vazio previne privilege escalation. '
  'Acessivel apenas via service_role (nao exposta a usuarios autenticados).';
