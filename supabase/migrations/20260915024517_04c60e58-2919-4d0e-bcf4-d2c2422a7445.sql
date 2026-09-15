CREATE SCHEMA IF NOT EXISTS local_mirror;
GRANT USAGE ON SCHEMA local_mirror TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA local_mirror GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA local_mirror GRANT ALL ON TABLES TO service_role;

CREATE TABLE IF NOT EXISTS public.db_sync_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  label text NOT NULL,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 8000,
  database_name text NOT NULL DEFAULT 'postgres',
  schema_name text NOT NULL DEFAULT 'public',
  mode text NOT NULL DEFAULT 'script',
  server_id uuid REFERENCES public.servers(id),
  website_id uuid REFERENCES public.websites(id),
  interval_seconds integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  lag_seconds integer NOT NULL DEFAULT 0,
  last_beacon_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.db_sync_sources TO authenticated;
GRANT ALL ON public.db_sync_sources TO service_role;
ALTER TABLE public.db_sync_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "db_sync_sources_manage" ON public.db_sync_sources
  FOR ALL TO authenticated
  USING (private.can_manage(owner_id)) WITH CHECK (private.can_manage(owner_id));
CREATE TRIGGER db_sync_sources_touch BEFORE UPDATE ON public.db_sync_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.db_sync_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  source_id uuid NOT NULL REFERENCES public.db_sync_sources(id),
  table_name text NOT NULL,
  primary_key text[] NOT NULL DEFAULT '{}',
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  strategy text NOT NULL DEFAULT 'cursor',
  cursor_column text,
  last_cursor text,
  local_rows bigint NOT NULL DEFAULT 0,
  mirror_rows bigint NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_status text NOT NULL DEFAULT 'pending',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, table_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.db_sync_tables TO authenticated;
GRANT ALL ON public.db_sync_tables TO service_role;
ALTER TABLE public.db_sync_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "db_sync_tables_manage" ON public.db_sync_tables
  FOR ALL TO authenticated
  USING (private.can_manage(owner_id)) WITH CHECK (private.can_manage(owner_id));
CREATE TRIGGER db_sync_tables_touch BEFORE UPDATE ON public.db_sync_tables
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS db_sync_tables_source_idx ON public.db_sync_tables(source_id);

CREATE TABLE IF NOT EXISTS public.db_sync_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  source_id uuid NOT NULL REFERENCES public.db_sync_sources(id),
  table_name text NOT NULL,
  rows_sent integer NOT NULL DEFAULT 0,
  rows_applied integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.db_sync_batches TO authenticated;
GRANT ALL ON public.db_sync_batches TO service_role;
ALTER TABLE public.db_sync_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "db_sync_batches_manage" ON public.db_sync_batches
  FOR ALL TO authenticated
  USING (private.can_manage(owner_id)) WITH CHECK (private.can_manage(owner_id));
CREATE INDEX IF NOT EXISTS db_sync_batches_source_idx ON public.db_sync_batches(source_id, created_at DESC);