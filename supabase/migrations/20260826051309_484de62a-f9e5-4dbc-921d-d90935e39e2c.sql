
-- 1) Extend the time-series metrics table with richer telemetry
ALTER TABLE public.server_metrics
  ADD COLUMN IF NOT EXISTS load5 numeric,
  ADD COLUMN IF NOT EXISTS load15 numeric,
  ADD COLUMN IF NOT EXISTS cpu_temp_c numeric,
  ADD COLUMN IF NOT EXISTS cpu_mhz numeric,
  ADD COLUMN IF NOT EXISTS cpu_cores integer,
  ADD COLUMN IF NOT EXISTS mem_available_mb numeric,
  ADD COLUMN IF NOT EXISTS swap_used_mb numeric,
  ADD COLUMN IF NOT EXISTS swap_total_mb numeric,
  ADD COLUMN IF NOT EXISTS net_rx_bps numeric,
  ADD COLUMN IF NOT EXISTS net_tx_bps numeric,
  ADD COLUMN IF NOT EXISTS latency_ms numeric,
  ADD COLUMN IF NOT EXISTS top_processes jsonb;

-- 2) Latest disk state per server (history stays in server_metrics)
CREATE TABLE public.server_disks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  mount text NOT NULL,
  device text,
  total_gb numeric,
  used_gb numeric,
  read_bps numeric,
  write_bps numeric,
  iops numeric,
  inodes_pct numeric,
  health text DEFAULT 'ok',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, mount)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_disks TO authenticated;
GRANT ALL ON public.server_disks TO service_role;
ALTER TABLE public.server_disks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage server_disks" ON public.server_disks FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 3) Latest systemd service states per server
CREATE TABLE public.server_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'unknown',
  sub_status text,
  restarts integer,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_services TO authenticated;
GRANT ALL ON public.server_services TO service_role;
ALTER TABLE public.server_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage server_services" ON public.server_services FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 4) Latest docker container states per server
CREATE TABLE public.server_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  image text,
  status text,
  state text,
  cpu_pct numeric,
  mem_mb numeric,
  restarts integer,
  ports text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_containers TO authenticated;
GRANT ALL ON public.server_containers TO service_role;
ALTER TABLE public.server_containers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage server_containers" ON public.server_containers FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 5) Latest network interface counters per server
CREATE TABLE public.server_net_interfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name text NOT NULL,
  rx_bps numeric,
  tx_bps numeric,
  rx_errors numeric,
  tx_errors numeric,
  rx_dropped numeric,
  tx_dropped numeric,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_net_interfaces TO authenticated;
GRANT ALL ON public.server_net_interfaces TO service_role;
ALTER TABLE public.server_net_interfaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage server_net_interfaces" ON public.server_net_interfaces FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 6) Live security summary per server (single row per server)
CREATE TABLE public.server_security (
  server_id uuid PRIMARY KEY REFERENCES public.servers(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  failed_ssh_24h integer DEFAULT 0,
  updates_pending integer DEFAULT 0,
  firewall_active boolean,
  active_users integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_security TO authenticated;
GRANT ALL ON public.server_security TO service_role;
ALTER TABLE public.server_security ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage server_security" ON public.server_security FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

-- 7) Important server events timeline
CREATE TABLE public.server_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_events TO authenticated;
GRANT ALL ON public.server_events TO service_role;
ALTER TABLE public.server_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage server_events" ON public.server_events FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));

CREATE INDEX IF NOT EXISTS server_events_server_created ON public.server_events (server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS server_metrics_server_collected ON public.server_metrics (server_id, collected_at DESC);
