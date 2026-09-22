CREATE TABLE IF NOT EXISTS public.driver_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  shipment_ids UUID[] NOT NULL DEFAULT '{}'::UUID[] CHECK (cardinality(shipment_ids) > 0),
  stops JSONB NOT NULL CHECK (jsonb_typeof(stops) = 'array'),
  options JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(options) = 'object'),
  last_optimized_result JSONB CHECK (last_optimized_result IS NULL OR jsonb_typeof(last_optimized_result) = 'object'),
  last_optimized_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'planned', 'dispatched', 'in_progress', 'completed', 'cancelled')),
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version > 0),
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.driver_route_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.driver_routes(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  change_type TEXT NOT NULL DEFAULT 'edit'
    CHECK (change_type IN ('created', 'edit', 'optimized', 'reoptimized', 'restored')),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.driver_route_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.driver_routes(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  status TEXT NOT NULL DEFAULT 'dispatched'
    CHECK (status IN ('dispatched', 'in_progress', 'completed', 'cancelled')),
  planned_start_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  planned_snapshot JSONB NOT NULL CHECK (jsonb_typeof(planned_snapshot) = 'object'),
  stop_progress JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(stop_progress) = 'array'),
  reoptimizations JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(reoptimizations) = 'array'),
  actual_distance_miles DOUBLE PRECISION CHECK (actual_distance_miles IS NULL OR actual_distance_miles >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.driver_route_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.driver_routes(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'track')),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_routes_driver_updated
  ON public.driver_routes (driver_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_routes_shipments
  ON public.driver_routes USING GIN (shipment_ids);
CREATE INDEX IF NOT EXISTS idx_driver_route_versions_route
  ON public.driver_route_versions (route_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_driver_route_executions_driver
  ON public.driver_route_executions (driver_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_route_executions_route
  ON public.driver_route_executions (route_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_route_shares_route
  ON public.driver_route_shares (route_id, created_at DESC);

DROP TRIGGER IF EXISTS touch_driver_routes_updated_at ON public.driver_routes;
CREATE TRIGGER touch_driver_routes_updated_at
  BEFORE UPDATE ON public.driver_routes
  FOR EACH ROW EXECUTE FUNCTION public.touch_planner_updated_at();

DROP TRIGGER IF EXISTS touch_driver_route_executions_updated_at ON public.driver_route_executions;
CREATE TRIGGER touch_driver_route_executions_updated_at
  BEFORE UPDATE ON public.driver_route_executions
  FOR EACH ROW EXECUTE FUNCTION public.touch_planner_updated_at();

ALTER TABLE public.driver_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_route_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_route_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_route_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers manage own routes"
  ON public.driver_routes FOR ALL
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY "Drivers manage own route versions"
  ON public.driver_route_versions FOR ALL
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY "Drivers manage own route executions"
  ON public.driver_route_executions FOR ALL
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());
CREATE POLICY "Drivers manage own route shares"
  ON public.driver_route_shares FOR ALL
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());

COMMENT ON TABLE public.driver_routes IS 'Saved multi-shipment route plans owned by DriveDrop drivers.';
COMMENT ON TABLE public.driver_route_versions IS 'Immutable snapshots of driver route edits and optimization.';
COMMENT ON TABLE public.driver_route_executions IS 'Dispatched driver routes with GPS, POD, reoptimization, and planned-versus-actual data.';
COMMENT ON TABLE public.driver_route_shares IS 'Revocable and expiring public tracking links for driver routes.';