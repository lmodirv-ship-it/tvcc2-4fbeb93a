CREATE TABLE IF NOT EXISTS public.external_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL,
  name TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'url' CHECK (method IN ('url','api','token','webhook')),
  url TEXT NOT NULL,
  token TEXT,
  webhook_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','failed')),
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, service_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_integrations TO authenticated;
GRANT ALL ON public.external_integrations TO service_role;
ALTER TABLE public.external_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team manage integrations" ON public.external_integrations
  FOR ALL TO authenticated
  USING (public.is_team_member(auth.uid()))
  WITH CHECK (public.is_team_member(auth.uid()));
CREATE TRIGGER external_integrations_touch BEFORE UPDATE ON public.external_integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();