-- Admins can manage team roles (except the protected system_owner role)
CREATE POLICY "admins read all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins grant non-owner roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND role <> 'system_owner');

CREATE POLICY "admins revoke non-owner roles" ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND role <> 'system_owner');

CREATE POLICY "admins update non-owner roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND role <> 'system_owner')
WITH CHECK (public.has_role(auth.uid(), 'admin') AND role <> 'system_owner');

-- Admins can see team profiles and manage invitations
CREATE POLICY "admins read profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage invitations" ON public.team_invitations
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin') AND role <> 'system_owner');

-- The permanent owner is always admin as well
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin' FROM public.profiles p
WHERE public.is_permanent_owner_email(p.email)
ON CONFLICT DO NOTHING;