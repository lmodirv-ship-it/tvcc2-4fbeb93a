-- 1) Team helper
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','editor','system_owner'))
$$;

CREATE OR REPLACE FUNCTION public.is_team_editor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','editor','system_owner'))
$$;

-- 2) Invitations
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  full_name text,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invitations TO authenticated;
GRANT ALL ON public.team_invitations TO service_role;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system owner manages invitations" ON public.team_invitations;
CREATE POLICY "system owner manages invitations" ON public.team_invitations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (public.has_role(auth.uid(),'system_owner'));
DROP POLICY IF EXISTS "admins read invitations" ON public.team_invitations;
CREATE POLICY "admins read invitations" ON public.team_invitations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- 3) Grant role from invitation on signup; permanent owner untouched
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  is_owner boolean := public.is_permanent_owner_email(NEW.email);
  hn_db_group_id uuid;
  invited_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  IF is_owner THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'system_owner') ON CONFLICT DO NOTHING;

    UPDATE public.websites SET owner_id = NEW.id WHERE owner_id IS NULL;

    IF NOT EXISTS (SELECT 1 FROM public.site_groups WHERE owner_id = NEW.id AND name = 'HN-DB') THEN
      INSERT INTO public.site_groups (owner_id, name, description, color, icon)
      VALUES (NEW.id, 'HN-DB', 'قواعد البيانات HN-DB', '#10b981', 'Database')
      RETURNING id INTO hn_db_group_id;

      INSERT INTO public.website_group_members (owner_id, group_id, website_id)
      SELECT NEW.id, hn_db_group_id, w.id
      FROM public.websites w
      WHERE w.domain LIKE '%hn-db%' OR w.domain LIKE '%hn-dbpro%'
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    SELECT role INTO invited_role FROM public.team_invitations
      WHERE lower(email) = lower(NEW.email) AND accepted_at IS NULL;

    IF invited_role IN ('admin','editor') THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, invited_role) ON CONFLICT DO NOTHING;
      UPDATE public.team_invitations SET accepted_at = now() WHERE lower(email) = lower(NEW.email);
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer') ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Protect permanent owner roles from change/removal
CREATE OR REPLACE FUNCTION public.protect_permanent_owner_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid := COALESCE(OLD.user_id, NEW.user_id);
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = target AND public.is_permanent_owner_email(u.email)) THEN
    RAISE EXCEPTION 'صلاحيات مدير المنصة الدائم محمية ولا يمكن تعديلها أو حذفها';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_owner_roles ON public.user_roles;
CREATE TRIGGER trg_protect_owner_roles BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_permanent_owner_roles();

-- 5) System owner manages roles (in addition to reads)
DROP POLICY IF EXISTS "system owner manages roles" ON public.user_roles;
CREATE POLICY "system owner manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'system_owner'))
  WITH CHECK (public.has_role(auth.uid(),'system_owner'));
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- 6) Team access on all owner-scoped tables: read + create/edit, never delete
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'owner_id' AND a.attnum > 0 AND NOT a.attisdropped
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "team read" ON public.%I', t.tbl);
    EXECUTE format('CREATE POLICY "team read" ON public.%I FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()))', t.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "team insert" ON public.%I', t.tbl);
    EXECUTE format('CREATE POLICY "team insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_team_editor(auth.uid()))', t.tbl);
    EXECUTE format('DROP POLICY IF EXISTS "team update" ON public.%I', t.tbl);
    EXECUTE format('CREATE POLICY "team update" ON public.%I FOR UPDATE TO authenticated USING (public.is_team_editor(auth.uid())) WITH CHECK (public.is_team_editor(auth.uid()))', t.tbl);
  END LOOP;
END $$;

-- 7) Websites: deletion restricted to the permanent owner / system owner only
DROP POLICY IF EXISTS "websites owner all" ON public.websites;
CREATE POLICY "websites owner select" ON public.websites FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "websites owner insert" ON public.websites FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "websites owner update" ON public.websites FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "websites delete system owner only" ON public.websites FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'system_owner') AND auth.uid() = owner_id);
