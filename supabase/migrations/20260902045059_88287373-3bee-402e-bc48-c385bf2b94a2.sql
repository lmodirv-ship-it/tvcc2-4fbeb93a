-- 1) Agent instance per server
CREATE TABLE public.agent_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  agent_id text,
  agent_version text,
  os text,
  status text NOT NULL DEFAULT 'unknown',
  last_poll_at timestamptz,
  last_heartbeat_at timestamptz,
  running_commands integer NOT NULL DEFAULT 0,
  poll_latency_ms integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_instances TO authenticated;
GRANT ALL ON public.agent_instances TO service_role;
ALTER TABLE public.agent_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own agent instances" ON public.agent_instances FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER agent_instances_touch BEFORE UPDATE ON public.agent_instances
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Agent roles (bundles of allowed actions)
CREATE TABLE public.agent_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  actions text[] NOT NULL DEFAULT '{}',
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_roles TO authenticated;
GRANT ALL ON public.agent_roles TO service_role;
ALTER TABLE public.agent_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own agent roles" ON public.agent_roles FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER agent_roles_touch BEFORE UPDATE ON public.agent_roles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Role bindings: server -> role
CREATE TABLE public.agent_role_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.agent_roles(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, role_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_role_bindings TO authenticated;
GRANT ALL ON public.agent_role_bindings TO service_role;
ALTER TABLE public.agent_role_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own agent role bindings" ON public.agent_role_bindings FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 4) Per-server per-action capabilities
CREATE TABLE public.agent_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  action text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  requires_confirm boolean NOT NULL DEFAULT false,
  max_per_hour integer NOT NULL DEFAULT 60,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, action)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_capabilities TO authenticated;
GRANT ALL ON public.agent_capabilities TO service_role;
ALTER TABLE public.agent_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own agent capabilities" ON public.agent_capabilities FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER agent_capabilities_touch BEFORE UPDATE ON public.agent_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) High level jobs and their steps
CREATE TABLE public.agent_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  website_id uuid,
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'custom',
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text,
  requested_by uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_jobs TO authenticated;
GRANT ALL ON public.agent_jobs TO service_role;
ALTER TABLE public.agent_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own agent jobs" ON public.agent_jobs FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER agent_jobs_touch BEFORE UPDATE ON public.agent_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.agent_job_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.agent_jobs(id) ON DELETE CASCADE,
  step_no integer NOT NULL DEFAULT 1,
  action text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  command_id uuid,
  status text NOT NULL DEFAULT 'pending',
  output text,
  exit_code integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_job_steps TO authenticated;
GRANT ALL ON public.agent_job_steps TO service_role;
ALTER TABLE public.agent_job_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own agent job steps" ON public.agent_job_steps FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER agent_job_steps_touch BEFORE UPDATE ON public.agent_job_steps
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6) Command timing / progress / job link
ALTER TABLE public.server_commands
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS progress text,
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.agent_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.server_commands REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.server_commands;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 7) Security: restrict identity signals reads to admins / system owners
DROP POLICY IF EXISTS "signals readable by authenticated" ON public.hn_group_identity_signals;
CREATE POLICY "signals readable by admins" ON public.hn_group_identity_signals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'));