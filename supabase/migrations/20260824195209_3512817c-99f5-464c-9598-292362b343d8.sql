-- ===== servers.role =====
DO $$ BEGIN
  CREATE TYPE public.server_role AS ENUM ('control','db_primary','db_replica','web','storage','backup','monitor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS role public.server_role NOT NULL DEFAULT 'web';

-- ===== hosting_plans =====
CREATE TABLE IF NOT EXISTS public.hosting_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  name_ar text NOT NULL,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  storage_gb integer NOT NULL DEFAULT 5,
  sites_limit integer NOT NULL DEFAULT 1,
  hn_domains_limit integer NOT NULL DEFAULT 2,
  external_domains_limit integer NOT NULL DEFAULT 0,
  transfer_gb integer NOT NULL DEFAULT 20,
  db_isolation text NOT NULL DEFAULT 'shared',
  db_quota_mb integer NOT NULL DEFAULT 250,
  backup_policy text NOT NULL DEFAULT 'weekly',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.hosting_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosting_plans TO authenticated;
GRANT ALL ON public.hosting_plans TO service_role;
ALTER TABLE public.hosting_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON public.hosting_plans FOR SELECT TO anon, authenticated USING (is_visible);
CREATE POLICY "plans_admin_write" ON public.hosting_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER hosting_plans_touch BEFORE UPDATE ON public.hosting_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== hosting_subscriptions =====
CREATE TABLE IF NOT EXISTS public.hosting_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.hosting_plans(id) ON DELETE RESTRICT,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  current_period_end timestamptz,
  addons jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosting_subscriptions TO authenticated;
GRANT ALL ON public.hosting_subscriptions TO service_role;
ALTER TABLE public.hosting_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hsub_owner_read" ON public.hosting_subscriptions FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE POLICY "hsub_owner_insert" ON public.hosting_subscriptions FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE POLICY "hsub_manage_update" ON public.hosting_subscriptions FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE POLICY "hsub_admin_delete" ON public.hosting_subscriptions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER hosting_subscriptions_touch BEFORE UPDATE ON public.hosting_subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS hosting_subscriptions_owner_idx ON public.hosting_subscriptions(owner_id);

-- ===== hosting_tenants =====
CREATE TABLE IF NOT EXISTS public.hosting_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  subscription_id uuid NOT NULL REFERENCES public.hosting_subscriptions(id) ON DELETE CASCADE,
  tenant_key text NOT NULL UNIQUE,
  isolation text NOT NULL DEFAULT 'shared',
  schema_name text,
  db_role text,
  bucket_name text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosting_tenants TO authenticated;
GRANT ALL ON public.hosting_tenants TO service_role;
ALTER TABLE public.hosting_tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "htenant_read" ON public.hosting_tenants FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE POLICY "htenant_admin_write" ON public.hosting_tenants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER hosting_tenants_touch BEFORE UPDATE ON public.hosting_tenants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== storage_quotas =====
CREATE TABLE IF NOT EXISTS public.storage_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.hosting_subscriptions(id) ON DELETE CASCADE,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  limit_bytes bigint NOT NULL DEFAULT 5368709120,
  used_bytes bigint NOT NULL DEFAULT 0,
  transfer_limit_bytes bigint NOT NULL DEFAULT 21474836480,
  transfer_used_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storage_quotas TO authenticated;
GRANT ALL ON public.storage_quotas TO service_role;
ALTER TABLE public.storage_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quota_read" ON public.storage_quotas FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE POLICY "quota_admin_write" ON public.storage_quotas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER storage_quotas_touch BEFORE UPDATE ON public.storage_quotas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== subscription_servers =====
CREATE TABLE IF NOT EXISTS public.subscription_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  subscription_id uuid NOT NULL REFERENCES public.hosting_subscriptions(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  role public.server_role NOT NULL DEFAULT 'web',
  cpu_quota integer NOT NULL DEFAULT 1,
  ram_quota_mb integer NOT NULL DEFAULT 1024,
  disk_quota_gb integer NOT NULL DEFAULT 5,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, server_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_servers TO authenticated;
GRANT ALL ON public.subscription_servers TO service_role;
ALTER TABLE public.subscription_servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subsrv_read" ON public.subscription_servers FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE POLICY "subsrv_admin_write" ON public.subscription_servers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER subscription_servers_touch BEFORE UPDATE ON public.subscription_servers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== file_replicas =====
CREATE TABLE IF NOT EXISTS public.file_replicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.hosting_subscriptions(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  checksum text,
  primary_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  replica_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  backup_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_replicas TO authenticated;
GRANT ALL ON public.file_replicas TO service_role;
ALTER TABLE public.file_replicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "replica_read" ON public.file_replicas FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE POLICY "replica_write" ON public.file_replicas FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER file_replicas_touch BEFORE UPDATE ON public.file_replicas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== hn_domains =====
CREATE TABLE IF NOT EXISTS public.hn_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.hosting_subscriptions(id) ON DELETE SET NULL,
  name text NOT NULL UNIQUE,
  fqdn text NOT NULL,
  public_fqdn text,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  target_ip text,
  target_port integer,
  records jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'reserved',
  last_published_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hn_domains TO authenticated;
GRANT ALL ON public.hn_domains TO service_role;
ALTER TABLE public.hn_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hnd_read" ON public.hn_domains FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE POLICY "hnd_write" ON public.hn_domains FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));
CREATE TRIGGER hn_domains_touch BEFORE UPDATE ON public.hn_domains FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== seed plans =====
INSERT INTO public.hosting_plans (code,name,name_ar,price_monthly,price_yearly,storage_gb,sites_limit,hn_domains_limit,external_domains_limit,transfer_gb,db_isolation,db_quota_mb,backup_policy,features,sort_order)
VALUES
 ('starter','Starter','ستارتر',2,20,5,1,2,0,20,'shared',250,'weekly','["نسخة أسبوعية 7 أيام","SSL داخلي وعام","نطاقان .HN"]',1),
 ('basic','Basic','بيسيك',5,50,20,3,5,1,100,'shared',1024,'daily_7','["نسخ يومية 7 أيام","نطاق خارجي","مراقبة توفر"]',2),
 ('pro','Pro','برو',12,120,100,10,15,3,500,'schema',5120,'daily_30','["schema ودور معزولان","نسخ يومية 30 يوماً","مفاتيح API","تنبيهات"]',3),
 ('business','Business','بزنس',29,290,500,25,50,10,1024,'stack',51200,'every_6h','["Supabase Stack مستقل","نسخ كل 6 ساعات","Failover","سجلات تدقيق","دعم أولوية"]',4),
 ('enterprise','Enterprise','إنتربرايز',0,0,1024,999,999,999,10240,'dedicated',1048576,'custom','["خادم وقاعدة مستقلان","SLA","عزل شبكي","تقارير امتثال"]',5)
ON CONFLICT (code) DO NOTHING;