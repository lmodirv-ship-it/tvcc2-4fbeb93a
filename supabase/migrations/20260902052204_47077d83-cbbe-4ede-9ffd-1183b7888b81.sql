CREATE TABLE public.publish_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'domain',
  url text NOT NULL,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  service_name text,
  port integer,
  is_canonical boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  health_url text,
  last_publish_at timestamptz,
  last_status text,
  last_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.publish_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  target_id uuid NOT NULL REFERENCES public.publish_targets(id) ON DELETE CASCADE,
  trigger text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  command_id uuid,
  output text,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_targets TO authenticated;
GRANT ALL ON public.publish_targets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publish_runs TO authenticated;
GRANT ALL ON public.publish_runs TO service_role;

ALTER TABLE public.publish_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "publish_targets_manage" ON public.publish_targets
  FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

CREATE POLICY "publish_runs_manage" ON public.publish_runs
  FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

CREATE INDEX idx_publish_runs_target ON public.publish_runs(target_id, created_at DESC);
CREATE UNIQUE INDEX idx_publish_targets_owner_url ON public.publish_targets(owner_id, url);

CREATE TRIGGER publish_targets_touch BEFORE UPDATE ON public.publish_targets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();