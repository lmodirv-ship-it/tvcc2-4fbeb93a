DROP POLICY IF EXISTS payment_orders_own_insert ON public.payment_orders;
REVOKE INSERT ON public.payment_orders FROM authenticated;
REVOKE ALL ON public.payment_orders FROM anon;
GRANT ALL ON public.payment_orders TO service_role;