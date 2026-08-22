CREATE TABLE public.ai_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  instructions text NOT NULL DEFAULT '',
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  file_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  priority int NOT NULL DEFAULT 2,
  model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_tasks TO authenticated;
GRANT ALL ON public.ai_tasks TO service_role;
ALTER TABLE public.ai_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their AI tasks" ON public.ai_tasks
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'system_owner'));

CREATE INDEX ai_tasks_owner_idx ON public.ai_tasks(owner_id, created_at DESC);
CREATE TRIGGER ai_tasks_touch BEFORE UPDATE ON public.ai_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();