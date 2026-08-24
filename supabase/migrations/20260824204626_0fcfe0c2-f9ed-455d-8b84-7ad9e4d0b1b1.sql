DROP POLICY IF EXISTS payment_accounts_auth_active_read ON public.payment_accounts;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_accounts' AND policyname='payment_accounts_owner_admin_read') THEN
    CREATE POLICY payment_accounts_owner_admin_read ON public.payment_accounts
      FOR SELECT TO authenticated
      USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
  END IF;
END $$;

REVOKE SELECT ON public.payment_accounts FROM anon;