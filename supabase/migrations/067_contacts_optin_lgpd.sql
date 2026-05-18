-- ============================================================================
-- Migration 067: Colunas opt-in LGPD em contacts (C24)
-- ============================================================================
-- Objetivo: Registrar consentimento do eleitor para receber mensagens WhatsApp.
-- Pré-requisito para broadcast (C17) — o envio em massa só deve ocorrer para
-- contatos com optin_whatsapp = true.
--
-- Expande tabela contacts (expand-contract — ADD COLUMN nullable, sem downtime):
--   - optin_whatsapp: flag de consentimento (NOT NULL DEFAULT false)
--   - optin_data:     quando o consentimento foi registrado (nullable)
--   - optin_origem:   canal de captura (nullable, CHECK enum)
--
-- RLS: as novas colunas herdam as políticas existentes de contacts.
-- Índice parcial: crítico para performance do broadcast (filtra só os TRUE).
--
-- Idempotência: uso de ADD COLUMN IF NOT EXISTS e CREATE INDEX IF NOT EXISTS.
-- Referência: RAQ-MAND-EM073 — T58 (Fase 6 Onda A)
-- ============================================================================

-- ─── 1. Coluna optin_whatsapp ─────────────────────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS optin_whatsapp BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contacts.optin_whatsapp IS
  'Consentimento LGPD: true = eleitor autorizou receber mensagens WhatsApp. '
  'Filtro obrigatório no broadcast (C17). '
  'Diferente de aceita_whatsapp (preferência de contato), este campo registra '
  'consentimento formal para comunicação em massa. '
  'Referência: T58 / Fase 6 Onda A.';

-- ─── 2. Coluna optin_data ─────────────────────────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS optin_data TIMESTAMPTZ;

COMMENT ON COLUMN public.contacts.optin_data IS
  'Data/hora em que o consentimento (optin_whatsapp) foi registrado. '
  'null = consentimento nunca foi registrado formalmente. '
  'Zerado para null quando optin_whatsapp = false.';

-- ─── 3. Coluna optin_origem ───────────────────────────────────────────────────

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS optin_origem TEXT
  CHECK (optin_origem IS NULL OR optin_origem IN ('manual', 'formulario', 'mensagem'));

COMMENT ON COLUMN public.contacts.optin_origem IS
  'Canal pelo qual o consentimento foi registrado: '
  'manual = atendente registrou na UI, '
  'formulario = capturado via formulário externo, '
  'mensagem = confirmado via resposta do próprio eleitor no WhatsApp. '
  'null quando optin_whatsapp = false.';

-- ─── 4. Índice parcial para performance do broadcast ─────────────────────────
-- Este índice é CRÍTICO: o broadcast (EF zapi-broadcast-create) filtra
-- contacts WHERE optin_whatsapp = true. Sem índice parcial, a query faz
-- full table scan — ineficiente em bases com 50k+ contatos.

CREATE INDEX IF NOT EXISTS idx_contacts_optin_whatsapp
  ON public.contacts (id)
  WHERE optin_whatsapp = true;

COMMENT ON INDEX public.idx_contacts_optin_whatsapp IS
  'Índice parcial em contacts(id) WHERE optin_whatsapp = true. '
  'Usado pelo broadcast (C17) para resolver segmentos sem full scan. '
  'Referência: T58 / Fase 6 Onda A.';

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 067: contacts.optin_whatsapp (BOOLEAN NOT NULL DEFAULT false), '
    'contacts.optin_data (TIMESTAMPTZ nullable), '
    'contacts.optin_origem (TEXT nullable, CHECK enum), '
    'idx_contacts_optin_whatsapp (parcial WHERE optin_whatsapp = true) '
    '— adicionados. Referência: T58 Fase 6 Onda A.';
END
$$;
