DROP POLICY IF EXISTS "anon reads active manara endpoints" ON public.manara_endpoints;
DROP POLICY IF EXISTS "anon reads active manara projects" ON public.manara_projects;
REVOKE SELECT ON public.manara_endpoints FROM anon;
REVOKE SELECT ON public.manara_projects FROM anon;