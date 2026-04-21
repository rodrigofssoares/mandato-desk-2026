-- RAQ-MAND-EM026: corrige api_insert para usar apenas as colunas presentes no
-- payload (respeitando defaults, como gen_random_uuid() no id).
-- jsonb_populate_record zerava colunas ausentes, violando NOT NULL constraints.

CREATE OR REPLACE FUNCTION public.api_insert(
  p_user_id UUID,
  p_resource TEXT,
  p_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_payload JSONB;
  v_cols TEXT := '';
  v_vals TEXT := '';
  v_sep TEXT := '';
  v_key TEXT;
  v_idx INT := 1;
  v_param_values JSONB := '[]'::jsonb;
BEGIN
  PERFORM public._api_assert_resource(p_resource);

  v_payload := (p_data - 'id' - 'created_at' - 'updated_at')
    || jsonb_build_object('created_by', p_user_id);

  -- Montar INSERT dinamico apenas com colunas presentes
  FOR v_key IN SELECT jsonb_object_keys(v_payload) LOOP
    v_cols := v_cols || v_sep || quote_ident(v_key);
    v_vals := v_vals || v_sep || '($1 ->> ' || quote_literal(v_key) || ')';
    v_sep := ', ';
  END LOOP;

  IF v_cols = '' THEN
    RAISE EXCEPTION 'Nenhum campo para inserir' USING ERRCODE = '22023';
  END IF;

  EXECUTE format(
    'INSERT INTO %I (%s) VALUES (%s) RETURNING to_jsonb(%I.*)',
    p_resource, v_cols, v_vals, p_resource
  ) INTO v_result USING v_payload;

  RETURN v_result;
END;
$$;

-- Mesmo ajuste no api_update: usar apenas colunas presentes (ja estava ok,
-- mas reforcando o padrao de cast textual ->> para evitar problemas de tipo)

COMMENT ON FUNCTION public.api_insert(UUID, TEXT, JSONB) IS
  'Insere registro em contacts|demands|tags escopado ao usuario. Respeita defaults de colunas ausentes.';
