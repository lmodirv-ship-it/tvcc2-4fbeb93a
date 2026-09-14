ALTER TABLE public.tvcc_probe ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tvcc_probe TO authenticated;
GRANT ALL ON public.tvcc_probe TO service_role;

CREATE POLICY "Authenticated users can read tvcc_probe" ON public.tvcc_probe FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tvcc_probe" ON public.tvcc_probe FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tvcc_probe" ON public.tvcc_probe FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete tvcc_probe" ON public.tvcc_probe FOR DELETE TO authenticated USING (true);