-- Latest driver position for an active planner run, so shared tracking links can show a moving driver.
-- Only the most recent fix is kept; a simulated drive is flagged so it is never mistaken for GPS.
ALTER TABLE public.planner_route_executions
  ADD COLUMN IF NOT EXISTS last_latitude DOUBLE PRECISION
    CHECK (last_latitude IS NULL OR last_latitude BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS last_longitude DOUBLE PRECISION
    CHECK (last_longitude IS NULL OR last_longitude BETWEEN -180 AND 180),
  ADD COLUMN IF NOT EXISTS last_heading DOUBLE PRECISION
    CHECK (last_heading IS NULL OR last_heading BETWEEN 0 AND 360),
  ADD COLUMN IF NOT EXISTS last_speed_mps DOUBLE PRECISION
    CHECK (last_speed_mps IS NULL OR last_speed_mps >= 0),
  ADD COLUMN IF NOT EXISTS last_accuracy_meters DOUBLE PRECISION
    CHECK (last_accuracy_meters IS NULL OR last_accuracy_meters >= 0),
  ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_location_simulated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.planner_route_executions.last_location_at IS
  'When the driver device recorded the latest position; pings older than this value are ignored.';
