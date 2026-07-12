
CREATE TABLE public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'hnpay-ai',
  website_id UUID NULL,
  subscription_id UUID NULL,
  amount NUMERIC NULL,
  currency TEXT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  external_id TEXT NULL,
  fanout_total INT NOT NULL DEFAULT 0,
  fanout_delivered INT NOT NULL DEFAULT 0,
  fanout_failed INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read own payment events" ON public.payment_events
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX payment_events_owner_received_idx ON public.payment_events(owner_id, received_at DESC);
CREATE INDEX payment_events_website_idx ON public.payment_events(website_id);
