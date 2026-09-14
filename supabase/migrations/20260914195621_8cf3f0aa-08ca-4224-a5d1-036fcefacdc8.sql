DROP POLICY IF EXISTS "team manage integrations" ON public.external_integrations;
CREATE POLICY "owner scoped integrations" ON public.external_integrations
FOR ALL TO authenticated
USING (private.can_manage(owner_id))
WITH CHECK (private.can_manage(owner_id));