-- 039_add_theme_preference.sql
--
-- Adiciona preferência de tema por usuário. NULL = usa o tema default do
-- sistema (burgundy-institucional). Valores aceitos pra ficar fácil de
-- versionar caso sejam adicionados novos temas no futuro.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_preference TEXT;

-- Constraint: aceita NULL ou um dos temas conhecidos.
-- DO $$ pra não quebrar caso seja re-executada (idempotência defensiva).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_theme_preference_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_theme_preference_check
      CHECK (
        theme_preference IS NULL
        OR theme_preference IN ('navy-institucional', 'burgundy-institucional')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.theme_preference IS
  'Preferência de tema do usuário. NULL = usa o tema default do sistema (burgundy-institucional). Atualmente aceita: navy-institucional, burgundy-institucional.';
