-- Records each time a driver left the planned route, why, and how it ended, so dispatchers can see it.
ALTER TABLE public.planner_route_executions
  ADD COLUMN IF NOT EXISTS deviations JSONB NOT NULL DEFAULT '[]'::JSONB
  CHECK (jsonb_typeof(deviations) = 'array');
