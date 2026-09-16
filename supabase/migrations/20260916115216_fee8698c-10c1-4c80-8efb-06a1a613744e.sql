CREATE TABLE public.platform_tools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  slug text not null unique,
  name text not null,
  category text not null,
  license text,
  role_desc text,
  tech text,
  default_port integer,
  interface text,
  packages text,
  services text,
  paths text,
  ui_sections text,
  notes text,
  install_cmd text,
  start_cmd text,
  stop_cmd text,
  status_cmd text,
  uninstall_cmd text,
  detect_cmd text,
  docker_image text,
  website text,
  icon text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_tools TO authenticated;
GRANT ALL ON public.platform_tools TO service_role;
ALTER TABLE public.platform_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tools read" ON public.platform_tools FOR SELECT TO authenticated USING (true);
CREATE POLICY "tools manage" ON public.platform_tools FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER platform_tools_touch BEFORE UPDATE ON public.platform_tools FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.platform_tool_pages (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.platform_tools(id) on delete cascade,
  page_path text not null,
  page_label text,
  relation text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tool_id, page_path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_tool_pages TO authenticated;
GRANT ALL ON public.platform_tool_pages TO service_role;
ALTER TABLE public.platform_tool_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tool pages read" ON public.platform_tool_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "tool pages manage" ON public.platform_tool_pages FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'));
CREATE INDEX idx_tool_pages_path ON public.platform_tool_pages(page_path);
CREATE TRIGGER platform_tool_pages_touch BEFORE UPDATE ON public.platform_tool_pages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.platform_tool_installs (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.platform_tools(id) on delete cascade,
  server_id uuid references public.servers(id) on delete cascade,
  website_id uuid references public.websites(id) on delete cascade,
  status text not null default 'unknown',
  installed boolean not null default false,
  version text,
  port integer,
  access_url text,
  last_action text,
  last_command_id uuid,
  last_output text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tool_id, server_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_tool_installs TO authenticated;
GRANT ALL ON public.platform_tool_installs TO service_role;
ALTER TABLE public.platform_tool_installs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tool installs read" ON public.platform_tool_installs FOR SELECT TO authenticated USING (true);
CREATE POLICY "tool installs manage" ON public.platform_tool_installs FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'));
CREATE INDEX idx_tool_installs_server ON public.platform_tool_installs(server_id);
CREATE TRIGGER platform_tool_installs_touch BEFORE UPDATE ON public.platform_tool_installs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.platform_tool_links (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.platform_tools(id) on delete cascade,
  related_tool_id uuid not null references public.platform_tools(id) on delete cascade,
  relation text not null default 'works_with',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tool_id, related_tool_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_tool_links TO authenticated;
GRANT ALL ON public.platform_tool_links TO service_role;
ALTER TABLE public.platform_tool_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tool links read" ON public.platform_tool_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "tool links manage" ON public.platform_tool_links FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER platform_tool_links_touch BEFORE UPDATE ON public.platform_tool_links FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();