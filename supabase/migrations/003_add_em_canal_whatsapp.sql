-- Adicionar campo para indicar se o contato está no canal do WhatsApp
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS em_canal_whatsapp BOOLEAN DEFAULT FALSE;
