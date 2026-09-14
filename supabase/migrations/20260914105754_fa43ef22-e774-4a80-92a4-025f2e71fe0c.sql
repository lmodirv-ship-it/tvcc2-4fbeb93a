DROP POLICY IF EXISTS "anon reads current verified manara addresses" ON public.manara_addresses;
REVOKE SELECT ON public.manara_addresses FROM anon;