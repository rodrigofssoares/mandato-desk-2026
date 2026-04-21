-- RAQ-MAND-EM026: funcao SECURITY DEFINER para validar API token
-- independente do bypass de RLS (novo formato sb_secret_ tem comportamento
-- diferente das chaves service_role JWT antigas)

CREATE OR REPLACE FUNCTION public.validate_api_token(p_token TEXT)
RETURNS TABLE (token_id UUID, user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT t.id, t.user_id
    FROM public.api_tokens t
    WHERE t.token = p_token
    LIMIT 1;

  -- Atualizar last_used_at para o token encontrado (fire-and-forget)
  UPDATE public.api_tokens
  SET last_used_at = NOW()
  WHERE token = p_token;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_api_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_api_token(TEXT) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.validate_api_token(TEXT) IS
  'Valida um token da tabela api_tokens e retorna user_id. SECURITY DEFINER para funcionar independente de RLS. Usada pela edge function api-proxy.';
