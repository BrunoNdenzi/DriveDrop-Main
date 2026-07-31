-- Quick Send is intentionally separate from the FMCSA email campaign system.
-- It sends pasted recipient lists through one authorized Gmail Workspace mailbox.

CREATE TABLE IF NOT EXISTS public.quick_send_gmail_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_email           text NOT NULL UNIQUE,
  encrypted_refresh_token text NOT NULL,
  connected_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at            timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quick_send_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category          text NOT NULL,
  subject           text NOT NULL,
  message           text NOT NULL,
  status            text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'sending', 'completed', 'partial_failed', 'failed')),
  total_count       integer NOT NULL DEFAULT 0,
  sent_count        integer NOT NULL DEFAULT 0,
  failed_count      integer NOT NULL DEFAULT 0,
  suppressed_count  integer NOT NULL DEFAULT 0,
  pacing_seconds    integer NOT NULL DEFAULT 3 CHECK (pacing_seconds BETWEEN 1 AND 300),
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quick_send_recipients (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          uuid NOT NULL REFERENCES public.quick_send_batches(id) ON DELETE CASCADE,
  email             text NOT NULL,
  name              text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'suppressed', 'sent', 'failed')),
  gmail_message_id  text,
  error_message     text,
  sent_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, email)
);

CREATE TABLE IF NOT EXISTS public.quick_send_suppressions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL UNIQUE,
  reason      text NOT NULL DEFAULT 'unsubscribed',
  source      text NOT NULL DEFAULT 'recipient',
  batch_id    uuid REFERENCES public.quick_send_batches(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quick_send_batches_created_at
  ON public.quick_send_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quick_send_recipients_batch_status
  ON public.quick_send_recipients(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_quick_send_suppressions_email_lower
  ON public.quick_send_suppressions(lower(email));

ALTER TABLE public.quick_send_gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_send_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_send_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_send_suppressions ENABLE ROW LEVEL SECURITY;

-- Backend access uses the service role. No browser client receives direct table access.

CREATE OR REPLACE FUNCTION public.set_quick_send_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quick_send_connections_updated_at ON public.quick_send_gmail_connections;
CREATE TRIGGER trg_quick_send_connections_updated_at
  BEFORE UPDATE ON public.quick_send_gmail_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_quick_send_updated_at();

DROP TRIGGER IF EXISTS trg_quick_send_batches_updated_at ON public.quick_send_batches;
CREATE TRIGGER trg_quick_send_batches_updated_at
  BEFORE UPDATE ON public.quick_send_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_quick_send_updated_at();

DROP TRIGGER IF EXISTS trg_quick_send_recipients_updated_at ON public.quick_send_recipients;
CREATE TRIGGER trg_quick_send_recipients_updated_at
  BEFORE UPDATE ON public.quick_send_recipients
  FOR EACH ROW EXECUTE FUNCTION public.set_quick_send_updated_at();