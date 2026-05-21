-- ============================================================================
-- Migration 088: Presets de modelos por agente (Econômico / Balanceado / Premium)
-- ============================================================================
-- Estrutura em 2 níveis:
--   1. ai_agent_model_presets — define 3 conjuntos (econômico, balanceado, premium)
--      por agente, com flag is_active_preset indicando qual está selecionado.
--   2. ai_agent_models — lista de modelos dentro de cada preset, com posição,
--      flag enabled e is_default (modelo prioritário dentro do preset).
--
-- Constraints de integridade:
--   - Só 1 preset ativo por agente (unique partial index)
--   - Só 1 modelo default por preset (unique partial index)
--   - UNIQUE em (agent_id, preset_key) — não repete preset do mesmo tipo
--   - UNIQUE em (preset_id, provider, model_id) — não repete modelo no preset
--
-- text_only_mode: coluna adicionada à ai_agents na migration 086 (já inclusa lá).
-- Esta migration NÃO re-altera ai_agents para evitar conflito.
--
-- Seed: cria os 3 presets default + modelos pré-selecionados.
-- Balanceado marcado como is_active_preset = true por padrão.
-- ============================================================================

-- ─── Tabela de presets ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_agent_model_presets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id          UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  preset_key        TEXT NOT NULL
                    CHECK (preset_key IN ('econ', 'bal', 'pre', 'custom')),
  is_active_preset  BOOLEAN NOT NULL DEFAULT false,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_model_presets IS
  'Define os conjuntos de modelos disponíveis por agente: econ=Econômico, bal=Balanceado, pre=Premium, custom=Personalizado. Apenas 1 preset pode estar ativo por vez (constraint via index parcial).';

COMMENT ON COLUMN public.ai_agent_model_presets.preset_key IS
  'econ = Econômico (menor custo), bal = Balanceado (padrão ativo), pre = Premium (maior qualidade), custom = Personalizado pelo admin.';

-- UNIQUE: 1 preset de cada tipo por agente
CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_model_presets_agent_key_unique
  ON public.ai_agent_model_presets (agent_id, preset_key);

-- Só 1 preset ativo por agente
CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_model_presets_one_active
  ON public.ai_agent_model_presets (agent_id)
  WHERE is_active_preset = true;

-- ─── Trigger updated_at ──────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_ai_agent_model_presets_updated_at ON public.ai_agent_model_presets;
CREATE TRIGGER trg_ai_agent_model_presets_updated_at
  BEFORE UPDATE ON public.ai_agent_model_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Tabela de modelos por preset ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_agent_models (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  preset_id   UUID NOT NULL REFERENCES public.ai_agent_model_presets(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL
              CHECK (provider IN ('openai', 'anthropic', 'openrouter')),
  model_id    TEXT NOT NULL,           -- ex: 'openai/gpt-4o-mini'
  enabled     BOOLEAN NOT NULL DEFAULT true,
  is_default  BOOLEAN NOT NULL DEFAULT false,  -- modelo prioritário dentro do preset
  position    INT NOT NULL DEFAULT 0,  -- ordem de exibição

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_models IS
  'Modelos disponíveis dentro de cada preset. position define ordem de exibição. is_default marca o modelo preferido do preset (só 1 por preset).';

COMMENT ON COLUMN public.ai_agent_models.model_id IS
  'ID do modelo no formato provider/model-name (ex: openai/gpt-4o-mini, anthropic/claude-3.5-haiku, meta-llama/llama-3.3-70b-instruct).';

-- UNIQUE: modelo não pode se repetir dentro do mesmo preset
CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_models_preset_model_unique
  ON public.ai_agent_models (preset_id, provider, model_id);

-- Só 1 modelo default por preset
CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_models_one_default
  ON public.ai_agent_models (preset_id)
  WHERE is_default = true;

-- ─── RLS: presets e modelos — admin pode tudo ────────────────────────────────

ALTER TABLE public.ai_agent_model_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_agent_model_presets: admin pode ver" ON public.ai_agent_model_presets;
CREATE POLICY "ai_agent_model_presets: admin pode ver"
  ON public.ai_agent_model_presets
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "ai_agent_model_presets: admin pode inserir" ON public.ai_agent_model_presets;
CREATE POLICY "ai_agent_model_presets: admin pode inserir"
  ON public.ai_agent_model_presets
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ai_agent_model_presets: admin pode editar" ON public.ai_agent_model_presets;
CREATE POLICY "ai_agent_model_presets: admin pode editar"
  ON public.ai_agent_model_presets
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ai_agent_model_presets: admin pode deletar" ON public.ai_agent_model_presets;
CREATE POLICY "ai_agent_model_presets: admin pode deletar"
  ON public.ai_agent_model_presets
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

ALTER TABLE public.ai_agent_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_agent_models: admin pode ver" ON public.ai_agent_models;
CREATE POLICY "ai_agent_models: admin pode ver"
  ON public.ai_agent_models
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "ai_agent_models: admin pode inserir" ON public.ai_agent_models;
CREATE POLICY "ai_agent_models: admin pode inserir"
  ON public.ai_agent_models
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ai_agent_models: admin pode editar" ON public.ai_agent_models;
CREATE POLICY "ai_agent_models: admin pode editar"
  ON public.ai_agent_models
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ai_agent_models: admin pode deletar" ON public.ai_agent_models;
CREATE POLICY "ai_agent_models: admin pode deletar"
  ON public.ai_agent_models
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ─── Seed: 3 presets default ─────────────────────────────────────────────────
-- Roda apenas se o agente singleton existe e ainda não tem presets.
-- Balanceado marcado como ativo por padrão.

DO $$
DECLARE
  v_agent_id   UUID;
  v_econ_id    UUID;
  v_bal_id     UUID;
  v_pre_id     UUID;
BEGIN
  -- Pega o ID do agente singleton
  SELECT id INTO v_agent_id FROM public.ai_agents LIMIT 1;

  IF v_agent_id IS NULL THEN
    RAISE NOTICE 'Seed 088: ai_agents vazio — seed ignorado.';
    RETURN;
  END IF;

  -- Só insere se ainda não há presets para este agente
  IF EXISTS (SELECT 1 FROM public.ai_agent_model_presets WHERE agent_id = v_agent_id) THEN
    RAISE NOTICE 'Seed 088: presets já existem para agent_id % — seed ignorado.', v_agent_id;
    RETURN;
  END IF;

  -- ── Preset Econômico ──────────────────────────────────────────────────────
  INSERT INTO public.ai_agent_model_presets (agent_id, preset_key, is_active_preset)
  VALUES (v_agent_id, 'econ', false)
  RETURNING id INTO v_econ_id;

  INSERT INTO public.ai_agent_models (preset_id, provider, model_id, enabled, is_default, position)
  VALUES
    (v_econ_id, 'openai',      'openai/gpt-4o-mini',              true, true,  0),
    (v_econ_id, 'anthropic',   'anthropic/claude-3.5-haiku',      true, false, 1),
    (v_econ_id, 'openrouter',  'meta-llama/llama-3.3-70b-instruct', true, false, 2);

  -- ── Preset Balanceado (ativo por padrão) ─────────────────────────────────
  INSERT INTO public.ai_agent_model_presets (agent_id, preset_key, is_active_preset)
  VALUES (v_agent_id, 'bal', true)
  RETURNING id INTO v_bal_id;

  INSERT INTO public.ai_agent_models (preset_id, provider, model_id, enabled, is_default, position)
  VALUES
    (v_bal_id, 'openai',     'openai/gpt-4o-mini',          true, true,  0),
    (v_bal_id, 'openai',     'openai/gpt-4o',               true, false, 1),
    (v_bal_id, 'anthropic',  'anthropic/claude-3.5-sonnet', true, false, 2),
    (v_bal_id, 'openrouter', 'meta-llama/llama-3.3-70b-instruct', true, false, 3);

  -- ── Preset Premium ────────────────────────────────────────────────────────
  INSERT INTO public.ai_agent_model_presets (agent_id, preset_key, is_active_preset)
  VALUES (v_agent_id, 'pre', false)
  RETURNING id INTO v_pre_id;

  INSERT INTO public.ai_agent_models (preset_id, provider, model_id, enabled, is_default, position)
  VALUES
    (v_pre_id, 'openai',    'openai/gpt-4o',                true, true,  0),
    (v_pre_id, 'anthropic', 'anthropic/claude-3.5-sonnet',  true, false, 1),
    (v_pre_id, 'anthropic', 'anthropic/claude-opus-4',      true, false, 2);

  RAISE NOTICE 'Seed 088: 3 presets criados para agent_id %.', v_agent_id;
END;
$$;
