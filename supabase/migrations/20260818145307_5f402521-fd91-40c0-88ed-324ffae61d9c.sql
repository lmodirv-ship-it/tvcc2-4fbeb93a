-- HN.RLS certificates issued after domain ownership verification
CREATE TABLE public.hn_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  domain text NOT NULL,
  serial text NOT NULL UNIQUE,
  verification_method text NOT NULL DEFAULT 'DNS',
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 year'),
  status text NOT NULL DEFAULT 'active',
  fingerprint text NOT NULL,
  signature text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hn_certificates_owner ON public.hn_certificates(owner_id);
CREATE INDEX idx_hn_certificates_website ON public.hn_certificates(website_id);
CREATE INDEX idx_hn_certificates_domain ON public.hn_certificates(lower(domain));
CREATE UNIQUE INDEX idx_hn_certificates_one_active
  ON public.hn_certificates(website_id) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hn_certificates TO authenticated;
GRANT ALL ON public.hn_certificates TO service_role;

ALTER TABLE public.hn_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their certificates"
  ON public.hn_certificates FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owners insert their certificates"
  ON public.hn_certificates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update their certificates"
  ON public.hn_certificates FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners delete their certificates"
  ON public.hn_certificates FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER touch_hn_certificates
  BEFORE UPDATE ON public.hn_certificates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'unregistered',
  ADD COLUMN IF NOT EXISTS registered_at timestamptz,
  ADD COLUMN IF NOT EXISTS hn_project_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_websites_hn_project_id
  ON public.websites(hn_project_id) WHERE hn_project_id IS NOT NULL;