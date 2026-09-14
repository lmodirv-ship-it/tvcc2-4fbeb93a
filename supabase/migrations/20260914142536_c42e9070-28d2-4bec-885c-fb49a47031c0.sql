insert into public.platform_pages (page_key, route_path, name_ar, enabled, show_in_sidebar, min_role)
values
  ('federated_docker', '/federated/docker', 'إدارة الحاويات (Docker)', true, true, 'admin'),
  ('federated_nginx', '/federated/nginx', 'الواجهة والتوجيه (Nginx)', true, true, 'admin')
on conflict do nothing;