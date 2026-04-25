-- One-shot: reseta senha de Aparecida e MRFB para @123456,
-- confirma email, e marca senha_temporaria=true pra forcar troca no 1o login.
BEGIN;

UPDATE auth.users
SET encrypted_password = crypt('@123456', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email IN ('aparecida.silva.nasc@gmail.com', 'mrbfpereira@gmail.com');

UPDATE public.profiles
SET senha_temporaria = true
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN ('aparecida.silva.nasc@gmail.com', 'mrbfpereira@gmail.com')
);

SELECT email, email_confirmed_at IS NOT NULL AS confirmado
FROM auth.users
WHERE email IN ('aparecida.silva.nasc@gmail.com', 'mrbfpereira@gmail.com');

COMMIT;
