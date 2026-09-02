ALTER TABLE public.port_links
  ADD COLUMN IF NOT EXISTS link_kind text NOT NULL DEFAULT 'bridge',
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS website_id uuid,
  ADD COLUMN IF NOT EXISTS target_url text,
  ADD COLUMN IF NOT EXISTS vault_secret_id uuid,
  ADD COLUMN IF NOT EXISTS auto_start boolean NOT NULL DEFAULT true;

ALTER TABLE public.site_runtimes
  ADD COLUMN IF NOT EXISTS auto_start boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.server_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  level text NOT NULL DEFAULT 'view',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_access TO authenticated;
GRANT ALL ON public.server_access TO service_role;

ALTER TABLE public.server_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "server_access_manage_by_owner" ON public.server_access
  FOR ALL TO authenticated
  USING (public.can_manage(owner_id))
  WITH CHECK (public.can_manage(owner_id));

CREATE POLICY "server_access_read_own" ON public.server_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
