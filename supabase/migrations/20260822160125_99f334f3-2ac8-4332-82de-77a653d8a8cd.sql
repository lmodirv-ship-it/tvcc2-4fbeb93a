DO $$
DECLARE t text; pol record;
  tables text[] := ARRAY['activity_log','ai_conversations','ai_messages','ai_model_tests','ai_models','ai_providers','ai_routing','core_directives','core_hub_config','deployment_job_targets','deployment_jobs','domains','notification_channels','notification_logs','notification_preferences','notifications','operation_log','payment_events','recovery_points','service_dependencies','site_cluster_members','site_clusters','site_groups','site_health_checks','site_provisioning','site_services','site_templates','video_requests','website_android_releases','website_env_vars','website_group_members','website_settings','website_template_links','websites','clients'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- drop blanket team-wide policies (any admin/editor, no owner scoping)
    FOR pol IN
      SELECT p.polname FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname=t
        AND coalesce(pg_get_expr(p.polqual,p.polrelid),'')||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') ILIKE '%is_team_%'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.polname, t);
    END LOOP;

    -- ensure owner/admin (can_manage) access remains for tables that have owner_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='owner_id')
       AND NOT EXISTS (
         SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relname=t
           AND coalesce(pg_get_expr(p.polqual,p.polrelid),'')||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'') ILIKE '%can_manage%')
    THEN
      EXECUTE format('CREATE POLICY "manage read" ON public.%I FOR SELECT TO authenticated USING (public.can_manage(owner_id))', t);
      EXECUTE format('CREATE POLICY "manage insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_manage(owner_id))', t);
      EXECUTE format('CREATE POLICY "manage update" ON public.%I FOR UPDATE TO authenticated USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id))', t);
    END IF;
  END LOOP;
END $$;