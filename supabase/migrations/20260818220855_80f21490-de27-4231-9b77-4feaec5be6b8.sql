CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  owner_emails text[] := ARRAY['lmodirv@gmail.com','info@hnchat.net'];
  is_owner boolean := false;
  hn_db_group_id uuid;
  hn_db_domains text[] := ARRAY[
    'admin.hn-db.fun','ai.hn-db.fun','api.hn-db.fun','api.hn-dbpro.com',
    'auth.hn-db.fun','db.hn-createur.com','files.hn-db.fun','hn-bd.online',
    'hn-db.fun','hn-db.hn-groupe.net','hn-dbpro.com','hn-groupe.org',
    'owner.hn-db.fun','rule.hn-db.fun','status.hn-db.fun','users.hn-db.fun',
    'ws.hn-db.fun','www.db.hn-createur.com','www.hn-bd.online','www.hn-db.fun',
    'www.hn-db.hn-groupe.net','www.hn-dbpro.com','www.hn-groupe.org'
  ];
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = ANY(owner_emails) THEN
    is_owner := true;
  END IF;

  IF is_owner THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'system_owner')
    ON CONFLICT DO NOTHING;

    UPDATE public.websites SET owner_id = NEW.id WHERE owner_id IS NULL;

    INSERT INTO public.site_groups (owner_id, name, description, color, icon)
    VALUES (NEW.id, 'HN-DB', 'قواعد البيانات HN-DB (23 موقع)', '#10b981', 'Database')
    RETURNING id INTO hn_db_group_id;

    INSERT INTO public.website_group_members (owner_id, group_id, website_id)
    SELECT NEW.id, hn_db_group_id, w.id
    FROM public.websites w
    WHERE w.domain = ANY(hn_db_domains)
    ON CONFLICT DO NOTHING;
  ELSE
    -- Non-privileged default role for all self-registered users
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Remove admin grants from any account that is not a system owner
DELETE FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles o
    WHERE o.user_id = ur.user_id AND o.role = 'system_owner'
  );