CREATE TABLE IF NOT EXISTS public.monitoring_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('site','server')),
  code text,
  label text,
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'unknown',
  last_beacon_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS monitoring_entities_site_uidx ON public.monitoring_entities(website_id) WHERE website_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS monitoring_entities_server_uidx ON public.monitoring_entities(server_id) WHERE website_id IS NULL AND server_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_entities TO authenticated;
GRANT ALL ON public.monitoring_entities TO service_role;
ALTER TABLE public.monitoring_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitoring_entities_admin" ON public.monitoring_entities FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER monitoring_entities_touch BEFORE UPDATE ON public.monitoring_entities FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.monitoring_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  service_id uuid,
  schedule_id uuid,
  role text NOT NULL DEFAULT 'hosts',
  status text NOT NULL DEFAULT 'active',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monitoring_links_site_idx ON public.monitoring_links(website_id);
CREATE INDEX IF NOT EXISTS monitoring_links_server_idx ON public.monitoring_links(server_id);
CREATE UNIQUE INDEX IF NOT EXISTS monitoring_links_uidx ON public.monitoring_links(coalesce(website_id,'00000000-0000-0000-0000-000000000000'::uuid), coalesce(server_id,'00000000-0000-0000-0000-000000000000'::uuid), role);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_links TO authenticated;
GRANT ALL ON public.monitoring_links TO service_role;
ALTER TABLE public.monitoring_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitoring_links_admin" ON public.monitoring_links FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER monitoring_links_touch BEFORE UPDATE ON public.monitoring_links FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.monitoring_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  key_type text NOT NULL CHECK (key_type IN ('site','server','shared')),
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  previous_fingerprint text,
  version integer NOT NULL DEFAULT 1,
  grace_until timestamptz,
  enforced boolean NOT NULL DEFAULT false,
  rotated_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS monitoring_keys_site_uidx ON public.monitoring_keys(website_id) WHERE website_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS monitoring_keys_server_uidx ON public.monitoring_keys(server_id) WHERE server_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS monitoring_keys_shared_uidx ON public.monitoring_keys(key_type) WHERE key_type = 'shared';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_keys TO authenticated;
GRANT ALL ON public.monitoring_keys TO service_role;
ALTER TABLE public.monitoring_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitoring_keys_admin" ON public.monitoring_keys FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER monitoring_keys_touch BEFORE UPDATE ON public.monitoring_keys FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.monitoring_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  day date NOT NULL DEFAULT current_date,
  sites integer NOT NULL DEFAULT 0,
  active_sites integer NOT NULL DEFAULT 0,
  connected_sites integer NOT NULL DEFAULT 0,
  online_servers integer NOT NULL DEFAULT 0,
  beacons bigint NOT NULL DEFAULT 0,
  local_rows bigint NOT NULL DEFAULT 0,
  mirror_rows bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS monitoring_metrics_daily_uidx ON public.monitoring_metrics_daily(owner_id, day);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_metrics_daily TO authenticated;
GRANT ALL ON public.monitoring_metrics_daily TO service_role;
ALTER TABLE public.monitoring_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitoring_metrics_daily_admin" ON public.monitoring_metrics_daily FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER monitoring_metrics_daily_touch BEFORE UPDATE ON public.monitoring_metrics_daily FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();