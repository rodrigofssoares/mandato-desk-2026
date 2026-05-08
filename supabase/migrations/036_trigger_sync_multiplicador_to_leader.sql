-- ============================================================================
-- 036 — Trigger: sync contacts.e_multiplicador → leaders (tipo Multiplicador)
-- ============================================================================
-- Quando um contato tem a flag e_multiplicador marcada como true (na criação
-- ou em update), o trigger cria automaticamente um registro em leaders com
-- leader_type = "Multiplicador" e linka via contacts.leader_id.
--
-- Mantém a checkbox no formulário de contato funcionando como atalho rápido,
-- evitando que o usuário precise navegar pra aba Articuladores manualmente.
--
-- Garantias:
-- - Idempotente: só age se contacts.leader_id IS NULL (não duplica)
-- - Só age quando flag vira true (INSERT com flag=true OU UPDATE de false→true)
-- - Ignora contatos com merged_into != NULL (duplicados/históricos)
-- - SECURITY DEFINER: contorna RLS pra escrever em leaders independente de
--   permissão do usuário no INSERT em leaders
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_multiplicador_to_leader()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leader_id UUID;
  v_multiplicador_type_id UUID;
BEGIN
  -- Só age se flag está true
  IF NEW.e_multiplicador IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Já linkado: não duplica
  IF NEW.leader_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Contato mesclado/histórico: ignora
  IF NEW.merged_into IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Em UPDATE, só age se flag mudou (false → true). Evita recriar quando o
  -- usuário edita outros campos com a flag já true (ex: leader_id resetado
  -- manualmente).
  IF TG_OP = 'UPDATE' AND OLD.e_multiplicador IS NOT DISTINCT FROM NEW.e_multiplicador THEN
    RETURN NEW;
  END IF;

  -- Resolve tipo Multiplicador
  SELECT id INTO v_multiplicador_type_id
  FROM leader_types
  WHERE slug = 'multiplicador'
  LIMIT 1;

  IF v_multiplicador_type_id IS NULL THEN
    RAISE WARNING 'sync_multiplicador_to_leader: leader_type "multiplicador" não encontrado, trigger noop';
    RETURN NEW;
  END IF;

  INSERT INTO leaders (
    nome,
    leader_type_id,
    whatsapp,
    phone,
    email,
    instagram,
    birth_date,
    address,
    neighborhoods,
    city,
    active,
    created_by
  )
  VALUES (
    NEW.nome,
    v_multiplicador_type_id,
    NEW.whatsapp,
    NEW.telefone,
    NEW.email,
    NEW.instagram,
    NEW.data_nascimento,
    NEW.logradouro,
    CASE WHEN NEW.bairro IS NOT NULL AND length(trim(NEW.bairro)) > 0
         THEN ARRAY[NEW.bairro]
         ELSE NULL
    END,
    NEW.cidade,
    true,
    NEW.created_by
  )
  RETURNING id INTO v_leader_id;

  -- BEFORE trigger: alteração em NEW propaga pro INSERT/UPDATE original
  NEW.leader_id := v_leader_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_multiplicador_to_leader ON contacts;

CREATE TRIGGER trg_sync_multiplicador_to_leader
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION sync_multiplicador_to_leader();

COMMENT ON FUNCTION sync_multiplicador_to_leader() IS
  'Auto-cria leader (tipo Multiplicador) e linka contacts.leader_id quando contacts.e_multiplicador vira true. Idempotente. Ver migration 036.';
