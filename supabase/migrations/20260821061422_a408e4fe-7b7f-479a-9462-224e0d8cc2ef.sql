REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_permanent_owner_roles() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_team_member(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_team_editor(uuid) FROM anon;