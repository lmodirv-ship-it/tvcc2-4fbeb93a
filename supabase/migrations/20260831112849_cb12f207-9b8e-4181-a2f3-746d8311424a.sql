CREATE TABLE public.hn_group_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][0-9]{6}$'),
  service_number integer,
  service_name text,
  site_url text,
  origin text,
  status text NOT NULL DEFAULT 'discovered' CHECK (status IN ('discovered','connected','revoked')),
  hub_source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_signal_at timestamptz,
  signal_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hn_group_identity_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid REFERENCES public.hn_group_identities(id) ON DELETE CASCADE,
  code text NOT NULL,
  origin text,
  ip_hash text,
  user_agent text,
  signature_valid boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hn_group_identity_signals_identity ON public.hn_group_identity_signals(identity_id, created_at DESC);

GRANT SELECT ON public.hn_group_identities TO authenticated;
GRANT ALL ON public.hn_group_identities TO service_role;
GRANT SELECT ON public.hn_group_identity_signals TO authenticated;
GRANT ALL ON public.hn_group_identity_signals TO service_role;

ALTER TABLE public.hn_group_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hn_group_identity_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "identities readable by authenticated" ON public.hn_group_identities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "identities insert by admin" ON public.hn_group_identities
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "identities update by admin" ON public.hn_group_identities
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "identities delete by admin" ON public.hn_group_identities
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "signals readable by authenticated" ON public.hn_group_identity_signals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "signals delete by admin" ON public.hn_group_identity_signals
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_hn_group_identities_updated
  BEFORE UPDATE ON public.hn_group_identities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();