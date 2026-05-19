-- migration: 060_zapi_credenciais_formato.sql
--
-- Adiciona CHECK constraints de formato em zapi_accounts para garantir que
-- instance_id e instance_token sejam compostos apenas de letras e dígitos,
-- impedindo SSRF por injeção de caracteres especiais na URL do fetch das
-- Edge Functions Z-API (achado pós-pentest RAQ-MAND-EM073 Fase 3).
--
-- Defesa em profundidade: mesmo que a validação da EF seja bypassada ou
-- removida, o banco rejeita valores maliciosos na origem.
--
-- Regex: ^[A-Za-z0-9]{4,64}$  — instance_id  (4-64 alfanuméricos)
--        ^[A-Za-z0-9]{8,128}$ — instance_token (8-128 alfanuméricos)
--
-- As constraints são idempotentes via DROP … IF EXISTS antes do ADD.

-- instance_id
ALTER TABLE public.zapi_accounts
  DROP CONSTRAINT IF EXISTS chk_zapi_instance_id_fmt;

ALTER TABLE public.zapi_accounts
  ADD CONSTRAINT chk_zapi_instance_id_fmt
    CHECK (instance_id ~ '^[A-Za-z0-9]{4,64}$');

-- instance_token
ALTER TABLE public.zapi_accounts
  DROP CONSTRAINT IF EXISTS chk_zapi_instance_token_fmt;

ALTER TABLE public.zapi_accounts
  ADD CONSTRAINT chk_zapi_instance_token_fmt
    CHECK (instance_token ~ '^[A-Za-z0-9]{8,128}$');
