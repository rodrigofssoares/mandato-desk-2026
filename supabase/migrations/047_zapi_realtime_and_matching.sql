-- ============================================================================
-- Migration 047: Realtime publication + matching automático chat → contato
-- ============================================================================
-- Two changes related to the Conversas feature:
--   1. T09 — Trigger BEFORE INSERT/UPDATE em zapi_chats que preenche
--      contact_id automaticamente quando o phone do chat bate com
--      contacts.whatsapp (matching por dígitos, tolerante a +55).
--   2. T07 — Adiciona zapi_chats e zapi_messages à publicação Realtime
--      pra que o frontend receba INSERT/UPDATE em tempo real.
--
-- Reference: RAQ-MAND-EM051 — T07 + T09.
-- Rollback:
--   DROP TRIGGER trg_zapi_chats_match_contact ON public.zapi_chats;
--   DROP FUNCTION public.zapi_match_contact();
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.zapi_chats;
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.zapi_messages;
-- ============================================================================

-- ── 1. Função de matching ──────────────────────────────────────────────────
-- Estratégia: comparar os 10 últimos dígitos (DDD + número, sem DDI).
-- Cobre os 3 casos típicos:
--   - contact.whatsapp "+55 (11) 99999-9999"  → 5511999999999
--   - contact.whatsapp "(11) 99999-9999"       →   11999999999
--   - phone Z-API     "5511999999999"          → 5511999999999
-- Fixar last 10 evita falsos positivos em DDIs estrangeiros e padroniza
-- o caso brasileiro (DDD 2 + número 8 = 10 dígitos é o mínimo confiável).

CREATE OR REPLACE FUNCTION public.zapi_match_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_phone_norm TEXT;
  v_phone_tail TEXT;
  v_contact_id UUID;
BEGIN
  v_phone_norm := normalize_phone(COALESCE(NEW.phone, ''));

  -- Telefones muito curtos não fazem match (evita false positives e bugs)
  IF length(v_phone_norm) < 10 THEN
    RETURN NEW;
  END IF;

  v_phone_tail := right(v_phone_norm, 10);

  SELECT id
    INTO v_contact_id
    FROM public.contacts
   WHERE whatsapp IS NOT NULL
     AND length(normalize_phone(whatsapp)) >= 10
     AND right(normalize_phone(whatsapp), 10) = v_phone_tail
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_contact_id IS NOT NULL THEN
    NEW.contact_id := v_contact_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.zapi_match_contact() IS
  'Trigger function — vincula zapi_chats.contact_id ao contato CRM cujo whatsapp '
  'tenha os mesmos 10 últimos dígitos (DDD + número). SECURITY DEFINER pra que '
  'a EF (que escreve via service_role) consiga ler contacts respeitando search_path fixo.';

-- ── 2. Trigger ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_zapi_chats_match_contact ON public.zapi_chats;

CREATE TRIGGER trg_zapi_chats_match_contact
  BEFORE INSERT OR UPDATE OF phone ON public.zapi_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.zapi_match_contact();

-- ── 3. Realtime publication ───────────────────────────────────────────────
-- ALTER PUBLICATION ADD TABLE falha se a tabela já estiver na publicação;
-- envolvemos em DO blocks pra ser idempotente.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.zapi_chats;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.zapi_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- ── 4. Backfill: chats já existentes que ficaram sem contact_id ───────────
-- Útil porque o foundation slice rodou ANTES deste trigger existir; qualquer
-- chat criado pelo zapi-send-text até aqui tem contact_id NULL mesmo se o
-- contato existe. Reroda o matching uma vez.

UPDATE public.zapi_chats AS z
   SET contact_id = c.id
  FROM public.contacts AS c
 WHERE z.contact_id IS NULL
   AND c.whatsapp IS NOT NULL
   AND length(normalize_phone(z.phone)) >= 10
   AND length(normalize_phone(c.whatsapp)) >= 10
   AND right(normalize_phone(z.phone), 10) = right(normalize_phone(c.whatsapp), 10);
