CREATE TABLE public.monitoring_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  website_id uuid references public.websites(id) on delete cascade,
  server_id uuid references public.servers(id) on delete cascade,
  event_type text not null,
  message text,
  status text not null default 'info',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_events TO authenticated;
GRANT ALL ON public.monitoring_events TO service_role;
ALTER TABLE public.monitoring_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitoring_events_admin" ON public.monitoring_events FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'system_owner'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'system_owner'::public.app_role));
CREATE INDEX monitoring_events_website_idx ON public.monitoring_events(website_id, created_at DESC);
CREATE INDEX monitoring_events_server_idx ON public.monitoring_events(server_id, created_at DESC);

CREATE TABLE public.tvcc_nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  server_id uuid references public.servers(id) on delete set null,
  node_code text not null unique,
  label text,
  base_url text,
  key_fingerprint text,
  version text,
  status text not null default 'pending',
  last_beacon_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tvcc_nodes TO authenticated;
GRANT ALL ON public.tvcc_nodes TO service_role;
ALTER TABLE public.tvcc_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tvcc_nodes_admin" ON public.tvcc_nodes FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'system_owner'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'system_owner'::public.app_role));
CREATE TRIGGER tvcc_nodes_touch BEFORE UPDATE ON public.tvcc_nodes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.tvcc_node_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  source_node_id uuid not null references public.tvcc_nodes(id) on delete cascade,
  target_node_id uuid not null references public.tvcc_nodes(id) on delete cascade,
  link_type text not null default 'mesh',
  status text not null default 'pending',
  key_fingerprint text,
  last_exchange_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_node_id, target_node_id, link_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tvcc_node_links TO authenticated;
GRANT ALL ON public.tvcc_node_links TO service_role;
ALTER TABLE public.tvcc_node_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tvcc_node_links_admin" ON public.tvcc_node_links FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'system_owner'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role) OR private.has_role(auth.uid(),'system_owner'::public.app_role));
CREATE TRIGGER tvcc_node_links_touch BEFORE UPDATE ON public.tvcc_node_links FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();