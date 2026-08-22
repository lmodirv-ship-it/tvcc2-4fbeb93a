REVOKE EXECUTE ON FUNCTION public.can_manage(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_manage(uuid) TO authenticated, service_role;