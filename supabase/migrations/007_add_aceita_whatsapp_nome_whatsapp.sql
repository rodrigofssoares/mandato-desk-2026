-- Adicionar campo para indicar se o contato aceita receber mensagens no WhatsApp
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS aceita_whatsapp BOOLEAN DEFAULT FALSE;

-- Adicionar campo para nome de exibição no WhatsApp
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS nome_whatsapp TEXT;
