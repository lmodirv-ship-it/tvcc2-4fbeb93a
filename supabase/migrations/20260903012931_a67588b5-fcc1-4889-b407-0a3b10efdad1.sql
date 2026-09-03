ALTER TABLE public.brand_settings
  ADD COLUMN IF NOT EXISTS theme_id text DEFAULT 'neon',
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS background_color text,
  ADD COLUMN IF NOT EXISTS font_family text,
  ADD COLUMN IF NOT EXISTS radius text,
  ADD COLUMN IF NOT EXISTS shadow text;

CREATE POLICY "anon reads current verified manara addresses"
ON public.manara_addresses FOR SELECT TO anon
USING (is_current = true AND is_verified = true AND retired_at IS NULL);

GRANT SELECT ON public.manara_addresses TO anon;
GRANT SELECT ON public.manara_projects TO anon;
GRANT SELECT ON public.manara_public_routes TO anon, authenticated;

ALTER VIEW public.manara_public_routes SET (security_invoker = on);