DROP POLICY IF EXISTS payment_accounts_public_active_read ON public.payment_accounts;

CREATE POLICY payment_accounts_auth_active_read ON public.payment_accounts
FOR SELECT TO authenticated
USING (is_active = true);

REVOKE SELECT ON public.payment_accounts FROM anon;
GRANT SELECT ON public.payment_accounts TO authenticated;
GRANT ALL ON public.payment_accounts TO service_role;

CREATE OR REPLACE VIEW public.public_payment_methods
WITH (security_invoker = off) AS
SELECT id, label, kind, currency, gateway_url, is_default
FROM public.payment_accounts
WHERE is_active = true;

GRANT SELECT ON public.public_payment_methods TO anon, authenticated;