-- 1) user_preferences
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  theme_id text NOT NULL DEFAULT 'neon',
  language text NOT NULL DEFAULT 'ar',
  sidebar_collapsed boolean NOT NULL DEFAULT false,
  extras jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own preferences" ON public.user_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER user_preferences_touch BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) dashboard_tasks
CREATE TABLE public.dashboard_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'todo',
  priority integer NOT NULL DEFAULT 2,
  category text NOT NULL DEFAULT 'general',
  assigned_to uuid,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  agent_job_id uuid REFERENCES public.agent_jobs(id) ON DELETE SET NULL,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_tasks TO authenticated;
GRANT ALL ON public.dashboard_tasks TO service_role;
ALTER TABLE public.dashboard_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage dashboard tasks" ON public.dashboard_tasks
  FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE INDEX dashboard_tasks_owner_idx ON public.dashboard_tasks(owner_id, status);
CREATE TRIGGER dashboard_tasks_touch BEFORE UPDATE ON public.dashboard_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) entity_relations
CREATE TABLE public.entity_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  relation text NOT NULL DEFAULT 'linked',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, target_type, target_id, relation)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_relations TO authenticated;
GRANT ALL ON public.entity_relations TO service_role;
ALTER TABLE public.entity_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage entity relations" ON public.entity_relations
  FOR ALL TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE INDEX entity_relations_source_idx ON public.entity_relations(source_type, source_id);
CREATE INDEX entity_relations_target_idx ON public.entity_relations(target_type, target_id);
CREATE TRIGGER entity_relations_touch BEFORE UPDATE ON public.entity_relations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();