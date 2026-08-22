ALTER TABLE public.ai_tasks
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'planning',
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_step_at timestamptz,
  ADD COLUMN IF NOT EXISTS allow_edit boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ai_task_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.ai_tasks(id) ON DELETE CASCADE,
  step_no integer NOT NULL DEFAULT 1,
  stage text NOT NULL DEFAULT 'working',
  title text NOT NULL,
  detail text,
  tool_name text,
  status text NOT NULL DEFAULT 'done',
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_task_steps TO authenticated;
GRANT ALL ON public.ai_task_steps TO service_role;
ALTER TABLE public.ai_task_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_task_steps_manage" ON public.ai_task_steps;
CREATE POLICY "ai_task_steps_manage" ON public.ai_task_steps
  FOR ALL TO authenticated
  USING (public.can_manage(owner_id))
  WITH CHECK (public.can_manage(owner_id));

CREATE INDEX IF NOT EXISTS ai_task_steps_task_idx ON public.ai_task_steps(task_id, step_no);
CREATE INDEX IF NOT EXISTS ai_tasks_status_idx ON public.ai_tasks(status, created_at DESC);