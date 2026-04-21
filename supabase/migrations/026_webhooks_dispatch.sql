-- ============================================================================
-- RAQ-MAND-EM033 — Dispatch de webhooks
--
-- Implementa o envio real dos webhooks a partir de triggers no banco usando
-- pg_net. Qualquer mutacao em contacts/demands/tags/leaders/branding_settings
-- passa pelo dispatch_webhooks, que:
--   1. Busca todos os webhooks ativos cujo array `events` contem o evento atual
--   2. Dispara HTTP POST assincrono para a URL configurada
--   3. Registra um webhook_log com o payload e o request_id (pg_net)
-- Uma segunda funcao reconcilia o status_code/response assim que pg_net
-- entrega a resposta (melhor esforco).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Correlacao com a resposta assincrona do pg_net
ALTER TABLE webhook_logs
  ADD COLUMN IF NOT EXISTS request_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_request_id
  ON webhook_logs(request_id);

-- ---------------------------------------------------------------------------
-- dispatch_webhooks(event, payload)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dispatch_webhooks(
  p_event TEXT,
  p_payload JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_webhook RECORD;
  v_request_id BIGINT;
  v_body JSONB;
BEGIN
  v_body := jsonb_build_object(
    'event', p_event,
    'timestamp', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'data', p_payload
  );

  FOR v_webhook IN
    SELECT id, url
    FROM webhooks
    WHERE is_active = TRUE
      AND p_event = ANY(events)
  LOOP
    BEGIN
      SELECT net.http_post(
        url := v_webhook.url,
        body := v_body,
        headers := '{"Content-Type":"application/json","User-Agent":"MandatoDesk-Webhook/1.0"}'::jsonb,
        timeout_milliseconds := 8000
      ) INTO v_request_id;

      INSERT INTO webhook_logs (webhook_id, event_type, payload, request_id)
      VALUES (v_webhook.id, p_event, p_payload, v_request_id);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO webhook_logs (webhook_id, event_type, payload, status_code, response)
      VALUES (v_webhook.id, p_event, p_payload, 0, 'Erro no dispatch: ' || SQLERRM);
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION dispatch_webhooks(TEXT, JSONB) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Triggers por entidade
-- ---------------------------------------------------------------------------

-- contacts
CREATE OR REPLACE FUNCTION trg_webhooks_contacts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM dispatch_webhooks('contact.created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM dispatch_webhooks('contact.updated', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM dispatch_webhooks('contact.deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS webhooks_contacts_dispatch ON contacts;
CREATE TRIGGER webhooks_contacts_dispatch
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION trg_webhooks_contacts();

-- demands
CREATE OR REPLACE FUNCTION trg_webhooks_demands()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM dispatch_webhooks('demand.created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM dispatch_webhooks('demand.updated', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM dispatch_webhooks('demand.deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS webhooks_demands_dispatch ON demands;
CREATE TRIGGER webhooks_demands_dispatch
  AFTER INSERT OR UPDATE OR DELETE ON demands
  FOR EACH ROW EXECUTE FUNCTION trg_webhooks_demands();

-- tags
CREATE OR REPLACE FUNCTION trg_webhooks_tags()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM dispatch_webhooks('tag.created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM dispatch_webhooks('tag.updated', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM dispatch_webhooks('tag.deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS webhooks_tags_dispatch ON tags;
CREATE TRIGGER webhooks_tags_dispatch
  AFTER INSERT OR UPDATE OR DELETE ON tags
  FOR EACH ROW EXECUTE FUNCTION trg_webhooks_tags();

-- leaders
CREATE OR REPLACE FUNCTION trg_webhooks_leaders()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM dispatch_webhooks('leader.created', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM dispatch_webhooks('leader.updated', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM dispatch_webhooks('leader.deleted', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS webhooks_leaders_dispatch ON leaders;
CREATE TRIGGER webhooks_leaders_dispatch
  AFTER INSERT OR UPDATE OR DELETE ON leaders
  FOR EACH ROW EXECUTE FUNCTION trg_webhooks_leaders();

-- branding_settings (apenas update)
CREATE OR REPLACE FUNCTION trg_webhooks_branding()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM dispatch_webhooks('branding.updated', to_jsonb(NEW));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS webhooks_branding_dispatch ON branding_settings;
CREATE TRIGGER webhooks_branding_dispatch
  AFTER UPDATE ON branding_settings
  FOR EACH ROW EXECUTE FUNCTION trg_webhooks_branding();

-- contact_merges (insert = merge concluido)
CREATE OR REPLACE FUNCTION trg_webhooks_contact_merge()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM dispatch_webhooks('contact.merged', to_jsonb(NEW));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS webhooks_contact_merge_dispatch ON contact_merges;
CREATE TRIGGER webhooks_contact_merge_dispatch
  AFTER INSERT ON contact_merges
  FOR EACH ROW EXECUTE FUNCTION trg_webhooks_contact_merge();

-- ---------------------------------------------------------------------------
-- Best effort: reconciliacao do status_code/response quando pg_net responde.
-- Se a tabela net._http_response existir, instala um AFTER INSERT que atualiza
-- o log correspondente pelo request_id.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_webhook_response()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE webhook_logs
  SET
    status_code = NEW.status_code,
    response = LEFT(COALESCE(NEW.content::TEXT, NEW.error_msg, ''), 2000)
  WHERE request_id = NEW.id;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'net' AND c.relname = '_http_response'
  ) THEN
    DROP TRIGGER IF EXISTS webhook_response_sync ON net._http_response;
    CREATE TRIGGER webhook_response_sync
      AFTER INSERT ON net._http_response
      FOR EACH ROW EXECUTE FUNCTION sync_webhook_response();
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  -- Sem privilegio para colocar trigger em schema net; segue sem reconciliacao
  NULL;
END $$;
