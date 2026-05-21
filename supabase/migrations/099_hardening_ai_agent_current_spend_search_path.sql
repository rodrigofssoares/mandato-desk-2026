-- ============================================================================
-- Migration 099: Hardening search_path da função ai_agent_current_spend
-- ============================================================================
-- A função foi criada na migration 089 com SET search_path = public, pg_catalog.
-- O padrão seguro (alinhado com ai_count_user_messages_today, migration 098) é
-- SET search_path = '' com todas as referências qualificadas (public.tabela).
--
-- Risco original: com search_path não-vazio, um atacante com permissão CREATE em
-- public poderia criar um objeto homônimo e desviar execução. Neste stack Supabase
-- o role authenticated não tem CREATE em public, então o risco era teórico — mas
-- aplicamos o hardening por consistência e conformidade com o template seguro.
--
-- NOVO-01 [LOW] do re-audit de segurança RAQ-MAND-EM075 Onda 2.1.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_agent_current_spend(p_agent_id UUID)
RETURNS DECIMAL(10,6)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    SUM(c.total_cost_brl), 0
  )
  FROM public.ai_chat_messages_cost c
  WHERE c.created_at >= date_trunc('month', now())
    AND c.created_at <  date_trunc('month', now()) + INTERVAL '1 month';
  -- Nota: filtra apenas pelo mês corrente (UTC). agent_id é reservado para futura
  -- multi-agente — no MVP a organização tem 1 agente, então o filtro é só por período.
$$;

COMMENT ON FUNCTION public.ai_agent_current_spend(UUID) IS
  'Retorna o gasto total em BRL do mês corrente (UTC). SECURITY DEFINER + search_path vazio (hardening migration 099). O parâmetro agent_id é reservado para futura multi-agente — no MVP o filtro é apenas por período.';
