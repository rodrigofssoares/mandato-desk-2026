-- ============================================================================
-- Migration 008: Auditoria de atualização em contatos
-- Adiciona a coluna `atualizado_por` e um trigger que popula automaticamente
-- tanto `updated_at` quanto `atualizado_por` em toda operação de INSERT/UPDATE.
-- Se não houver usuário autenticado (auth.uid() IS NULL), o autor será gravado
-- como "Automação" — cobrindo chamadas feitas via service role, API tokens,
-- webhooks ou edge functions.
-- ============================================================================

-- 1. Coluna de auditoria
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS atualizado_por TEXT;

-- 2. Função que popula updated_at + atualizado_por em UPDATE
CREATE OR REPLACE FUNCTION set_contact_audit_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT nome INTO v_user_name FROM profiles WHERE id = auth.uid();
  END IF;

  NEW.updated_at = now();
  NEW.atualizado_por = COALESCE(v_user_name, 'Automação');
  RETURN NEW;
END;
$$;

-- 3. Função que popula atualizado_por em INSERT (para já exibir quem criou)
CREATE OR REPLACE FUNCTION set_contact_audit_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT nome INTO v_user_name FROM profiles WHERE id = auth.uid();
  END IF;

  NEW.atualizado_por = COALESCE(v_user_name, 'Automação');
  RETURN NEW;
END;
$$;

-- 4. Substituir o trigger antigo de updated_at pelo novo
DROP TRIGGER IF EXISTS contacts_updated_at ON contacts;
DROP TRIGGER IF EXISTS contacts_audit_trigger ON contacts;
DROP TRIGGER IF EXISTS contacts_audit_insert_trigger ON contacts;

CREATE TRIGGER contacts_audit_trigger
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_contact_audit_fields();

CREATE TRIGGER contacts_audit_insert_trigger
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_contact_audit_on_insert();

-- 5. Backfill: marcar contatos existentes que ainda não têm autor como "Automação"
--    Usamos DEFAULT na coluna para evitar disparar o trigger prevent_duplicate_contacts.
ALTER TABLE contacts
  ALTER COLUMN atualizado_por SET DEFAULT 'Automação';
