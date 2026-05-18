-- ============================================================================
-- Migration 076: Proteção CRÍTICA do consentimento LGPD (opt-in WhatsApp)
-- ============================================================================
-- CRÍTICA-1: optin_whatsapp era coluna comum — qualquer atendente autenticado
-- fazia UPDATE direto via PATCH/supabase-js e marcava optin=true sem controle.
-- Todo o broadcast "confia" nesse flag = controle de consentimento furado.
--
-- Solução:
--   a) Função SECURITY DEFINER `registrar_optin_whatsapp` — único caminho
--      permitido para alterar optin_whatsapp / optin_data / optin_origem.
--   b) Trigger BEFORE UPDATE em contacts que BLOQUEIA qualquer alteração
--      direta dessas 3 colunas a não ser que venha da função (via GUC local).
--   c) Constraint NOT NULL em optin_data quando optin_whatsapp = true
--      (verificado na função — UPDATE extra nunca ignora a data).
--
-- A função exige:
--   - optin_whatsapp = true  → optin_data = now(), optin_origem obrigatório
--   - optin_whatsapp = false → optin_data = null, optin_origem = null
--
-- Referência: RAQ-MAND-EM073 — Hardening Fase 6 / CRÍTICA-1
-- ============================================================================

-- ─── 1. Função SECURITY DEFINER ───────────────────────────────────────────────
-- Executa como o papel do schema owner (superuser / service_role).
-- Usa `SET LOCAL app.optin_via_funcao = 'on'` para sinalizar ao trigger.

CREATE OR REPLACE FUNCTION public.registrar_optin_whatsapp(
  p_contact_id UUID,
  p_valor      BOOLEAN,
  p_origem     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem_valida TEXT;
BEGIN
  -- Valida origem se opt-in = true (obrigatório)
  IF p_valor = true THEN
    IF p_origem IS NULL OR p_origem NOT IN ('manual', 'formulario', 'mensagem') THEN
      RAISE EXCEPTION 'registrar_optin_whatsapp: p_origem inválida ou ausente (use manual|formulario|mensagem) — got: %', p_origem
        USING ERRCODE = '22023';
    END IF;
    v_origem_valida := p_origem;
  ELSE
    -- Revogar: origem e data sempre null
    v_origem_valida := NULL;
  END IF;

  -- Sinaliza ao trigger que esta alteração é legítima
  PERFORM set_config('app.optin_via_funcao', 'on', true); -- true = local (transação)

  UPDATE public.contacts
  SET
    optin_whatsapp = p_valor,
    optin_data     = CASE WHEN p_valor THEN now() ELSE NULL END,
    optin_origem   = v_origem_valida
  WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registrar_optin_whatsapp: contato % não encontrado', p_contact_id
      USING ERRCODE = '02000';
  END IF;

  -- Limpa o GUC após o UPDATE (defensivo — embora set_config LOCAL já expire na transação)
  PERFORM set_config('app.optin_via_funcao', 'off', true);

END;
$$;

COMMENT ON FUNCTION public.registrar_optin_whatsapp(UUID, BOOLEAN, TEXT) IS
  'Único caminho autorizado para alterar optin_whatsapp/optin_data/optin_origem em contacts. '
  'Garante: opt-in=true sempre tem data+origem; revogação zera data+origem. '
  'Usa GUC local app.optin_via_funcao=on para bypassar o trigger de proteção. '
  'SECURITY DEFINER: executa com privilégios elevados independente do chamador. '
  'Referência: RAQ-MAND-EM073 CRÍTICA-1.';

-- GRANT EXECUTE para usuários autenticados (chamado via supabase.rpc)
GRANT EXECUTE ON FUNCTION public.registrar_optin_whatsapp(UUID, BOOLEAN, TEXT) TO authenticated;

-- ─── 2. Trigger de proteção — BLOQUEIA UPDATE direto nas colunas LGPD ─────────

CREATE OR REPLACE FUNCTION public.trg_bloquear_optin_direto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se a alteração vier da função autorizada (GUC local = 'on'), permite.
  IF current_setting('app.optin_via_funcao', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Detecta se alguma das 3 colunas LGPD foi alterada
  IF (NEW.optin_whatsapp IS DISTINCT FROM OLD.optin_whatsapp)
     OR (NEW.optin_data IS DISTINCT FROM OLD.optin_data)
     OR (NEW.optin_origem IS DISTINCT FROM OLD.optin_origem)
  THEN
    RAISE EXCEPTION
      'Alteração direta de optin_whatsapp/optin_data/optin_origem bloqueada. '
      'Use a função registrar_optin_whatsapp(contact_id, valor, origem).'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_bloquear_optin_direto() IS
  'Trigger que bloqueia UPDATE direto nas colunas LGPD de contacts. '
  'Permite apenas quando chamado via registrar_optin_whatsapp (GUC local). '
  'Referência: RAQ-MAND-EM073 CRÍTICA-1.';

-- Remove trigger anterior se existir (idempotência)
DROP TRIGGER IF EXISTS trg_contacts_bloquear_optin ON public.contacts;

CREATE TRIGGER trg_contacts_bloquear_optin
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_bloquear_optin_direto();

COMMENT ON TRIGGER trg_contacts_bloquear_optin ON public.contacts IS
  'BEFORE UPDATE: bloqueia alteração direta de optin_whatsapp/optin_data/optin_origem. '
  'Somente registrar_optin_whatsapp() pode alterar essas colunas (via GUC app.optin_via_funcao). '
  'Referência: RAQ-MAND-EM073 CRÍTICA-1.';

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 076: '
    'Função registrar_optin_whatsapp criada (SECURITY DEFINER, GRANT authenticated). '
    'Trigger trg_contacts_bloquear_optin instalado (BEFORE UPDATE em contacts). '
    'Colunas optin_whatsapp/optin_data/optin_origem protegidas contra UPDATE direto. '
    'Referência: RAQ-MAND-EM073 CRÍTICA-1.';
END
$$;
