# RAQ-MAND-EM071 — APLICAR MIGRATION 050 (manual via Dashboard)

A primeira passada do fix (commit `012a8e4`) endereçou o dup-check client-side,
mas o bug **persistia** porque a causa raiz era um trigger Postgres
(`trg_prevent_duplicate_contacts`) que bloqueava qualquer UPDATE em contatos
com whatsapp duplicado legacy, mesmo quando o whatsapp não mudava no update.

A migration `050_prevent_duplicate_skip_unchanged.sql` corrige isso, mas
**não foi aplicada automaticamente** porque a CLI Supabase precisa do
`SUPABASE_DB_PASSWORD` no `.env` (não disponível nesta sessão).

## Como aplicar (1 minuto)

1. Acessar https://supabase.com/dashboard → projeto Mandato Desk 2026
2. Menu lateral → **SQL Editor** → **New query**
3. Colar o SQL abaixo e clicar **Run**

```sql
CREATE OR REPLACE FUNCTION public.prevent_duplicate_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.merged_into IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.whatsapp IS NOT DISTINCT FROM NEW.whatsapp THEN
    RETURN NEW;
  END IF;

  IF NEW.whatsapp IS NOT NULL AND NEW.whatsapp != '' THEN
    IF EXISTS (
      SELECT 1 FROM public.contacts
      WHERE whatsapp = NEW.whatsapp
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND merged_into IS NULL
    ) THEN
      RAISE EXCEPTION 'Contato com este WhatsApp ja existe';
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;
```

## Verificação rápida — confirmar que Érika está entre os afetados

(Opcional, só pra evidência). Rodar no SQL Editor:

```sql
SELECT id, nome, whatsapp
FROM contacts
WHERE merged_into IS NULL
  AND whatsapp IS NOT NULL
  AND whatsapp <> ''
  AND whatsapp IN (
    SELECT whatsapp FROM contacts
    WHERE merged_into IS NULL AND whatsapp IS NOT NULL AND whatsapp <> ''
    GROUP BY whatsapp HAVING COUNT(*) > 1
  )
ORDER BY whatsapp, nome;
```

Esperado: lista com ~18 linhas onde Érika Rímoli Mota da Silva aparece.

## Teste após aplicar

1. Abrir o contato Érika no app.
2. Marcar uma nova etiqueta. **Sem mexer no whatsapp.**
3. Salvar.

**Esperado:** toast verde "Contato atualizado com sucesso", etiqueta persiste após reload.

## Regression test

1. Tentar criar um novo contato com whatsapp que JÁ existe em outro.

**Esperado:** toast vermelho "Contato com este WhatsApp já existe" (a proteção
contra criação de novas duplicatas continua valendo).
