-- 1) hn_group_identity_signals: make ingestion explicitly service-role only
REVOKE INSERT, UPDATE ON public.hn_group_identity_signals FROM authenticated, anon;
REVOKE ALL ON public.hn_group_identity_signals FROM anon;
GRANT SELECT, DELETE ON public.hn_group_identity_signals TO authenticated;
GRANT ALL ON public.hn_group_identity_signals TO service_role;

-- 2) site_visits: counter is served only through the server API (admin client)
DROP POLICY IF EXISTS "site_visits_public_read" ON public.site_visits;
REVOKE ALL ON public.site_visits FROM anon, authenticated;
GRANT ALL ON public.site_visits TO service_role;

-- 3) tvcc_probe: restrict to admins / system owners
DROP POLICY IF EXISTS "Authenticated users can read tvcc_probe" ON public.tvcc_probe;
DROP POLICY IF EXISTS "Authenticated users can insert tvcc_probe" ON public.tvcc_probe;
DROP POLICY IF EXISTS "Authenticated users can update tvcc_probe" ON public.tvcc_probe;
DROP POLICY IF EXISTS "Authenticated users can delete tvcc_probe" ON public.tvcc_probe;

CREATE POLICY "tvcc_probe_admin_select" ON public.tvcc_probe FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'system_owner'::app_role));
CREATE POLICY "tvcc_probe_admin_insert" ON public.tvcc_probe FOR INSERT TO authenticated
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'system_owner'::app_role));
CREATE POLICY "tvcc_probe_admin_update" ON public.tvcc_probe FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'system_owner'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'system_owner'::app_role));
CREATE POLICY "tvcc_probe_admin_delete" ON public.tvcc_probe FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'system_owner'::app_role));

REVOKE ALL ON public.tvcc_probe FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tvcc_probe TO authenticated;
GRANT ALL ON public.tvcc_probe TO service_role;