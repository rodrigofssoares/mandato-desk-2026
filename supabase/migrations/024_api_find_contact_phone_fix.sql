-- RAQ-MAND-EM026: api_find_contact_by_phone usa a coluna real 'telefone'
-- (o banco e em pt-BR; o edge function faz a traducao en->pt antes de inserir)

CREATE OR REPLACE FUNCTION public.api_find_contact_by_phone(
  p_user_id UUID,
  p_phone_normalized TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT to_jsonb(c.*) INTO v_result
  FROM contacts c
  WHERE c.created_by = p_user_id
    AND c.telefone ILIKE '%' || p_phone_normalized || '%'
  LIMIT 1;

  RETURN v_result;
END;
$$;
