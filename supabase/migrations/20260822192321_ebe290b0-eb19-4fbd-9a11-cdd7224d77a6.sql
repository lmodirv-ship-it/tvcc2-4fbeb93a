ALTER TABLE public.service_dependencies ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.site_services ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.site_services ALTER COLUMN is_public SET DEFAULT false;
UPDATE public.site_services SET is_public = false WHERE is_public;

DROP POLICY IF EXISTS "invited user reads own invitation" ON public.team_invitations;
CREATE POLICY "invited user reads own invitation"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (
  accepted_at IS NULL
  AND lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
);