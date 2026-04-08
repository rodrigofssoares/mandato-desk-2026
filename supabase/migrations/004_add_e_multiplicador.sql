-- Adicionar campo para indicar se o contato é multiplicador
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS e_multiplicador BOOLEAN DEFAULT FALSE;
