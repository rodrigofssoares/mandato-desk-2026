-- ============================================================================
-- 050 — Trigger prevent_duplicate_contacts: skip quando whatsapp não mudou
-- ============================================================================
-- Bug [RAQ-MAND-EM071]: contatos com whatsapp duplicado legacy (18 documentados
-- no comentário da migration 037) bloqueavam qualquer UPDATE — incluindo
-- updates de etiquetas, observações, etc. — porque a trigger
-- trg_prevent_duplicate_contacts dispara RAISE EXCEPTION sempre que detecta
-- outro contato com o mesmo whatsapp, sem checar se o whatsapp realmente
-- mudou nesse UPDATE.
--
-- Caso real: contato "Érika Rímoli Mota da Silva" não conseguia salvar
-- novas etiquetas. O cliente nem chegava no contact_tags porque a UPDATE
-- na tabela contacts (logActivity / updated_at / atualizado_por etc.)
-- batia primeiro na trigger.
--
-- Fix: a trigger só faz sentido como prevenção de CRIAÇÃO de novas
-- duplicatas, não como rejeição de duplicatas pré-existentes. Quando
-- OLD.whatsapp = NEW.whatsapp (whatsapp não está mudando), a checagem é
-- pulada. Insert continua sendo verificado normalmente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_duplicate_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Linhas sendo soft-deletadas (merge) saem do escopo de unicidade.
  IF NEW.merged_into IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- UPDATE em que o whatsapp não está mudando: duplicata é pré-existente
  -- e não é responsabilidade deste UPDATE. Pula a checagem pra não bloquear
  -- updates legítimos (etiquetas, observações, ranking, etc).
  IF TG_OP = 'UPDATE' AND OLD.whatsapp IS NOT DISTINCT FROM NEW.whatsapp THEN
    RETURN NEW;
  END IF;

  IF NEW.whatsapp IS NOT NULL AND NEW.whatsapp <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.contacts
      WHERE whatsapp = NEW.whatsapp
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND merged_into IS NULL
    ) THEN
      RAISE EXCEPTION 'Contato com este WhatsApp já existe';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_duplicate_contacts() IS
  'Bloqueia inserts/updates que CRIARIAM novas duplicatas de whatsapp. Pula quando whatsapp não muda no UPDATE (duplicata legacy não é problema deste update) ou quando NEW está sendo soft-deletado (merged_into NOT NULL).';
