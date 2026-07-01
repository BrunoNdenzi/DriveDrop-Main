-- Email delivery log table
-- Tracks every outgoing email, its delivery state, and retry history.
-- Used by the Brevo webhook handler to detect bounces and trigger fallback resends.

CREATE TABLE IF NOT EXISTS public.email_delivery_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       text UNIQUE,          -- Nodemailer / Brevo message ID
  recipient        text NOT NULL,
  subject          text NOT NULL,
  from_address     text NOT NULL,
  html             text,                 -- stored for fallback resend
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','sent','delivered','bounced','failed','retried')),
  bounce_type      text,                 -- 'hard' | 'soft' | 'blocked' | 'invalid' | 'deferred'
  bounce_reason    text,
  provider         text NOT NULL DEFAULT 'brevo', -- 'brevo' | 'gmail' | 'fallback'
  retry_count      integer NOT NULL DEFAULT 0,
  last_retry_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Index for webhook lookups by message_id
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_message_id ON public.email_delivery_logs(message_id);
-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON public.email_delivery_logs(status);

-- Only admins and service role can read/write delivery logs (no user-facing RLS needed)
ALTER TABLE public.email_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on email_delivery_logs"
  ON public.email_delivery_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_email_delivery_logs_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_delivery_logs_updated_at ON public.email_delivery_logs;
CREATE TRIGGER trg_email_delivery_logs_updated_at
  BEFORE UPDATE ON public.email_delivery_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_email_delivery_logs_updated_at();
