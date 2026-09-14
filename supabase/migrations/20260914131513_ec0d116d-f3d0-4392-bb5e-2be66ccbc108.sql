-- 1) Hourly rollup table for server metrics
CREATE TABLE IF NOT EXISTS public.metrics_hourly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  bucket_start timestamptz NOT NULL,
  samples integer NOT NULL DEFAULT 0,
  cpu_avg numeric,
  cpu_max numeric,
  memory_avg numeric,
  memory_max numeric,
  disk_avg numeric,
  disk_max numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, bucket_start)
);
GRANT SELECT ON public.metrics_hourly TO authenticated;
GRANT ALL ON public.metrics_hourly TO service_role;
ALTER TABLE public.metrics_hourly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metrics_hourly_admin_read" ON public.metrics_hourly FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','system_owner')));
CREATE INDEX IF NOT EXISTS metrics_hourly_server_bucket_idx ON public.metrics_hourly (server_id, bucket_start DESC);

-- 2) Unified security event log
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  category text NOT NULL,
  action text NOT NULL,
  resource text,
  resource_id text,
  severity text NOT NULL DEFAULT 'info',
  success boolean NOT NULL DEFAULT true,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_events_admin_read" ON public.security_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','system_owner')));
CREATE POLICY "security_events_self_insert" ON public.security_events FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());
CREATE INDEX IF NOT EXISTS security_events_created_idx ON public.security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_category_idx ON public.security_events (category, created_at DESC);

-- 3) Rollup + retention for raw server metrics
CREATE OR REPLACE FUNCTION public.rollup_server_metrics(retain_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - make_interval(days => retain_days);
  removed integer;
BEGIN
  INSERT INTO public.metrics_hourly (server_id, bucket_start, samples, cpu_avg, cpu_max, memory_avg, memory_max, disk_avg, disk_max)
  SELECT server_id, date_trunc('hour', created_at), count(*),
         avg(cpu_usage), max(cpu_usage), avg(memory_usage), max(memory_usage), avg(disk_usage), max(disk_usage)
  FROM public.server_metrics
  WHERE created_at < cutoff
  GROUP BY server_id, date_trunc('hour', created_at)
  ON CONFLICT (server_id, bucket_start) DO UPDATE
    SET samples = EXCLUDED.samples, cpu_avg = EXCLUDED.cpu_avg, cpu_max = EXCLUDED.cpu_max,
        memory_avg = EXCLUDED.memory_avg, memory_max = EXCLUDED.memory_max,
        disk_avg = EXCLUDED.disk_avg, disk_max = EXCLUDED.disk_max;

  DELETE FROM public.server_metrics WHERE created_at < cutoff;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rollup_server_metrics(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_server_metrics(integer) TO service_role;