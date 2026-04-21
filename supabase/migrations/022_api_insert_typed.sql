-- RAQ-MAND-EM026: api_insert tipado corretamente.
-- jsonb_populate_record fornece os valores com os tipos da coluna
-- (UUID, timestamp, etc.). Selecionamos apenas as colunas presentes
-- no payload para respeitar os defaults das demais.

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
  v_sep TEXT := '';
  v_key TEXT;
BEGIN
  PERFORM public._api_assert_resource(p_resource);

  v_payload := (p_data - 'id' - 'created_at' - 'updated_at')
    || jsonb_build_object('created_by', p_user_id);

  FOR v_key IN SELECT jsonb_object_keys(v_payload) LOOP
    v_cols := v_cols || v_sep || quote_ident(v_key);
    v_sep := ', ';
  END LOOP;

  IF v_cols = '' THEN
    RAISE EXCEPTION 'Nenhum campo para inserir' USING ERRCODE = '22023';
  END IF;

  -- jsonb_populate_record casts automaticamente com base nos tipos da tabela
  EXECUTE format(
    'INSERT INTO %I (%s) SELECT %s FROM jsonb_populate_record(NULL::%I, $1) RETURNING to_jsonb(%I.*)',
    p_resource, v_cols, v_cols, p_resource, p_resource
  ) INTO v_result USING v_payload;

  RETURN v_result;
END;
$$;

-- api_update tambem precisa do mesmo tratamento de tipo
CREATE OR REPLACE FUNCTION public.api_update(
  p_user_id UUID,
  p_resource TEXT,
  p_id UUID,
  p_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_set_clause TEXT := '';
  v_sep TEXT := '';
  v_key TEXT;
  v_payload JSONB;
BEGIN
  PERFORM public._api_assert_resource(p_resource);

  v_payload := p_data - 'id' - 'created_by' - 'created_at';

  FOR v_key IN SELECT jsonb_object_keys(v_payload) LOOP
    v_set_clause := v_set_clause
      || v_sep
      || format('%I = (SELECT %I FROM jsonb_populate_record(NULL::%I, $3))',
                v_key, v_key, p_resource);
    v_sep := ', ';
  END LOOP;

  IF v_set_clause = '' THEN
    RAISE EXCEPTION 'Nenhum campo valido para atualizar' USING ERRCODE = '22023';
  END IF;

  EXECUTE format(
    'UPDATE %I t SET %s WHERE t.id = $1 AND t.created_by = $2 RETURNING to_jsonb(t.*)',
    p_resource, v_set_clause
  ) INTO v_result USING p_id, p_user_id, v_payload;

  RETURN v_result;
END;
$$;
