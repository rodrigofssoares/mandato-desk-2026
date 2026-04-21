-- RAQ-MAND-EM026: ajusta api_link_contact_to_board para nao filtrar boards
-- por created_by. Os boards no sistema usam RBAC via has_permission, nao
-- isolamento por usuario. Boards com created_by NULL (ex: seeds) sao
-- visiveis na UI e tambem devem funcionar na API.

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
BEGIN
  IF p_board_ref IS NULL OR LENGTH(p_board_ref) = 0 THEN
    RETURN jsonb_build_object('status', 'warning', 'message', 'board nao informado');
  END IF;

  -- Resolver board_id (sem filtro de created_by — RBAC cuida do acesso)
  v_is_uuid := p_board_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF v_is_uuid THEN
    SELECT b.id INTO v_board_id
    FROM boards b
    WHERE b.id = p_board_ref::uuid;
  ELSE
    SELECT COUNT(*) INTO v_board_count
    FROM boards b
    WHERE b.nome ILIKE p_board_ref;

    IF v_board_count > 1 THEN
      RETURN jsonb_build_object(
        'status', 'warning',
        'ambiguous', true,
        'message', format('nome de board ambiguo (%s encontrados) — informe o UUID em board_id', v_board_count)
      );
    END IF;

    SELECT b.id INTO v_board_id
    FROM boards b
    WHERE b.nome ILIKE p_board_ref
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

  -- Resolver stage_id (escopado ao board)
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
