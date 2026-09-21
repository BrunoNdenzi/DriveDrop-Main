CREATE TABLE IF NOT EXISTS public.planner_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  default_vehicle_type TEXT NOT NULL DEFAULT 'default',
  default_vehicle_slots INTEGER NOT NULL DEFAULT 1 CHECK (default_vehicle_slots BETWEEN 1 AND 100),
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.planner_saved_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  address TEXT NOT NULL CHECK (char_length(address) BETWEEN 3 AND 500),
  latitude DOUBLE PRECISION CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS public.planner_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  stops JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(stops) = 'array'),
  options JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(options) = 'object'),
  recurrence JSONB CHECK (recurrence IS NULL OR jsonb_typeof(recurrence) = 'object'),
  next_run_at TIMESTAMPTZ,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  last_optimized_result JSONB,
  last_optimized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_planner_saved_locations_user
  ON public.planner_saved_locations (user_id, name);

CREATE INDEX IF NOT EXISTS idx_planner_routes_user_updated
  ON public.planner_routes (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_planner_routes_next_run
  ON public.planner_routes (next_run_at)
  WHERE is_recurring = TRUE;

CREATE OR REPLACE FUNCTION public.touch_planner_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_planner_profiles_updated_at ON public.planner_profiles;
CREATE TRIGGER touch_planner_profiles_updated_at
  BEFORE UPDATE ON public.planner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_planner_updated_at();

DROP TRIGGER IF EXISTS touch_planner_saved_locations_updated_at ON public.planner_saved_locations;
CREATE TRIGGER touch_planner_saved_locations_updated_at
  BEFORE UPDATE ON public.planner_saved_locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_planner_updated_at();

DROP TRIGGER IF EXISTS touch_planner_routes_updated_at ON public.planner_routes;
CREATE TRIGGER touch_planner_routes_updated_at
  BEFORE UPDATE ON public.planner_routes
  FOR EACH ROW EXECUTE FUNCTION public.touch_planner_updated_at();

ALTER TABLE public.planner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own planner profile"
  ON public.planner_profiles
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own planner locations"
  ON public.planner_saved_locations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own planner routes"
  ON public.planner_routes
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.planner_profiles IS
  'Standalone route planner settings and onboarding state, independent of marketplace roles.';

COMMENT ON TABLE public.planner_saved_locations IS
  'User-owned address book entries for standalone route planning.';

COMMENT ON TABLE public.planner_routes IS
  'User-owned reusable route definitions, optional recurrence, and latest optimization snapshot.';