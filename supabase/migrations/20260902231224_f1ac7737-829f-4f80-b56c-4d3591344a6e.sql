CREATE TABLE public.manara_projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_key text NOT NULL UNIQUE,
    name text NOT NULL,
    website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
    current_address_id uuid,
    status text NOT NULL DEFAULT 'active',
    owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    group_tag text DEFAULT 'HN-GROUPE',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.manara_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.manara_projects(id) ON DELETE CASCADE,
    url text NOT NULL,
    host text,
    port int,
    server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
    kind text NOT NULL DEFAULT 'web',
    is_current boolean NOT NULL DEFAULT false,
    is_verified boolean NOT NULL DEFAULT false,
    verified_at timestamptz,
    retired_at timestamptz,
    fingerprint text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.manara_endpoints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.manara_projects(id) ON DELETE CASCADE,
    kind text NOT NULL,
    label text,
    url text,
    version text,
    status text NOT NULL DEFAULT 'pending',
    last_seen_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.manara_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.manara_projects(id) ON DELETE CASCADE,
    from_address_id uuid REFERENCES public.manara_addresses(id) ON DELETE SET NULL,
    to_address_id uuid NOT NULL REFERENCES public.manara_addresses(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending',
    reason text,
    error text,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.manara_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.manara_projects(id) ON DELETE CASCADE,
    address_id uuid REFERENCES public.manara_addresses(id) ON DELETE SET NULL,
    kind text NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manara_projects
    ADD CONSTRAINT fk_current_address
    FOREIGN KEY (current_address_id) REFERENCES public.manara_addresses(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manara_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manara_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manara_endpoints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manara_updates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manara_events TO authenticated;

GRANT SELECT ON public.manara_projects TO anon;
GRANT SELECT ON public.manara_addresses TO anon;
GRANT SELECT ON public.manara_endpoints TO anon;

GRANT ALL ON public.manara_projects TO service_role;
GRANT ALL ON public.manara_addresses TO service_role;
GRANT ALL ON public.manara_endpoints TO service_role;
GRANT ALL ON public.manara_updates TO service_role;
GRANT ALL ON public.manara_events TO service_role;

ALTER TABLE public.manara_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manara_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manara_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manara_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manara_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon reads active manara projects"
ON public.manara_projects
FOR SELECT
TO anon
USING (status = 'active');

CREATE POLICY "anon reads verified current manara addresses"
ON public.manara_addresses
FOR SELECT
TO anon
USING (is_current = true AND is_verified = true AND retired_at IS NULL);

CREATE POLICY "anon reads active manara endpoints"
ON public.manara_endpoints
FOR SELECT
TO anon
USING (status IN ('active', 'pending', 'online'));

CREATE POLICY "authenticated reads own manara projects"
ON public.manara_projects
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'));

CREATE POLICY "authenticated inserts own manara projects"
ON public.manara_projects
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "authenticated updates own manara projects"
ON public.manara_projects
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'));

CREATE POLICY "authenticated deletes own manara projects"
ON public.manara_projects
FOR DELETE
TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'));

CREATE POLICY "authenticated reads manara addresses"
ON public.manara_addresses
FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_addresses.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
));

CREATE POLICY "authenticated inserts manara addresses"
ON public.manara_addresses
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_addresses.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
));

CREATE POLICY "authenticated updates manara addresses"
ON public.manara_addresses
FOR UPDATE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_addresses.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_addresses.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
));

CREATE POLICY "authenticated deletes manara addresses"
ON public.manara_addresses
FOR DELETE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_addresses.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
));

CREATE POLICY "authenticated reads manara endpoints"
ON public.manara_endpoints
FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_endpoints.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
));

CREATE POLICY "authenticated writes manara endpoints"
ON public.manara_endpoints
FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_endpoints.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_endpoints.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
));

CREATE POLICY "authenticated reads manara updates"
ON public.manara_updates
FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_updates.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
));

CREATE POLICY "authenticated writes manara updates"
ON public.manara_updates
FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_updates.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_updates.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
));

CREATE POLICY "authenticated reads manara events"
ON public.manara_events
FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_events.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
));

CREATE POLICY "authenticated writes manara events"
ON public.manara_events
FOR ALL
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_events.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.manara_projects p
    WHERE p.id = manara_events.project_id
      AND (p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'system_owner'))
));

CREATE INDEX idx_manara_projects_key ON public.manara_projects(project_key);
CREATE INDEX idx_manara_projects_website ON public.manara_projects(website_id);
CREATE INDEX idx_manara_addresses_project_current ON public.manara_addresses(project_id, is_current);
CREATE INDEX idx_manara_endpoints_project ON public.manara_endpoints(project_id);
CREATE INDEX idx_manara_updates_project_status ON public.manara_updates(project_id, status);
CREATE INDEX idx_manara_events_project_created ON public.manara_events(project_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.manara_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_manara_projects_updated
    BEFORE UPDATE ON public.manara_projects
    FOR EACH ROW EXECUTE FUNCTION public.manara_touch_updated_at();

CREATE TRIGGER trg_manara_addresses_updated
    BEFORE UPDATE ON public.manara_addresses
    FOR EACH ROW EXECUTE FUNCTION public.manara_touch_updated_at();

CREATE TRIGGER trg_manara_endpoints_updated
    BEFORE UPDATE ON public.manara_endpoints
    FOR EACH ROW EXECUTE FUNCTION public.manara_touch_updated_at();

CREATE TRIGGER trg_manara_updates_updated
    BEFORE UPDATE ON public.manara_updates
    FOR EACH ROW EXECUTE FUNCTION public.manara_touch_updated_at();

CREATE OR REPLACE FUNCTION public.manara_log_address_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.is_current = true AND OLD.is_current = false THEN
        INSERT INTO public.manara_events (project_id, address_id, kind, message)
        VALUES (NEW.project_id, NEW.id, 'address_current', 'تم تعيين العنوان الحالي: ' || NEW.url);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_manara_addresses_current
    AFTER UPDATE ON public.manara_addresses
    FOR EACH ROW EXECUTE FUNCTION public.manara_log_address_change();

INSERT INTO public.manara_projects (project_key, name, website_id, status, owner_id, group_tag)
SELECT w.site_code, COALESCE(w.name, w.domain), w.id, 'active', w.owner_id, 'HN-GROUPE'
FROM public.websites w
WHERE w.site_code IS NOT NULL
  AND w.id NOT IN (SELECT website_id FROM public.manara_projects WHERE website_id IS NOT NULL)
ON CONFLICT (project_key) DO NOTHING;

INSERT INTO public.manara_addresses (project_id, url, host, kind, is_current, is_verified)
SELECT p.id,
       'https://' || w.domain,
       w.domain,
       'web',
       true,
       false
FROM public.manara_projects p
JOIN public.websites w ON w.id = p.website_id
WHERE p.current_address_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE public.manara_projects p
SET current_address_id = (
    SELECT id FROM public.manara_addresses WHERE project_id = p.id AND is_current = true LIMIT 1
)
WHERE current_address_id IS NULL;