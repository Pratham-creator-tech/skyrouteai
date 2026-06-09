
-- Restrict SELECT on deliveries to staff roles
DROP POLICY IF EXISTS "del read" ON public.deliveries;
CREATE POLICY "del read" ON public.deliveries FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'fleet_manager'));

-- Restrict SELECT on drivers to fleet_manager/admin
DROP POLICY IF EXISTS "drv read" ON public.drivers;
CREATE POLICY "drv read" ON public.drivers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager') OR public.has_role(auth.uid(), 'dispatcher'));

-- Restrict SELECT on vehicles to staff roles
DROP POLICY IF EXISTS "veh read" ON public.vehicles;
CREATE POLICY "veh read" ON public.vehicles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager') OR public.has_role(auth.uid(), 'dispatcher'));

-- Restrict SELECT on ai_events to admin only
DROP POLICY IF EXISTS "ev read" ON public.ai_events;
CREATE POLICY "ev read" ON public.ai_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Lock down user_roles: only admins can insert/update/delete
CREATE POLICY "user_roles admin insert" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles admin update" ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles admin delete" ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Revoke EXECUTE on trigger functions from PUBLIC/authenticated/anon (they only need to run as triggers)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
