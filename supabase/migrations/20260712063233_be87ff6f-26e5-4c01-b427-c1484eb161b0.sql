
-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users: profiles + admin role
INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role FROM auth.users u
ON CONFLICT DO NOTHING;

-- Grant system_owner to owner emails
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'system_owner'::app_role FROM auth.users u
WHERE u.email IN ('lmodirv@gmail.com','info@hnchat.net')
ON CONFLICT DO NOTHING;
