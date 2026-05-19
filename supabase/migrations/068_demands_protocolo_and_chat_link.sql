-- ============================================================================
-- Migration 068: Protocolo em demands + demand_id em zapi_chats (C18)
-- ============================================================================
-- Objetivo: Habilitar o protocolo público de demanda (MAND-XXXXXX) e
-- vincular conversas WhatsApp à demanda correspondente.
--
-- Mudanças:
--   demands:
--     - Sequence demands_protocolo_seq (numeração incremental)
--     - Coluna protocolo TEXT UNIQUE (gerado pelo trigger no INSERT)
--     - Trigger set_demand_protocolo: preenche protocolo automaticamente
--     - UPDATE retroativo: preenche protocolo em registros existentes
--   zapi_chats:
--     - Coluna demand_id UUID REFERENCES demands(id) ON DELETE SET NULL
--     - Índice parcial para queries de vínculo
--
-- Idempotência: CREATE SEQUENCE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
-- trigger com DROP IF EXISTS + CREATE, ADD COLUMN IF NOT EXISTS.
-- Referência: RAQ-MAND-EM073 — T60 (Fase 6 Onda A)
-- ============================================================================

-- ─── 1. Sequence para protocolo ──────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.demands_protocolo_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

COMMENT ON SEQUENCE public.demands_protocolo_seq IS
  'Numeração incremental para protocolos de demanda no formato MAND-XXXXXX. '
  'Gerenciada pelo trigger set_demand_protocolo em demands. '
  'Referência: T60 / Fase 6 Onda A.';

-- ─── 2. Coluna protocolo em demands ──────────────────────────────────────────

ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS protocolo TEXT;

-- Constraint UNIQUE adicionada separadamente para idempotência
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.demands'::regclass
      AND conname  = 'demands_protocolo_key'
  ) THEN
    ALTER TABLE public.demands ADD CONSTRAINT demands_protocolo_key UNIQUE (protocolo);
  END IF;
END
$$;

COMMENT ON COLUMN public.demands.protocolo IS
  'Número de protocolo público da demanda, formato MAND-XXXXXX (ex: MAND-000042). '
  'Gerado automaticamente pelo trigger set_demand_protocolo no INSERT. '
  'Exibido ao eleitor nas mensagens de retorno automático (C18). '
  'Referência: T60 / Fase 6 Onda A.';

-- ─── 3. Trigger de geração de protocolo ──────────────────────────────────────

-- Função do trigger
CREATE OR REPLACE FUNCTION public.fn_set_demand_protocolo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só preenche se ainda não tem protocolo (segurança de idempotência)
  IF NEW.protocolo IS NULL THEN
    NEW.protocolo := 'MAND-' || LPAD(nextval('public.demands_protocolo_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_set_demand_protocolo() IS
  'Gera protocolo no formato MAND-XXXXXX ao inserir nova demanda. '
  'Usa a sequence demands_protocolo_seq. SECURITY DEFINER para acessar '
  'a sequence mesmo quando chamado por usuários sem USAGE na sequence. '
  'Referência: T60 / Fase 6 Onda A.';

-- Drop defensivo + criação do trigger
DROP TRIGGER IF EXISTS set_demand_protocolo ON public.demands;

CREATE TRIGGER set_demand_protocolo
  BEFORE INSERT ON public.demands
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_demand_protocolo();

COMMENT ON TRIGGER set_demand_protocolo ON public.demands IS
  'BEFORE INSERT: preenche demands.protocolo via fn_set_demand_protocolo(). '
  'Referência: T60 / Fase 6 Onda A.';

-- ─── 4. Retroativo: preenche protocolo em registros existentes ───────────────
-- Idempotente: WHERE protocolo IS NULL garante que não reprocessa registros
-- que já têm protocolo (ex: em caso de re-run da migration).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.demands WHERE protocolo IS NULL ORDER BY created_at ASC
  LOOP
    UPDATE public.demands
    SET protocolo = 'MAND-' || LPAD(nextval('public.demands_protocolo_seq')::text, 6, '0')
    WHERE id = r.id AND protocolo IS NULL;
  END LOOP;

  RAISE NOTICE 'Protocolos retroativos gerados para registros existentes em demands.';
END
$$;

-- ─── 5. Coluna demand_id em zapi_chats ───────────────────────────────────────

ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS demand_id UUID
  REFERENCES public.demands(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.zapi_chats.demand_id IS
  'Demanda CRM vinculada a esta conversa WhatsApp (N:1 — conversa pode ter 1 demanda). '
  'ON DELETE SET NULL: se a demanda for excluída, o vínculo é removido sem deletar o chat. '
  'Usado pela EF zapi-demand-notify para saber qual chat usar ao enviar retorno automático. '
  'Referência: T60 / Fase 6 Onda A.';

-- ─── 6. Índice para consulta de chats vinculados ─────────────────────────────

CREATE INDEX IF NOT EXISTS idx_zapi_chats_demand_id
  ON public.zapi_chats (demand_id)
  WHERE demand_id IS NOT NULL;

COMMENT ON INDEX public.idx_zapi_chats_demand_id IS
  'Índice parcial em zapi_chats(demand_id) WHERE demand_id IS NOT NULL. '
  'Usado pela EF zapi-demand-notify para buscar o chat vinculado à demanda. '
  'Referência: T60 / Fase 6 Onda A.';

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 068: '
    'demands_protocolo_seq criada, '
    'demands.protocolo (TEXT UNIQUE) adicionada, '
    'trigger set_demand_protocolo criado (BEFORE INSERT), '
    'protocolos retroativos gerados, '
    'zapi_chats.demand_id (UUID FK → demands) adicionada, '
    'idx_zapi_chats_demand_id criado. '
    'Referência: T60 Fase 6 Onda A.';
END
$$;
