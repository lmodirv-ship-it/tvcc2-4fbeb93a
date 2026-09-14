CREATE OR REPLACE FUNCTION public.verify_cron_secret(_name text, _secret text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM private.cron_secrets
    WHERE name = _name AND secret = _secret
  )
$$;

REVOKE ALL ON FUNCTION public.verify_cron_secret(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text, text) TO service_role;