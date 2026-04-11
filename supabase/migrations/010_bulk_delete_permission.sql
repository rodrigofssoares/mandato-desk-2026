-- ========================================================================
-- 009_bulk_delete_permission.sql
-- Adiciona a permissão granular "pode_deletar_em_massa" na matriz de
-- permissões por cargo. Esta é uma permissão adicional a pode_deletar:
-- mesmo que o cargo possa deletar registros individualmente, só fará
-- operações em massa se esta flag estiver habilitada.
-- ========================================================================

ALTER TABLE permissoes_perfil
  ADD COLUMN IF NOT EXISTS pode_deletar_em_massa BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill: admin e proprietario ganham bulk delete em todas as seções onde
-- já podiam deletar. Demais cargos permanecem em FALSE (comportamento seguro).
UPDATE permissoes_perfil
SET pode_deletar_em_massa = TRUE
WHERE role IN ('admin', 'proprietario')
  AND pode_deletar = TRUE;

-- Atualiza o helper has_permission para reconhecer a nova ação 'deletar_em_massa'.
-- Mantém assinatura original: has_permission(_user_id uuid, _module text, _action text)
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
    ELSE RETURN FALSE;
  END CASE;
END;
$$;
