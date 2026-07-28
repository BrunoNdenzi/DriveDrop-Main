CREATE TABLE IF NOT EXISTS public.parking_interest_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  company_type TEXT,
  vehicle_types TEXT[] NOT NULL,
  spaces_needed INTEGER NOT NULL CHECK (spaces_needed BETWEEN 1 AND 500),
  parking_frequency TEXT NOT NULL,
  monthly_price_range TEXT NOT NULL,
  needed_by TEXT NOT NULL,
  requested_services TEXT,
  contact_consent BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'parking_interest_page',
  email_notification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (email_notification_status IN ('pending', 'sent', 'failed')),
  sms_notification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (sms_notification_status IN ('pending', 'sent', 'failed')),
  notification_attempted_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parking_interest_submitted_at
  ON public.parking_interest_submissions (submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_parking_interest_company
  ON public.parking_interest_submissions (company_name);

ALTER TABLE public.parking_interest_submissions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.parking_interest_submissions IS
  'Non-binding demand survey responses for the proposed Charlotte commercial parking facility.';