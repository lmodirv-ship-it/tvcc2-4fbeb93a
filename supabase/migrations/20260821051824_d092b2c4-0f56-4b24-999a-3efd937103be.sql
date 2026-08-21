
ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS network_kind text NOT NULL DEFAULT 'cloud',
  ADD COLUMN IF NOT EXISTS private_ip text,
  ADD COLUMN IF NOT EXISTS is_tvcc_node boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tvcc_version text,
  ADD COLUMN IF NOT EXISTS tvcc_url text;

ALTER TABLE public.storages
  ADD COLUMN IF NOT EXISTS server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS path text,
  ADD COLUMN IF NOT EXISTS bucket text,
  ADD COLUMN IF NOT EXISTS auto_provisioned boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.server_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  target_server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'sync',
  channel text NOT NULL DEFAULT 'public',
  target_port integer NOT NULL DEFAULT 22,
  status text NOT NULL DEFAULT 'unknown',
  latency_ms integer,
  last_checked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT server_links_distinct CHECK (source_server_id <> target_server_id),
  CONSTRAINT server_links_unique UNIQUE (source_server_id, target_server_id, link_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_links TO authenticated;
GRANT ALL ON public.server_links TO service_role;
ALTER TABLE public.server_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server_links owner only" ON public.server_links FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER server_links_touch BEFORE UPDATE ON public.server_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.site_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  primary_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_clusters_key_unique UNIQUE (owner_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_clusters TO authenticated;
GRANT ALL ON public.site_clusters TO service_role;
ALTER TABLE public.site_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_clusters owner only" ON public.site_clusters FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER site_clusters_touch BEFORE UPDATE ON public.site_clusters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.site_cluster_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cluster_id uuid NOT NULL REFERENCES public.site_clusters(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text,
  role text NOT NULL DEFAULT 'replica',
  status text NOT NULL DEFAULT 'unknown',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_cluster_members_unique UNIQUE (cluster_id, server_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_cluster_members TO authenticated;
GRANT ALL ON public.site_cluster_members TO service_role;
ALTER TABLE public.site_cluster_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_cluster_members owner only" ON public.site_cluster_members FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.site_provisioning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  step text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  detail text,
  command_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_provisioning_unique UNIQUE (website_id, step)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_provisioning TO authenticated;
GRANT ALL ON public.site_provisioning TO service_role;
ALTER TABLE public.site_provisioning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_provisioning owner only" ON public.site_provisioning FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER site_provisioning_touch BEFORE UPDATE ON public.site_provisioning
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
