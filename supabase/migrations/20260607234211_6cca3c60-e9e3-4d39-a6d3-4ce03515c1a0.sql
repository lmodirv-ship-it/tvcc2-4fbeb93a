
CREATE TABLE public.ssl_certificates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  website_id UUID,
  domain_id UUID,
  domain TEXT NOT NULL,
  issuer TEXT,
  subject TEXT,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  days_until_expiry INTEGER,
  status TEXT NOT NULL DEFAULT 'unknown',
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ssl_certificates TO authenticated;
GRANT ALL ON public.ssl_certificates TO service_role;

ALTER TABLE public.ssl_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ssl_certificates owner all"
  ON public.ssl_certificates
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER ssl_certificates_touch_updated_at
  BEFORE UPDATE ON public.ssl_certificates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX ssl_certificates_owner_idx ON public.ssl_certificates(owner_id);
CREATE INDEX ssl_certificates_website_idx ON public.ssl_certificates(website_id);
CREATE INDEX ssl_certificates_domain_idx ON public.ssl_certificates(domain_id);
