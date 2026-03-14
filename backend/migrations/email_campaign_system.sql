-- =============================================================================
-- Email Campaign System for DriveDrop
-- Carrier outreach: enriched FMCSA contacts + campaign management + analytics
-- =============================================================================

-- ============================================
-- CARRIER CONTACTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.carrier_contacts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),

  -- FMCSA identity
  dot_number text UNIQUE NOT NULL,
  company_name text NOT NULL,
  mc_number text,

  -- Contact info (enriched)
  email text,
  email_verified boolean DEFAULT false,
  email_verification_score integer DEFAULT 0, -- 0-100
  phone text,
  website text,

  -- Address
  address text,
  city text,
  state text,
  zip text,

  -- FMCSA attributes
  business_type text, -- 'carrier', 'broker', 'carrier_broker'
  power_units integer,
  drivers integer,
  operating_status text DEFAULT 'AUTHORIZED',

  -- Enrichment metadata
  source text, -- 'hunter', 'apollo', 'snov', 'manual'
  enriched_at timestamptz,
  last_verified_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT carrier_contacts_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_carrier_contacts_dot ON public.carrier_contacts(dot_number);
CREATE INDEX IF NOT EXISTS idx_carrier_contacts_email ON public.carrier_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carrier_contacts_email_verified ON public.carrier_contacts(email_verified);
CREATE INDEX IF NOT EXISTS idx_carrier_contacts_state ON public.carrier_contacts(state);

-- ============================================
-- EMAIL CAMPAIGNS
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),

  -- Identity
  name text NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL,
  text_content text,
  notes text,
  tags text[],

  -- Status lifecycle
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'scheduled', 'sending', 'completed', 'paused', 'cancelled')
  ),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,

  -- Targeting
  target_audience jsonb DEFAULT '{}',

  -- Send settings
  total_recipients integer DEFAULT 0,
  daily_limit integer DEFAULT 10,
  send_rate_per_hour integer DEFAULT 30,
  warmup_mode boolean DEFAULT true,

  -- Aggregate stats (updated via increment functions)
  sent_count integer DEFAULT 0,
  delivered_count integer DEFAULT 0,
  opened_count integer DEFAULT 0,
  clicked_count integer DEFAULT 0,
  bounced_count integer DEFAULT 0,
  unsubscribed_count integer DEFAULT 0,
  conversion_count integer DEFAULT 0,

  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT email_campaigns_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_scheduled ON public.email_campaigns(scheduled_at) WHERE scheduled_at IS NOT NULL;

-- ============================================
-- CAMPAIGN RECIPIENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),

  campaign_id uuid NOT NULL,
  carrier_contact_id uuid NOT NULL,

  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed')
  ),

  -- Timestamps
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,

  -- Engagement counters
  open_count integer DEFAULT 0,
  click_count integer DEFAULT 0,
  last_opened_at timestamptz,
  last_clicked_at timestamptz,

  -- Error info
  error_message text,
  bounce_type text, -- 'hard', 'soft'

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT campaign_recipients_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_recipients_unique UNIQUE (campaign_id, carrier_contact_id),
  CONSTRAINT campaign_recipients_campaign_fkey FOREIGN KEY (campaign_id) REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT campaign_recipients_contact_fkey FOREIGN KEY (carrier_contact_id) REFERENCES public.carrier_contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON public.campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_sent ON public.campaign_recipients(sent_at) WHERE sent_at IS NOT NULL;

-- ============================================
-- EMAIL EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),

  campaign_id uuid NOT NULL,
  recipient_id uuid NOT NULL,

  event_type text NOT NULL CHECK (
    event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'spam', 'unsubscribed')
  ),

  -- Context
  ip_address text,
  user_agent text,
  location jsonb, -- { city, region, country }
  device_type text, -- 'desktop', 'mobile', 'tablet'

  -- Click-specific
  link_url text,
  link_label text,

  event_time timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}',

  CONSTRAINT email_events_pkey PRIMARY KEY (id),
  CONSTRAINT email_events_campaign_fkey FOREIGN KEY (campaign_id) REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT email_events_recipient_fkey FOREIGN KEY (recipient_id) REFERENCES public.campaign_recipients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_events_campaign ON public.email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_recipient ON public.email_events(recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON public.email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_time ON public.email_events(event_time DESC);

-- ============================================
-- EMAIL SUPPRESSION LIST
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_suppression_list (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),

  email text UNIQUE NOT NULL,
  reason text NOT NULL CHECK (reason IN ('unsubscribed', 'bounced_hard', 'spam_complaint', 'manual', 'invalid')),
  source text, -- campaign_id or 'manual'
  notes text,

  added_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT email_suppression_list_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_suppression_email ON public.email_suppression_list(email);
CREATE INDEX IF NOT EXISTS idx_suppression_reason ON public.email_suppression_list(reason);

-- ============================================
-- CAMPAIGN CONVERSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.campaign_conversions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),

  campaign_id uuid NOT NULL,
  recipient_id uuid NOT NULL,

  conversion_type text NOT NULL CHECK (
    conversion_type IN ('signup', 'booking', 'contact', 'demo_request')
  ),

  user_id uuid, -- links to profiles.id if they signed up
  value_usd numeric DEFAULT 0,
  converted_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}',

  CONSTRAINT campaign_conversions_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_conversions_campaign_fkey FOREIGN KEY (campaign_id) REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT campaign_conversions_recipient_fkey FOREIGN KEY (recipient_id) REFERENCES public.campaign_recipients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_campaign_conversions_campaign ON public.campaign_conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_conversions_type ON public.campaign_conversions(conversion_type);
CREATE INDEX IF NOT EXISTS idx_campaign_conversions_at ON public.campaign_conversions(converted_at DESC);

-- =============================================================================
-- INCREMENT FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_campaign_sent(campaign_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.email_campaigns SET sent_count = sent_count + 1, updated_at = now() WHERE id = campaign_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_delivered(campaign_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.email_campaigns SET delivered_count = delivered_count + 1, updated_at = now() WHERE id = campaign_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_opened(campaign_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.email_campaigns SET opened_count = opened_count + 1, updated_at = now() WHERE id = campaign_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_clicked(campaign_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.email_campaigns SET clicked_count = clicked_count + 1, updated_at = now() WHERE id = campaign_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_bounced(campaign_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.email_campaigns SET bounced_count = bounced_count + 1, updated_at = now() WHERE id = campaign_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_unsubscribed(campaign_id UUID)
RETURNS void LANGUAGE sql AS $$
  UPDATE public.email_campaigns SET unsubscribed_count = unsubscribed_count + 1, updated_at = now() WHERE id = campaign_id;
$$;

-- =============================================================================
-- RLS POLICIES (admin only)
-- =============================================================================

ALTER TABLE public.carrier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on carrier_contacts" ON public.carrier_contacts;
CREATE POLICY "Admin full access on carrier_contacts" ON public.carrier_contacts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin full access on email_campaigns" ON public.email_campaigns;
CREATE POLICY "Admin full access on email_campaigns" ON public.email_campaigns FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin full access on campaign_recipients" ON public.campaign_recipients;
CREATE POLICY "Admin full access on campaign_recipients" ON public.campaign_recipients FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin full access on email_events" ON public.email_events;
CREATE POLICY "Admin full access on email_events" ON public.email_events FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin full access on email_suppression_list" ON public.email_suppression_list;
CREATE POLICY "Admin full access on email_suppression_list" ON public.email_suppression_list FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Admin full access on campaign_conversions" ON public.campaign_conversions;
CREATE POLICY "Admin full access on campaign_conversions" ON public.campaign_conversions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
