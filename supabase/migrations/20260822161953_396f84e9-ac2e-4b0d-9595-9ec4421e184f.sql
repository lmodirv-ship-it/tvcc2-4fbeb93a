CREATE TABLE public.domain_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('domain','port')),
  target text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('domain','port')),
  mode text NOT NULL CHECK (mode IN ('redirect_301','proxy','tcp_bridge')),
  status text NOT NULL DEFAULT 'pending',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.domain_redirects TO authenticated;
GRANT ALL ON public.domain_redirects TO service_role;

ALTER TABLE public.domain_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "redirects read" ON public.domain_redirects FOR SELECT TO authenticated USING (public.can_manage(owner_id));
CREATE POLICY "redirects insert" ON public.domain_redirects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "redirects update" ON public.domain_redirects FOR UPDATE TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE POLICY "redirects delete" ON public.domain_redirects FOR DELETE TO authenticated USING (public.can_manage(owner_id));

CREATE TRIGGER domain_redirects_touch BEFORE UPDATE ON public.domain_redirects
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();