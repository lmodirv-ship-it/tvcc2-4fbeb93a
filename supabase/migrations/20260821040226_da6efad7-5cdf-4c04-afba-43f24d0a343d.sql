-- 1) Permanent owner account definition
CREATE OR REPLACE FUNCTION public.is_permanent_owner_email(_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$ SELECT lower(coalesce(_email,'')) = 'lmodirv@gmail.com' $$;

-- 2) Signup trigger: admin ONLY for the permanent owner, everyone else = viewer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_owner boolean := public.is_permanent_owner_email(NEW.email);
  hn_db_group_id uuid;
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
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Backfill: if the permanent owner already exists, guarantee the roles
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r.role
FROM auth.users u
CROSS JOIN (VALUES ('admin'::app_role), ('system_owner'::app_role)) AS r(role)
WHERE public.is_permanent_owner_email(u.email)
ON CONFLICT DO NOTHING;

-- 4) Protect the permanent owner's roles from deletion / modification
CREATE OR REPLACE FUNCTION public.protect_permanent_owner_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_email text;
BEGIN
  SELECT email INTO target_email FROM auth.users WHERE id = OLD.user_id;
  IF public.is_permanent_owner_email(target_email) THEN
    RAISE EXCEPTION 'صلاحيات مدير المنصة الدائم (lmodirv@gmail.com) غير قابلة للحذف أو التغيير';
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_permanent_owner_roles ON public.user_roles;
CREATE TRIGGER trg_protect_permanent_owner_roles
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_permanent_owner_roles();

-- 5) Protect the permanent owner's profile row
CREATE OR REPLACE FUNCTION public.protect_permanent_owner_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_permanent_owner_email(OLD.email) THEN
    RAISE EXCEPTION 'حساب مدير المنصة الدائم غير قابل للحذف';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_permanent_owner_profile ON public.profiles;
CREATE TRIGGER trg_protect_permanent_owner_profile
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_permanent_owner_profile();