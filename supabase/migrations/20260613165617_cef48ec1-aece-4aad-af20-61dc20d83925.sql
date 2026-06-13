
-- ai_decisions: restrict INSERT to admin/dispatcher
DROP POLICY IF EXISTS "ai_decisions auth insert" ON public.ai_decisions;
CREATE POLICY "ai_decisions staff insert" ON public.ai_decisions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));

-- workflow_executions: restrict INSERT/UPDATE to admin/dispatcher
DROP POLICY IF EXISTS "wf_exec insert" ON public.workflow_executions;
DROP POLICY IF EXISTS "wf_exec update" ON public.workflow_executions;
CREATE POLICY "wf_exec staff insert" ON public.workflow_executions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));
CREATE POLICY "wf_exec staff update" ON public.workflow_executions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));

-- workflow_steps: restrict INSERT/UPDATE to admin/dispatcher
DROP POLICY IF EXISTS "wf_step insert" ON public.workflow_steps;
DROP POLICY IF EXISTS "wf_step update" ON public.workflow_steps;
CREATE POLICY "wf_step staff insert" ON public.workflow_steps
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));
CREATE POLICY "wf_step staff update" ON public.workflow_steps
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));

-- profiles: restrict SELECT to self or admin
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
CREATE POLICY "Profiles readable by self or admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
