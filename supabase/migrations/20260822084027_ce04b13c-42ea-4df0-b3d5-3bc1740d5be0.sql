-- 1. can_manage: owner, system owner, or platform admin
CREATE OR REPLACE FUNCTION public.can_manage(_owner uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    _owner = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','system_owner'))
  )
$$;

-- 2. port_links
CREATE TABLE IF NOT EXISTS public.port_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text,
  source_server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  source_port integer NOT NULL,
  target_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  target_host text,
  target_port integer NOT NULL,
  bridge_kind text NOT NULL DEFAULT 'tcp_forward',
  status text NOT NULL DEFAULT 'pending',
  last_checked_at timestamptz,
  latency_ms integer,
  last_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.port_links TO authenticated;
GRANT ALL ON public.port_links TO service_role;
ALTER TABLE public.port_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "port_links_manage" ON public.port_links FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER port_links_touch BEFORE UPDATE ON public.port_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. server_ports extra columns
ALTER TABLE public.server_ports
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS managed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_kind text,
  ADD COLUMN IF NOT EXISTS note text;

-- 4. ai_models port binding
ALTER TABLE public.ai_models
  ADD COLUMN IF NOT EXISTS port integer,
  ADD COLUMN IF NOT EXISTS server_port_id uuid REFERENCES public.server_ports(id) ON DELETE SET NULL;

-- 5. admin (= owner-level) access on operational tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'websites','servers','server_ports','server_sites','server_metrics','server_configs',
    'server_commands','server_links','site_services','service_dependencies','site_clusters',
    'site_cluster_members','ai_providers','ai_models','ai_routing','site_groups','domains',
    'ssl_certificates','clients','subscriptions','storages','databases','site_provisioning',
    'website_env_vars','backup_schedules','site_backups','operation_log'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_manage', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id))',
      t || '_admin_manage', t);
  END LOOP;
END $$;
