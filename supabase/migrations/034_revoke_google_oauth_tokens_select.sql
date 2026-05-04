-- FIX P-HIGH-1 (residual): bloquear SELECT direto via PostgREST na tabela base.
-- A migration 032 criou a view google_oauth_tokens_safe (sem access_token/refresh_token).
-- Mas a tabela base ainda tinha a policy "google_oauth_tokens_select" (de 001_complete_schema),
-- permitindo que o frontend lesse access_token e refresh_token diretamente via supabase-js.
-- Isso significa que qualquer XSS local poderia exfiltrar o refresh_token Google (6 meses de validade).
--
-- Correção: remover a policy. Edge Functions continuam funcionando (usam service_role, bypassa RLS).
-- O frontend já foi atualizado em useGoogleSync.ts para ler de google_oauth_tokens_safe.

DROP POLICY IF EXISTS "google_oauth_tokens_select" ON google_oauth_tokens;

-- INSERT, UPDATE e DELETE permanecem proibidos pra authenticated (já estavam restritos
-- a Edge Function via service_role nas policies originais).
