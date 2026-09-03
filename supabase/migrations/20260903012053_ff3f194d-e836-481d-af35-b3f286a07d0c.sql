CREATE OR REPLACE FUNCTION public.bump_site_visits()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v bigint;
BEGIN
  UPDATE public.site_visits
     SET counter = counter + 1, updated_at = now()
   WHERE id = (SELECT id FROM public.site_visits ORDER BY updated_at ASC LIMIT 1)
  RETURNING counter INTO v;
  RETURN v;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_site_visits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_site_visits() FROM anon;
REVOKE EXECUTE ON FUNCTION public.bump_site_visits() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bump_site_visits() TO service_role;