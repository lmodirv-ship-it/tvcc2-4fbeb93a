CREATE TABLE public.payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'bank',
  bank_name text,
  holder text,
  account_number text,
  rib text,
  iban text,
  swift text,
  gateway_url text DEFAULT 'https://hnpay.live/',
  currency text NOT NULL DEFAULT 'MAD',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_accounts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_accounts TO authenticated;
GRANT ALL ON public.payment_accounts TO service_role;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_accounts_public_active_read" ON public.payment_accounts
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "payment_accounts_admin_manage" ON public.payment_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner') OR owner_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner') OR owner_id = auth.uid());

CREATE TRIGGER payment_accounts_touch BEFORE UPDATE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.payment_accounts(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.hosting_plans(id) ON DELETE SET NULL,
  plan_name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  buyer_name text,
  buyer_email text,
  reference text NOT NULL DEFAULT ('HN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  method text NOT NULL DEFAULT 'bank_transfer',
  status text NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_orders_own_read" ON public.payment_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE POLICY "payment_orders_own_insert" ON public.payment_orders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "payment_orders_admin_update" ON public.payment_orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE POLICY "payment_orders_admin_delete" ON public.payment_orders
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));

CREATE TRIGGER payment_orders_touch BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.payment_accounts (label, kind, bank_name, holder, account_number, rib, iban, gateway_url, currency, is_active, is_default, notes)
VALUES ('حساب HN الرئيسي', 'bank', 'Crédit Agricole du Maroc', 'EL HA...', '0402035676010111',
  '225451040203567601011123', 'MA64225451040203567601011123', 'https://hnpay.live/', 'MAD', true, true,
  'الحساب المعتمد لاستقبال مدفوعات باقات الاستضافة عبر منصة HNPay.');