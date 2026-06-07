
-- 1) site_groups
CREATE TABLE public.site_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#6366f1',
  icon text NOT NULL DEFAULT 'Folder',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_groups TO authenticated;
GRANT ALL ON public.site_groups TO service_role;
ALTER TABLE public.site_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_groups owner all" ON public.site_groups
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_site_groups_updated BEFORE UPDATE ON public.site_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) website_group_members
CREATE TABLE public.website_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  group_id uuid NOT NULL REFERENCES public.site_groups(id) ON DELETE CASCADE,
  website_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, website_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_group_members TO authenticated;
GRANT ALL ON public.website_group_members TO service_role;
ALTER TABLE public.website_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wgm owner all" ON public.website_group_members
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 3) site_templates
CREATE TABLE public.site_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  template_type text NOT NULL DEFAULT 'general',
  default_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_templates TO authenticated;
GRANT ALL ON public.site_templates TO service_role;
ALTER TABLE public.site_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_templates owner all" ON public.site_templates
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_site_templates_updated BEFORE UPDATE ON public.site_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) website_template_links
CREATE TABLE public.website_template_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.site_templates(id) ON DELETE CASCADE,
  website_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, website_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_template_links TO authenticated;
GRANT ALL ON public.website_template_links TO service_role;
ALTER TABLE public.website_template_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wtl owner all" ON public.website_template_links
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 5) site_health_checks
CREATE TABLE public.site_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  website_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'unknown',
  response_time_ms integer,
  http_status integer,
  ssl_valid boolean,
  error_message text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_website_time ON public.site_health_checks (website_id, checked_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_health_checks TO authenticated;
GRANT ALL ON public.site_health_checks TO service_role;
ALTER TABLE public.site_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health owner all" ON public.site_health_checks
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 6) deployment_jobs
CREATE TABLE public.deployment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  scope_type text NOT NULL,
  scope_id uuid,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  target_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deployment_jobs TO authenticated;
GRANT ALL ON public.deployment_jobs TO service_role;
ALTER TABLE public.deployment_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs owner all" ON public.deployment_jobs
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_deployment_jobs_updated BEFORE UPDATE ON public.deployment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7) deployment_job_targets
CREATE TABLE public.deployment_job_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.deployment_jobs(id) ON DELETE CASCADE,
  website_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_targets_job ON public.deployment_job_targets (job_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deployment_job_targets TO authenticated;
GRANT ALL ON public.deployment_job_targets TO service_role;
ALTER TABLE public.deployment_job_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_targets owner all" ON public.deployment_job_targets
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
