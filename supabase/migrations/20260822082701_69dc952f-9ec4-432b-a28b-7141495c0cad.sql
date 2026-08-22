DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'servers','server_configs','server_commands','server_metrics','server_ports','server_sites',
    'server_links','server_ip_history','server_alert_rules','server_alert_history',
    'ssl_certificates','databases','storages','site_users','site_user_access','hn_certificates',
    'subscriptions','backup_schedules','site_backups','clients','vault_secrets','vault_secret_versions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'team read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'team insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'team update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'owner read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'owner insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'owner update', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'system_owner'))$f$, 'owner read', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'system_owner'))$f$, 'owner insert', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'system_owner')) WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'system_owner'))$f$, 'owner update', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "admins read invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "system owner reads invitations" ON public.team_invitations;
CREATE POLICY "system owner reads invitations" ON public.team_invitations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'system_owner'));