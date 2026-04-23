-- Diagnostico: quais usuarios de auth.users tem perfil?
SELECT
  u.id,
  u.email,
  p.id IS NOT NULL AS tem_profile,
  p.role,
  p.status_aprovacao,
  p.nome
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.email;
