CREATE TABLE IF NOT EXISTS public.site_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  key_hash text,
  version text,
  status text NOT NULL DEFAULT 'pending',
  last_beacon_at timestamptz,
  last_ip text,
  beacons bigint NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_agents TO authenticated;
GRANT ALL ON public.site_agents TO service_role;

ALTER TABLE public.site_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_agents_owner_admin_all" ON public.site_agents
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'system_owner'));

CREATE INDEX IF NOT EXISTS site_agents_website_idx ON public.site_agents(website_id);
CREATE INDEX IF NOT EXISTS site_agents_beacon_idx ON public.site_agents(last_beacon_at DESC);

CREATE TRIGGER site_agents_touch BEFORE UPDATE ON public.site_agents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();