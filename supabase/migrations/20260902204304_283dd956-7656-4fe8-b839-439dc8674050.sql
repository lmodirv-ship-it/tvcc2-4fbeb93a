ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS site_code text;

CREATE SEQUENCE IF NOT EXISTS public.website_code_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.assign_website_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.site_code IS NULL OR NEW.site_code = '' THEN
    NEW.site_code := 'ID' || lpad(nextval('public.website_code_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_website_code ON public.websites;
CREATE TRIGGER trg_assign_website_code
BEFORE INSERT ON public.websites
FOR EACH ROW EXECUTE FUNCTION public.assign_website_code();

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.websites
  WHERE site_code IS NULL
)
UPDATE public.websites w
SET site_code = 'ID' || lpad(o.rn::text, 5, '0')
FROM ordered o
WHERE w.id = o.id;

SELECT setval('public.website_code_seq', GREATEST((SELECT count(*) FROM public.websites), 1), true);

CREATE UNIQUE INDEX IF NOT EXISTS websites_site_code_key ON public.websites (site_code);