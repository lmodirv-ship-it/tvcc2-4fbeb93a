-- ============ SERVERS ============
CREATE TABLE public.servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  hostname text NOT NULL,
  provider text,
  region text,
  os text,
  vcpu integer,
  ram_mb integer,
  disk_gb integer,
  status text NOT NULL DEFAULT 'pending',
  agent_token_hash text,
  agent_version text,
  last_seen_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.servers TO authenticated;
GRANT ALL ON public.servers TO service_role;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "servers_owner_all" ON public.servers FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER servers_touch BEFORE UPDATE ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.server_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  cpu_percent numeric,
  mem_used_mb numeric,
  mem_total_mb numeric,
  disk_used_gb numeric,
  disk_total_gb numeric,
  load_avg numeric,
  uptime_seconds bigint,
  process_count integer,
  collected_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_metrics TO authenticated;
GRANT ALL ON public.server_metrics TO service_role;
ALTER TABLE public.server_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server_metrics_owner_all" ON public.server_metrics FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX server_metrics_server_time_idx ON public.server_metrics (server_id, collected_at DESC);

CREATE TABLE public.server_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  name text NOT NULL,
  domain text,
  port integer,
  status text NOT NULL DEFAULT 'unknown',
  service_kind text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (server_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_sites TO authenticated;
GRANT ALL ON public.server_sites TO service_role;
ALTER TABLE public.server_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "server_sites_owner_all" ON public.server_sites FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL;

-- ============ AI ============
CREATE TABLE public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'cloud',
  vendor text NOT NULL DEFAULT 'lovable',
  base_url text,
  api_key_encrypted text,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_checked_at timestamptz,
  last_latency_ms integer,
  status text NOT NULL DEFAULT 'unknown',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_providers_owner_all" ON public.ai_providers FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER ai_providers_touch BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  name text NOT NULL,
  model_id text NOT NULL,
  kind text NOT NULL DEFAULT 'cloud',
  endpoint_url text,
  capabilities text[] NOT NULL DEFAULT ARRAY['text']::text[],
  context_window integer,
  size_mb numeric,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100,
  last_latency_ms integer,
  status text NOT NULL DEFAULT 'unknown',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_models TO authenticated;
GRANT ALL ON public.ai_models TO service_role;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_models_owner_all" ON public.ai_models FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER ai_models_touch BEFORE UPDATE ON public.ai_models
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'محادثة جديدة',
  model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  website_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_conversations_owner_all" ON public.ai_conversations FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER ai_conversations_touch BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  model_label text,
  tool_calls jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_messages_owner_all" ON public.ai_messages FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX ai_messages_conversation_idx ON public.ai_messages (conversation_id, created_at);

CREATE TABLE public.ai_routing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task text NOT NULL,
  primary_model_id uuid REFERENCES public.ai_models(id) ON DELETE SET NULL,
  fallback_model_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, task)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_routing TO authenticated;
GRANT ALL ON public.ai_routing TO service_role;
ALTER TABLE public.ai_routing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_routing_owner_all" ON public.ai_routing FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER ai_routing_touch BEFORE UPDATE ON public.ai_routing
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();