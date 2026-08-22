-- 1. site_runtimes: how each website is actually run on a server
CREATE TABLE public.site_runtimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  domain text NOT NULL,
  runtime_kind text NOT NULL DEFAULT 'static',
  port integer,
  root_path text,
  unit_name text,
  exec_start text,
  status text NOT NULL DEFAULT 'unknown',
  memory_mb numeric,
  last_output text,
  last_restart_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_runtimes TO authenticated;
GRANT ALL ON public.site_runtimes TO service_role;
ALTER TABLE public.site_runtimes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_runtimes manage" ON public.site_runtimes FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER site_runtimes_touch BEFORE UPDATE ON public.site_runtimes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. site_databases: link a website to a database (local / lan / cloud)
CREATE TABLE public.site_databases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  database_id uuid REFERENCES public.databases(id) ON DELETE SET NULL,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  connection_kind text NOT NULL DEFAULT 'local',
  role text NOT NULL DEFAULT 'primary',
  db_engine text NOT NULL DEFAULT 'postgres',
  db_name text,
  db_user text,
  host text,
  port integer,
  secret_id uuid REFERENCES public.vault_secrets(id) ON DELETE SET NULL,
  env_key text NOT NULL DEFAULT 'DATABASE_URL',
  status text NOT NULL DEFAULT 'pending',
  latency_ms integer,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_databases TO authenticated;
GRANT ALL ON public.site_databases TO service_role;
ALTER TABLE public.site_databases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_databases manage" ON public.site_databases FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER site_databases_touch BEFORE UPDATE ON public.site_databases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. storage_events: live storage / sync activity log
CREATE TABLE public.storage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  storage_id uuid REFERENCES public.storages(id) ON DELETE CASCADE,
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  event_kind text NOT NULL,
  path text,
  size_mb numeric,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_events TO authenticated;
GRANT ALL ON public.storage_events TO service_role;
ALTER TABLE public.storage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "storage_events manage" ON public.storage_events FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE INDEX storage_events_recent_idx ON public.storage_events (owner_id, created_at DESC);

-- 4. live sync settings
ALTER TABLE public.storages
  ADD COLUMN IF NOT EXISTS watch_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_written boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'idle';

ALTER TABLE public.site_cluster_members
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS sync_interval_seconds integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'idle';