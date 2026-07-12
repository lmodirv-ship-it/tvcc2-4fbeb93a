
-- Allow seeded sites without an owner and let system owners manage all sites
ALTER TABLE public.websites ALTER COLUMN owner_id DROP NOT NULL;

DROP POLICY IF EXISTS "system owner all websites" ON public.websites;
CREATE POLICY "system owner all websites" ON public.websites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'system_owner'))
  WITH CHECK (public.has_role(auth.uid(), 'system_owner') AND (owner_id IS NULL OR owner_id = auth.uid()));
