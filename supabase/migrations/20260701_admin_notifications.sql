-- Admin-wide notification system
-- Stores system-level alerts visible to all admins.
-- Separate from the per-user notifications table used by clients/drivers.

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text NOT NULL DEFAULT 'system'
             CHECK (type IN (
               'new_shipment',
               'driver_application',
               'payment_failed',
               'support_ticket',
               'deletion_request',
               'email_failure',
               'assignment_update',
               'dispute',
               'system'
             )),
  title      text NOT NULL,
  message    text NOT NULL,
  severity   text NOT NULL DEFAULT 'medium'
             CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  action_link text,
  is_read    boolean NOT NULL DEFAULT false,
  read_at    timestamptz,
  data       jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read  ON public.admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_severity ON public.admin_notifications(severity);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created  ON public.admin_notifications(created_at DESC);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on admin_notifications"
  ON public.admin_notifications FOR ALL
  USING (true)
  WITH CHECK (true);

-- Authenticated admins can select and update (mark-read)
CREATE POLICY "Admins can read admin_notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update admin_notifications"
  ON public.admin_notifications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
