
-- Tighten site_services & service_dependencies RLS to owner/admin
DROP POLICY IF EXISTS "site_services insert authenticated" ON public.site_services;
DROP POLICY IF EXISTS "site_services update authenticated" ON public.site_services;
DROP POLICY IF EXISTS "site_services read all authenticated" ON public.site_services;

CREATE POLICY "site_services select owner or admin" ON public.site_services
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'system_owner'));

CREATE POLICY "site_services insert owner or admin" ON public.site_services
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'system_owner'));

CREATE POLICY "site_services update owner or admin" ON public.site_services
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'system_owner'));

DROP POLICY IF EXISTS "service_dependencies insert authenticated" ON public.service_dependencies;
DROP POLICY IF EXISTS "service_dependencies update authenticated" ON public.service_dependencies;
DROP POLICY IF EXISTS "service_dependencies read all authenticated" ON public.service_dependencies;

CREATE POLICY "service_dependencies select owner or admin" ON public.service_dependencies
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'system_owner'));

CREATE POLICY "service_dependencies insert owner or admin" ON public.service_dependencies
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'system_owner'));

CREATE POLICY "service_dependencies update owner or admin" ON public.service_dependencies
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'system_owner'));

-- Revoke public EXECUTE on SECURITY DEFINER trigger-only functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_system_owner() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies (runs as querying role), so authenticated needs EXECUTE.
-- Revoke from anon/PUBLIC only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
