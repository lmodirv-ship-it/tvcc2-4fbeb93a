CREATE OR REPLACE FUNCTION public.is_permanent_owner_email(_email text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(_email,'')) IN ('lmodirv@gmail.com','info@hnchat.net','taltnamart@gmail.com')
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, r.role
FROM auth.users u
CROSS JOIN (VALUES ('admin'::public.app_role), ('system_owner'::public.app_role)) AS r(role)
WHERE public.is_permanent_owner_email(u.email)
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name','')
FROM auth.users u
WHERE public.is_permanent_owner_email(u.email)
ON CONFLICT (id) DO NOTHING;