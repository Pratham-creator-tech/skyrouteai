
-- Vehicles: add requested columns
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vehicle_number TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
  ADD COLUMN IF NOT EXISTS capacity NUMERIC,
  ADD COLUMN IF NOT EXISTS current_location TEXT,
  ADD COLUMN IF NOT EXISTS fuel_efficiency NUMERIC;

-- Drivers: add requested columns
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS assigned_vehicle UUID REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- Warehouses: add requested columns
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS warehouse_name TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Deliveries: add requested columns
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS pickup_location TEXT,
  ADD COLUMN IF NOT EXISTS dropoff_location TEXT,
  ADD COLUMN IF NOT EXISTS pickup_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS pickup_longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS dropoff_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS dropoff_longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS weight NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_time INTEGER;

-- Routes: add requested columns
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS distance NUMERIC,
  ADD COLUMN IF NOT EXISTS travel_time INTEGER,
  ADD COLUMN IF NOT EXISTS fuel_cost NUMERIC;

-- New table: ai_decisions
CREATE TABLE public.ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  decision TEXT NOT NULL,
  reasoning TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_decisions TO authenticated;
GRANT ALL ON public.ai_decisions TO service_role;

ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_decisions admin read" ON public.ai_decisions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ai_decisions staff insert" ON public.ai_decisions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dispatcher'));

CREATE POLICY "ai_decisions admin update" ON public.ai_decisions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ai_decisions admin delete" ON public.ai_decisions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ai_decisions_timestamp ON public.ai_decisions(timestamp DESC);
CREATE INDEX idx_ai_decisions_agent_name ON public.ai_decisions(agent_name);
