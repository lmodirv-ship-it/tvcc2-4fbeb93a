CREATE TABLE public.website_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  setting_key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (website_id, setting_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_settings TO authenticated;
GRANT ALL ON public.website_settings TO service_role;

ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "website_settings owner all" ON public.website_settings
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER website_settings_touch
  BEFORE UPDATE ON public.website_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX website_settings_website_idx ON public.website_settings(website_id);
CREATE INDEX website_settings_owner_idx ON public.website_settings(owner_id);