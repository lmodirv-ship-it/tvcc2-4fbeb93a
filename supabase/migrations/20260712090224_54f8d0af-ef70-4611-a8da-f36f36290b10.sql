
CREATE TABLE public.video_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  requester_channel text NOT NULL DEFAULT 'hn-nawat',
  target_site text,
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'site-to-vid-magic',
  external_id text,
  video_url text,
  thumbnail_url text,
  duration_seconds integer,
  error_message text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_requests TO authenticated;
GRANT ALL ON public.video_requests TO service_role;
ALTER TABLE public.video_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage own video requests" ON public.video_requests
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX video_requests_owner_created_idx ON public.video_requests(owner_id, created_at DESC);
CREATE TRIGGER video_requests_touch BEFORE UPDATE ON public.video_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
