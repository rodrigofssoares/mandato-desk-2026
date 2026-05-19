-- ============================================================================
-- Migration 069: Trigger de notificação de status de demanda via EF (C18)
-- ============================================================================
-- Objetivo: Quando o status de uma demanda muda, dispara a EF zapi-demand-notify
-- via pg_net.http_post para enviar mensagem automática ao eleitor no WhatsApp.
--
-- Arquitetura:
--   - Trigger on_demand_status_change: AFTER UPDATE OF status em demands
--   - Chama pg_net.http_post para zapi-demand-notify com payload JSON
--   - Usa CRON_SECRET do Vault (função private.get_cron_secret) para autenticar
--   - URL do projeto hardcoded (pública, não é secret)
--
-- Transições que geram mensagem:
--   open → in_progress: "Seu pedido foi recebido e está sendo analisado"
--   in_progress → resolved: "Seu pedido foi concluído"
--   Outras transições: silencioso (sem envio)
--
-- Idempotência: DROP TRIGGER IF EXISTS + CREATE OR REPLACE FUNCTION.
-- Referência: RAQ-MAND-EM073 — T61 (Fase 6 Onda A)
-- ============================================================================

-- ─── 1. Garante extensões necessárias ────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ─── 2. Função do trigger ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_on_demand_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, vault, pg_catalog
AS $$
DECLARE
  v_cron_secret TEXT;
  v_supabase_url TEXT;
  v_payload JSONB;
BEGIN
  -- Só dispara quando o status realmente mudou
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Só notifica nas transições relevantes (open→in_progress e in_progress→resolved)
  -- Outras transições são silenciosas
  IF NOT (
    (OLD.status = 'open'        AND NEW.status = 'in_progress') OR
    (OLD.status = 'in_progress' AND NEW.status = 'resolved')
  ) THEN
    RETURN NEW;
  END IF;

  -- Lê o CRON_SECRET do Vault (mesma função usada pelo sender de agendamentos)
  BEGIN
    v_cron_secret := private.get_cron_secret();
  EXCEPTION WHEN OTHERS THEN
    -- Se falhar em ler o secret, loga e não bloqueia o UPDATE
    RAISE WARNING 'fn_on_demand_status_change: falha ao ler cron_secret do Vault: %', SQLERRM;
    RETURN NEW;
  END;

  IF v_cron_secret IS NULL OR v_cron_secret = '' THEN
    RAISE WARNING 'fn_on_demand_status_change: cron_secret não configurado no Vault';
    RETURN NEW;
  END IF;

  -- URL do projeto Supabase (pública — não é secret)
  v_supabase_url := 'https://nevgnvrwqaoztefnyqdj.supabase.co';

  -- Monta payload para a EF
  v_payload := jsonb_build_object(
    'demand_id',  NEW.id,
    'old_status', OLD.status,
    'new_status', NEW.status
  );

  -- Dispara chamada HTTP assíncrona via pg_net (não bloqueia o UPDATE)
  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/zapi-demand-notify',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_cron_secret
    ),
    body    := v_payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca deixar o trigger falhar e bloquear o UPDATE na demanda
  RAISE WARNING 'fn_on_demand_status_change: erro inesperado: %. Demand id=%, transição %→%',
    SQLERRM, NEW.id, OLD.status, NEW.status;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_on_demand_status_change() IS
  'Dispara zapi-demand-notify via pg_net quando demands.status muda. '
  'Transições que geram notificação: open→in_progress e in_progress→resolved. '
  'Usa CRON_SECRET do Vault (private.get_cron_secret). '
  'Nunca bloqueia o UPDATE em caso de falha. '
  'Referência: T61 / Fase 6 Onda A.';

-- ─── 3. Trigger AFTER UPDATE OF status ───────────────────────────────────────

DROP TRIGGER IF EXISTS on_demand_status_change ON public.demands;

CREATE TRIGGER on_demand_status_change
  AFTER UPDATE OF status ON public.demands
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_on_demand_status_change();

COMMENT ON TRIGGER on_demand_status_change ON public.demands IS
  'AFTER UPDATE OF status: chama fn_on_demand_status_change() para disparar '
  'notificação WhatsApp ao eleitor via zapi-demand-notify. '
  'Referência: T61 / Fase 6 Onda A.';

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 069: '
    'fn_on_demand_status_change() criada (SECURITY DEFINER, pg_net), '
    'trigger on_demand_status_change criado (AFTER UPDATE OF status em demands). '
    'Notifica open→in_progress e in_progress→resolved via zapi-demand-notify. '
    'Referência: T61 Fase 6 Onda A.';
END
$$;
