-- Lead Acquisition & Outreach Tables for DriveDrop
-- Supports: carriers, brokers, dealers, shippers

-- ============================================
-- LEADS TABLE - Central lead store
-- ============================================
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  
  -- Source info
  source text NOT NULL CHECK (source IN ('fmcsa', 'manual', 'csv_import', 'web_scrape', 'referral', 'website', 'linkedin', 'other')),
  source_id text,  -- external ID (e.g., USDOT number, MC number)
  
  -- Lead type
  lead_type text NOT NULL CHECK (lead_type IN ('carrier', 'broker', 'dealer', 'shipper', 'fleet_owner', 'auction_house')),
  
  -- Company info
  company_name text NOT NULL,
  dba_name text,
  
  -- Contact info
  contact_first_name text,
  contact_last_name text,
  contact_email text,
  contact_phone text,
  contact_title text,
  
  -- Address
  address_street text,
  address_city text,
  address_state text,
  address_zip text,
  address_country text DEFAULT 'US',
  
  -- FMCSA-specific fields
  usdot_number text,
  mc_number text,
  carrier_operation text,  -- 'interstate', 'intrastate'
  entity_type text,        -- 'CARRIER', 'BROKER', 'FREIGHT FORWARDER'
  operating_status text,   -- 'AUTHORIZED', 'NOT AUTHORIZED', etc.
  total_drivers integer,
  total_power_units integer,
  mcs150_date text,        -- last updated date on FMCSA
  
  -- Business info
  fleet_size integer,
  vehicle_types text[],     -- ['sedan', 'suv', 'truck', 'flatbed', 'enclosed']
  service_areas text[],     -- ['TX', 'CA', 'nationwide']
  annual_revenue text,
  years_in_business integer,
  website_url text,
  
  -- Lead scoring & status
  score integer DEFAULT 0,  -- 0-100 lead quality score
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'responding', 'qualified', 'negotiating', 'converted', 'lost', 'unsubscribed', 'invalid')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Outreach tracking
  last_contacted_at timestamptz,
  last_responded_at timestamptz,
  contact_attempts integer DEFAULT 0,
  outreach_channel text,  -- 'email', 'phone', 'sms', 'linkedin'
  
  -- Campaign association
  campaign_id uuid,
  
  -- Notes & tags
  notes text,
  tags text[],
  
  -- Conversion tracking
  converted_user_id uuid,  -- links to profiles.id if they sign up
  converted_at timestamptz,
  
  -- Metadata
  raw_data jsonb,  -- original data from source
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  
  CONSTRAINT leads_pkey PRIMARY KEY (id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON public.leads(lead_type);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_usdot ON public.leads(usdot_number) WHERE usdot_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_mc ON public.leads(mc_number) WHERE mc_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(contact_email) WHERE contact_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON public.leads(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_state ON public.leads(address_state);

-- ============================================
-- OUTREACH CAMPAIGNS
-- ============================================
CREATE TABLE IF NOT EXISTS public.outreach_campaigns (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  campaign_type text NOT NULL CHECK (campaign_type IN ('email', 'sms', 'phone', 'multi_channel')),
  target_lead_type text NOT NULL CHECK (target_lead_type IN ('carrier', 'broker', 'dealer', 'shipper', 'fleet_owner', 'auction_house', 'all')),
  
  -- Email template
  email_subject text,
  email_body text,
  
  -- SMS template
  sms_body text,
  
  -- Schedule
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  
  -- Filters for auto-selecting leads
  target_filters jsonb DEFAULT '{}',  -- { states: ['TX'], min_fleet_size: 5, etc. }
  
  -- Stats
  total_leads integer DEFAULT 0,
  sent_count integer DEFAULT 0,
  opened_count integer DEFAULT 0,
  replied_count integer DEFAULT 0,
  converted_count integer DEFAULT 0,
  bounced_count integer DEFAULT 0,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  
  CONSTRAINT outreach_campaigns_pkey PRIMARY KEY (id)
);

-- ============================================
-- OUTREACH LOG - Every contact attempt
-- ============================================
CREATE TABLE IF NOT EXISTS public.outreach_log (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  lead_id uuid NOT NULL,
  campaign_id uuid,
  
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'phone', 'linkedin', 'other')),
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  
  -- Content
  subject text,
  body text,
  
  -- Status
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed', 'unsubscribed')),
  
  -- Response
  response_text text,
  responded_at timestamptz,
  
  sent_at timestamptz DEFAULT now(),
  sent_by uuid,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT outreach_log_pkey PRIMARY KEY (id),
  CONSTRAINT outreach_log_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE,
  CONSTRAINT outreach_log_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_outreach_log_lead ON public.outreach_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_log_campaign ON public.outreach_log(campaign_id);

-- ============================================
-- DATA IMPORT JOBS - Track CSV/FMCSA imports
-- ============================================
CREATE TABLE IF NOT EXISTS public.lead_import_jobs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  
  source text NOT NULL,  -- 'fmcsa_api', 'csv_upload', 'manual_batch'
  file_name text,
  
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Stats
  total_records integer DEFAULT 0,
  imported_count integer DEFAULT 0,
  skipped_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  duplicate_count integer DEFAULT 0,
  
  -- Filters used
  filters jsonb,
  errors jsonb DEFAULT '[]',
  
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  
  CONSTRAINT lead_import_jobs_pkey PRIMARY KEY (id)
);

-- Add foreign key for leads.campaign_id after campaigns table exists
ALTER TABLE public.leads 
  ADD CONSTRAINT leads_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES public.outreach_campaigns(id) ON DELETE SET NULL;

-- RLS policies (admin only)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_import_jobs ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin full access on leads" ON public.leads FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin full access on campaigns" ON public.outreach_campaigns FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin full access on outreach_log" ON public.outreach_log FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin full access on import_jobs" ON public.lead_import_jobs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
