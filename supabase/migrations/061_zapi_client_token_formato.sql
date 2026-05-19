-- migration: 061_zapi_client_token_formato.sql
--
-- Adiciona CHECK constraint de formato em zapi_accounts para client_token,
-- complementando a migration 060 que só cobriu instance_id e instance_token.
-- client_token vai no header Authorization das requisições à Z-API,
-- portanto deve ser alfanumérico puro para evitar injeção de caracteres especiais.
--
-- Regex: ^[A-Za-z0-9]{8,128}$ — client_token (8-128 alfanuméricos)
--
-- A constraint é idempotente via DROP … IF EXISTS antes do ADD.
-- Verificado antes do deploy: conta existente com client_token 'Fca8f7a9b8a9a431792b052e012b6f059S'
-- (34 chars, tudo alfanumérico) — sem violação.

ALTER TABLE public.zapi_accounts
  DROP CONSTRAINT IF EXISTS chk_zapi_client_token_fmt;

ALTER TABLE public.zapi_accounts
  ADD CONSTRAINT chk_zapi_client_token_fmt
    CHECK (client_token ~ '^[A-Za-z0-9]{8,128}$');
