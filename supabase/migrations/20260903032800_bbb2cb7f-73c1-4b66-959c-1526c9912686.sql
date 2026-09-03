CREATE TABLE public.hub_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  hub_key text NOT NULL,
  hub_url text NOT NULL,
  sites_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  response jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hub_exports_owner ON public.hub_exports(owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_exports TO authenticated;
GRANT ALL ON public.hub_exports TO service_role;
ALTER TABLE public.hub_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hub_exports_owner_all" ON public.hub_exports FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'system_owner'));

CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  requester_website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  requester_domain text,
  provider_website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  provider_domain text,
  service_key text NOT NULL,
  service_type text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  status text NOT NULL DEFAULT 'received',
  routed_by text,
  callback_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_requests_owner ON public.service_requests(owner_id, created_at DESC);
CREATE INDEX idx_service_requests_status ON public.service_requests(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_requests TO authenticated;
GRANT ALL ON public.service_requests TO service_role;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_requests_owner_all" ON public.service_requests FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'system_owner'));

CREATE TRIGGER service_requests_touch BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();