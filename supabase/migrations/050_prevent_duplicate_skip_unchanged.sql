-- ============================================================================
-- 050 - Trigger prevent_duplicate_contacts: skip quando whatsapp nao mudou
-- ============================================================================
-- Bug [RAQ-MAND-EM071]: contatos com whatsapp duplicado legacy (18 documentados
-- no comentario da migration 037) bloqueavam qualquer UPDATE - incluindo
-- updates de etiquetas, observacoes, etc. - porque a trigger
-- trg_prevent_duplicate_contacts dispara RAISE EXCEPTION sempre que detecta
-- outro contato com o mesmo whatsapp, sem checar se o whatsapp realmente
-- mudou nesse UPDATE.
--
-- Caso real: contato "Erika Rimoli Mota da Silva" nao conseguia salvar
-- novas etiquetas. O cliente nem chegava no contact_tags porque a UPDATE
-- na tabela contacts (logActivity / updated_at / atualizado_por etc.)
-- batia primeiro na trigger.
--
-- Fix: a trigger so faz sentido como prevencao de CRIACAO de novas
-- duplicatas, nao como rejeicao de duplicatas pre-existentes. Quando
-- OLD.whatsapp = NEW.whatsapp (whatsapp nao esta mudando), a checagem e
-- pulada. Insert continua sendo verificado normalmente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_duplicate_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Linhas sendo soft-deletadas (merge) saem do escopo de unicidade.
  IF NEW.merged_into IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- UPDATE em que o whatsapp nao esta mudando: duplicata e pre-existente
  -- e nao e responsabilidade deste UPDATE. Pula a checagem pra nao bloquear
  -- updates legitimos (etiquetas, observacoes, ranking, etc).
  IF TG_OP = 'UPDATE' AND OLD.whatsapp IS NOT DISTINCT FROM NEW.whatsapp THEN
    RETURN NEW;
  END IF;

  IF NEW.whatsapp IS NOT NULL AND NEW.whatsapp != '' THEN
    IF EXISTS (
      SELECT 1 FROM public.contacts
      WHERE whatsapp = NEW.whatsapp
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND merged_into IS NULL
    ) THEN
      RAISE EXCEPTION 'Contato com este WhatsApp ja existe';
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

COMMENT ON FUNCTION public.prevent_duplicate_contacts() IS
  'Bloqueia inserts/updates que CRIARIAM novas duplicatas de whatsapp. Pula quando whatsapp nao muda no UPDATE (duplicata legacy nao e problema deste update) ou quando NEW esta sendo soft-deletado (merged_into NOT NULL).';
