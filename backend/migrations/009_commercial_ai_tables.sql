-- Migration 009: Commercial & AI Tables
-- Date: January 16, 2026
-- Purpose: Add tables for commercial accounts, AI features, and universal integrations
-- Run: psql -h your-db-host -U postgres -d drivedrop < backend/migrations/009_commercial_ai_tables.sql

-- ============================================================================
-- COMMERCIAL ACCOUNTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS commercial_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    
    -- Company Information
    company_name TEXT NOT NULL,
    business_type TEXT CHECK (business_type IN (
        'auction_house', 
        'dealership_new', 
        'dealership_used',
        'manufacturer', 
        'rental_fleet', 
        'broker',
        'other'
    )),
    tax_id TEXT,
    dot_number TEXT,
    mc_number TEXT,
    
    -- Billing Information
    billing_address JSONB NOT NULL, -- {street, city, state, zip, country}
    billing_email TEXT NOT NULL,
    billing_phone TEXT,
    payment_terms TEXT DEFAULT 'net_30' CHECK (payment_terms IN (
        'net_7', 'net_15', 'net_30', 'net_60', 'net_90', 'immediate'
    )),
    credit_limit DECIMAL(12,2) DEFAULT 0,
    auto_approve_limit DECIMAL(10,2) DEFAULT 0,
    
    -- API Access
    api_key_hash TEXT UNIQUE, -- SHA256 hashed
    api_secret_hash TEXT,
    webhook_url TEXT,
    webhook_secret TEXT,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    
    -- Status & Verification
    account_status TEXT DEFAULT 'pending_approval' CHECK (account_status IN (
        'active', 'suspended', 'pending_approval', 'closed'
    )),
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id),
    
    -- Metadata
    monthly_shipment_count INTEGER DEFAULT 0,
    total_revenue_generated DECIMAL(14,2) DEFAULT 0,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BILL OF LADING (BOL)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bills_of_lading (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) UNIQUE NOT NULL,
    bol_number TEXT UNIQUE NOT NULL, -- e.g., BOL-2026-001234
    
    -- Shipper Information
    shipper_name TEXT NOT NULL,
    shipper_address TEXT NOT NULL,
    shipper_phone TEXT,
    shipper_email TEXT,
    
    -- Consignee Information
    consignee_name TEXT NOT NULL,
    consignee_address TEXT NOT NULL,
    consignee_phone TEXT,
    consignee_email TEXT,
    
    -- Carrier Information
    carrier_name TEXT NOT NULL,
    carrier_dot_number TEXT,
    carrier_mc_number TEXT,
    driver_name TEXT,
    driver_license TEXT,
    
    -- Vehicle Information
    vehicle_vin TEXT NOT NULL,
    vehicle_year INTEGER,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_color TEXT,
    vehicle_mileage INTEGER,
    vehicle_license_plate TEXT,
    
    -- Condition Documentation
    condition_notes TEXT,
    damage_report JSONB, -- Array of damage descriptions with locations
    pickup_photos JSONB, -- Array of photo URLs (6+ angles)
    delivery_photos JSONB, -- Array of photo URLs at delivery
    
    -- Financial Terms
    freight_charges DECIMAL(10,2),
    insurance_amount DECIMAL(10,2),
    special_instructions TEXT,
    
    -- Digital Signatures (base64 encoded images)
    shipper_signature TEXT,
    shipper_signed_at TIMESTAMPTZ,
    carrier_signature TEXT,
    carrier_signed_at TIMESTAMPTZ,
    consignee_signature TEXT,
    consignee_signed_at TIMESTAMPTZ,
    
    -- Status Tracking
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 
        'awaiting_signatures', 
        'signed', 
        'in_transit', 
        'delivered', 
        'disputed'
    )),
    
    -- PDF Document
    pdf_url TEXT, -- Supabase Storage URL
    pdf_generated_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SHIPMENT DOCUMENTS (General Document Management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS shipment_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) NOT NULL,
    
    -- Document Classification
    document_type TEXT CHECK (document_type IN (
        'bill_of_lading',
        'bill_of_sale',
        'title',
        'registration',
        'insurance',
        'inspection_report',
        'gate_pass',
        'proof_of_delivery',
        'damage_report',
        'other'
    )),
    
    -- File Information
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER, -- bytes
    mime_type TEXT,
    
    -- AI Extraction Results (if applicable)
    extracted_data JSONB,
    ai_confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    requires_review BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Signatures (if applicable)
    signatures JSONB, -- Array of {signer_name, signature_data, signed_at}
    
    -- Metadata
    uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
    description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- GATE PASSES (Facility Access Control)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gate_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES shipments(id) NOT NULL,
    pass_number TEXT UNIQUE NOT NULL, -- e.g., GP-2026-001234
    
    -- Facility Information
    facility_name TEXT NOT NULL, -- e.g., "Copart - Phoenix"
    facility_address TEXT,
    facility_contact_name TEXT,
    facility_contact_phone TEXT,
    
    -- Vehicle & Authorization
    vehicle_vin TEXT NOT NULL,
    authorized_person TEXT NOT NULL, -- Driver name
    authorized_company TEXT, -- Carrier company
    authorized_person_id TEXT, -- Driver license number
    
    -- Validity Period
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    
    -- QR Code for Scanning
    qr_code_data TEXT, -- Encrypted verification string
    qr_code_url TEXT, -- Image URL
    
    -- Usage Tracking
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    scanned_by TEXT,
    scan_location JSONB, -- {lat, lng}
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active', 'used', 'expired', 'revoked'
    )),
    revoked_reason TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- UNIVERSAL INTEGRATION SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS auction_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commercial_account_id UUID REFERENCES commercial_accounts(id) NOT NULL,
    
    -- Integration Identity
    name TEXT NOT NULL, -- e.g., "Copart Phoenix", "Manheim Dallas"
    company_name TEXT NOT NULL,
    company_type TEXT NOT NULL, -- auction, dealership, manufacturer, fleet, etc.
    
    -- Integration Type
    integration_type TEXT CHECK (integration_type IN (
        'api',        -- REST API
        'sftp',       -- SFTP file transfer
        'email',      -- Email with attachments
        'manual_csv', -- Manual CSV upload
        'webhook'     -- Incoming webhooks
    )),
    
    -- Authentication Configuration
    auth_method TEXT CHECK (auth_method IN (
        'oauth2',
        'api_key',
        'basic_auth',
        'jwt',
        'sftp_credentials',
        'none'
    )),
    base_url TEXT,
    api_endpoint TEXT, -- e.g., "/api/vehicles"
    auth_config JSONB, -- Encrypted credentials {api_key, username, password, etc.}
    
    -- Field Mapping (CRITICAL - Maps their fields to ours)
    -- Example: {"their_vin": "vin", "make": "vehicle_make", "lot_number": "reference_number"}
    field_mapping JSONB NOT NULL,
    
    -- Sync Configuration
    sync_frequency TEXT DEFAULT 'manual' CHECK (sync_frequency IN (
        'realtime',  -- Webhook-based
        'hourly',
        'daily',
        'manual'
    )),
    last_sync_at TIMESTAMPTZ,
    next_sync_at TIMESTAMPTZ,
    auto_create_shipments BOOLEAN DEFAULT FALSE,
    
    -- Health & Monitoring
    is_active BOOLEAN DEFAULT TRUE,
    health_status TEXT DEFAULT 'unknown' CHECK (health_status IN (
        'healthy', 'degraded', 'down', 'unknown'
    )),
    last_error TEXT,
    last_error_at TIMESTAMPTZ,
    consecutive_failures INTEGER DEFAULT 0,
    
    -- Performance Metrics
    total_syncs INTEGER DEFAULT 0,
    total_vehicles_fetched INTEGER DEFAULT 0,
    total_shipments_created INTEGER DEFAULT 0,
    avg_sync_duration_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INTEGRATION LOGS (Debugging & Monitoring)
-- ============================================================================

CREATE TABLE IF NOT EXISTS integration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID REFERENCES auction_integrations(id) NOT NULL,
    
    -- Log Classification
    log_type TEXT CHECK (log_type IN ('sync', 'webhook', 'error', 'auth', 'manual')),
    status TEXT CHECK (status IN ('success', 'failure', 'partial')),
    
    -- Sync Results
    vehicles_fetched INTEGER DEFAULT 0,
    vehicles_created INTEGER DEFAULT 0,
    vehicles_updated INTEGER DEFAULT 0,
    vehicles_skipped INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    
    -- Request/Response Details (for debugging)
    request_data JSONB, -- Sanitized (no credentials)
    response_data JSONB, -- Truncated if large
    error_details TEXT,
    
    -- Performance
    duration_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AI DOCUMENT EXTRACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_document_extractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    shipment_id UUID REFERENCES shipments(id), -- Optional, linked if used in shipment
    
    -- Document Information
    document_url TEXT NOT NULL,
    document_type TEXT CHECK (document_type IN (
        'registration',
        'title',
        'insurance',
        'bill_of_sale',
        'drivers_license',
        'inspection_report',
        'unknown'
    )),
    
    -- AI Extraction Results
    extracted_data JSONB NOT NULL, -- Structured data extracted by AI
    -- Example: {"vin": "1HGBH41JXMN109186", "make": "Honda", "model": "Accord", ...}
    
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    raw_ai_response TEXT, -- Full AI response for debugging
    ocr_text TEXT, -- Raw text from OCR
    
    -- Human Review Process
    requires_review BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    approved BOOLEAN,
    
    -- Usage Tracking
    used_in_shipment BOOLEAN DEFAULT FALSE,
    
    -- Performance Metrics
    processing_time_ms INTEGER,
    ai_model TEXT DEFAULT 'gpt-4-vision', -- or claude-3-opus, etc.
    ai_cost_usd DECIMAL(8,4), -- Track costs per extraction
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AI DISPATCHER OPTIMIZATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_dispatch_optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Input Data
    optimization_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shipment_ids UUID[] NOT NULL,
    available_driver_ids UUID[] NOT NULL,
    
    -- AI Output
    assignments JSONB NOT NULL, -- {shipment_id: driver_id} mappings
    efficiency_score DECIMAL(5,2), -- 0.00 to 100.00 percentage
    estimated_revenue DECIMAL(12,2),
    estimated_costs DECIMAL(12,2),
    estimated_profit DECIMAL(12,2),
    fuel_savings DECIMAL(10,2),
    empty_miles_saved DECIMAL(10,2),
    
    -- AI Recommendations
    recommendations JSONB, -- Array of AI suggestions
    -- Example: [{"type": "route_optimization", "message": "Driver #123 can add Stop #456", "potential_revenue": 450}]
    
    -- Admin Approval Process
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',
        'approved',
        'rejected',
        'partially_approved'
    )),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Actual Performance Tracking (post-execution)
    actual_efficiency DECIMAL(5,2),
    actual_revenue DECIMAL(12,2),
    actual_costs DECIMAL(12,2),
    actual_profit DECIMAL(12,2),
    variance_notes TEXT,
    
    -- Metrics
    ai_model TEXT DEFAULT 'custom-optimization-algorithm',
    processing_time_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ
);

-- ============================================================================
-- AI NATURAL LANGUAGE SHIPMENT PROMPTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_shipment_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    
    -- Input
    natural_language_prompt TEXT NOT NULL,
    -- Example: "Ship my 2023 Honda Accord VIN 1HGBH41JXMN109186 from LA to NYC tomorrow"
    
    input_method TEXT DEFAULT 'text' CHECK (input_method IN (
        'text',      -- Typed in chat
        'voice',     -- Voice-to-text
        'email',     -- Email parsing
        'whatsapp',  -- WhatsApp message
        'sms'        -- SMS text
    )),
    
    -- AI Processing
    extracted_data JSONB NOT NULL,
    -- Example: {
    --   "vehicle": {"vin": "...", "year": 2023, "make": "Honda", "model": "Accord"},
    --   "pickup": {"city": "Los Angeles", "state": "CA", "date": "2026-01-17"},
    --   "delivery": {"city": "New York", "state": "NY"}
    -- }
    
    ai_confidence DECIMAL(3,2), -- 0.00 to 1.00
    ai_model TEXT DEFAULT 'gpt-4',
    
    -- Result
    shipment_id UUID REFERENCES shipments(id), -- Created shipment (if successful)
    quote_amount DECIMAL(10,2),
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    
    -- User Feedback (for continuous learning)
    user_feedback TEXT,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    
    -- Metrics
    processing_time_ms INTEGER,
    ai_cost_usd DECIMAL(8,4),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BULK UPLOADS
-- ============================================================================

CREATE TABLE IF NOT EXISTS bulk_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
    
    -- File Information
    file_name TEXT NOT NULL,
    file_url TEXT, -- Supabase Storage URL
    file_size INTEGER,
    
    -- Processing Stats
    total_rows INTEGER,
    processed_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    
    -- Results
    errors JSONB, -- Array of {row: number, error: string}
    created_shipment_ids UUID[], -- Successfully created shipments
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',
        'processing',
        'completed',
        'failed',
        'partially_completed'
    )),
    
    -- Preview Mode (for validation before actual creation)
    preview_mode BOOLEAN DEFAULT FALSE,
    preview_data JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Commercial Accounts
CREATE INDEX idx_commercial_accounts_user ON commercial_accounts(user_id);
CREATE INDEX idx_commercial_accounts_status ON commercial_accounts(account_status);
CREATE INDEX idx_commercial_accounts_api_key ON commercial_accounts(api_key_hash) WHERE api_key_hash IS NOT NULL;

-- Bills of Lading
CREATE INDEX idx_bol_shipment ON bills_of_lading(shipment_id);
CREATE INDEX idx_bol_number ON bills_of_lading(bol_number);
CREATE INDEX idx_bol_status ON bills_of_lading(status);
CREATE INDEX idx_bol_vin ON bills_of_lading(vehicle_vin);

-- Shipment Documents
CREATE INDEX idx_shipment_documents_shipment ON shipment_documents(shipment_id);
CREATE INDEX idx_shipment_documents_type ON shipment_documents(document_type);
CREATE INDEX idx_shipment_documents_uploaded_by ON shipment_documents(uploaded_by);
CREATE INDEX idx_shipment_documents_review ON shipment_documents(requires_review) WHERE requires_review = TRUE;

-- Gate Passes
CREATE INDEX idx_gate_passes_shipment ON gate_passes(shipment_id);
CREATE INDEX idx_gate_passes_pass_number ON gate_passes(pass_number);
CREATE INDEX idx_gate_passes_status ON gate_passes(status);
CREATE INDEX idx_gate_passes_active ON gate_passes(status, valid_until) WHERE status = 'active';
CREATE INDEX idx_gate_passes_vin ON gate_passes(vehicle_vin);

-- Integrations
CREATE INDEX idx_integrations_account ON auction_integrations(commercial_account_id);
CREATE INDEX idx_integrations_active ON auction_integrations(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_integrations_health ON auction_integrations(health_status);
CREATE INDEX idx_integrations_next_sync ON auction_integrations(next_sync_at) WHERE is_active = TRUE;

-- Integration Logs
CREATE INDEX idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX idx_integration_logs_status ON integration_logs(status);
CREATE INDEX idx_integration_logs_created ON integration_logs(created_at DESC);

-- AI Document Extractions
CREATE INDEX idx_ai_extractions_user ON ai_document_extractions(user_id);
CREATE INDEX idx_ai_extractions_shipment ON ai_document_extractions(shipment_id);
CREATE INDEX idx_ai_extractions_review ON ai_document_extractions(requires_review) WHERE requires_review = TRUE;
CREATE INDEX idx_ai_extractions_created ON ai_document_extractions(created_at DESC);

-- AI Dispatcher
CREATE INDEX idx_ai_dispatch_status ON ai_dispatch_optimizations(status);
CREATE INDEX idx_ai_dispatch_date ON ai_dispatch_optimizations(optimization_date);
CREATE INDEX idx_ai_dispatch_created ON ai_dispatch_optimizations(created_at DESC);

-- AI Shipment Prompts
CREATE INDEX idx_ai_prompts_user ON ai_shipment_prompts(user_id);
CREATE INDEX idx_ai_prompts_success ON ai_shipment_prompts(success);
CREATE INDEX idx_ai_prompts_created ON ai_shipment_prompts(created_at DESC);

-- Bulk Uploads
CREATE INDEX idx_bulk_uploads_user ON bulk_uploads(uploaded_by);
CREATE INDEX idx_bulk_uploads_status ON bulk_uploads(status);
CREATE INDEX idx_bulk_uploads_created ON bulk_uploads(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE commercial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills_of_lading ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE gate_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_document_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_shipment_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_uploads ENABLE ROW LEVEL SECURITY;

-- Users can view their own commercial accounts
CREATE POLICY "Users view own commercial accounts" ON commercial_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own commercial accounts" ON commercial_accounts
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can view BOLs for their shipments
CREATE POLICY "Users view own BOLs" ON bills_of_lading
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM shipments 
            WHERE shipments.id = bills_of_lading.shipment_id 
            AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
        )
    );

-- Users can view their own document extractions
CREATE POLICY "Users view own extractions" ON ai_document_extractions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own extractions" ON ai_document_extractions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own AI prompts
CREATE POLICY "Users view own prompts" ON ai_shipment_prompts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own prompts" ON ai_shipment_prompts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own bulk uploads
CREATE POLICY "Users view own bulk uploads" ON bulk_uploads
    FOR SELECT USING (auth.uid() = uploaded_by);

CREATE POLICY "Users insert own bulk uploads" ON bulk_uploads
    FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- Admins can view and modify everything
CREATE POLICY "Admins view all commercial accounts" ON commercial_accounts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins view all BOLs" ON bills_of_lading
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins view all documents" ON shipment_documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins view all gate passes" ON gate_passes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins view all integrations" ON auction_integrations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admins view all extractions" ON ai_document_extractions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_commercial_accounts_updated_at BEFORE UPDATE ON commercial_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_of_lading_updated_at BEFORE UPDATE ON bills_of_lading
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipment_documents_updated_at BEFORE UPDATE ON shipment_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_auction_integrations_updated_at BEFORE UPDATE ON auction_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify tables were created
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'commercial_accounts',
        'bills_of_lading',
        'shipment_documents',
        'gate_passes',
        'auction_integrations',
        'integration_logs',
        'ai_document_extractions',
        'ai_dispatch_optimizations',
        'ai_shipment_prompts',
        'bulk_uploads'
    );
    
    IF table_count = 10 THEN
        RAISE NOTICE '✅ Migration 009 completed successfully - All 10 tables created';
    ELSE
        RAISE WARNING '⚠️ Migration 009 incomplete - Only % of 10 tables created', table_count;
    END IF;
END $$;
