
CREATE TABLE public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  current_step TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_executions TO authenticated;
GRANT ALL ON public.workflow_executions TO service_role;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wf_exec read" ON public.workflow_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "wf_exec insert" ON public.workflow_executions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wf_exec update" ON public.workflow_executions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wf_exec admin delete" ON public.workflow_executions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_wf_exec_updated BEFORE UPDATE ON public.workflow_executions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_wf_exec_delivery ON public.workflow_executions(delivery_id);
CREATE INDEX idx_wf_exec_created ON public.workflow_executions(created_at DESC);

CREATE TABLE public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
  agent_key TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  step_order INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decision TEXT,
  reasoning TEXT,
  output JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_steps TO authenticated;
GRANT ALL ON public.workflow_steps TO service_role;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wf_step read" ON public.workflow_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "wf_step insert" ON public.workflow_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wf_step update" ON public.workflow_steps FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "wf_step admin delete" ON public.workflow_steps FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_wf_step_updated BEFORE UPDATE ON public.workflow_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_wf_step_exec ON public.workflow_steps(execution_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_executions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_steps;
