CREATE TABLE IF NOT EXISTS public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counter bigint NOT NULL DEFAULT 10000,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_visits TO anon;
GRANT SELECT ON public.site_visits TO authenticated;
GRANT ALL ON public.site_visits TO service_role;

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_visits_public_read" ON public.site_visits;
CREATE POLICY "site_visits_public_read" ON public.site_visits
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.site_visits (counter)
SELECT 10000 WHERE NOT EXISTS (SELECT 1 FROM public.site_visits);

CREATE OR REPLACE FUNCTION public.bump_site_visits()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v bigint;
BEGIN
  UPDATE public.site_visits
     SET counter = counter + 1, updated_at = now()
   WHERE id = (SELECT id FROM public.site_visits ORDER BY created_order LIMIT 1)
  RETURNING counter INTO v;
  RETURN v;
END;
$$;