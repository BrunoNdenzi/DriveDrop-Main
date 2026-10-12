-- Proof of delivery photos live in a private bucket; customers see them only through short-lived signed links.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('planner-proof', 'planner-proof', false, 6291456, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- One link per stop, shared with that stop's customer so they can follow the driver's ETA.
CREATE TABLE IF NOT EXISTS public.planner_stop_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.planner_routes(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES public.planner_route_executions(id) ON DELETE CASCADE,
  stop_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS planner_stop_links_execution_stop_idx ON public.planner_stop_links (execution_id, stop_id);

ALTER TABLE public.planner_stop_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own planner stop links"
  ON public.planner_stop_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
