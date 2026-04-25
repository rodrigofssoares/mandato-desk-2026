-- Tabela de grupos de duplicados que o usuario marcou como "nao sao duplicatas".
-- Usada para ocultar permanentemente falsos positivos (ex: nomes genericos como
-- "Ana", "Maria" ou placeholder "{{full_name}}" com telefones distintos).

CREATE TABLE IF NOT EXISTS public.dismissed_duplicate_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_field TEXT NOT NULL CHECK (match_field IN ('whatsapp', 'email', 'nome')),
  match_value TEXT NOT NULL,
  reason TEXT,
  dismissed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_field, match_value)
);

CREATE INDEX IF NOT EXISTS idx_dismissed_duplicate_groups_lookup
  ON public.dismissed_duplicate_groups (match_field, match_value);

ALTER TABLE public.dismissed_duplicate_groups ENABLE ROW LEVEL SECURITY;

-- Qualquer usuario autenticado pode ler/inserir/deletar. (A feature de
-- duplicados ja exige login no app; nao ha multitenancy aqui.)

DROP POLICY IF EXISTS "dismissed_groups_select" ON public.dismissed_duplicate_groups;
CREATE POLICY "dismissed_groups_select"
  ON public.dismissed_duplicate_groups
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "dismissed_groups_insert" ON public.dismissed_duplicate_groups;
CREATE POLICY "dismissed_groups_insert"
  ON public.dismissed_duplicate_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "dismissed_groups_delete" ON public.dismissed_duplicate_groups;
CREATE POLICY "dismissed_groups_delete"
  ON public.dismissed_duplicate_groups
  FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE public.dismissed_duplicate_groups IS
  'Grupos de duplicados marcados pelo usuario como "nao sao duplicatas". Ocultados permanentemente da lista.';
