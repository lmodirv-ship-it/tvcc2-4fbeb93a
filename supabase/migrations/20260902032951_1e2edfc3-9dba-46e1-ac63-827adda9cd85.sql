
-- 1. domain settings ---------------------------------------------------
CREATE TABLE public.domain_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  domain text NOT NULL,
  backend_port integer,
  upstream_host text NOT NULL DEFAULT '127.0.0.1',
  nginx_template text,
  force_https boolean NOT NULL DEFAULT true,
  http2 boolean NOT NULL DEFAULT true,
  websockets boolean NOT NULL DEFAULT false,
  redirect_www boolean NOT NULL DEFAULT true,
  client_max_body_mb integer NOT NULL DEFAULT 50,
  proxy_read_timeout integer NOT NULL DEFAULT 60,
  security_headers boolean NOT NULL DEFAULT true,
  extra_directives text,
  ssl_mode text NOT NULL DEFAULT 'letsencrypt',
  ssl_cert_path text,
  ssl_key_path text,
  ssl_issuer text,
  ssl_expires_at timestamptz,
  auto_renew boolean NOT NULL DEFAULT true,
  last_applied_at timestamptz,
  last_test_output text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.domain_settings TO authenticated;
GRANT ALL ON public.domain_settings TO service_role;
ALTER TABLE public.domain_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_settings_manage" ON public.domain_settings FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER domain_settings_touch BEFORE UPDATE ON public.domain_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. firewall rules -----------------------------------------------------
CREATE TABLE public.firewall_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  port integer NOT NULL,
  protocol text NOT NULL DEFAULT 'tcp',
  action text NOT NULL DEFAULT 'allow',
  source_cidr text NOT NULL DEFAULT 'any',
  reason text,
  domain text,
  status text NOT NULL DEFAULT 'pending',
  last_output text,
  requested_by uuid,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, port, protocol, source_cidr)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firewall_rules TO authenticated;
GRANT ALL ON public.firewall_rules TO service_role;
ALTER TABLE public.firewall_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firewall_rules_manage" ON public.firewall_rules FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER firewall_rules_touch BEFORE UPDATE ON public.firewall_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. task ↔ server ↔ role ------------------------------------------------
CREATE TABLE public.server_task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  task_id uuid NOT NULL REFERENCES public.scheduled_tasks(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  required_role public.server_role,
  min_level text NOT NULL DEFAULT 'operate',
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, server_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_task_assignments TO authenticated;
GRANT ALL ON public.server_task_assignments TO service_role;
ALTER TABLE public.server_task_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server_task_assignments_manage" ON public.server_task_assignments FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER server_task_assignments_touch BEFORE UPDATE ON public.server_task_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. role capabilities (reference data) ---------------------------------
CREATE TABLE public.server_role_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.server_role NOT NULL,
  action text NOT NULL,
  min_level text NOT NULL DEFAULT 'operate',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, action)
);
GRANT SELECT ON public.server_role_capabilities TO authenticated;
GRANT ALL ON public.server_role_capabilities TO service_role;
ALTER TABLE public.server_role_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_caps_read" ON public.server_role_capabilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_caps_admin_write" ON public.server_role_capabilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'));
CREATE TRIGGER role_caps_touch BEFORE UPDATE ON public.server_role_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.server_role_capabilities (role, action, min_level, description) VALUES
  ('control','service_restart','operate','إعادة تشغيل خدمة'),
  ('control','nginx_reload','manage','إعادة تحميل Nginx'),
  ('control','firewall_apply','manage','تطبيق قواعد الجدار الناري'),
  ('control','agent_update','manage','تحديث الوكيل'),
  ('control','tunnel_setup','manage','إنشاء نفق للبوابة'),
  ('web','service_restart','operate','إعادة تشغيل خدمة موقع'),
  ('web','nginx_write_vhost','manage','كتابة إعداد النطاق'),
  ('web','nginx_test','operate','اختبار إعداد Nginx'),
  ('web','nginx_reload','manage','إعادة تحميل Nginx'),
  ('web','ssl_issue','manage','إصدار شهادة SSL'),
  ('web','firewall_apply','manage','فتح/إغلاق منفذ'),
  ('web','tunnel_setup','manage','ربط الموقع بالبوابة العامة'),
  ('storage','storage_sync','operate','مزامنة نسخة موقع'),
  ('storage','storage_prune','manage','حذف نسخة قديمة'),
  ('backup','backup_run','operate','تشغيل نسخة احتياطية'),
  ('backup','db_sync','operate','مزامنة قاعدة بيانات'),
  ('db_primary','db_sync','manage','مزامنة القاعدة الرئيسية'),
  ('db_replica','db_sync','operate','تحديث النسخة القرائية'),
  ('monitor','net_report','view','تقرير الشبكة');

-- 5. tunnels (local ⇄ VPS gateway) --------------------------------------
CREATE TABLE public.server_tunnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  local_server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  gateway_server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'wireguard',
  local_port integer,
  gateway_port integer,
  local_address inet,
  gateway_address inet,
  public_domain text,
  auto_reconnect boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  latency_ms integer,
  last_check_at timestamptz,
  last_output text,
  vault_secret_id uuid REFERENCES public.vault_secrets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (local_server_id, gateway_server_id, gateway_port)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_tunnels TO authenticated;
GRANT ALL ON public.server_tunnels TO service_role;
ALTER TABLE public.server_tunnels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server_tunnels_manage" ON public.server_tunnels FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER server_tunnels_touch BEFORE UPDATE ON public.server_tunnels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. site copies on the storage server ----------------------------------
CREATE TABLE public.site_storage_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  source_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  storage_server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  domain text NOT NULL,
  source_path text NOT NULL,
  storage_path text NOT NULL,
  auto_sync boolean NOT NULL DEFAULT true,
  interval_minutes integer NOT NULL DEFAULT 30,
  size_bytes bigint NOT NULL DEFAULT 0,
  file_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  last_synced_at timestamptz,
  last_output text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, storage_server_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_storage_syncs TO authenticated;
GRANT ALL ON public.site_storage_syncs TO service_role;
ALTER TABLE public.site_storage_syncs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_storage_syncs_manage" ON public.site_storage_syncs FOR ALL TO authenticated
  USING (public.can_manage(owner_id)) WITH CHECK (public.can_manage(owner_id));
CREATE TRIGGER site_storage_syncs_touch BEFORE UPDATE ON public.site_storage_syncs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
