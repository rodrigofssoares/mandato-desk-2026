-- ============================================================================
-- Migration 053: Matching reverso contato -> chat Z-API
-- ============================================================================
-- Bug [RAQ-MAND-EM072]: o botao "Adicionar no CRM" cria um contato com o
-- whatsapp do chat, mas zapi_chats.contact_id continuava NULL — o nome salvo
-- nunca aparecia na lista de conversas (a lista exibia o telefone).
--
-- Causa: a migration 047 instalou apenas o matching DIRETO (zapi_chats ->
-- contacts): o trigger trg_zapi_chats_match_contact dispara em escrita de
-- zapi_chats. Nao existe o caminho REVERSO — criar ou editar o whatsapp de um
-- contato nunca religava os chats Z-API ja existentes.
--
-- Fix: trigger AFTER INSERT OR UPDATE OF whatsapp em contacts que religa os
-- chats orfaos (contact_id IS NULL) cujo phone tenha os mesmos 10 ultimos
-- digitos (DDD + numero). Espelha a logica de zapi_match_contact() (047).
--
-- Nao ha recursao: este trigger faz UPDATE de zapi_chats.contact_id, enquanto
-- trg_zapi_chats_match_contact so dispara em UPDATE OF phone.
--
-- Rollback:
--   DROP TRIGGER trg_contacts_match_zapi_chat ON public.contacts;
--   DROP FUNCTION public.zapi_match_chat_on_contact();
-- ============================================================================

-- ── 1. Funcao de matching reverso ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.zapi_match_chat_on_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_whatsapp_norm TEXT;
  v_whatsapp_tail TEXT;
BEGIN
  v_whatsapp_norm := normalize_phone(COALESCE(NEW.whatsapp, ''));

  -- Sem whatsapp utilizavel (curto demais): nada a religar.
  IF length(v_whatsapp_norm) < 10 THEN
    RETURN NEW;
  END IF;

  v_whatsapp_tail := right(v_whatsapp_norm, 10);

  -- Religa chats orfaos cujo phone bata pelos 10 ultimos digitos.
  -- zapi_chats tem poucas dezenas de linhas — full scan e irrelevante.
  -- O guard contact_id IS NULL evita "roubar" um chat ja vinculado.
  UPDATE public.zapi_chats z
     SET contact_id = NEW.id
   WHERE z.contact_id IS NULL
     AND length(normalize_phone(z.phone)) >= 10
     AND right(normalize_phone(z.phone), 10) = v_whatsapp_tail;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.zapi_match_chat_on_contact() IS
  'Trigger reverso (contacts -> zapi_chats): ao criar ou editar o whatsapp de '
  'um contato, vincula chats Z-API orfaos com o mesmo numero. Complementa '
  'zapi_match_contact() (047), que so cobre o sentido zapi_chats -> contacts.';

-- ── 2. Trigger ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_contacts_match_zapi_chat ON public.contacts;

CREATE TRIGGER trg_contacts_match_zapi_chat
  AFTER INSERT OR UPDATE OF whatsapp ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.zapi_match_chat_on_contact();

-- ── 3. Backfill: religa chats orfaos com contatos ja existentes ────────────
-- Cobre os chats que ficaram sem contact_id antes deste trigger existir
-- (incluindo contatos criados pelo botao "Adicionar no CRM" durante os testes).
UPDATE public.zapi_chats z
   SET contact_id = c.id
  FROM public.contacts c
 WHERE z.contact_id IS NULL
   AND c.whatsapp IS NOT NULL
   AND c.merged_into IS NULL
   AND length(normalize_phone(z.phone)) >= 10
   AND length(normalize_phone(c.whatsapp)) >= 10
   AND right(normalize_phone(z.phone), 10) = right(normalize_phone(c.whatsapp), 10);
