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
  SELECT m.server_id, date_trunc('hour', m.collected_at), count(*),
         avg(m.cpu_percent), max(m.cpu_percent),
         avg(CASE WHEN m.mem_total_mb > 0 THEN m.mem_used_mb / m.mem_total_mb * 100 END),
         max(CASE WHEN m.mem_total_mb > 0 THEN m.mem_used_mb / m.mem_total_mb * 100 END),
         avg(CASE WHEN m.disk_total_gb > 0 THEN m.disk_used_gb / m.disk_total_gb * 100 END),
         max(CASE WHEN m.disk_total_gb > 0 THEN m.disk_used_gb / m.disk_total_gb * 100 END)
  FROM public.server_metrics m
  WHERE m.collected_at < cutoff
  GROUP BY m.server_id, date_trunc('hour', m.collected_at)
  ON CONFLICT (server_id, bucket_start) DO UPDATE
    SET samples = EXCLUDED.samples, cpu_avg = EXCLUDED.cpu_avg, cpu_max = EXCLUDED.cpu_max,
        memory_avg = EXCLUDED.memory_avg, memory_max = EXCLUDED.memory_max,
        disk_avg = EXCLUDED.disk_avg, disk_max = EXCLUDED.disk_max;

  DELETE FROM public.server_metrics WHERE collected_at < cutoff;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rollup_server_metrics(integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_server_metrics(integer) TO service_role;