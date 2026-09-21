ALTER TABLE public.planner_routes
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'planned', 'dispatched', 'in_progress', 'completed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version > 0),
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.planner_route_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.planner_routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  change_type TEXT NOT NULL DEFAULT 'edit'
    CHECK (change_type IN ('created', 'edit', 'optimized', 'reoptimized', 'restored')),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.planner_route_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.planner_routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.planner_route_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.planner_routes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'track')),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planner_route_versions_route
  ON public.planner_route_versions (route_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_planner_route_executions_user
  ON public.planner_route_executions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_planner_route_executions_route
  ON public.planner_route_executions (route_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_planner_route_shares_route
  ON public.planner_route_shares (route_id, created_at DESC);

DROP TRIGGER IF EXISTS touch_planner_route_executions_updated_at ON public.planner_route_executions;
CREATE TRIGGER touch_planner_route_executions_updated_at
  BEFORE UPDATE ON public.planner_route_executions
  FOR EACH ROW EXECUTE FUNCTION public.touch_planner_updated_at();

ALTER TABLE public.planner_route_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_route_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_route_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own planner route versions"
  ON public.planner_route_versions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own planner route executions"
  ON public.planner_route_executions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own planner route shares"
  ON public.planner_route_shares FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

INSERT INTO public.planner_route_versions (route_id, user_id, version_number, change_type, snapshot)
SELECT id, user_id, current_version, 'created', jsonb_build_object(
  'name', name,
  'stops', stops,
  'options', options,
  'recurrence', recurrence,
  'optimizedResult', last_optimized_result
)
FROM public.planner_routes
ON CONFLICT (route_id, version_number) DO NOTHING;

COMMENT ON TABLE public.planner_route_versions IS 'Immutable snapshots for route edits, optimization, restoration, and mid-route reoptimization.';
COMMENT ON TABLE public.planner_route_executions IS 'Dispatched route runs with stop completion, GPS, POD, and planned-versus-actual data.';
COMMENT ON TABLE public.planner_route_shares IS 'Revocable, expiring route links for view-only or live progress access.';