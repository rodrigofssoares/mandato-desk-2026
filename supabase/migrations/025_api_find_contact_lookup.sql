-- RAQ-MAND-EM029: permite identificar um contato via API por phone, instagram
-- ou name (alem do UUID). Centraliza a logica de lookup num unico RPC para
-- manter o edge function enxuto.

CREATE OR REPLACE FUNCTION public.api_find_contact_by_lookup(
  p_user_id UUID,
  p_field TEXT,
  p_value TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_count INT;
  v_normalized TEXT;
BEGIN
  IF p_value IS NULL OR LENGTH(TRIM(p_value)) = 0 THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'valor de busca vazio');
  END IF;

  IF p_field = 'phone' THEN
    -- Mesma logica da api_find_contact_by_phone: remove separadores e
    -- prefixo 55, compara por substring (formatos variam bastante).
    v_normalized := regexp_replace(p_value, '[\s\(\)\-\+]', '', 'g');
    v_normalized := regexp_replace(v_normalized, '^55', '');

    IF LENGTH(v_normalized) = 0 THEN
      RETURN jsonb_build_object('status', 'error', 'message', 'telefone invalido apos normalizacao');
    END IF;

    SELECT to_jsonb(c.*) INTO v_result
    FROM contacts c
    WHERE c.created_by = p_user_id
      AND c.telefone ILIKE '%' || v_normalized || '%'
      AND c.merged_into IS NULL
    LIMIT 1;

  ELSIF p_field = 'instagram' THEN
    -- Handles sao unicos por pessoa. Remove @ inicial se houver. Match exato.
    v_normalized := regexp_replace(p_value, '^@', '');

    SELECT to_jsonb(c.*) INTO v_result
    FROM contacts c
    WHERE c.created_by = p_user_id
      AND c.instagram ILIKE v_normalized
      AND c.merged_into IS NULL
    LIMIT 1;

  ELSIF p_field = 'name' THEN
    -- Nome pode repetir. Conta primeiro para detectar ambiguidade.
    SELECT COUNT(*) INTO v_count
    FROM contacts c
    WHERE c.created_by = p_user_id
      AND c.nome ILIKE p_value
      AND c.merged_into IS NULL;

    IF v_count > 1 THEN
      RETURN jsonb_build_object(
        'status', 'ambiguous',
        'count', v_count,
        'message', format(
          'Mais de um contato com o nome "%s" (%s encontrados). Use ID, telefone ou Instagram para identificar.',
          p_value, v_count
        )
      );
    END IF;

    SELECT to_jsonb(c.*) INTO v_result
    FROM contacts c
    WHERE c.created_by = p_user_id
      AND c.nome ILIKE p_value
      AND c.merged_into IS NULL
    LIMIT 1;

  ELSE
    RETURN jsonb_build_object(
      'status', 'error',
      'message', format('Campo de busca invalido: "%s". Use: phone, instagram, name.', p_field)
    );
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_find_contact_by_lookup(UUID, TEXT, TEXT) TO authenticated, service_role;
