CREATE TABLE public.site_transfer_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  website_id uuid REFERENCES public.websites(id),
  destination_id uuid REFERENCES public.backup_destinations(id),
  domain text NOT NULL,
  site_code text,
  direction text NOT NULL DEFAULT 'export',
  status text NOT NULL DEFAULT 'pending',
  size_bytes bigint,
  file_path text,
  error_message text,
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_transfer_tasks TO authenticated;
GRANT ALL ON public.site_transfer_tasks TO service_role;

ALTER TABLE public.site_transfer_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages transfer tasks"
ON public.site_transfer_tasks FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE INDEX site_transfer_tasks_owner_idx ON public.site_transfer_tasks (owner_id, created_at DESC);
CREATE INDEX site_transfer_tasks_website_idx ON public.site_transfer_tasks (website_id);

CREATE TRIGGER site_transfer_tasks_touch
BEFORE UPDATE ON public.site_transfer_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();