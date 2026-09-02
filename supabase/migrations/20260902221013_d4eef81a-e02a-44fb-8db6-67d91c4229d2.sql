BEGIN;

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS workspace_name text,
  ADD COLUMN IF NOT EXISTS is_remix boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS remix_of text,
  ADD COLUMN IF NOT EXISTS lovable_workspace_id uuid;

CREATE TABLE IF NOT EXISTS public.lovable_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text,
  name text NOT NULL,
  owner_email text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text DEFAULT 'pay_hub',
  sync_status text DEFAULT 'pending',
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lovable_workspaces TO authenticated;
GRANT ALL ON public.lovable_workspaces TO service_role;

ALTER TABLE public.lovable_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_and_admins_manage_workspaces"
  ON public.lovable_workspaces
  FOR ALL
  TO authenticated
  USING (public.can_manage(owner_id))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'));

CREATE TABLE IF NOT EXISTS public.lovable_workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.lovable_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lovable_workspace_members TO authenticated;
GRANT ALL ON public.lovable_workspace_members TO service_role;

ALTER TABLE public.lovable_workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_own_workspaces"
  ON public.lovable_workspace_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.lovable_workspaces w
      WHERE w.id = workspace_id AND public.can_manage(w.owner_id)
    )
  );

CREATE POLICY "owners_and_admins_manage_members"
  ON public.lovable_workspace_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lovable_workspaces w
      WHERE w.id = workspace_id AND public.can_manage(w.owner_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lovable_workspaces w
      WHERE w.id = workspace_id AND (w.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
    )
  );

CREATE TABLE IF NOT EXISTS public.lovable_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.lovable_workspaces(id) ON DELETE CASCADE,
  external_project_id text,
  external_site_id text,
  name text,
  domain text,
  primary_domain text,
  owner_email text,
  imported_website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  is_remix boolean DEFAULT false,
  remix_of text,
  raw_data jsonb,
  sync_status text DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, external_site_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lovable_sites TO authenticated;
GRANT ALL ON public.lovable_sites TO service_role;

ALTER TABLE public.lovable_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_and_admins_manage_sites"
  ON public.lovable_sites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lovable_workspaces w
      WHERE w.id = workspace_id AND public.can_manage(w.owner_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lovable_workspaces w
      WHERE w.id = workspace_id AND public.can_manage(w.owner_id)
    )
  );

CREATE TABLE IF NOT EXISTS public.tvcc_service_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.lovable_workspaces(id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.lovable_sites(id) ON DELETE CASCADE,
  link_kind text NOT NULL CHECK (link_kind IN ('workspace','site')),
  service_id uuid REFERENCES public.site_services(id) ON DELETE CASCADE,
  status text DEFAULT 'active',
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tvcc_service_links TO authenticated;
GRANT ALL ON public.tvcc_service_links TO service_role;

ALTER TABLE public.tvcc_service_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_and_admins_manage_tvcc_links"
  ON public.tvcc_service_links
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.lovable_workspaces w
      WHERE w.id = workspace_id AND public.can_manage(w.owner_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lovable_workspaces w
      WHERE w.id = workspace_id AND public.can_manage(w.owner_id)
    )
  );

CREATE TRIGGER lovable_workspaces_touch
  BEFORE UPDATE ON public.lovable_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER lovable_workspace_members_touch
  BEFORE UPDATE ON public.lovable_workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER lovable_sites_touch
  BEFORE UPDATE ON public.lovable_sites
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER tvcc_service_links_touch
  BEFORE UPDATE ON public.tvcc_service_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMIT;