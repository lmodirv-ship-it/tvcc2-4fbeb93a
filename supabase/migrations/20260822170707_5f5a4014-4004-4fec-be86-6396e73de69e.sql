CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL DEFAULT '',
  category text,
  cover_url text,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  author_id uuid,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog public read published" ON public.blog_posts
FOR SELECT TO anon, authenticated USING (published = true);

CREATE POLICY "blog managers read all" ON public.blog_posts
FOR SELECT TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner'));

CREATE POLICY "blog managers insert" ON public.blog_posts
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner') OR public.has_role(auth.uid(),'editor'));

CREATE POLICY "blog managers update" ON public.blog_posts
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'system_owner') OR author_id = auth.uid());

CREATE POLICY "blog managers delete" ON public.blog_posts
FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'system_owner') OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER blog_posts_touch BEFORE UPDATE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

WITH seed(slug, title, excerpt, category, ord) AS (
  VALUES
  ('ma-hiya-tvcc','ما هي منصة TVCC؟','مقدمة شاملة عن مركز قيادة المواقع TVCC وكيف يوحّد إدارة مشاريعك.','نظرة عامة',0),
  ('idarat-almawaqi','إدارة المواقع من لوحة واحدة','أضف مواقعك وتابع حالتها الحيّة والنطاقات والشهادات من مكان واحد.','المواقع',1),
  ('tawtheeq-annitaq','توثيق النطاق عبر سجل TXT','كيف يولّد TVCC كود تحقق ويتأكد من ملكيتك للنطاق قبل إضافته.','النطاقات',2),
  ('shahadat-ssl','مراقبة شهادات SSL والتنبيهات','تتبّع صلاحية الشهادات واستلام تنبيهات قبل انتهائها بوقت كافٍ.','الأمان',3),
  ('idarat-servers','إدارة السيرفرات والوكيل (Agent)','تثبيت وكيل TVCC على سيرفرك للتحكم في الخدمات والموارد لحظياً.','السيرفرات',4),
  ('markaz-almanafid','مركز المنافذ والجسور بين الخدمات','فتح المنافذ، الجدار الناري، وربط منفذ بمنفذ أو بموقع بسهولة.','الشبكة',5),
  ('almazamana-allahdiya','التخزين والمزامنة اللحظية','مزامنة ملفات المواقع بين السيرفرات لحظياً مع إثبات الملكية.','التخزين',6),
  ('namadhij-althaka','نماذج الذكاء الاصطناعي: سحابية ومحلية','ربط Ollama وLM Studio والنماذج السحابية واختبارها من المنصة.','الذكاء الاصطناعي',7),
  ('alfarik-walsalahiyat','الفريق والصلاحيات والأدوار','المالك والمدير والمحرر والمشاهد: من يرى ماذا ومن يستطيع التعديل.','الفريق',8),
  ('i3adat-attawjih','إعادة التوجيه بين النطاقات والمنافذ','إنشاء تحويلات 301 وبروكسي وجسور TCP بضغطة زر.','النطاقات',9)
)
INSERT INTO public.blog_posts (slug, title, excerpt, content, category, published, published_at)
SELECT slug, title, excerpt,
'## مقدمة

' || excerpt || '

منصة **TVCC** هي مركز قيادة موحّد صمّمناه لإدارة المواقع والسيرفرات والخدمات من واجهة عربية واحدة، بدل التنقّل بين عشرات اللوحات.

## لماذا هذه الميزة؟

- توفير الوقت: كل شيء في مكان واحد، بلا تعقيد.
- الشفافية: حالة حيّة لكل مورد مع سجل عمليات كامل.
- الأمان: صلاحيات دقيقة وسياسات وصول صارمة على مستوى قاعدة البيانات.

## كيف تعمل؟

1. سجّل الدخول إلى لوحة التحكم.
2. افتح القسم المخصّص من القائمة الجانبية.
3. أضف المورد (موقع، سيرفر، نموذج، منفذ) واتبع خطوات التحقق.
4. راقب النتيجة لحظياً من لوحة التحكم.

## نصائح عملية

- فعّل التنبيهات حتى تصلك أي مشكلة قبل أن يلاحظها زوّارك.
- استخدم وضع «المحاكاة (Dry Run)» قبل تنفيذ أي أمر حسّاس على السيرفر.
- راجع سجل العمليات بعد كل تغيير للتأكد من نجاحه.

## الخلاصة

هذه الميزة جزء من رؤية TVCC: منصة واحدة حيّة تنمو مع أعمالك، وأي تطوير نضيفه يصل تلقائياً إلى كل نسخك.',
category, true, now() - (ord || ' days')::interval
FROM seed;