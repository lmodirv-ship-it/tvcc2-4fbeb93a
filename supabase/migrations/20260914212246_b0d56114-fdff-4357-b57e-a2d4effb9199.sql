UPDATE public.payment_accounts pa
SET owner_id = (SELECT u.id FROM auth.users u WHERE public.is_permanent_owner_email(u.email) ORDER BY u.created_at LIMIT 1)
WHERE pa.owner_id IS NULL;

ALTER TABLE public.payment_accounts ALTER COLUMN owner_id SET NOT NULL;

DROP POLICY IF EXISTS payment_accounts_admin_manage ON public.payment_accounts;
DROP POLICY IF EXISTS payment_accounts_owner_admin_read ON public.payment_accounts;

CREATE POLICY payment_accounts_owner_read ON public.payment_accounts
FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR private.has_role(auth.uid(), 'system_owner'::app_role));

CREATE POLICY payment_accounts_owner_manage ON public.payment_accounts
FOR ALL TO authenticated
USING (owner_id = auth.uid() OR private.has_role(auth.uid(), 'system_owner'::app_role))
WITH CHECK (owner_id = auth.uid() OR private.has_role(auth.uid(), 'system_owner'::app_role));