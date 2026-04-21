-- RAQ-MAND-EM026: RPCs SECURITY DEFINER para as operacoes da edge function api-proxy.
-- Motivo: novas chaves sb_secret_ nao fazem mais bypass de RLS; em vez de depender
-- da chave, usamos funcoes SECURITY DEFINER que executam com privilegios elevados.
-- Todas as funcoes recebem p_user_id (extraido do token validado) e filtram por
-- created_by = p_user_id, mantendo o isolamento por usuario.

-- Whitelist de recursos permitidos
CREATE OR REPLACE FUNCTION public._api_assert_resource(p_resource TEXT)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_resource NOT IN ('contacts', 'demands', 'tags') THEN
    RAISE EXCEPTION 'Recurso invalido: %', p_resource USING ERRCODE = '22023';
  END IF;
END;
$$;

-- Buscar pelo id
CREATE OR REPLACE FUNCTION public.api_get_one(
  p_user_id UUID,
  p_resource TEXT,
  p_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public._api_assert_resource(p_resource);

  EXECUTE format(
    'SELECT to_jsonb(t) FROM %I t WHERE t.id = $1 AND t.created_by = $2',
    p_resource
  ) INTO v_result USING p_id, p_user_id;

  RETURN v_result;
END;
$$;

-- Listar com paginacao e busca
CREATE OR REPLACE FUNCTION public.api_list(
  p_user_id UUID,
  p_resource TEXT,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_search TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data JSONB;
  v_total BIGINT;
  v_search_col TEXT;
  v_where TEXT := 't.created_by = $1';
  v_has_search BOOLEAN := p_search IS NOT NULL AND LENGTH(p_search) > 0;
BEGIN
  PERFORM public._api_assert_resource(p_resource);

  v_search_col := CASE p_resource
    WHEN 'contacts' THEN 'name'
    WHEN 'demands' THEN 'title'
    WHEN 'tags' THEN 'name'
  END;

  IF v_has_search THEN
    EXECUTE format(
      'SELECT COUNT(*) FROM %I t WHERE %s AND t.%I ILIKE $2',
      p_resource, v_where, v_search_col
    ) INTO v_total USING p_user_id, '%' || p_search || '%';

    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), ''[]''::jsonb) FROM (SELECT * FROM %I t WHERE %s AND t.%I ILIKE $2 ORDER BY t.created_at DESC LIMIT $3 OFFSET $4) x',
      p_resource, v_where, v_search_col
    ) INTO v_data USING p_user_id, '%' || p_search || '%', p_limit, p_offset;
  ELSE
    EXECUTE format('SELECT COUNT(*) FROM %I t WHERE %s', p_resource, v_where)
      INTO v_total USING p_user_id;

    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), ''[]''::jsonb) FROM (SELECT * FROM %I t WHERE %s ORDER BY t.created_at DESC LIMIT $2 OFFSET $3) x',
      p_resource, v_where
    ) INTO v_data USING p_user_id, p_limit, p_offset;
  END IF;

  RETURN jsonb_build_object('data', v_data, 'total', v_total);
END;
$$;

-- Inserir registro (com created_by injetado)
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
BEGIN
  PERFORM public._api_assert_resource(p_resource);

  v_payload := p_data - 'id' - 'created_at' - 'updated_at';
  v_payload := v_payload || jsonb_build_object('created_by', p_user_id);

  EXECUTE format(
    'INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1) RETURNING to_jsonb(%I.*)',
    p_resource, p_resource, p_resource
  ) INTO v_result USING v_payload;

  RETURN v_result;
END;
$$;

-- Atualizar por id
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
  v_key TEXT;
  v_sep TEXT := '';
  v_payload JSONB;
BEGIN
  PERFORM public._api_assert_resource(p_resource);

  v_payload := p_data - 'id' - 'created_by' - 'created_at';

  FOR v_key IN SELECT jsonb_object_keys(v_payload) LOOP
    v_set_clause := v_set_clause || v_sep || format('%I = ($3 ->> %L)', v_key, v_key);
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

-- Remover por id
CREATE OR REPLACE FUNCTION public.api_delete(
  p_user_id UUID,
  p_resource TEXT,
  p_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public._api_assert_resource(p_resource);

  EXECUTE format(
    'DELETE FROM %I t WHERE t.id = $1 AND t.created_by = $2 RETURNING to_jsonb(t.*)',
    p_resource
  ) INTO v_result USING p_id, p_user_id;

  RETURN v_result;
END;
$$;

-- Buscar contato pelo telefone normalizado
CREATE OR REPLACE FUNCTION public.api_find_contact_by_phone(
  p_user_id UUID,
  p_phone_normalized TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT to_jsonb(c.*) INTO v_result
  FROM contacts c
  WHERE c.created_by = p_user_id
    AND c.phone ILIKE '%' || p_phone_normalized || '%'
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- Vincular contato a board/etapa, aceitando UUID OU nome
CREATE OR REPLACE FUNCTION public.api_link_contact_to_board(
  p_user_id UUID,
  p_contact_id UUID,
  p_board_ref TEXT,
  p_stage_ref TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_uuid BOOLEAN;
  v_board_id UUID;
  v_board_count INT;
  v_stage_id UUID;
  v_stage_count INT;
  v_existing_item_id UUID;
  v_next_ordem INT;
  v_new_item_id UUID;
  v_action TEXT;
BEGIN
  IF p_board_ref IS NULL OR LENGTH(p_board_ref) = 0 THEN
    RETURN jsonb_build_object('status', 'warning', 'message', 'board nao informado');
  END IF;

  -- Resolver board_id
  v_is_uuid := p_board_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF v_is_uuid THEN
    SELECT b.id INTO v_board_id
    FROM boards b
    WHERE b.id = p_board_ref::uuid AND b.created_by = p_user_id;
  ELSE
    SELECT COUNT(*) INTO v_board_count
    FROM boards b
    WHERE b.created_by = p_user_id AND b.nome ILIKE p_board_ref;

    IF v_board_count > 1 THEN
      RETURN jsonb_build_object(
        'status', 'warning',
        'ambiguous', true,
        'message', format('nome de board ambiguo (%s encontrados) — informe o UUID em board_id', v_board_count)
      );
    END IF;

    SELECT b.id INTO v_board_id
    FROM boards b
    WHERE b.created_by = p_user_id AND b.nome ILIKE p_board_ref
    LIMIT 1;
  END IF;

  IF v_board_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'warning',
      'message', CASE WHEN v_is_uuid
        THEN 'board_id not found or not accessible'
        ELSE format('board nao encontrado pelo nome: "%s"', p_board_ref)
      END
    );
  END IF;

  -- Resolver stage_id
  IF p_stage_ref IS NOT NULL AND LENGTH(p_stage_ref) > 0 THEN
    v_is_uuid := p_stage_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    IF v_is_uuid THEN
      SELECT s.id INTO v_stage_id
      FROM board_stages s
      WHERE s.id = p_stage_ref::uuid AND s.board_id = v_board_id;
    ELSE
      SELECT COUNT(*) INTO v_stage_count
      FROM board_stages s
      WHERE s.board_id = v_board_id AND s.nome ILIKE p_stage_ref;

      IF v_stage_count > 1 THEN
        RETURN jsonb_build_object(
          'status', 'warning',
          'resolved_board_id', v_board_id,
          'ambiguous', true,
          'message', format('nome de etapa ambiguo (%s encontrados) — informe o UUID em stage_id', v_stage_count)
        );
      END IF;

      SELECT s.id INTO v_stage_id
      FROM board_stages s
      WHERE s.board_id = v_board_id AND s.nome ILIKE p_stage_ref
      LIMIT 1;
    END IF;

    IF v_stage_id IS NULL THEN
      RETURN jsonb_build_object(
        'status', 'warning',
        'resolved_board_id', v_board_id,
        'message', CASE WHEN v_is_uuid
          THEN 'stage_id nao encontrado neste board'
          ELSE format('etapa nao encontrada pelo nome: "%s"', p_stage_ref)
        END
      );
    END IF;
  ELSE
    -- Sem stage informado: primeira etapa por ordem
    SELECT s.id INTO v_stage_id
    FROM board_stages s
    WHERE s.board_id = v_board_id
    ORDER BY s.ordem ASC
    LIMIT 1;

    IF v_stage_id IS NULL THEN
      RETURN jsonb_build_object(
        'status', 'warning',
        'resolved_board_id', v_board_id,
        'message', 'Nenhuma etapa encontrada no board informado'
      );
    END IF;
  END IF;

  -- Verificar se ja existe board_item
  SELECT bi.id INTO v_existing_item_id
  FROM board_items bi
  WHERE bi.contact_id = p_contact_id AND bi.board_id = v_board_id
  LIMIT 1;

  IF v_existing_item_id IS NOT NULL THEN
    UPDATE board_items
    SET stage_id = v_stage_id, moved_at = NOW()
    WHERE id = v_existing_item_id;

    RETURN jsonb_build_object(
      'status', 'ok',
      'action', 'moved',
      'board_item_id', v_existing_item_id,
      'resolved_board_id', v_board_id,
      'resolved_stage_id', v_stage_id
    );
  END IF;

  -- Calcular proxima ordem
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_next_ordem
  FROM board_items bi
  WHERE bi.stage_id = v_stage_id;

  INSERT INTO board_items (board_id, contact_id, stage_id, ordem)
  VALUES (v_board_id, p_contact_id, v_stage_id, v_next_ordem)
  RETURNING id INTO v_new_item_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'action', 'linked',
    'board_item_id', v_new_item_id,
    'resolved_board_id', v_board_id,
    'resolved_stage_id', v_stage_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'warning', 'message', SQLERRM);
END;
$$;

-- Permissoes: executar via anon/authenticated/service_role
REVOKE ALL ON FUNCTION public.api_get_one(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_list(UUID, TEXT, INT, INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_insert(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_update(UUID, TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_delete(UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_find_contact_by_phone(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.api_link_contact_to_board(UUID, UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.api_get_one(UUID, TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_list(UUID, TEXT, INT, INT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_insert(UUID, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_update(UUID, TEXT, UUID, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_delete(UUID, TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_find_contact_by_phone(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_link_contact_to_board(UUID, UUID, TEXT, TEXT) TO anon, authenticated, service_role;
