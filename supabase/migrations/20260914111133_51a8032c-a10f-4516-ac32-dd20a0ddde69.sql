-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  resource text,
  resource_id text,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'info',
  before_data jsonb,
  after_data jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage audit log" ON public.audit_log
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE INDEX idx_audit_log_created ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_website ON public.audit_log (website_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON public.audit_log (action, created_at DESC);

-- ============ ALERT RULES ============
CREATE TABLE public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  scope text NOT NULL DEFAULT 'fleet',
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  metric text NOT NULL,
  comparator text NOT NULL DEFAULT 'gt',
  threshold numeric NOT NULL,
  for_seconds integer NOT NULL DEFAULT 60,
  severity text NOT NULL DEFAULT 'warning',
  channel text NOT NULL DEFAULT 'in_app',
  is_active boolean NOT NULL DEFAULT true,
  last_fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_rules TO authenticated;
GRANT ALL ON public.alert_rules TO service_role;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage alert rules" ON public.alert_rules
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER trg_alert_rules_touch BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ QUERY HISTORY ============
CREATE TABLE public.query_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  sql_text text NOT NULL,
  mode text NOT NULL DEFAULT 'read',
  target_kind text NOT NULL DEFAULT 'sites',
  target_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  group_id uuid REFERENCES public.site_groups(id) ON DELETE SET NULL,
  targets_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  took_ms integer,
  status text NOT NULL DEFAULT 'pending',
  results jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.query_history TO authenticated;
GRANT ALL ON public.query_history TO service_role;
ALTER TABLE public.query_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage query history" ON public.query_history
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE INDEX idx_query_history_created ON public.query_history (created_at DESC);

-- ============ EXTEND EXISTING ============
ALTER TABLE public.site_groups
  ADD COLUMN IF NOT EXISTS group_kind text NOT NULL DEFAULT 'category',
  ADD COLUMN IF NOT EXISTS group_key text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_auto boolean NOT NULL DEFAULT false;

ALTER TABLE public.backup_schedules
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.site_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS copies integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS encrypt boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_verify_at timestamptz,
  ADD COLUMN IF NOT EXISTS verify_status text;

ALTER TABLE public.site_backups
  ADD COLUMN IF NOT EXISTS copy_index integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS encrypted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.agent_jobs
  ADD COLUMN IF NOT EXISTS steps_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_step text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.databases
  ADD COLUMN IF NOT EXISTS migration_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS tables_count integer,
  ADD COLUMN IF NOT EXISTS rows_count bigint,
  ADD COLUMN IF NOT EXISTS last_migration_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;