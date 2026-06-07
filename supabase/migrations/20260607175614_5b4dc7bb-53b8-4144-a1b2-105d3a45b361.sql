
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_emails text[] := ARRAY['lmodirv@gmail.com','info@hnchat.net'];
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
  ON CONFLICT DO NOTHING;

  IF NEW.email = ANY(owner_emails) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'system_owner')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_system_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.role = 'system_owner' THEN
    RAISE EXCEPTION 'Cannot remove system_owner role';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.role = 'system_owner' AND NEW.role <> 'system_owner' THEN
    RAISE EXCEPTION 'Cannot modify system_owner role';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS protect_system_owner_trigger ON public.user_roles;
CREATE TRIGGER protect_system_owner_trigger
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_system_owner();

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'system_owner'::app_role
FROM auth.users u
WHERE u.email IN ('lmodirv@gmail.com','info@hnchat.net')
ON CONFLICT DO NOTHING;
