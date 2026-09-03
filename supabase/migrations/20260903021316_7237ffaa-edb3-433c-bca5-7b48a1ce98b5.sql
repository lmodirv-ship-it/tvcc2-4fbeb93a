ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS api_url text,
  ADD COLUMN IF NOT EXISTS site_url text,
  ADD COLUMN IF NOT EXISTS manara_code text;

UPDATE public.websites
SET slug = COALESCE(slug, regexp_replace(lower(split_part(replace(replace(domain,'https://',''),'http://',''), '/', 1)), '[^a-z0-9]+', '-', 'g')),
    site_url = COALESCE(site_url, 'https://' || split_part(replace(replace(domain,'https://',''),'http://',''), '/', 1)),
    api_url = COALESCE(api_url, api_config_url, 'https://' || split_part(replace(replace(domain,'https://',''),'http://',''), '/', 1) || '/api')
WHERE domain IS NOT NULL;

CREATE INDEX IF NOT EXISTS websites_manara_code_idx ON public.websites (manara_code);