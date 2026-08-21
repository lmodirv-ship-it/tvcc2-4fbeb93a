CREATE OR REPLACE FUNCTION public.is_permanent_owner_email(_email text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = ''
AS $function$ SELECT lower(coalesce(_email,'')) = 'lmodirv@gmail.com' $function$;

-- core_hub_config: owner-scoped only (plus permanent system owner)
DROP POLICY IF EXISTS "owners manage core config" ON public.core_hub_config;
CREATE POLICY "core config owner only" ON public.core_hub_config FOR ALL TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'system_owner'))
WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(),'system_owner'));

DROP POLICY IF EXISTS "owners manage directives" ON public.core_directives;
CREATE POLICY "directives owner only" ON public.core_directives FOR ALL TO authenticated
USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'system_owner'))
WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(),'system_owner'));

DROP POLICY IF EXISTS "owners manage directive targets" ON public.core_directive_targets;
CREATE POLICY "directive targets owner only" ON public.core_directive_targets FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'system_owner') OR EXISTS (SELECT 1 FROM public.core_directives d WHERE d.id = core_directive_targets.directive_id AND d.owner_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'system_owner') OR EXISTS (SELECT 1 FROM public.core_directives d WHERE d.id = core_directive_targets.directive_id AND d.owner_id = auth.uid()));

-- site_services
DROP POLICY IF EXISTS "site_services select owner or admin" ON public.site_services;
DROP POLICY IF EXISTS "site_services insert owner or admin" ON public.site_services;
DROP POLICY IF EXISTS "site_services update owner or admin" ON public.site_services;
DROP POLICY IF EXISTS "site_services delete owner" ON public.site_services;
CREATE POLICY "site_services owner only" ON public.site_services FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'system_owner'))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'system_owner'));

-- service_dependencies
DROP POLICY IF EXISTS "service_dependencies select owner or admin" ON public.service_dependencies;
DROP POLICY IF EXISTS "service_dependencies insert owner or admin" ON public.service_dependencies;
DROP POLICY IF EXISTS "service_dependencies update owner or admin" ON public.service_dependencies;
DROP POLICY IF EXISTS "service_dependencies delete admin" ON public.service_dependencies;
CREATE POLICY "service_dependencies owner only" ON public.service_dependencies FOR ALL TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'system_owner'))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'system_owner'));