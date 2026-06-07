
-- 1) Secrets Vault
CREATE TABLE public.vault_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  website_id uuid,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  value_encrypted text NOT NULL,
  description text,
  last_rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_secrets TO authenticated;
GRANT ALL ON public.vault_secrets TO service_role;
ALTER TABLE public.vault_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vault owner all" ON public.vault_secrets FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER vault_secrets_touch BEFORE UPDATE ON public.vault_secrets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Domains
CREATE TABLE public.domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  domain text NOT NULL,
  registrar text,
  nameservers text[],
  dns_status text NOT NULL DEFAULT 'unknown',
  ssl_status text NOT NULL DEFAULT 'unknown',
  ssl_expires_at timestamptz,
  expires_at timestamptz,
  auto_renew boolean NOT NULL DEFAULT true,
  notes text,
  website_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.domains TO authenticated;
GRANT ALL ON public.domains TO service_role;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domains owner all" ON public.domains FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER domains_touch BEFORE UPDATE ON public.domains
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text,
  website_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications owner all" ON public.notifications FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.notification_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  channel_type text NOT NULL,
  target text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  events text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_channels TO authenticated;
GRANT ALL ON public.notification_channels TO service_role;
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_channels owner all" ON public.notification_channels FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER notif_channels_touch BEFORE UPDATE ON public.notification_channels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Environment Variables (per website .env)
CREATE TABLE public.website_env_vars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  website_id uuid NOT NULL,
  environment text NOT NULL DEFAULT 'production',
  key text NOT NULL,
  value text NOT NULL,
  is_secret boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, environment, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_env_vars TO authenticated;
GRANT ALL ON public.website_env_vars TO service_role;
ALTER TABLE public.website_env_vars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "env_vars owner all" ON public.website_env_vars FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER env_vars_touch BEFORE UPDATE ON public.website_env_vars
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) Recovery Points (backups / snapshots)
CREATE TABLE public.recovery_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  website_id uuid NOT NULL,
  point_type text NOT NULL DEFAULT 'full',
  label text,
  size_mb numeric DEFAULT 0,
  storage_path text,
  status text NOT NULL DEFAULT 'available',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recovery_points TO authenticated;
GRANT ALL ON public.recovery_points TO service_role;
ALTER TABLE public.recovery_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recovery owner all" ON public.recovery_points FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
