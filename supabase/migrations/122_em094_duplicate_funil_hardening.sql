-- ========================================================================
-- 122_em094_duplicate_funil_hardening.sql  [RAQ-MAND-EM094]
-- Hardening da RPC duplicate_board após auditoria de segurança:
--   1. (ALTO) Checa is_user_active — bloqueia usuário PENDENTE/INATIVO com
--      JWT ainda válido de executar a duplicação (invariante do projeto).
--   2. (MÉDIO) search_path = '' + nomes qualificados public.* — alinha ao
--      padrão de hardening do projeto (migrations 098-106).
--   3. (MÉDIO) Guard de volume — evita DoS ao copiar funil gigante.
--
-- Também endurece has_permission com search_path = '' + nomes qualificados:
-- como duplicate_board roda com search_path vazio e chama has_permission
-- internamente, a função precisa ser auto-contida (senão "profiles" não
-- resolve). Mudança é comportamentalmente idêntica — apenas qualifica tabelas.
-- ========================================================================

CREATE OR REPLACE FUNCTION has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  _role TEXT;
  _perm RECORD;
BEGIN
  SELECT role INTO _role FROM public.profiles WHERE id = _user_id;
  IF _role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF _role = 'admin' THEN
    RETURN TRUE;
  END IF;

  SELECT * INTO _perm
  FROM public.permissoes_perfil
  WHERE permissoes_perfil.role = _role
    AND secao = _module;

  IF _perm IS NULL THEN
    RETURN FALSE;
  END IF;

  CASE _action
    WHEN 'ver' THEN RETURN _perm.pode_ver;
    WHEN 'criar' THEN RETURN _perm.pode_criar;
    WHEN 'editar' THEN RETURN _perm.pode_editar;
    WHEN 'deletar' THEN RETURN _perm.pode_deletar;
    WHEN 'deletar_em_massa' THEN RETURN _perm.pode_deletar_em_massa;
    WHEN 'duplicar' THEN RETURN _perm.pode_duplicar;
    ELSE RETURN FALSE;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION duplicate_board(
  p_source_board_id UUID,
  p_copy_contacts   BOOLEAN DEFAULT FALSE
)
RETURNS boards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid          UUID := auth.uid();
  _role         TEXT;
  _src          public.boards%ROWTYPE;
  _new_board    public.boards%ROWTYPE;
  _stage        RECORD;
  _new_stage_id UUID;
  _item         RECORD;
  _new_item_id  UUID;
  _item_count   INTEGER;
BEGIN
  -- 1. Autenticação
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  -- 2. Usuário ativo (padrão do projeto — bloqueia PENDENTE/INATIVO)
  IF NOT public.is_user_active(_uid) THEN
    RAISE EXCEPTION 'Usuário inativo' USING ERRCODE = '42501';
  END IF;

  -- 3. Autorização (admin OU permissão 'duplicar' na seção board)
  SELECT role INTO _role FROM public.profiles WHERE id = _uid;
  IF _role IS DISTINCT FROM 'admin'
     AND NOT public.has_permission(_uid, 'board', 'duplicar') THEN
    RAISE EXCEPTION 'Sem permissão para duplicar funis' USING ERRCODE = '42501';
  END IF;

  -- 4. Funil de origem
  SELECT * INTO _src FROM public.boards WHERE id = p_source_board_id;
  IF _src.id IS NULL THEN
    RAISE EXCEPTION 'Funil de origem não encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- 5. Guard de volume (só quando copia contatos) — evita DoS / timeout
  IF p_copy_contacts THEN
    SELECT COUNT(*) INTO _item_count
    FROM public.board_items WHERE board_id = p_source_board_id;
    IF _item_count > 50000 THEN
      RAISE EXCEPTION
        'Funil com % contatos é grande demais para duplicar com cópia. Duplique sem contatos e reposicione manualmente.',
        _item_count
        USING ERRCODE = '54000';
    END IF;
  END IF;

  -- 6. Novo funil (nunca herda is_default; sufixo " (cópia)")
  INSERT INTO public.boards (nome, descricao, tipo_entidade, is_default, created_by)
  VALUES (_src.nome || ' (cópia)', _src.descricao, _src.tipo_entidade, FALSE, _uid)
  RETURNING * INTO _new_board;

  -- 7. Estágios + filhos (templates, checklist, anexos) + contatos opcionais
  FOR _stage IN
    SELECT * FROM public.board_stages WHERE board_id = p_source_board_id ORDER BY ordem
  LOOP
    INSERT INTO public.board_stages (board_id, nome, ordem, cor)
    VALUES (_new_board.id, _stage.nome, _stage.ordem, _stage.cor)
    RETURNING id INTO _new_stage_id;

    -- Templates de mensagem da etapa
    INSERT INTO public.stage_message_templates (stage_id, titulo, conteudo, ordem, created_by)
    SELECT _new_stage_id, titulo, conteudo, ordem, _uid
    FROM public.stage_message_templates
    WHERE stage_id = _stage.id;

    -- Checklist: itens + anexos (anexos referenciam o mesmo storage_path)
    FOR _item IN
      SELECT * FROM public.stage_checklist_items WHERE stage_id = _stage.id
    LOOP
      INSERT INTO public.stage_checklist_items (stage_id, texto, descricao, ordem, created_by)
      VALUES (_new_stage_id, _item.texto, _item.descricao, _item.ordem, _uid)
      RETURNING id INTO _new_item_id;

      INSERT INTO public.stage_checklist_attachments
        (item_id, tipo, storage_path, url_externa, nome_original, mime_type, tamanho_bytes, rotulo, ordem)
      SELECT _new_item_id, tipo, storage_path, url_externa, nome_original, mime_type, tamanho_bytes, rotulo, ordem
      FROM public.stage_checklist_attachments
      WHERE item_id = _item.id;
    END LOOP;

    -- Contatos posicionados (opcional). moved_at = agora (entrada no novo funil).
    IF p_copy_contacts THEN
      INSERT INTO public.board_items (board_id, stage_id, contact_id, ordem, moved_at)
      SELECT _new_board.id, _new_stage_id, contact_id, ordem, now()
      FROM public.board_items
      WHERE board_id = p_source_board_id
        AND stage_id = _stage.id;
    END IF;
  END LOOP;

  RETURN _new_board;
END;
$$;

GRANT EXECUTE ON FUNCTION duplicate_board(UUID, BOOLEAN) TO authenticated;
