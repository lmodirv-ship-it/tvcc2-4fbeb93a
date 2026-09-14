create or replace function private.can_command_server(_server uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _server is null
     or exists (
       select 1 from public.servers s
       where s.id = _server and private.can_manage(s.owner_id)
     )
$$;

drop policy if exists "own server_commands" on public.server_commands;
drop policy if exists "owner insert" on public.server_commands;
drop policy if exists "owner update" on public.server_commands;
drop policy if exists "owner read" on public.server_commands;
drop policy if exists "server_commands_admin_manage" on public.server_commands;

create policy "server_commands_read"
  on public.server_commands for select to authenticated
  using (private.can_manage(owner_id));

create policy "server_commands_insert"
  on public.server_commands for insert to authenticated
  with check (private.can_manage(owner_id) and private.can_command_server(server_id));

create policy "server_commands_update"
  on public.server_commands for update to authenticated
  using (private.can_manage(owner_id) and private.can_command_server(server_id))
  with check (private.can_manage(owner_id) and private.can_command_server(server_id));

create policy "server_commands_delete"
  on public.server_commands for delete to authenticated
  using (private.can_manage(owner_id) and private.can_command_server(server_id));

drop policy if exists site_uploads_owner_read on storage.objects;
drop policy if exists site_uploads_owner_write on storage.objects;
drop policy if exists site_uploads_owner_update on storage.objects;
drop policy if exists site_uploads_owner_delete on storage.objects;

create policy site_uploads_owner_read on storage.objects for select to authenticated
  using (
    bucket_id = 'site-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (owner = auth.uid() or owner is null)
  );

create policy site_uploads_owner_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
    and owner = auth.uid()
  );

create policy site_uploads_owner_update on storage.objects for update to authenticated
  using (
    bucket_id = 'site-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (owner = auth.uid() or owner is null)
  )
  with check (
    bucket_id = 'site-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy site_uploads_owner_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (owner = auth.uid() or owner is null)
  );