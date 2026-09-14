ALTER TABLE public.site_databases
  ADD COLUMN IF NOT EXISTS site_code text,
  ADD COLUMN IF NOT EXISTS schema_name text,
  ADD COLUMN IF NOT EXISTS server_path text,
  ADD COLUMN IF NOT EXISTS provisioning_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS provisioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS provisioning_error text;

CREATE UNIQUE INDEX IF NOT EXISTS site_databases_site_code_unique
  ON public.site_databases(site_code) WHERE site_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_databases_provisioning_status_idx
  ON public.site_databases(provisioning_status);

ALTER TABLE public.databases
  ADD COLUMN IF NOT EXISTS pairing_status text NOT NULL DEFAULT 'unpaired',
  ADD COLUMN IF NOT EXISTS agent_id text,
  ADD COLUMN IF NOT EXISTS agent_last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS public_endpoint text,
  ADD COLUMN IF NOT EXISTS tunnel_id uuid REFERENCES public.server_tunnels(id) ON DELETE SET NULL;

ALTER TABLE public.query_history
  ADD COLUMN IF NOT EXISTS database_id uuid REFERENCES public.databases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS confirmed_write boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS query_history_database_created_idx
  ON public.query_history(database_id, created_at DESC);

CREATE TABLE public.db_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  database_id uuid NOT NULL REFERENCES public.databases(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  agent_instance_id uuid REFERENCES public.agent_instances(id) ON DELETE SET NULL,
  tunnel_id uuid REFERENCES public.server_tunnels(id) ON DELETE SET NULL,
  connection_kind text NOT NULL DEFAULT 'agent',
  status text NOT NULL DEFAULT 'pending',
  pairing_code_hash text,
  pairing_expires_at timestamptz,
  certificate_fingerprint text,
  certificate_expires_at timestamptz,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  last_latency_ms integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(database_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.db_connections TO authenticated;
GRANT ALL ON public.db_connections TO service_role;
ALTER TABLE public.db_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "db_connections_admin_manage" ON public.db_connections
  FOR ALL TO authenticated
  USING (public.can_manage(owner_id))
  WITH CHECK (public.can_manage(owner_id));
CREATE INDEX db_connections_server_idx ON public.db_connections(server_id);
CREATE INDEX db_connections_status_idx ON public.db_connections(status, last_seen_at DESC);
CREATE TRIGGER db_connections_touch BEFORE UPDATE ON public.db_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.db_connections (owner_id, database_id, server_id, connection_kind, status, capabilities)
SELECT d.owner_id, d.id, d.server_id,
       CASE WHEN d.db_kind = 'local' THEN 'agent' ELSE 'direct' END,
       CASE WHEN d.db_kind = 'local' THEN 'awaiting_agent_upgrade' ELSE 'available' END,
       CASE WHEN d.db_kind = 'local'
         THEN '{"postgres":true,"postgrest":true,"auth":true,"storage":true,"realtime":true,"functions":true,"import_export":true}'::jsonb
         ELSE '{"postgres":true,"import_export":true}'::jsonb END
FROM public.databases d
ON CONFLICT (database_id) DO NOTHING;