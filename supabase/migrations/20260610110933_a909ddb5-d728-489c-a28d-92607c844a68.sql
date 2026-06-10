
DROP POLICY IF EXISTS "ai_decisions admin read" ON public.ai_decisions;
DROP POLICY IF EXISTS "ai_decisions staff insert" ON public.ai_decisions;

CREATE POLICY "ai_decisions auth read" ON public.ai_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_decisions auth insert" ON public.ai_decisions FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.ai_decisions REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_decisions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
