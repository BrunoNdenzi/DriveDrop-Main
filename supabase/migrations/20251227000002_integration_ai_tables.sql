-- ============================================================================
-- Universal Integration System & AI Tables
-- Migration: 20251227000002
-- Description: Creates tables for universal integrations and AI features
-- Author: DriveDrop Development Team
-- Date: December 27, 2025
-- ============================================================================

-- ============================================================================
-- AUCTION INTEGRATIONS TABLE (Universal Integration System) ⭐
-- ONE flexible table that handles ANY company integration
-- Replaces need for separate Copart, Manheim, IAA integrations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.auction_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Company Information
    company_name TEXT NOT NULL, -- Copart, Manheim, IAA, ADESA, local auctions, dealerships, etc.
    company_type TEXT NOT NULL CHECK (company_type IN (
        'auction_house',
        'dealership',
        'manufacturer',
        'rental_fleet',
        'broker',
        'other'
    )),
    
    -- Integration Method (Universal - works with everything!)
    integration_type TEXT NOT NULL CHECK (integration_type IN (
        'api',           -- REST API
        'sftp',          -- File transfer
        'email',         -- Email parsing
        'manual_csv',    -- Manual CSV upload
        'webhook',       -- Push notifications from company
        'scraper'        -- Web scraping (last resort)
    )),
    
    -- Authentication (Flexible JSON supports ANY auth type)
    auth_method TEXT NOT NULL CHECK (auth_method IN (
        'oauth2',
        'api_key',
        'basic_auth',
        'jwt',
        'sftp_credentials',
        'none'
    )),
    credentials_encrypted JSONB NOT NULL, -- Encrypted, flexible structure for ANY auth
    
    -- API Configuration
    api_base_url TEXT,
    api_version TEXT,
    api_endpoints JSONB, -- Custom endpoints: {vehicles: '/vehicles', status: '/status'}
    
    -- Field Mapping (Universal - maps THEIR fields to OUR fields)
    -- Example: {"vin": "VehicleVIN", "make": "MakeName", "model": "ModelName"}
    field_mapping JSONB NOT NULL,
    
    -- Webhook Configuration
    webhook_url TEXT, -- For incoming webhooks from company
    webhook_secret TEXT,
    webhook_events TEXT[], -- Events to listen for
    
    -- SFTP Configuration
    sftp_host TEXT,
    sftp_port INTEGER DEFAULT 22,
    sftp_path TEXT,
    
    -- Email Configuration
    email_address TEXT,
    email_filter JSONB, -- Rules for filtering/parsing emails
    
    -- Sync Settings
    sync_frequency TEXT DEFAULT 'hourly' CHECK (sync_frequency IN (
        'realtime', 'every_15min', 'hourly', 'daily', 'weekly', 'manual'
    )),
    last_sync_at TIMESTAMPTZ,
    next_sync_at TIMESTAMPTZ,
    auto_sync_enabled BOOLEAN DEFAULT TRUE,
    
    -- Status & Health Monitoring
    is_active BOOLEAN DEFAULT TRUE,
    health_status TEXT DEFAULT 'healthy' CHECK (health_status IN (
        'healthy', 'degraded', 'down', 'maintenance', 'unknown'
    )),
    last_error TEXT,
    error_count INTEGER DEFAULT 0,
    last_success_at TIMESTAMPTZ,
    
    -- Rate Limiting
    rate_limit_per_hour INTEGER DEFAULT 1000,
    rate_limit_per_day INTEGER,
    
    -- Data Validation
    validation_rules JSONB, -- Custom validation rules for data
    transform_rules JSONB, -- Data transformation rules
    
    -- Notifications
    notification_emails TEXT[], -- Alert emails for failures
    slack_webhook_url TEXT,
    
    -- Metadata
    description TEXT,
    notes TEXT,
    tags TEXT[],
    configuration JSONB DEFAULT '{}', -- Additional custom config
    
    -- Audit
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auction_integrations_company_name ON public.auction_integrations(company_name);
CREATE INDEX IF NOT EXISTS idx_auction_integrations_company_type ON public.auction_integrations(company_type);
CREATE INDEX IF NOT EXISTS idx_auction_integrations_status ON public.auction_integrations(is_active, health_status);
CREATE INDEX IF NOT EXISTS idx_auction_integrations_next_sync ON public.auction_integrations(next_sync_at) WHERE auto_sync_enabled = TRUE;

-- ============================================================================
-- INTEGRATION LOGS TABLE
-- Debugging and monitoring for all integrations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.integration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID REFERENCES public.auction_integrations(id) ON DELETE CASCADE,
    
    -- Request Information
    request_method TEXT,
    request_url TEXT,
    request_headers JSONB,
    request_payload JSONB,
    
    -- Response Information
    response_status INTEGER,
    response_headers JSONB,
    response_data JSONB,
    response_size INTEGER,
    
    -- Results
    vehicles_fetched INTEGER DEFAULT 0,
    vehicles_created INTEGER DEFAULT 0,
    vehicles_updated INTEGER DEFAULT 0,
    vehicles_skipped INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    warnings JSONB DEFAULT '[]',
    
    -- Performance
    duration_ms INTEGER,
    
    -- Status
    status TEXT CHECK (status IN (
        'success', 'partial_success', 'failed', 'timeout', 'rate_limited'
    )),
    
    -- Error Details
    error_message TEXT,
    error_stack TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration_id ON public.integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_status ON public.integration_logs(status);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON public.integration_logs(created_at DESC);

-- ============================================================================
-- DOCUMENT EXTRACTION QUEUE TABLE
-- AI processing queue for OCR and data extraction
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.document_extraction_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.shipment_documents(id) ON DELETE CASCADE,
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE,
    
    -- Document Info
    document_url TEXT NOT NULL,
    document_type TEXT,
    
    -- Processing Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'review_required'
    )),
    
    -- AI Processing
    ocr_provider TEXT, -- 'google_vision', 'aws_textract', 'azure_ocr'
    ocr_text TEXT,
    
    -- Extraction Results
    extracted_data JSONB,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    low_confidence_fields JSONB, -- Fields with confidence < 0.85
    
    -- Review
    requires_human_review BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    review_corrections JSONB, -- Human corrections to AI results
    
    -- Performance
    processing_time_ms INTEGER,
    ocr_time_ms INTEGER,
    extraction_time_ms INTEGER,
    
    -- Retry Logic
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    
    -- Priority
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
    
    -- Timestamps
    queued_at TIMESTAMPTZ DEFAULT NOW(),
    started_processing_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_doc_extraction_queue_status ON public.document_extraction_queue(status, priority);
CREATE INDEX IF NOT EXISTS idx_doc_extraction_queue_document_id ON public.document_extraction_queue(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_extraction_queue_requires_review ON public.document_extraction_queue(requires_human_review) WHERE requires_human_review = TRUE;

-- ============================================================================
-- AI DISPATCH OPTIMIZATIONS TABLE
-- Track AI dispatcher decisions and performance
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_dispatch_optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    optimization_date DATE NOT NULL,
    
    -- Input Parameters
    total_shipments INTEGER NOT NULL,
    available_drivers INTEGER NOT NULL,
    optimization_criteria JSONB, -- What factors AI considered
    
    -- AI Results
    assignments JSONB NOT NULL, -- Array of driver-shipment mappings
    efficiency_score DECIMAL(5,2), -- 0-100
    estimated_revenue DECIMAL(12,2),
    estimated_costs DECIMAL(12,2),
    profit_margin DECIMAL(5,2),
    
    -- Route Optimization
    total_distance_miles DECIMAL(10,2),
    empty_miles_saved DECIMAL(10,2),
    fuel_cost_saved DECIMAL(10,2),
    
    -- AI Insights & Recommendations
    recommendations JSONB, -- AI-generated insights and suggestions
    confidence_score DECIMAL(3,2),
    
    -- Performance vs Manual
    manual_cost_estimate DECIMAL(12,2),
    ai_cost_actual DECIMAL(12,2),
    savings_amount DECIMAL(12,2),
    savings_percent DECIMAL(5,2),
    
    -- Execution
    executed BOOLEAN DEFAULT FALSE,
    executed_at TIMESTAMPTZ,
    executed_by UUID REFERENCES public.profiles(id),
    
    -- Actual Results (after execution)
    actual_revenue DECIMAL(12,2),
    actual_costs DECIMAL(12,2),
    actual_efficiency DECIMAL(5,2),
    variance_explanation TEXT,
    
    -- Model Information
    model_version TEXT,
    model_parameters JSONB,
    processing_time_ms INTEGER,
    
    -- Metadata
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_dispatch_opt_date ON public.ai_dispatch_optimizations(optimization_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_dispatch_opt_executed ON public.ai_dispatch_optimizations(executed);
CREATE INDEX IF NOT EXISTS idx_ai_dispatch_opt_efficiency ON public.ai_dispatch_optimizations(efficiency_score DESC);

-- ============================================================================
-- AI SHIPMENT PROMPTS TABLE
-- Track natural language shipment creation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_shipment_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Input
    natural_language_prompt TEXT NOT NULL,
    input_method TEXT NOT NULL CHECK (input_method IN (
        'text', 'voice', 'email', 'whatsapp', 'sms', 'api'
    )),
    
    -- AI Processing
    model_used TEXT DEFAULT 'gpt-4', -- 'gpt-4', 'gpt-3.5-turbo', etc.
    extracted_data JSONB, -- Parsed structured data
    ai_confidence DECIMAL(3,2), -- 0.00 to 1.00
    processing_time_ms INTEGER,
    
    -- Validation
    validation_errors JSONB,
    validation_warnings JSONB,
    
    -- Results
    shipment_ids UUID[], -- Created shipments
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    
    -- User Feedback
    user_accepted BOOLEAN,
    user_feedback TEXT,
    user_corrections JSONB,
    
    -- Learning Data (for model improvement)
    flagged_for_training BOOLEAN DEFAULT FALSE,
    training_notes TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_shipment_prompts_user_id ON public.ai_shipment_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_shipment_prompts_success ON public.ai_shipment_prompts(success);
CREATE INDEX IF NOT EXISTS idx_ai_shipment_prompts_flagged ON public.ai_shipment_prompts(flagged_for_training) WHERE flagged_for_training = TRUE;
CREATE INDEX IF NOT EXISTS idx_ai_shipment_prompts_created_at ON public.ai_shipment_prompts(created_at DESC);

-- ============================================================================
-- Enable Row Level Security (RLS) on all new tables
-- ============================================================================
ALTER TABLE public.auction_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_extraction_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dispatch_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_shipment_prompts ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Apply update triggers
-- ============================================================================
DROP TRIGGER IF EXISTS update_auction_integrations_updated_at ON public.auction_integrations;
CREATE TRIGGER update_auction_integrations_updated_at
    BEFORE UPDATE ON public.auction_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE public.auction_integrations IS 'Universal integration system - works with ANY company (auction, dealer, manufacturer). Add new integrations in 5 minutes!';
COMMENT ON TABLE public.integration_logs IS 'Debugging and monitoring logs for all integrations';
COMMENT ON TABLE public.document_extraction_queue IS 'AI processing queue for OCR and data extraction from documents';
COMMENT ON TABLE public.ai_dispatch_optimizations IS 'Track AI dispatcher decisions and ROI - 30% efficiency gains';
COMMENT ON TABLE public.ai_shipment_prompts IS 'Natural language shipment creation history - "just type what you want"';
