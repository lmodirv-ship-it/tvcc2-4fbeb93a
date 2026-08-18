-- AI model test log
CREATE TABLE public.ai_model_tests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  model_label text NOT NULL DEFAULT '',
  provider_label text,
  prompt text NOT NULL DEFAULT '',
  answer text,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_model_tests TO authenticated;
GRANT ALL ON public.ai_model_tests TO service_role;
ALTER TABLE public.ai_model_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_model_tests" ON public.ai_model_tests FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_ai_model_tests_owner_created ON public.ai_model_tests (owner_id, created_at DESC);

-- Open ports reported by the agent
CREATE TABLE public.server_ports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  port integer NOT NULL,
  protocol text NOT NULL DEFAULT 'tcp',
  address text,
  process_name text,
  service text,
  is_public boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, port, protocol, address)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_ports TO authenticated;
GRANT ALL ON public.server_ports TO service_role;
ALTER TABLE public.server_ports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own server_ports" ON public.server_ports FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Server config snapshots read by the agent
CREATE TABLE public.server_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  kind text NOT NULL,
  path text NOT NULL,
  content text,
  checksum text,
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, kind, path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_configs TO authenticated;
GRANT ALL ON public.server_configs TO service_role;
ALTER TABLE public.server_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own server_configs" ON public.server_configs FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Whitelisted command queue picked up by the agent
CREATE TABLE public.server_commands (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  action text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  exit_code integer,
  output text,
  error_message text,
  requested_by uuid,
  dispatched_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_commands TO authenticated;
GRANT ALL ON public.server_commands TO service_role;
ALTER TABLE public.server_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own server_commands" ON public.server_commands FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_server_commands_pending ON public.server_commands (server_id, status, created_at);

-- Website backups
CREATE TABLE public.site_backups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  backup_type text NOT NULL DEFAULT 'full',
  label text,
  storage_path text,
  size_mb numeric,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_backups TO authenticated;
GRANT ALL ON public.site_backups TO service_role;
ALTER TABLE public.site_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own site_backups" ON public.site_backups FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Reference operations notebook
CREATE TABLE public.operation_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'server',
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  operation text NOT NULL,
  title text NOT NULL,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'success',
  actor text NOT NULL DEFAULT 'user',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operation_log TO authenticated;
GRANT ALL ON public.operation_log TO service_role;
ALTER TABLE public.operation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own operation_log" ON public.operation_log FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_operation_log_owner_created ON public.operation_log (owner_id, created_at DESC);