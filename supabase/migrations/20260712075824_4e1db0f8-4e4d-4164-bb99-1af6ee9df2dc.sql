
-- 1. Services table
CREATE TABLE IF NOT EXISTS public.site_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  name text NOT NULL,
  description text,
  endpoint_url text,
  status text NOT NULL DEFAULT 'active',
  is_public boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(website_id, service_type, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_services TO authenticated;
GRANT ALL ON public.site_services TO service_role;

ALTER TABLE public.site_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_services read all authenticated"
  ON public.site_services FOR SELECT TO authenticated USING (true);

CREATE POLICY "site_services insert authenticated"
  ON public.site_services FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "site_services update authenticated"
  ON public.site_services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "site_services delete owner"
  ON public.site_services FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'system_owner') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_site_services_touch
  BEFORE UPDATE ON public.site_services
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Dependencies (which site consumes which service from which provider)
CREATE TABLE IF NOT EXISTS public.service_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  consumer_website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  provider_website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.site_services(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(consumer_website_id, service_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_dependencies TO authenticated;
GRANT ALL ON public.service_dependencies TO service_role;

ALTER TABLE public.service_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_dependencies read all authenticated"
  ON public.service_dependencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_dependencies insert authenticated"
  ON public.service_dependencies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "service_dependencies update authenticated"
  ON public.service_dependencies FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "service_dependencies delete admin"
  ON public.service_dependencies FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'system_owner') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_service_deps_touch
  BEFORE UPDATE ON public.service_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_site_services_website ON public.site_services(website_id);
CREATE INDEX IF NOT EXISTS idx_service_deps_consumer ON public.service_dependencies(consumer_website_id);
CREATE INDEX IF NOT EXISTS idx_service_deps_provider ON public.service_dependencies(provider_website_id);
