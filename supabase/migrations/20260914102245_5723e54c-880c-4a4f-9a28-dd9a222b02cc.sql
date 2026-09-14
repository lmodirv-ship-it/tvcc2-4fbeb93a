create table public.fleet_blueprints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  schema_sql text not null default '',
  version integer not null default 1,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.fleet_blueprints to authenticated;
grant all on public.fleet_blueprints to service_role;
alter table public.fleet_blueprints enable row level security;
create policy "Owners manage blueprints" on public.fleet_blueprints for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner'));

create table public.blueprint_deployments (
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.fleet_blueprints(id) on delete cascade,
  website_id uuid references public.websites(id) on delete set null,
  server_id uuid references public.servers(id) on delete set null,
  status text not null default 'pending',
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.blueprint_deployments to authenticated;
grant all on public.blueprint_deployments to service_role;
alter table public.blueprint_deployments enable row level security;
create policy "Owners manage blueprint deployments" on public.blueprint_deployments for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner'));

create table public.federated_queries (
  id uuid primary key default gen_random_uuid(),
  sql_text text not null,
  target_kind text not null default 'site',
  target_ids uuid[] not null default '{}',
  destructive boolean not null default false,
  confirmed boolean not null default false,
  status text not null default 'draft',
  results jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.federated_queries to authenticated;
grant all on public.federated_queries to service_role;
alter table public.federated_queries enable row level security;
create policy "Owners manage federated queries" on public.federated_queries for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner'));

create table public.site_clones (
  id uuid primary key default gen_random_uuid(),
  source_website_id uuid references public.websites(id) on delete set null,
  target_server_id uuid references public.servers(id) on delete set null,
  new_domain text,
  status text not null default 'pending',
  snapshot_path text,
  result jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.site_clones to authenticated;
grant all on public.site_clones to service_role;
alter table public.site_clones enable row level security;
create policy "Owners manage site clones" on public.site_clones for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner'));

create table public.federated_alerts (
  id uuid primary key default gen_random_uuid(),
  severity text not null default 'info',
  source_kind text,
  source_id uuid,
  title text not null,
  body text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.federated_alerts to authenticated;
grant all on public.federated_alerts to service_role;
alter table public.federated_alerts enable row level security;
create policy "Owners manage federated alerts" on public.federated_alerts for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner'));

create table public.agent_configs (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  heartbeat_interval_sec integer not null default 60,
  allowed_commands text[] not null default '{}',
  autostart boolean not null default true,
  resource_limits jsonb not null default '{}',
  extra jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (server_id)
);
grant select, insert, update, delete on public.agent_configs to authenticated;
grant all on public.agent_configs to service_role;
alter table public.agent_configs enable row level security;
create policy "Owners manage agent configs" on public.agent_configs for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner'));

create table public.nginx_configs (
  id uuid primary key default gen_random_uuid(),
  server_id uuid not null references public.servers(id) on delete cascade,
  website_id uuid references public.websites(id) on delete set null,
  file_path text not null,
  content text not null default '',
  status text not null default 'active',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.nginx_configs to authenticated;
grant all on public.nginx_configs to service_role;
alter table public.nginx_configs enable row level security;
create policy "Owners manage nginx configs" on public.nginx_configs for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner'));

create table public.site_snapshots (
  id uuid primary key default gen_random_uuid(),
  website_id uuid not null references public.websites(id) on delete cascade,
  server_id uuid references public.servers(id) on delete set null,
  slot text not null default 'current',
  path text,
  size_bytes bigint,
  note text,
  created_at timestamptz not null default now(),
  unique (website_id, slot)
);
grant select, insert, update, delete on public.site_snapshots to authenticated;
grant all on public.site_snapshots to service_role;
alter table public.site_snapshots enable row level security;
create policy "Owners manage site snapshots" on public.site_snapshots for all to authenticated using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner')) with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'system_owner'));

create trigger touch_fleet_blueprints before update on public.fleet_blueprints for each row execute function public.touch_updated_at();
create trigger touch_blueprint_deployments before update on public.blueprint_deployments for each row execute function public.touch_updated_at();
create trigger touch_federated_queries before update on public.federated_queries for each row execute function public.touch_updated_at();
create trigger touch_site_clones before update on public.site_clones for each row execute function public.touch_updated_at();
create trigger touch_agent_configs before update on public.agent_configs for each row execute function public.touch_updated_at();
create trigger touch_nginx_configs before update on public.nginx_configs for each row execute function public.touch_updated_at();

insert into public.platform_pages (route_path, page_key, name_ar, name_en, name_fr, section, min_role, enabled, show_in_sidebar, icon)
values
 ('/federated','federated','نظرة عامة فيدرالية','Federated Overview','Vue fédérée','السيطرة الفيدرالية','admin',true,true,'Radar'),
 ('/federated/fleet','federated-fleet','المواقع والأسطول','Sites & Fleet','Sites et flotte','السيطرة الفيدرالية','admin',true,true,'Globe'),
 ('/federated/sql','federated-sql','استوديو قواعد البيانات','SQL Studio','Studio SQL','السيطرة الفيدرالية','admin',true,true,'Database'),
 ('/federated/mesh','federated-mesh','المزامنة والأمان','Mesh & Security','Mesh et sécurité','السيطرة الفيدرالية','admin',true,true,'Shield'),
 ('/federated/pitr','federated-pitr','النسخ والسفر عبر الزمن','PITR & Backups','PITR et sauvegardes','السيطرة الفيدرالية','admin',true,true,'History'),
 ('/federated/healing','federated-healing','الشفاء الذاتي والسجلات','Self-Healing & Logs','Auto-réparation','السيطرة الفيدرالية','admin',true,true,'HeartPulse'),
 ('/federated/assets','federated-assets','الأصول المركزية','Edge Assets','Actifs Edge','السيطرة الفيدرالية','admin',true,true,'Package'),
 ('/federated/db','federated-db','قواعد البيانات','Databases','Bases de données','السيطرة الفيدرالية','admin',true,true,'DatabaseZap'),
 ('/federated/agents','federated-agents','الوكيل','Agents','Agents','السيطرة الفيدرالية','admin',true,true,'Bot')
on conflict (page_key) do nothing;