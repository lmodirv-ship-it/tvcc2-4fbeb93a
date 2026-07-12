
DO $$
DECLARE
  t record;
  pol_name text := 'system owner full access';
BEGIN
  FOR t IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind='r' AND n.nspname='public'
      AND c.relname NOT IN ('user_roles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, t.table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''system_owner''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''system_owner''::app_role))',
      pol_name, t.table_name
    );
  END LOOP;
END
$$;

-- Owner can read all user_roles too (but cannot modify system_owner rows — existing protect_system_owner trigger enforces)
DROP POLICY IF EXISTS "system owner reads roles" ON public.user_roles;
CREATE POLICY "system owner reads roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'::app_role));
