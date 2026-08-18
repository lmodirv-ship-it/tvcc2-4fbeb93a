-- Add columns to existing tables
ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS agent_version text,
  ADD COLUMN IF NOT EXISTS public_ip text,
  ADD COLUMN IF NOT EXISTS auto_cert_policy text NOT NULL DEFAULT 'manual';

ALTER TABLE public.server_commands
  ADD COLUMN IF NOT EXISTS dry_run boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preview jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.vault_secrets
  ADD COLUMN IF NOT EXISTS rotation_period_days integer,
  ADD COLUMN IF NOT EXISTS last_rotated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL;

-- New table: backup_schedules
CREATE TABLE IF NOT EXISTS public.backup_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE,
  backup_type text NOT NULL DEFAULT 'full',
  schedule text NOT NULL DEFAULT '0 2 * * *',
  retention_count integer NOT NULL DEFAULT 7,
  is_active boolean NOT NULL DEFAULT true,
  notify_on_failure boolean NOT NULL DEFAULT true,
  last_run_at timestamp with time zone,
  next_run_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_schedules TO authenticated;
GRANT ALL ON public.backup_schedules TO service_role;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own backup schedules"
ON public.backup_schedules
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- New table: server_alert_rules
CREATE TABLE IF NOT EXISTS public.server_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  threshold numeric,
  duration_minutes integer NOT NULL DEFAULT 5,
  channels uuid[] NOT NULL DEFAULT '{}',
  cooldown_minutes integer NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_alert_rules TO authenticated;
GRANT ALL ON public.server_alert_rules TO service_role;
ALTER TABLE public.server_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own alert rules"
ON public.server_alert_rules
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- New table: server_alert_history
CREATE TABLE IF NOT EXISTS public.server_alert_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.server_alert_rules(id) ON DELETE SET NULL,
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  website_id uuid REFERENCES public.websites(id) ON DELETE SET NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  notified_at timestamp with time zone,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_alert_history TO authenticated;
GRANT ALL ON public.server_alert_history TO service_role;
ALTER TABLE public.server_alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alert history"
ON public.server_alert_history
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- New table: vault_secret_versions
CREATE TABLE IF NOT EXISTS public.vault_secret_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_id uuid NOT NULL REFERENCES public.vault_secrets(id) ON DELETE CASCADE,
  value_encrypted text NOT NULL,
  rotated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.vault_secret_versions TO authenticated;
GRANT ALL ON public.vault_secret_versions TO service_role;
ALTER TABLE public.vault_secret_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own secret versions"
ON public.vault_secret_versions
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- New table: server_ip_history
CREATE TABLE IF NOT EXISTS public.server_ip_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  old_ip text,
  new_ip text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.server_ip_history TO authenticated;
GRANT ALL ON public.server_ip_history TO service_role;
ALTER TABLE public.server_ip_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own server IP history"
ON public.server_ip_history
FOR ALL
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'backup_schedules_touch'
  ) THEN
    CREATE TRIGGER backup_schedules_touch
      BEFORE UPDATE ON public.backup_schedules
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'server_alert_rules_touch'
  ) THEN
    CREATE TRIGGER server_alert_rules_touch
      BEFORE UPDATE ON public.server_alert_rules
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON public.backup_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_server_alert_history_created ON public.server_alert_history(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_ip_history_server ON public.server_ip_history(server_id, created_at DESC);
