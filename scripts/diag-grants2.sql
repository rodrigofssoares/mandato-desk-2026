-- Checa grants para service_role especificamente
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND grantee IN ('service_role', 'anon', 'authenticated', 'postgres')
ORDER BY grantee, privilege_type;

-- Checa se o role service_role existe e suas propriedades
SELECT rolname, rolsuper, rolbypassrls, rolinherit
FROM pg_roles
WHERE rolname IN ('service_role', 'authenticated', 'anon', 'postgres');
