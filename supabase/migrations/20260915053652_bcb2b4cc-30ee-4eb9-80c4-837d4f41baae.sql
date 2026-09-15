CREATE TABLE IF NOT EXISTS public.engine_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  created_by uuid,
  engine_id text NOT NULL,
  label text,
  server_id uuid,
  website_id uuid,
  ctx jsonb NOT NULL DEFAULT '{}'::jsonb,
  interval_minutes integer NOT NULL DEFAULT 60,
  dry_run boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_status text,
  last_error text,
  run_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.engine_schedules TO authenticated;
GRANT ALL ON public.engine_schedules TO service_role;

ALTER TABLE public.engine_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "engine_schedules_select" ON public.engine_schedules;
CREATE POLICY "engine_schedules_select" ON public.engine_schedules
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'system_owner'::app_role));

DROP POLICY IF EXISTS "engine_schedules_insert" ON public.engine_schedules;
CREATE POLICY "engine_schedules_insert" ON public.engine_schedules
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'system_owner'::app_role)));

DROP POLICY IF EXISTS "engine_schedules_update" ON public.engine_schedules;
CREATE POLICY "engine_schedules_update" ON public.engine_schedules
  FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'system_owner'::app_role));

CREATE INDEX IF NOT EXISTS engine_schedules_due_idx ON public.engine_schedules (is_active, next_run_at);
CREATE INDEX IF NOT EXISTS engine_schedules_owner_idx ON public.engine_schedules (owner_id);

CREATE OR REPLACE FUNCTION public.engine_schedules_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS engine_schedules_updated_at ON public.engine_schedules;
CREATE TRIGGER engine_schedules_updated_at BEFORE UPDATE ON public.engine_schedules
  FOR EACH ROW EXECUTE FUNCTION public.engine_schedules_touch();