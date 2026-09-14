CREATE TABLE public.backup_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  host text NOT NULL,
  username text NOT NULL DEFAULT 'root',
  port integer NOT NULL DEFAULT 22,
  secret_id uuid REFERENCES public.vault_secrets(id) ON DELETE SET NULL,
  base_path text NOT NULL DEFAULT '/srv/tvcc-backups',
  is_enabled boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  last_run_status text,
  last_run_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_destinations TO authenticated;
GRANT ALL ON public.backup_destinations TO service_role;
ALTER TABLE public.backup_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage their backup destinations"
  ON public.backup_destinations FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER backup_destinations_touch BEFORE UPDATE ON public.backup_destinations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.site_backup_copies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  destination_id uuid NOT NULL REFERENCES public.backup_destinations(id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  domain text NOT NULL,
  copy_kind text NOT NULL CHECK (copy_kind IN ('first','current')),
  remote_path text NOT NULL,
  size_bytes bigint,
  checksum text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  command_id uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (destination_id, website_id, copy_kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_backup_copies TO authenticated;
GRANT ALL ON public.site_backup_copies TO service_role;
ALTER TABLE public.site_backup_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage their site backup copies"
  ON public.site_backup_copies FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER site_backup_copies_touch BEFORE UPDATE ON public.site_backup_copies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_site_backup_copies_dest ON public.site_backup_copies (destination_id, domain);