-- 1) FAILOVER
CREATE TABLE public.failover_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  primary_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  backup_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  health_url text,
  check_interval_sec integer NOT NULL DEFAULT 60,
  failure_threshold integer NOT NULL DEFAULT 3,
  auto_failback boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  current_state text NOT NULL DEFAULT 'primary',
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.failover_policies TO authenticated;
GRANT ALL ON public.failover_policies TO service_role;
ALTER TABLE public.failover_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "failover_policies_manage" ON public.failover_policies FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER failover_policies_touch BEFORE UPDATE ON public.failover_policies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.failover_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  policy_id uuid REFERENCES public.failover_policies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  to_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.failover_events TO authenticated;
GRANT ALL ON public.failover_events TO service_role;
ALTER TABLE public.failover_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "failover_events_manage" ON public.failover_events FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 2) AGENT INSTALLERS
CREATE TABLE public.agent_installers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  label text,
  os_target text NOT NULL DEFAULT 'linux',
  install_command text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_installers TO authenticated;
GRANT ALL ON public.agent_installers TO service_role;
ALTER TABLE public.agent_installers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_installers_manage" ON public.agent_installers FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 3) GIT DEPLOY
CREATE TABLE public.git_repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'github',
  repo_url text NOT NULL,
  branch text NOT NULL DEFAULT 'main',
  build_command text,
  output_dir text,
  deploy_path text,
  auto_deploy boolean NOT NULL DEFAULT false,
  webhook_secret text,
  last_commit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.git_repositories TO authenticated;
GRANT ALL ON public.git_repositories TO service_role;
ALTER TABLE public.git_repositories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "git_repositories_manage" ON public.git_repositories FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER git_repositories_touch BEFORE UPDATE ON public.git_repositories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.git_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  repository_id uuid REFERENCES public.git_repositories(id) ON DELETE CASCADE,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  commit_sha text,
  commit_message text,
  trigger_source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'queued',
  logs text,
  command_id uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.git_deployments TO authenticated;
GRANT ALL ON public.git_deployments TO service_role;
ALTER TABLE public.git_deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "git_deployments_manage" ON public.git_deployments FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 4) UPTIME
CREATE TABLE public.uptime_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  method text NOT NULL DEFAULT 'GET',
  expected_status integer NOT NULL DEFAULT 200,
  interval_sec integer NOT NULL DEFAULT 300,
  timeout_ms integer NOT NULL DEFAULT 10000,
  is_active boolean NOT NULL DEFAULT true,
  last_status text,
  last_latency_ms integer,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uptime_monitors TO authenticated;
GRANT ALL ON public.uptime_monitors TO service_role;
ALTER TABLE public.uptime_monitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uptime_monitors_manage" ON public.uptime_monitors FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER uptime_monitors_touch BEFORE UPDATE ON public.uptime_monitors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.uptime_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  monitor_id uuid REFERENCES public.uptime_monitors(id) ON DELETE CASCADE,
  status text NOT NULL,
  http_status integer,
  latency_ms integer,
  error_message text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uptime_checks TO authenticated;
GRANT ALL ON public.uptime_checks TO service_role;
ALTER TABLE public.uptime_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uptime_checks_manage" ON public.uptime_checks FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 5) SCHEDULED TASKS
CREATE TABLE public.scheduled_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  task_type text NOT NULL,
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  schedule_kind text NOT NULL DEFAULT 'interval',
  interval_minutes integer NOT NULL DEFAULT 60,
  cron_expression text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_tasks TO authenticated;
GRANT ALL ON public.scheduled_tasks TO service_role;
ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scheduled_tasks_manage" ON public.scheduled_tasks FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER scheduled_tasks_touch BEFORE UPDATE ON public.scheduled_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.task_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  task_id uuid REFERENCES public.scheduled_tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  output text,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_runs TO authenticated;
GRANT ALL ON public.task_runs TO service_role;
ALTER TABLE public.task_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_runs_manage" ON public.task_runs FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 6) WEBHOOKS
CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  direction text NOT NULL DEFAULT 'outgoing',
  url text NOT NULL,
  secret text,
  events text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  last_delivery_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_endpoints_manage" ON public.webhook_endpoints FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER webhook_endpoints_touch BEFORE UPDATE ON public.webhook_endpoints FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  endpoint_id uuid REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  response_code integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_deliveries_manage" ON public.webhook_deliveries FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 7) USAGE / COST
CREATE TABLE public.usage_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  category text NOT NULL,
  provider text,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'unit',
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  period_start date,
  period_end date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_costs TO authenticated;
GRANT ALL ON public.usage_costs TO service_role;
ALTER TABLE public.usage_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_costs_manage" ON public.usage_costs FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));