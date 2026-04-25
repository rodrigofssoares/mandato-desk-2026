-- =====================================================================
-- RAQ-MAND-EM037 — Senha temporária + primeiro acesso + correção de login
-- =====================================================================
--
-- Esta migration:
--   1. Adiciona a coluna `senha_temporaria` em profiles (flag de primeiro
--      acesso — quando TRUE o app força o usuário a trocar a senha antes
--      de usar o sistema).
--   2. Garante colunas `nome` e `telefone` em profiles (estavam no DB real
--      mas não em migrations do repo — deixamos idempotente).
--   3. Atualiza a trigger `handle_new_user` para escrever em `nome` (a
--      versão antiga escrevia em `name` que não existe mais).
--   4. Confirma o e-mail de TODOS os usuários já criados (corrige os que
--      ficaram presos em `email_confirmed_at = NULL` por causa do fluxo
--      de `auth.signUp()` antigo — é essa a causa do bug "credenciais
--      inválidas" mesmo com senha correta).
-- =====================================================================

-- 1. Garantir colunas em profiles (idempotente)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nome TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS senha_temporaria BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Atualizar trigger de criação automática de perfil para usar `nome`
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'nome',
      NEW.raw_user_meta_data ->> 'name',
      NEW.raw_user_meta_data ->> 'full_name',
      ''
    ),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Confirmar e-mail de todos os usuários existentes (fix do bug de login)
-- Somente quando `email_confirmed_at` está nulo — preserva quem já confirmou.
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL
  AND id IN (SELECT id FROM public.profiles);

-- 4. Marcar usuários que ainda não têm senha definida como temporários
-- (noop se o default já está FALSE e ninguém mudou) — deixamos aqui só
-- como documentação. Reset real de senha é feito via edge function
-- `reset-user-password` + ação manual do admin.
