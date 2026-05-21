-- ============================================================================
-- Migration 105: RPC atômica set_active_preset
-- ============================================================================
-- Substitui os 2 UPDATEs sequenciais em useSetActivePreset por uma única
-- operação atômica no banco, eliminando a race condition (M2/Security + SF-1/CR).
--
-- Um único UPDATE com expressão condicional garante atomicidade:
--   is_active_preset = (preset_key = p_preset_key)
--
-- SECURITY DEFINER com search_path vazio (padrão hardening do projeto).
-- Acesso restrito a authenticated (RLS da tabela protege por is_admin).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_active_preset(
  p_agent_id  UUID,
  p_preset_key TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.ai_agent_model_presets
  SET
    is_active_preset = (preset_key = p_preset_key),
    updated_at       = now()
  WHERE agent_id = p_agent_id;
$$;

COMMENT ON FUNCTION public.set_active_preset(UUID, TEXT) IS
  'Ativa atomicamente o preset identificado por p_preset_key e desativa os demais do mesmo agente. Substitui os 2 UPDATEs sequenciais que geravam race condition.';

-- Revoga de público, concede apenas a authenticated
REVOKE ALL ON FUNCTION public.set_active_preset(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_preset(UUID, TEXT) TO authenticated;
