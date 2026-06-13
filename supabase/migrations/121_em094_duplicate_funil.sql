-- ========================================================================
-- 121_em094_duplicate_funil.sql  [RAQ-MAND-EM094]
-- Duplicação de funis (boards) preservando toda a estrutura.
--
-- 1. Nova permissão granular "pode_duplicar" na matriz de permissões
--    (espelha o padrão de 010_bulk_delete_permission.sql / pode_deletar_em_massa).
-- 2. has_permission() passa a reconhecer a ação 'duplicar'.
-- 3. RPC duplicate_board() — SECURITY DEFINER, atômica: copia o board, seus
--    estágios, templates de mensagem, checklist (itens + anexos) e,
--    opcionalmente, os contatos posicionados. O novo funil recebe o sufixo
--    " (cópia)" no nome para o responsável renomear depois.
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. Coluna pode_duplicar (aditiva, default seguro FALSE)
-- ------------------------------------------------------------------------
ALTER TABLE permissoes_perfil
  ADD COLUMN IF NOT EXISTS pode_duplicar BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: quem já pode CRIAR funis ganha o direito de duplicar.
-- Restrito à seção 'board' (duplicar funil é uma ação específica de funis).
UPDATE permissoes_perfil
SET pode_duplicar = TRUE
WHERE secao = 'board'
  AND pode_criar = TRUE;

-- ------------------------------------------------------------------------
-- 2. has_permission reconhece a ação 'duplicar'
--    Mantém a assinatura original has_permission(uuid, text, text).
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  _role TEXT;
  _perm RECORD;
BEGIN
  SELECT role INTO _role FROM profiles WHERE id = _user_id;
  IF _role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF _role = 'admin' THEN
    RETURN TRUE;
  END IF;

  SELECT * INTO _perm
  FROM permissoes_perfil
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

-- ------------------------------------------------------------------------
-- 3. RPC duplicate_board
--    SECURITY DEFINER para conseguir copiar todas as tabelas filhas numa
--    única transação. A autorização é checada manualmente via has_permission.
--    Retorna a linha completa do novo funil.
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION duplicate_board(
  p_source_board_id UUID,
  p_copy_contacts   BOOLEAN DEFAULT FALSE
)
RETURNS boards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid          UUID := auth.uid();
  _role         TEXT;
  _src          boards%ROWTYPE;
  _new_board    boards%ROWTYPE;
  _stage        RECORD;
  _new_stage_id UUID;
  _item         RECORD;
  _new_item_id  UUID;
BEGIN
  -- 3.1 Autenticação
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  -- 3.2 Autorização (admin OU permissão 'duplicar' na seção board)
  SELECT role INTO _role FROM profiles WHERE id = _uid;
  IF _role IS DISTINCT FROM 'admin'
     AND NOT has_permission(_uid, 'board', 'duplicar') THEN
    RAISE EXCEPTION 'Sem permissão para duplicar funis' USING ERRCODE = '42501';
  END IF;

  -- 3.3 Funil de origem
  SELECT * INTO _src FROM boards WHERE id = p_source_board_id;
  IF _src.id IS NULL THEN
    RAISE EXCEPTION 'Funil de origem não encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- 3.4 Novo funil (nunca herda is_default; sufixo " (cópia)")
  INSERT INTO boards (nome, descricao, tipo_entidade, is_default, created_by)
  VALUES (_src.nome || ' (cópia)', _src.descricao, _src.tipo_entidade, FALSE, _uid)
  RETURNING * INTO _new_board;

  -- 3.5 Estágios + filhos (templates, checklist, anexos) + contatos opcionais
  FOR _stage IN
    SELECT * FROM board_stages WHERE board_id = p_source_board_id ORDER BY ordem
  LOOP
    INSERT INTO board_stages (board_id, nome, ordem, cor)
    VALUES (_new_board.id, _stage.nome, _stage.ordem, _stage.cor)
    RETURNING id INTO _new_stage_id;

    -- Templates de mensagem da etapa
    INSERT INTO stage_message_templates (stage_id, titulo, conteudo, ordem, created_by)
    SELECT _new_stage_id, titulo, conteudo, ordem, _uid
    FROM stage_message_templates
    WHERE stage_id = _stage.id;

    -- Checklist: itens + anexos (anexos referenciam o mesmo storage_path)
    FOR _item IN
      SELECT * FROM stage_checklist_items WHERE stage_id = _stage.id
    LOOP
      INSERT INTO stage_checklist_items (stage_id, texto, descricao, ordem, created_by)
      VALUES (_new_stage_id, _item.texto, _item.descricao, _item.ordem, _uid)
      RETURNING id INTO _new_item_id;

      INSERT INTO stage_checklist_attachments
        (item_id, tipo, storage_path, url_externa, nome_original, mime_type, tamanho_bytes, rotulo, ordem)
      SELECT _new_item_id, tipo, storage_path, url_externa, nome_original, mime_type, tamanho_bytes, rotulo, ordem
      FROM stage_checklist_attachments
      WHERE item_id = _item.id;
    END LOOP;

    -- Contatos posicionados (opcional). moved_at = agora (entrada no novo funil).
    IF p_copy_contacts THEN
      INSERT INTO board_items (board_id, stage_id, contact_id, ordem, moved_at)
      SELECT _new_board.id, _new_stage_id, contact_id, ordem, now()
      FROM board_items
      WHERE board_id = p_source_board_id
        AND stage_id = _stage.id;
    END IF;
  END LOOP;

  RETURN _new_board;
END;
$$;

GRANT EXECUTE ON FUNCTION duplicate_board(UUID, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION duplicate_board(UUID, BOOLEAN) IS
  'EM094: duplica um funil (board) com estágios, templates, checklist e anexos. p_copy_contacts opcionalmente copia os contatos posicionados. Novo nome recebe sufixo " (cópia)".';

COMMENT ON COLUMN permissoes_perfil.pode_duplicar IS
  'EM094: permite duplicar funis (ação "duplicar" na seção board).';
