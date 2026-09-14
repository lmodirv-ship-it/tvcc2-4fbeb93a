INSERT INTO public.site_databases (owner_id, website_id, database_id, connection_kind, role, db_engine, db_name, schema_name, site_code, env_key, status, provisioning_status, provisioned_at, last_checked_at)
SELECT w.owner_id, w.id, '39418692-bc0b-467c-8c81-321cb368af0b'::uuid, 'cloud', 'primary', 'postgres', 'tvcc-hn-groupe', 'public', w.site_code, 'DATABASE_URL', 'connected', 'completed', now(), now()
FROM public.websites w
WHERE w.id = '8dbeb668-6f95-4ce2-b965-121aab4c1bf9'
  AND NOT EXISTS (
    SELECT 1 FROM public.site_databases sd
    WHERE sd.website_id = w.id AND sd.database_id = '39418692-bc0b-467c-8c81-321cb368af0b'::uuid
  );