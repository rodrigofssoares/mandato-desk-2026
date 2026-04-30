-- Migration 031: adiciona coluna meta_votos em branding_settings
-- Idempotente: usa IF NOT EXISTS e bloco DO para a constraint

ALTER TABLE branding_settings
  ADD COLUMN IF NOT EXISTS meta_votos integer NULL DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'branding_settings_meta_votos_nonneg'
  ) THEN
    ALTER TABLE branding_settings
      ADD CONSTRAINT branding_settings_meta_votos_nonneg
      CHECK (meta_votos IS NULL OR meta_votos >= 0);
  END IF;
END;
$$;
