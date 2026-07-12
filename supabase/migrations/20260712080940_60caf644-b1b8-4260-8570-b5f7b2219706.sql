
-- Core hub config (singleton row per owner)
CREATE TABLE public.core_hub_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  core_url TEXT NOT NULL DEFAULT 'https://hn-nwt.lovable.app',
  webhook_path TEXT NOT NULL DEFAULT '/api/public/core/ingest',
  api_key TEXT,
  connection_status TEXT NOT NULL DEFAULT 'unknown',
  last_sync_at TIMESTAMPTZ,
  last_ping_ms INTEGER,
  auto_broadcast BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_hub_config TO authenticated;
GRANT ALL ON public.core_hub_config TO service_role;
ALTER TABLE public.core_hub_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage core config" ON public.core_hub_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'system_owner') OR public.has_role(auth.uid(),'admin') OR auth.uid()=owner_id)
  WITH CHECK (public.has_role(auth.uid(),'system_owner') OR public.has_role(auth.uid(),'admin') OR auth.uid()=owner_id);
CREATE TRIGGER core_hub_config_touch BEFORE UPDATE ON public.core_hub_config FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Directives issued from the core
CREATE TABLE public.core_directives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  directive_type TEXT NOT NULL DEFAULT 'instruction', -- rule|instruction|update|broadcast|feature
  scope TEXT NOT NULL DEFAULT 'all', -- all|service_type|specific_sites
  target_service_type TEXT,
  target_website_ids UUID[] NOT NULL DEFAULT '{}',
  priority TEXT NOT NULL DEFAULT 'normal', -- low|normal|high|critical
  status TEXT NOT NULL DEFAULT 'draft', -- draft|broadcasting|delivered|partial|failed
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  broadcast_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_directives TO authenticated;
GRANT ALL ON public.core_directives TO service_role;
ALTER TABLE public.core_directives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage directives" ON public.core_directives FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'system_owner') OR public.has_role(auth.uid(),'admin') OR auth.uid()=owner_id)
  WITH CHECK (public.has_role(auth.uid(),'system_owner') OR public.has_role(auth.uid(),'admin') OR auth.uid()=owner_id);
CREATE TRIGGER core_directives_touch BEFORE UPDATE ON public.core_directives FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_core_directives_owner ON public.core_directives(owner_id, created_at DESC);

-- Per-site delivery log
CREATE TABLE public.core_directive_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  directive_id UUID NOT NULL REFERENCES public.core_directives(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|delivered|failed|skipped
  http_status INTEGER,
  response_ms INTEGER,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(directive_id, website_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_directive_targets TO authenticated;
GRANT ALL ON public.core_directive_targets TO service_role;
ALTER TABLE public.core_directive_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage directive targets" ON public.core_directive_targets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'system_owner') OR public.has_role(auth.uid(),'admin')
    OR EXISTS(SELECT 1 FROM public.core_directives d WHERE d.id=directive_id AND d.owner_id=auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'system_owner') OR public.has_role(auth.uid(),'admin')
    OR EXISTS(SELECT 1 FROM public.core_directives d WHERE d.id=directive_id AND d.owner_id=auth.uid()));
CREATE INDEX idx_directive_targets_dir ON public.core_directive_targets(directive_id);
