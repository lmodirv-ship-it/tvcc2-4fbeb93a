
CREATE TABLE IF NOT EXISTS public.storage_link_beacons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  destination_id uuid REFERENCES public.backup_destinations(id),
  hostname text,
  base_path text,
  agent_version text,
  status text NOT NULL DEFAULT 'online',
  domains_count integer DEFAULT 0,
  folders_count integer DEFAULT 0,
  sites_found integer DEFAULT 0,
  disk_total_gb numeric,
  disk_free_gb numeric,
  mem_total_mb numeric,
  mem_free_mb numeric,
  load_avg numeric,
  uptime_seconds bigint,
  latency_ms integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_ping_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS storage_link_beacons_dest_host_uidx
  ON public.storage_link_beacons (destination_id, coalesce(hostname, ''));
CREATE INDEX IF NOT EXISTS storage_link_beacons_owner_idx ON public.storage_link_beacons (owner_id);

GRANT SELECT ON public.storage_link_beacons TO authenticated;
GRANT ALL ON public.storage_link_beacons TO service_role;

ALTER TABLE public.storage_link_beacons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads own beacons" ON public.storage_link_beacons;
CREATE POLICY "owner reads own beacons" ON public.storage_link_beacons
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP TRIGGER IF EXISTS storage_link_beacons_touch ON public.storage_link_beacons;
CREATE TRIGGER storage_link_beacons_touch BEFORE UPDATE ON public.storage_link_beacons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
