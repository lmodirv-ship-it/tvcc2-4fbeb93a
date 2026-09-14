
ALTER TABLE public.backup_destinations
  ADD COLUMN IF NOT EXISTS storage_server_id uuid REFERENCES public.servers(id),
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'all';

CREATE TABLE IF NOT EXISTS public.server_site_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid REFERENCES public.servers(id),
  host text,
  domain text NOT NULL,
  source text,
  doc_root text,
  service_name text,
  port integer,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_site_scans TO authenticated;
GRANT ALL ON public.server_site_scans TO service_role;

ALTER TABLE public.server_site_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own scans" ON public.server_site_scans;
CREATE POLICY "own scans" ON public.server_site_scans
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS server_site_scans_owner_idx ON public.server_site_scans(owner_id);
CREATE INDEX IF NOT EXISTS server_site_scans_domain_idx ON public.server_site_scans(domain);

DROP TRIGGER IF EXISTS server_site_scans_touch ON public.server_site_scans;
CREATE TRIGGER server_site_scans_touch BEFORE UPDATE ON public.server_site_scans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
