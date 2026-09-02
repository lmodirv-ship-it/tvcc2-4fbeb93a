-- 1) VPN peers between servers
CREATE TABLE public.server_vpn_peers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  peer_server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  interface text NOT NULL DEFAULT 'wg0',
  internal_ip text NOT NULL,
  public_key text,
  endpoint text,
  allowed_ips text NOT NULL DEFAULT '10.77.0.0/24',
  listen_port integer NOT NULL DEFAULT 51820,
  keepalive integer NOT NULL DEFAULT 25,
  vault_secret_id uuid REFERENCES public.vault_secrets(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  last_handshake_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, internal_ip)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_vpn_peers TO authenticated;
GRANT ALL ON public.server_vpn_peers TO service_role;
ALTER TABLE public.server_vpn_peers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vpn_peers_manage" ON public.server_vpn_peers FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER server_vpn_peers_touch BEFORE UPDATE ON public.server_vpn_peers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Automation rules per server
CREATE TABLE public.server_automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  metric text NOT NULL,
  comparator text NOT NULL DEFAULT 'gt',
  threshold numeric NOT NULL DEFAULT 90,
  action text NOT NULL,
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify boolean NOT NULL DEFAULT true,
  cooldown_minutes integer NOT NULL DEFAULT 30,
  enabled boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  trigger_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_automation_rules TO authenticated;
GRANT ALL ON public.server_automation_rules TO service_role;
ALTER TABLE public.server_automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules_manage" ON public.server_automation_rules FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER server_automation_rules_touch BEFORE UPDATE ON public.server_automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Health score snapshots
CREATE TABLE public.server_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 100,
  level text NOT NULL DEFAULT 'healthy',
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  cpu_percent numeric,
  memory_percent numeric,
  disk_percent numeric,
  services_down integer NOT NULL DEFAULT 0,
  ports_down integer NOT NULL DEFAULT 0,
  heartbeat_age_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX server_health_snapshots_server_time ON public.server_health_snapshots (server_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.server_health_snapshots TO authenticated;
GRANT ALL ON public.server_health_snapshots TO service_role;
ALTER TABLE public.server_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_snapshots_manage" ON public.server_health_snapshots FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 4) Boot restore reports
CREATE TABLE public.server_boot_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  agent_version text,
  boot_at timestamptz NOT NULL DEFAULT now(),
  restored jsonb NOT NULL DEFAULT '[]'::jsonb,
  failed jsonb NOT NULL DEFAULT '[]'::jsonb,
  previous_ip text,
  current_ip text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX server_boot_reports_server_time ON public.server_boot_reports (server_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.server_boot_reports TO authenticated;
GRANT ALL ON public.server_boot_reports TO service_role;
ALTER TABLE public.server_boot_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boot_reports_manage" ON public.server_boot_reports FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));