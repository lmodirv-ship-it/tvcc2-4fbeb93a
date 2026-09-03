REVOKE ALL ON public.manara_addresses FROM anon;
GRANT SELECT (id, project_id, url, kind, is_current, is_verified, retired_at, updated_at) ON public.manara_addresses TO anon;