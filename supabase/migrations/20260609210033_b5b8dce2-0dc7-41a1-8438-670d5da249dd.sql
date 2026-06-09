
-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_system_owner() FROM PUBLIC, anon, authenticated;

-- Restrict sensitive columns in databases
REVOKE SELECT, UPDATE ON public.databases FROM authenticated;
GRANT SELECT (id, owner_id, website_id, name, db_type, size_mb, status, created_at, updated_at)
  ON public.databases TO authenticated;
GRANT INSERT, DELETE ON public.databases TO authenticated;
GRANT UPDATE (name, db_type, size_mb, status, website_id)
  ON public.databases TO authenticated;

-- Restrict sensitive value column in website_env_vars
REVOKE SELECT, UPDATE ON public.website_env_vars FROM authenticated;
GRANT SELECT (id, website_id, owner_id, key, environment, is_secret, created_at, updated_at)
  ON public.website_env_vars TO authenticated;
GRANT INSERT, DELETE ON public.website_env_vars TO authenticated;
GRANT UPDATE (key, environment, is_secret, value)
  ON public.website_env_vars TO authenticated;
