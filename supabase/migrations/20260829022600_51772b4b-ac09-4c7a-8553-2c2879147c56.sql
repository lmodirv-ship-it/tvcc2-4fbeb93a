ALTER TABLE public.site_backups
  ADD COLUMN IF NOT EXISTS target_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dest_path text,
  ADD COLUMN IF NOT EXISTS is_latest boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_site_backups_latest ON public.site_backups(website_id, backup_type) WHERE is_latest;

ALTER TABLE public.backup_schedules
  ADD COLUMN IF NOT EXISTS target_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dest_path text,
  ADD COLUMN IF NOT EXISTS label text;

ALTER TABLE public.databases
  ADD COLUMN IF NOT EXISTS db_kind text NOT NULL DEFAULT 'cloud',
  ADD COLUMN IF NOT EXISTS port integer,
  ADD COLUMN IF NOT EXISTS db_name text,
  ADD COLUMN IF NOT EXISTS server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS connection_url text,
  ADD COLUMN IF NOT EXISTS sync_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS linked_database_id uuid REFERENCES public.databases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS env_key text,
  ADD COLUMN IF NOT EXISTS last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.site_services
  ADD COLUMN IF NOT EXISTS link_method text NOT NULL DEFAULT 'api',
  ADD COLUMN IF NOT EXISTS auth_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS port integer,
  ADD COLUMN IF NOT EXISTS health_path text,
  ADD COLUMN IF NOT EXISTS script text;

ALTER TABLE public.service_dependencies
  ADD COLUMN IF NOT EXISTS link_method text NOT NULL DEFAULT 'api',
  ADD COLUMN IF NOT EXISTS env_prefix text,
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;