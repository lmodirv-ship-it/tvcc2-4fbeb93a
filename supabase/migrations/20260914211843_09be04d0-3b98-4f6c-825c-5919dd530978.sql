CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.cron_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO private.cron_secrets (name, secret)
VALUES ('nightly_backup', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION private.run_nightly_backup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE s text;
BEGIN
  SELECT secret INTO s FROM private.cron_secrets WHERE name = 'nightly_backup';
  PERFORM net.http_post(
    url := 'https://project--b4f7d096-0b0d-4a25-815e-9faa0862c50f.lovable.app/api/public/backups/nightly',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-tvcc-secret', s),
    body := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule('tvcc-nightly-backup', '0 0 * * *', $$SELECT private.run_nightly_backup();$$);