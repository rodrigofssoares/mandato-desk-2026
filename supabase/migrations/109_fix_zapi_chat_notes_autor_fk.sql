-- ============================================================================
-- Migration 109: corrige FK de zapi_chat_notes.autor_id (RAQ-MAND-EM077)
-- ============================================================================
-- Problema:
--   A página de conversas do WhatsApp falhava ao carregar as notas internas com:
--     "Could not find a relationship between 'zapi_chat_notes' and 'autor_id'
--      in the schema cache"
--
--   Causa raiz: na migration 057 a coluna `autor_id` foi criada apontando para
--   `auth.users(id)`. O PostgREST NÃO expõe relacionamentos para o schema `auth`,
--   então o embed `autor:profiles!autor_id(nome)` (useChatNotes.ts) não encontra
--   a relação. Além disso, `auth.users` não possui a coluna `nome` — quem a tem
--   é `profiles`.
--
-- Correção:
--   Trocar a FK de `autor_id` de `auth.users(id)` para `public.profiles(id)`,
--   alinhando ao padrão de todo o restante do projeto (created_by/responsible_id
--   etc. sempre referenciam profiles). Como `profiles.id` referencia
--   `auth.users(id)` (1:1), todos os valores atuais de `autor_id` continuam
--   válidos — nenhum dado é perdido.
--
--   Após esta migration o PostgREST passa a reconhecer o relacionamento e o
--   embed `autor:profiles!autor_id(nome)` resolve corretamente.
--
-- Robustez:
--   Em vez de assumir o nome auto-gerado da FK antiga, um bloco DO descobre
--   dinamicamente QUALQUER foreign key existente na coluna `autor_id` e a remove.
--   Isso evita o cenário em que o nome real difere de
--   `zapi_chat_notes_autor_id_fkey` (deixando duas FKs e causando ambiguidade
--   no PostgREST). Idempotente: pode ser reaplicada com segurança.
--
-- Observação: as policies RLS de zapi_chat_notes usam `autor_id = auth.uid()`,
--   que permanece correto pois profiles.id = auth.users.id. ON DELETE CASCADE
--   é mantido (autor_id é NOT NULL, então SET NULL não é opção) — preserva a
--   semântica original da migration 057.
--
-- Referência: RAQ-MAND-EM077 — correção de erro ao carregar conversas WhatsApp
-- ============================================================================

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  -- 1. Descobrir e remover QUALQUER FK existente sobre a coluna autor_id,
  --    independentemente do nome (a da migration 057 apontava p/ auth.users).
  FOR fk_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel  ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE con.contype = 'f'
      AND ns.nspname = 'public'
      AND rel.relname = 'zapi_chat_notes'
      AND con.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute
          WHERE attrelid = 'public.zapi_chat_notes'::regclass
            AND attname = 'autor_id')
      ]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE public.zapi_chat_notes DROP CONSTRAINT %I', fk_name);
    RAISE NOTICE 'Migration 109: FK antiga % removida de zapi_chat_notes.autor_id.', fk_name;
  END LOOP;

  -- 2. Criar a FK correta: autor_id -> public.profiles(id).
  --    ON DELETE CASCADE mantém o comportamento original (remover notas do autor
  --    deletado), agora via profiles (que por sua vez cascateia de auth.users).
  ALTER TABLE public.zapi_chat_notes
    ADD CONSTRAINT zapi_chat_notes_autor_id_fkey
    FOREIGN KEY (autor_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
END
$$;

-- 3. Forçar o PostgREST a recarregar o schema cache imediatamente.
NOTIFY pgrst, 'reload schema';

-- ─── Log ─────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 109: FK zapi_chat_notes.autor_id realocada de auth.users para public.profiles (RAQ-MAND-EM077).';
END
$$;
