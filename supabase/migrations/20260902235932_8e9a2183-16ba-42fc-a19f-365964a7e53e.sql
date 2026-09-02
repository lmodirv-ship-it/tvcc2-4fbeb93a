-- Fix PUBLIC_INFRASTRUCTURE_EXPOSURE: anonymous users must not read internal
-- server infrastructure details from manara_addresses (host, port, server_id).
-- Replace direct table access with a minimal public-safe view.

-- 1. Revoke direct anon access to the infrastructure table.
REVOKE SELECT ON public.manara_addresses FROM anon;

-- 2. Drop the anon policy that exposed host/port/server_id/url.
DROP POLICY IF EXISTS "anon reads verified current manara addresses"
  ON public.manara_addresses;

-- 3. Create a public-safe view containing only routing-safe columns.
CREATE OR REPLACE VIEW public.manara_public_routes AS
SELECT
    p.project_key,
    p.name AS project_name,
    p.status AS project_status,
    p.group_tag,
    a.url,
    a.kind,
    a.is_current,
    a.is_verified,
    a.updated_at
FROM public.manara_addresses a
JOIN public.manara_projects p ON p.id = a.project_id
WHERE a.is_current = true
  AND a.is_verified = true
  AND a.retired_at IS NULL
  AND p.status = 'active';

-- 4. Grant anon read access to the safe view.
GRANT SELECT ON public.manara_public_routes TO anon;
GRANT SELECT ON public.manara_public_routes TO authenticated;
GRANT ALL ON public.manara_public_routes TO service_role;
