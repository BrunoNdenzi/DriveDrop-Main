CREATE TABLE IF NOT EXISTS public.dump_truck_booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_type TEXT NOT NULL,
  full_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  project_type TEXT NOT NULL,
  project_name TEXT,
  solicitation_number TEXT,
  trucks_needed INTEGER NOT NULL CHECK (trucks_needed BETWEEN 1 AND 100),
  service_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration TEXT NOT NULL,
  estimated_days INTEGER CHECK (estimated_days IS NULL OR estimated_days BETWEEN 1 AND 365),
  job_site_address TEXT NOT NULL,
  dump_site_address TEXT,
  material_type TEXT NOT NULL,
  estimated_loads_per_day INTEGER CHECK (estimated_loads_per_day IS NULL OR estimated_loads_per_day BETWEEN 1 AND 1000),
  loading_method TEXT,
  site_requirements TEXT,
  compliance_requirements TEXT[] NOT NULL DEFAULT '{}',
  purchase_order_available BOOLEAN NOT NULL DEFAULT false,
  additional_details TEXT,
  contact_consent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'quoted', 'confirmed', 'declined', 'cancelled')),
  source TEXT NOT NULL DEFAULT 'dump_truck_service_page',
  email_notification_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_notification_status IN ('pending', 'sent', 'failed')),
  sms_notification_status TEXT NOT NULL DEFAULT 'pending' CHECK (sms_notification_status IN ('pending', 'sent', 'failed')),
  notification_attempted_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dump_truck_booking_service_date
  ON public.dump_truck_booking_requests (service_date, status);

CREATE INDEX IF NOT EXISTS idx_dump_truck_booking_submitted_at
  ON public.dump_truck_booking_requests (submitted_at DESC);

ALTER TABLE public.dump_truck_booking_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.dump_truck_booking_requests IS
  'Public dump truck service requests submitted at least one calendar day in advance by 1:30 PM America/New_York time.';
