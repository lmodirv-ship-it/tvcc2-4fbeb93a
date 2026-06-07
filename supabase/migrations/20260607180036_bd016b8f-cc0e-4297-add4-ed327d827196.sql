
-- Preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  event_type text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT false,
  telegram boolean NOT NULL DEFAULT false,
  webhook boolean NOT NULL DEFAULT false,
  min_severity text NOT NULL DEFAULT 'info',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, event_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs owner all" ON public.notification_preferences FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER prefs_touch BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Delivery logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  notification_id uuid,
  channel_type text NOT NULL,
  target text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  provider_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_logs TO authenticated;
GRANT ALL ON public.notification_logs TO service_role;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_logs owner read" ON public.notification_logs FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "notif_logs owner insert" ON public.notification_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Realtime for the bell
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  PERFORM 1 FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND schemaname='public' AND tablename='notifications';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS notifications_owner_unread_idx
  ON public.notifications(owner_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS notif_logs_owner_idx
  ON public.notification_logs(owner_id, created_at DESC);
