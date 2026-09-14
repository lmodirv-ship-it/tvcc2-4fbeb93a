-- 1) حفظ المعرّف القديم
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS legacy_site_code text;

-- 2) دالتان لتنفيذ SQL داخلياً على قاعدة المنصة (يستدعيهما الخادم فقط بصلاحية service_role)
CREATE OR REPLACE FUNCTION public.tvcc_exec_sql(sql text)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY EXECUTE sql;
END;
$$;

CREATE OR REPLACE FUNCTION public.tvcc_exec_sql_scalar(sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE sql INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tvcc_exec_sql(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tvcc_exec_sql_scalar(text) TO service_role;

-- 3) تحديث مولّد معرّفات المواقع إلى S######
CREATE OR REPLACE FUNCTION public.assign_website_code() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.site_code IS NULL OR NEW.site_code = '' THEN
    NEW.site_code := 'S' || lpad(nextval('public.website_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4) حفظ الأكواد القديمة
UPDATE public.websites SET legacy_site_code = site_code WHERE legacy_site_code IS NULL AND site_code IS NOT NULL;

-- 5) إعادة ترقيم المواقع بالصيغة الجديدة، مع تثبيت TVCC على S222222
WITH ordered AS (
  SELECT id, site_code, row_number() OVER (ORDER BY created_at, id) as rn
  FROM public.websites
  WHERE site_code IS NOT NULL
)
UPDATE public.websites w
SET site_code = CASE
  WHEN o.site_code = 'ID00243' THEN 'S222222'
  ELSE 'S' || lpad(
    CASE WHEN o.rn >= 222222 THEN o.rn + 1 ELSE o.rn END::text,
    6, '0'
  )
END
FROM ordered o
WHERE w.id = o.id;

-- 6) تحديث معرّفات site_databases لتتوافق مع المواقع
UPDATE public.site_databases sd
SET site_code = w.site_code
FROM public.websites w
WHERE sd.website_id = w.id AND sd.site_code IS DISTINCT FROM w.site_code;

-- 7) إعادة ضبط المولّد على آخر رقم مستخدم
SELECT setval('public.website_code_seq', (
  SELECT COALESCE(MAX(NULLIF(regexp_replace(site_code, '[^0-9]', '', 'g'), '')), '0')::bigint + 1
  FROM public.websites
  WHERE site_code LIKE 'S%'
));

-- 8) ربط قاعدة TVCC الأساسية بالموقع ووضعها كنوع internal
UPDATE public.databases
SET db_kind = 'internal',
    website_id = (SELECT id FROM public.websites WHERE site_code = 'S222222' LIMIT 1)
WHERE name = 'TVCC Cloud Primary' AND is_primary = true;