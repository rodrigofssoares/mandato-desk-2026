-- ============================================================================
-- Migration 106: RPC atômica set_default_model_in_preset
-- ============================================================================
-- Substitui os 2 UPDATEs sequenciais em useSetDefaultModelInPreset por uma
-- operação atômica, eliminando a mesma race condition da migration 105.
--
-- Estratégia: 1 UPDATE condicional filtrando pelo preset_id garante que apenas
-- modelos do mesmo preset são tocados. is_default = (id = p_model_id).
--
-- SECURITY DEFINER com search_path vazio (padrão hardening do projeto).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_default_model_in_preset(
  p_preset_id UUID,
  p_model_id  UUID
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.ai_agent_models
  SET
    is_default = (id = p_model_id),
    updated_at = now()
  WHERE preset_id = p_preset_id;
$$;

COMMENT ON FUNCTION public.set_default_model_in_preset(UUID, UUID) IS
  'Define atomicamente o modelo padrão de um preset: marca is_default=true no modelo p_model_id e false nos demais do mesmo preset. Substitui os 2 UPDATEs sequenciais que geravam race condition.';

-- Revoga de público, concede apenas a authenticated
REVOKE ALL ON FUNCTION public.set_default_model_in_preset(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_default_model_in_preset(UUID, UUID) TO authenticated;
