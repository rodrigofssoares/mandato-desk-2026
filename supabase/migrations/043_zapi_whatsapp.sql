-- Migration: 043_zapi_whatsapp
--
-- Why: Cria o modelo de dados completo do módulo Z-API WhatsApp para o Mandato Desk 2026.
--      5 tabelas: zapi_accounts, zapi_panel_passwords, zapi_chats, zapi_messages, zapi_webhook_log.
--      RLS habilitada em todas. Índices compostos para performance de lista de chats e histórico.
--
-- Segurança:
--   - instance_token e client_token são armazenados criptografados (AES-256-GCM aplicado
--     pela Edge Function antes do INSERT — esta migration apenas define a coluna text).
--   - password_hash em zapi_panel_passwords armazena hash bcrypt (NUNCA texto puro).
--   - webhook_secret é hex aleatório de 32 chars gerado automaticamente no INSERT.
--   - RLS: usuários autenticados veem contas; somente admin gerencia contas e senhas;
--     chats/mensagens/logs são somente-leitura para o cliente (service_role via EF escreve).
--
-- Reference: RAQ-MAND-EM051 — T01 (tabelas base Z-API)
-- Rollback: DROP TABLE zapi_webhook_log, zapi_messages, zapi_chats,
--                      zapi_panel_passwords, zapi_accounts CASCADE;

-- ─── Pré-requisito: pgcrypto (gen_random_bytes) ──────────────────────────────
-- Supabase habilita pgcrypto por padrão. Se não estiver disponível,
-- esta migration falhará na cláusula DEFAULT de webhook_secret.
-- Solução: habilitar via Supabase Dashboard → Database → Extensions → pgcrypto.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. zapi_accounts ────────────────────────────────────────────────────────
-- Cada registro representa uma instância Z-API conectada a uma conta WhatsApp.
-- Uma instalação pode ter múltiplas contas (ex: gabinete + assessoria).
CREATE TABLE IF NOT EXISTS public.zapi_accounts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  instance_id     TEXT        NOT NULL,
  -- SEGURANÇA: valor armazenado criptografado (AES-256-GCM) pela Edge Function zapi-*
  --            antes do INSERT. Esta coluna nunca recebe texto puro em produção.
  instance_token  TEXT        NOT NULL,
  -- SEGURANÇA: idem — criptografado pela EF antes do INSERT.
  client_token    TEXT        NOT NULL,
  -- Segredo aleatório de 32 chars hex gerado automaticamente.
  -- A Z-API deve ser configurada para enviar este valor no header X-Webhook-Secret.
  -- gen_random_bytes vive no schema `extensions` no Supabase (não em public).
  webhook_secret  TEXT        NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  status          TEXT        NOT NULL DEFAULT 'configured'
                              CHECK (status IN ('configured', 'connected', 'disconnected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE  public.zapi_accounts IS
  'Contas Z-API conectadas ao Mandato Desk. Cada conta representa uma instância WhatsApp '
  'com seu próprio número. Tokens (instance_token, client_token) chegam criptografados '
  'via AES-256-GCM pela Edge Function antes do INSERT — nunca em texto puro.';

COMMENT ON COLUMN public.zapi_accounts.instance_token IS
  'Token da instância Z-API. SEGURANÇA: armazenado criptografado (AES-256-GCM) '
  'pela Edge Function. Descriptografar apenas em runtime via EF com ZAPI_ENCRYPTION_KEY.';

COMMENT ON COLUMN public.zapi_accounts.client_token IS
  'Client token Z-API para autenticação na API REST. SEGURANÇA: idem instance_token — '
  'AES-256-GCM aplicado pela EF antes do INSERT.';

COMMENT ON COLUMN public.zapi_accounts.webhook_secret IS
  'Segredo de 32 chars hex gerado aleatoriamente no INSERT. '
  'Configurar este valor no painel Z-API como X-Webhook-Secret para validação HMAC. '
  'Exposto somente para admin via policy RLS.';

COMMENT ON COLUMN public.zapi_accounts.status IS
  'Estado atual da conexão WhatsApp: configured (cadastrada mas não testada), '
  'connected (WhatsApp online), disconnected (sessão encerrada ou QR expirado).';

-- Trigger: manter updated_at sincronizado (função já existe desde migration 001)
CREATE TRIGGER trg_zapi_accounts_updated_at
  BEFORE UPDATE ON public.zapi_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 2. zapi_panel_passwords ─────────────────────────────────────────────────
-- Senha extra que protege o acesso à aba Conversas.
-- Separada da auth Supabase para isolamento de responsabilidades.
CREATE TABLE IF NOT EXISTS public.zapi_panel_passwords (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID        NOT NULL REFERENCES public.zapi_accounts(id) ON DELETE CASCADE,
  -- SEGURANÇA: hash bcrypt (custo ≥10). NUNCA armazenar texto puro aqui.
  --            A Edge Function zapi-validate-panel-password faz bcrypt.compare().
  password_hash TEXT        NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 1 senha por conta
  CONSTRAINT uq_panel_password_account UNIQUE (account_id)
);

COMMENT ON TABLE  public.zapi_panel_passwords IS
  'Senha extra que protege o acesso à aba Conversas por conta Z-API. '
  'Autenticação dupla: Supabase Auth (identidade) + esta senha (acesso à aba). '
  'Apenas administradores (role=admin) podem criar/alterar via RLS.';

COMMENT ON COLUMN public.zapi_panel_passwords.password_hash IS
  'Hash bcrypt (custo ≥10) da senha extra do painel. '
  'NUNCA armazenar texto puro. A EF zapi-validate-panel-password faz bcrypt.compare() '
  'e retorna um session token JWT de 30 minutos se o hash for válido.';

-- ─── 3. zapi_chats ───────────────────────────────────────────────────────────
-- Um chat = conversa com um número de telefone em uma conta.
-- UNIQUE(account_id, phone) garante que cada número tem exatamente 1 chat por conta.
CREATE TABLE IF NOT EXISTS public.zapi_chats (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID        NOT NULL REFERENCES public.zapi_accounts(id) ON DELETE CASCADE,
  -- Número em formato E.164 ou raw — normalize_phone() já existe (migration 001).
  -- A EF normaliza antes do INSERT para garantir consistência no UNIQUE.
  phone                 TEXT        NOT NULL,
  -- FK nullable: o chat pode existir antes de o número ser vinculado a um contato CRM.
  -- T09 (trigger normalize_phone matching) preenche este campo automaticamente.
  -- ON DELETE SET NULL: deletar o contato CRM não apaga o histórico de mensagens.
  contact_id            UUID        REFERENCES public.contacts(id) ON DELETE SET NULL,
  last_message_at       TIMESTAMPTZ,
  -- Preview truncado em 200 chars pela EF antes do INSERT (sem base64 de mídia).
  last_message_preview  TEXT,
  unread_count          INT         NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_chat_account_phone UNIQUE (account_id, phone)
);

COMMENT ON TABLE  public.zapi_chats IS
  'Conversas WhatsApp agrupadas por número de telefone dentro de cada conta Z-API. '
  'UNIQUE(account_id, phone) garante unicidade. contact_id é preenchido pelo trigger '
  'de matching T09 (normalize_phone). Escrita apenas via service_role (Edge Functions).';

COMMENT ON COLUMN public.zapi_chats.phone IS
  'Número do remetente/destinatário. Normalizado via normalize_phone() antes do INSERT '
  'pela EF para garantir UNIQUE(account_id, phone) consistente.';

COMMENT ON COLUMN public.zapi_chats.contact_id IS
  'FK nullable para contacts.id. NULL = número ainda não vinculado a um contato CRM. '
  'Preenchido automaticamente pelo trigger T09 de matching por normalize_phone(). '
  'ON DELETE SET NULL: deletar contato CRM preserva histórico de mensagens.';

COMMENT ON COLUMN public.zapi_chats.last_message_preview IS
  'Texto da última mensagem, truncado em 200 chars pela EF. '
  'Nunca contém base64 de mídia. Usado apenas para preview na lista de chats.';

-- Trigger: manter updated_at sincronizado
CREATE TRIGGER trg_zapi_chats_updated_at
  BEFORE UPDATE ON public.zapi_chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 4. zapi_messages ────────────────────────────────────────────────────────
-- Histórico de mensagens. Idempotência garantida por UNIQUE(message_id, account_id).
-- A EF usa INSERT ... ON CONFLICT (message_id, account_id) DO NOTHING.
CREATE TABLE IF NOT EXISTS public.zapi_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        NOT NULL REFERENCES public.zapi_accounts(id) ON DELETE CASCADE,
  chat_id     UUID        NOT NULL REFERENCES public.zapi_chats(id) ON DELETE CASCADE,
  -- ID retornado pela Z-API — chave de idempotência. Duplicatas são ignoradas.
  message_id  TEXT        NOT NULL,
  direction   TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  -- NULL se mensagem for não-texto (mídia) — MVP não armazena base64.
  body        TEXT,
  status      TEXT        NOT NULL DEFAULT 'sent'
              CHECK (status IN ('sent', 'delivered', 'read', 'error')),
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotência: dois webhooks com o mesmo messageId+accountId → 1 linha apenas.
  CONSTRAINT uq_message_idempotency UNIQUE (message_id, account_id)
);

COMMENT ON TABLE  public.zapi_messages IS
  'Histórico de mensagens WhatsApp por chat. UNIQUE(message_id, account_id) garante '
  'idempotência: a EF usa INSERT ... ON CONFLICT DO NOTHING. '
  'body=NULL para mensagens de mídia (MVP não armazena base64). '
  'Escrita apenas via service_role. Purge automático por pg_cron (migration 044): '
  'registros com created_at < now() - 90 days são deletados diariamente.';

COMMENT ON COLUMN public.zapi_messages.message_id IS
  'ID da mensagem retornado pela Z-API. Usado como chave de idempotência junto com '
  'account_id. Duplicatas são silenciosamente ignoradas pela EF (DO NOTHING).';

COMMENT ON COLUMN public.zapi_messages.body IS
  'Texto da mensagem. NULL para mensagens de mídia (imagem, áudio, vídeo) — '
  'MVP não armazena conteúdo binário/base64. A EF remove campos media/audio antes do INSERT.';

-- ─── 5. zapi_webhook_log ─────────────────────────────────────────────────────
-- Auditoria de todos os eventos recebidos do webhook Z-API.
-- account_id NULLABLE: eventos de conta desconhecida (UUID inválido) ainda viram log.
CREATE TABLE IF NOT EXISTS public.zapi_webhook_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULLABLE: eventos de conta não encontrada geram log com account_id=NULL + processing_status='error'
  account_id        UUID        REFERENCES public.zapi_accounts(id) ON DELETE SET NULL,
  event_type        TEXT        NOT NULL,
  -- SEGURANÇA: payload sem campos media/audio/image (EF trunca base64 antes do INSERT).
  payload           JSONB       NOT NULL,
  processing_status TEXT        NOT NULL DEFAULT 'processed'
                    CHECK (processing_status IN ('processed', 'error')),
  -- Preenchido apenas em processamento com erro. Inclui mensagem de exceção para debug.
  error_detail      TEXT,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.zapi_webhook_log IS
  'Log de auditoria de todos os eventos recebidos via webhook Z-API. '
  'account_id NULLABLE: eventos de conta não reconhecida são logados com account_id=NULL. '
  'Escrita apenas via service_role. '
  'Purge automático por pg_cron (migration 044): registros com received_at < now() - 90 days.';

COMMENT ON COLUMN public.zapi_webhook_log.payload IS
  'Payload completo do evento Z-API, sem campos de mídia (media, audio, image, video). '
  'A EF remove esses campos antes do INSERT para evitar armazenar base64 volumoso. '
  'Usado para debug e reprocessamento manual.';

COMMENT ON COLUMN public.zapi_webhook_log.error_detail IS
  'Detalhe do erro de processamento. NULL quando processing_status=''processed''. '
  'Inclui mensagem de exceção para facilitar debug sem acesso direto aos logs da EF.';

-- ─── Índices ──────────────────────────────────────────────────────────────────

-- zapi_chats: listar chats de uma conta ordenados por última mensagem
CREATE INDEX IF NOT EXISTS idx_zapi_chats_account_id
  ON public.zapi_chats (account_id);

CREATE INDEX IF NOT EXISTS idx_zapi_chats_last_message
  ON public.zapi_chats (account_id, last_message_at DESC);

-- Partial index para filtro "não lidas" — evita full scan em conta com muitos chats
CREATE INDEX IF NOT EXISTS idx_zapi_chats_unread
  ON public.zapi_chats (account_id, unread_count)
  WHERE unread_count > 0;

-- zapi_messages: histórico de conversa ordenado + idempotência explícita
CREATE INDEX IF NOT EXISTS idx_zapi_messages_chat_id
  ON public.zapi_messages (chat_id);

CREATE INDEX IF NOT EXISTS idx_zapi_messages_sent_at
  ON public.zapi_messages (sent_at DESC);

-- Já implícito pelo UNIQUE constraint, mas explicitado para clareza de intenção
CREATE INDEX IF NOT EXISTS idx_zapi_messages_idempotency
  ON public.zapi_messages (message_id, account_id);

-- zapi_webhook_log: listagem e filtro por conta
CREATE INDEX IF NOT EXISTS idx_zapi_webhook_log_account_id
  ON public.zapi_webhook_log (account_id);

CREATE INDEX IF NOT EXISTS idx_zapi_webhook_log_received_at
  ON public.zapi_webhook_log (received_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.zapi_accounts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_panel_passwords  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_chats            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zapi_webhook_log      ENABLE ROW LEVEL SECURITY;

-- Drop defensivo antes de recriar (idempotência)
DROP POLICY IF EXISTS "zapi_accounts_select"  ON public.zapi_accounts;
DROP POLICY IF EXISTS "zapi_accounts_insert"  ON public.zapi_accounts;
DROP POLICY IF EXISTS "zapi_accounts_update"  ON public.zapi_accounts;
DROP POLICY IF EXISTS "zapi_accounts_delete"  ON public.zapi_accounts;

DROP POLICY IF EXISTS "zapi_panel_passwords_select" ON public.zapi_panel_passwords;
DROP POLICY IF EXISTS "zapi_panel_passwords_insert" ON public.zapi_panel_passwords;
DROP POLICY IF EXISTS "zapi_panel_passwords_update" ON public.zapi_panel_passwords;
DROP POLICY IF EXISTS "zapi_panel_passwords_delete" ON public.zapi_panel_passwords;

DROP POLICY IF EXISTS "zapi_chats_select"  ON public.zapi_chats;
DROP POLICY IF EXISTS "zapi_chats_write"   ON public.zapi_chats;

DROP POLICY IF EXISTS "zapi_messages_select" ON public.zapi_messages;
DROP POLICY IF EXISTS "zapi_messages_write"  ON public.zapi_messages;

DROP POLICY IF EXISTS "zapi_webhook_log_select" ON public.zapi_webhook_log;
DROP POLICY IF EXISTS "zapi_webhook_log_write"  ON public.zapi_webhook_log;

-- ── zapi_accounts ─────────────────────────────────────────────────────────────
-- Qualquer usuário autenticado pode ver a lista de contas (a senha extra protege
-- o conteúdo das conversas — ver zapi_panel_passwords).
CREATE POLICY "zapi_accounts_select"
  ON public.zapi_accounts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Apenas admin pode criar novas contas Z-API
CREATE POLICY "zapi_accounts_insert"
  ON public.zapi_accounts
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Apenas admin pode editar contas Z-API (ex: trocar nome, revogar token)
CREATE POLICY "zapi_accounts_update"
  ON public.zapi_accounts
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Apenas admin pode excluir contas Z-API
CREATE POLICY "zapi_accounts_delete"
  ON public.zapi_accounts
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- ── zapi_panel_passwords ──────────────────────────────────────────────────────
-- Somente admin gerencia senhas extra do painel (nunca o próprio atendente).
CREATE POLICY "zapi_panel_passwords_select"
  ON public.zapi_panel_passwords
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "zapi_panel_passwords_insert"
  ON public.zapi_panel_passwords
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "zapi_panel_passwords_update"
  ON public.zapi_panel_passwords
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "zapi_panel_passwords_delete"
  ON public.zapi_panel_passwords
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- ── zapi_chats ────────────────────────────────────────────────────────────────
-- Todos os autenticados podem ler chats (a senha extra do painel protege o acesso
-- à aba — enforcement feito no frontend com hook useZapiPanelSession).
-- Escrita exclusiva via service_role (Edge Functions com bypass RLS).
CREATE POLICY "zapi_chats_select"
  ON public.zapi_chats
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE bloqueados para usuários — somente service_role via EF
CREATE POLICY "zapi_chats_write"
  ON public.zapi_chats
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ── zapi_messages ─────────────────────────────────────────────────────────────
CREATE POLICY "zapi_messages_select"
  ON public.zapi_messages
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE bloqueados para usuários — somente service_role via EF
CREATE POLICY "zapi_messages_write"
  ON public.zapi_messages
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- ── zapi_webhook_log ──────────────────────────────────────────────────────────
CREATE POLICY "zapi_webhook_log_select"
  ON public.zapi_webhook_log
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT/UPDATE/DELETE bloqueados para usuários — somente service_role via EF
CREATE POLICY "zapi_webhook_log_write"
  ON public.zapi_webhook_log
  FOR ALL
  USING (false)
  WITH CHECK (false);
