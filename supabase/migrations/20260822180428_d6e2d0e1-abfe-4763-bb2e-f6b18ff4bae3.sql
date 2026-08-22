CREATE TABLE public.file_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  name text NOT NULL,
  target_path text NOT NULL DEFAULT '/home/ismail/hn',
  mode text NOT NULL DEFAULT 'agent',
  host text,
  ssh_user text,
  port integer,
  service_name text,
  install_cmd text,
  build_cmd text,
  start_cmd text,
  output_dir text,
  file_count integer DEFAULT 0,
  size_bytes bigint DEFAULT 0,
  storage_path text,
  status text NOT NULL DEFAULT 'draft',
  dry_run boolean NOT NULL DEFAULT false,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  log text,
  command_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_transfers TO authenticated;
GRANT ALL ON public.file_transfers TO service_role;
ALTER TABLE public.file_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "file_transfers_select" ON public.file_transfers FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage(owner_id));
CREATE POLICY "file_transfers_insert" ON public.file_transfers FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "file_transfers_update" ON public.file_transfers FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage(owner_id))
  WITH CHECK (owner_id = auth.uid() OR public.can_manage(owner_id));
CREATE POLICY "file_transfers_delete" ON public.file_transfers FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage(owner_id));

CREATE INDEX file_transfers_owner_idx ON public.file_transfers (owner_id, created_at DESC);
CREATE INDEX file_transfers_server_idx ON public.file_transfers (server_id);

CREATE POLICY "site_uploads_owner_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'site-uploads' AND owner = auth.uid());
CREATE POLICY "site_uploads_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-uploads' AND owner = auth.uid());
CREATE POLICY "site_uploads_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-uploads' AND owner = auth.uid());
CREATE POLICY "site_uploads_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-uploads' AND owner = auth.uid());