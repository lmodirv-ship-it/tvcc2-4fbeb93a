
CREATE TABLE public.brand_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  name text NOT NULL DEFAULT 'TVCC',
  tagline text NOT NULL DEFAULT 'SECURE • VERIFY • PROTECT',
  logo_url text NOT NULL,
  favicon_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.brand_settings TO anon, authenticated;
GRANT ALL ON public.brand_settings TO service_role;

ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read brand settings"
  ON public.brand_settings FOR SELECT
  USING (true);

CREATE POLICY "System owners can insert brand settings"
  ON public.brand_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

CREATE POLICY "System owners can update brand settings"
  ON public.brand_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner'));

CREATE TRIGGER brand_settings_touch
  BEFORE UPDATE ON public.brand_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.brand_settings (logo_url, favicon_url)
VALUES (
  '/__l5e/assets-v1/cabd42ee-a07c-45eb-ac0f-021341b6d445/tvcc-logo.jpeg',
  '/__l5e/assets-v1/cabd42ee-a07c-45eb-ac0f-021341b6d445/tvcc-logo.jpeg'
);
