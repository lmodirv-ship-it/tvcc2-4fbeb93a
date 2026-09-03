REVOKE SELECT ON public.manara_projects FROM anon;
GRANT SELECT (id, project_key, name, status, group_tag) ON public.manara_projects TO anon;