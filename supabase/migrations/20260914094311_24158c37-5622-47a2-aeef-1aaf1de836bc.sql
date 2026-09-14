-- 1) platform_settings (singleton)
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  support_email text,
  phone text,
  whatsapp text,
  address text,
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_language text NOT NULL DEFAULT 'ar',
  official_domain text DEFAULT 'tvcc.hnpay.live',
  maintenance_mode boolean NOT NULL DEFAULT false,
  dns_records jsonb NOT NULL DEFAULT '{"cname_host":"_tvcc","cname_value":"network.tvcc.ma","txt_host":"_tvcc","txt_value":"tvcc-network=enabled"}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_singleton_true CHECK (singleton = true)
);

GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings_read" ON public.platform_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_settings_insert" ON public.platform_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'));
CREATE POLICY "platform_settings_update" ON public.platform_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'));

CREATE TRIGGER platform_settings_touch BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.platform_settings (support_email, phone) VALUES ('lmodirv@gmail.com', NULL);

-- 2) platform_pages
CREATE TABLE public.platform_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  route_path text NOT NULL UNIQUE,
  page_key text NOT NULL UNIQUE,
  section text NOT NULL DEFAULT 'عام',
  icon text,
  name_ar text NOT NULL,
  name_fr text,
  name_en text,
  description_ar text,
  is_public boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  show_in_sidebar boolean NOT NULL DEFAULT true,
  min_role public.app_role NOT NULL DEFAULT 'viewer',
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_pages TO authenticated;
GRANT ALL ON public.platform_pages TO service_role;

ALTER TABLE public.platform_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_pages_read" ON public.platform_pages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_pages_write" ON public.platform_pages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'));

CREATE OR REPLACE FUNCTION public.assign_platform_page_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
  tries int := 0;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    LOOP
      candidate := 'ح' || lpad((floor(random() * 1000000))::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.platform_pages WHERE code = candidate);
      tries := tries + 1;
      IF tries > 50 THEN
        RAISE EXCEPTION 'could not allocate page code';
      END IF;
    END LOOP;
    NEW.code := candidate;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER platform_pages_code BEFORE INSERT ON public.platform_pages
  FOR EACH ROW EXECUTE FUNCTION public.assign_platform_page_code();
CREATE TRIGGER platform_pages_touch BEFORE UPDATE ON public.platform_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) platform_page_links
CREATE TABLE public.platform_page_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.platform_pages(id) ON DELETE CASCADE,
  link_type text NOT NULL DEFAULT 'table',
  target_page_id uuid REFERENCES public.platform_pages(id) ON DELETE CASCADE,
  target_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_page_links_page_idx ON public.platform_page_links(page_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_page_links TO authenticated;
GRANT ALL ON public.platform_page_links TO service_role;

ALTER TABLE public.platform_page_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_page_links_read" ON public.platform_page_links
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform_page_links_write" ON public.platform_page_links
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'));

CREATE TRIGGER platform_page_links_touch BEFORE UPDATE ON public.platform_page_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) seed pages
INSERT INTO public.platform_pages (route_path, page_key, section, name_ar, name_en, min_role, is_public, sort_order) VALUES
('/dashboard','dashboard','لوحة التحكم','لوحة التحكم','Dashboard','viewer',false,10),
('/websites','websites','المواقع','المواقع','Websites','viewer',false,20),
('/groups','groups','المواقع','المجموعات','Groups','viewer',false,21),
('/import-sites','import-sites','المواقع','استيراد المواقع','Import Sites','editor',false,22),
('/templates','templates','المواقع','القوالب','Templates','editor',false,23),
('/publish-sync','publish-sync','المواقع','النشر والمزامنة','Publish Sync','editor',false,24),
('/blog-manager','blog-manager','المحتوى','إدارة المدونة','Blog Manager','editor',false,30),
('/video-studio','video-studio','المحتوى','استوديو الفيديو','Video Studio','editor',false,31),
('/editor','editor','المحتوى','المحرر','Editor','editor',false,32),
('/servers','servers','البنية التحتية','السيرفرات','Servers','viewer',false,40),
('/topology','topology','البنية التحتية','الخريطة','Topology','viewer',false,41),
('/network','network','البنية التحتية','الشبكة','Network','viewer',false,42),
('/connect','connect','البنية التحتية','مركز الربط','Connect','editor',false,43),
('/bridge','bridge','البنية التحتية','الجسر','Bridge','editor',false,44),
('/failover','failover','البنية التحتية','التحويل عند العطل','Failover','admin',false,45),
('/environment','environment','البنية التحتية','البيئة','Environment','admin',false,46),
('/domains','domains','النطاقات','النطاقات','Domains','viewer',false,50),
('/hn-domains','hn-domains','النطاقات','نطاقات HN','HN Domains','editor',false,51),
('/certificates','certificates','النطاقات','الشهادات','Certificates','editor',false,52),
('/ssl','ssl','النطاقات','شهادات SSL','SSL','editor',false,53),
('/group-ids','group-ids','النطاقات','معرّفات المجموعة','Group IDs','editor',false,54),
('/manara','manara','منارة','منارة','Manara','viewer',false,60),
('/ai-models','ai-models','الذكاء الاصطناعي','نماذج الذكاء','AI Models','editor',false,70),
('/ai-chat','ai-chat','الذكاء الاصطناعي','محادثة النماذج','AI Chat','editor',false,71),
('/ai-tests','ai-tests','الذكاء الاصطناعي','اختبار النماذج','AI Tests','editor',false,72),
('/ai-connect','ai-connect','الذكاء الاصطناعي','ربط النماذج','AI Connect','admin',false,73),
('/jobs','jobs','التشغيل','مركز المهام','Jobs','viewer',false,80),
('/services','services','التشغيل','الخدمات','Services','viewer',false,81),
('/automation','automation','التشغيل','الأتمتة','Automation','admin',false,82),
('/operations','operations','التشغيل','العمليات','Operations','admin',false,83),
('/deploy','deploy','التشغيل','النشر','Deploy','editor',false,84),
('/downloads','downloads','التشغيل','مركز التحميل','Downloads','editor',false,85),
('/apk-manager','apk-manager','التشغيل','إدارة التطبيقات','APK Manager','editor',false,86),
('/backups','backups','الحماية','النسخ الاحتياطي','Backups','admin',false,90),
('/recovery','recovery','الحماية','الاسترجاع','Recovery','admin',false,91),
('/vault','vault','الحماية','الخزنة','Vault','admin',false,92),
('/audit','audit','الحماية','التدقيق','Audit','admin',false,93),
('/monitoring','monitoring','المراقبة','المراقبة','Monitoring','viewer',false,100),
('/logs','logs','المراقبة','السجلات','Logs','viewer',false,101),
('/activity','activity','المراقبة','النشاط','Activity','viewer',false,102),
('/reports','reports','المراقبة','التقارير','Reports','viewer',false,103),
('/notifications','notifications','المراقبة','الإشعارات','Notifications','viewer',false,104),
('/hosting','hosting','الأعمال','الاستضافة','Hosting','admin',false,110),
('/my-hosting','my-hosting','الأعمال','استضافتي','My Hosting','viewer',false,111),
('/subscriptions','subscriptions','الأعمال','الاشتراكات','Subscriptions','admin',false,112),
('/clients','clients','الأعمال','العملاء','Clients','admin',false,113),
('/payments-hub','payments-hub','الأعمال','مركز المدفوعات','Payments Hub','admin',false,114),
('/payment-accounts','payment-accounts','الأعمال','حسابات الدفع','Payment Accounts','admin',false,115),
('/payment-providers','payment-providers','الأعمال','مزودو الدفع','Payment Providers','admin',false,116),
('/integrations','integrations','الأعمال','التكاملات','Integrations','admin',false,117),
('/core-hub','core-hub','النظام','المركز الأساسي','Core Hub','admin',false,120),
('/users','users','النظام','المستخدمون والفريق','Users','admin',false,121),
('/settings','settings','النظام','الإعدادات','Settings','admin',false,122),
('/settings/notifications','settings-notifications','النظام','إعدادات الإشعارات','Notification Settings','admin',false,123),
('/','public-home','الصفحات العامة','الصفحة الرئيسية','Home','viewer',true,200),
('/pricing','public-pricing','الصفحات العامة','الأسعار','Pricing','viewer',true,201),
('/blog','public-blog','الصفحات العامة','المدونة','Blog','viewer',true,202),
('/docs','public-docs','الصفحات العامة','التوثيق','Docs','viewer',true,203),
('/checkout','public-checkout','الصفحات العامة','الشراء','Checkout','viewer',true,204),
('/app-link','public-app-link','الصفحات العامة','ربط التطبيق','App Link','viewer',true,205),
('/auth','public-auth','الصفحات العامة','تسجيل الدخول','Sign in','viewer',true,206);