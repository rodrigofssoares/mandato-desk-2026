-- A trigger prevent_duplicate_contacts checava unicidade em TODA insercao/
-- atualizacao em contacts, inclusive quando o proprio registro estava sendo
-- soft-deletado via merged_into = winner.id. Como o whatsapp do loser
-- permanece igual no NEW (so muda merged_into), e o winner ainda esta ativo
-- com o mesmo numero, a trigger via dois "duplicados" e abortava com
-- "Contato com este WhatsApp ja existe" — quebrando qualquer mesclagem.
--
-- Fix: se o NEW ja esta sendo marcado como mesclado (merged_into IS NOT NULL),
-- libera. O contato sai do escopo da unicidade ao virar soft-deleted.

CREATE OR REPLACE FUNCTION public.prevent_duplicate_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Permite atualizar livremente registros que estao saindo do escopo
  -- (sendo marcados como mesclados / soft-deleted).
  IF NEW.merged_into IS NOT NULL THEN
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
  'Bloqueia inserts/updates que criariam dois contatos ATIVOS com mesmo whatsapp. Ignora rows ja sendo soft-deletadas (merged_into NOT NULL).';
