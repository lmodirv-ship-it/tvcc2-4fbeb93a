
-- 1) أعمدة الربط مع HN-Cloud / HN-DB / Android على websites
ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS site_id text UNIQUE DEFAULT encode(extensions.gen_random_bytes(8), 'hex'),
  ADD COLUMN IF NOT EXISTS frontend_domain text,
  ADD COLUMN IF NOT EXISTS hn_db_connection_id text,
  ADD COLUMN IF NOT EXISTS hn_cloud_storage_id text,
  ADD COLUMN IF NOT EXISTS api_config_url text,
  ADD COLUMN IF NOT EXISTS android_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS android_latest_version text,
  ADD COLUMN IF NOT EXISTS android_version_code integer,
  ADD COLUMN IF NOT EXISTS android_apk_url text,
  ADD COLUMN IF NOT EXISTS android_aab_url text,
  ADD COLUMN IF NOT EXISTS android_status text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS android_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS websites_frontend_domain_idx ON public.websites (frontend_domain);
CREATE INDEX IF NOT EXISTS websites_site_id_idx ON public.websites (site_id);

-- 2) تعبئة site_id للسجلات القديمة لو فاضي
UPDATE public.websites
SET site_id = encode(extensions.gen_random_bytes(8), 'hex')
WHERE site_id IS NULL;

-- 3) جدول سجل إصدارات APK لكل موقع
CREATE TABLE IF NOT EXISTS public.website_android_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  website_id uuid NOT NULL,
  version_name text NOT NULL,
  version_code integer NOT NULL,
  apk_url text,
  aab_url text,
  notes text,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_android_releases TO authenticated;
GRANT ALL ON public.website_android_releases TO service_role;

ALTER TABLE public.website_android_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "android_releases owner all"
  ON public.website_android_releases
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS war_website_idx ON public.website_android_releases (website_id, created_at DESC);
