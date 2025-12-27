-- ============================================================================
-- Commercial Vehicle Shipping - New Tables
-- Migration: 20251227000001
-- Description: Creates all new tables for commercial/B2B functionality
-- Author: DriveDrop Development Team
-- Date: December 27, 2025
-- ============================================================================

-- ============================================================================
-- COMMERCIAL ACCOUNTS TABLE
-- For B2B clients (auction houses, dealerships, manufacturers, fleets)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.commercial_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Account Type
    account_type TEXT NOT NULL CHECK (account_type IN (
        'auction_house', 
        'dealership_new', 
        'dealership_used', 
        'manufacturer', 
        'rental_fleet', 
        'broker'
    )),
    
    -- Business Information
    company_name TEXT NOT NULL,
    company_ein TEXT, -- Tax ID
    dot_number TEXT,
    mc_number TEXT,
    business_address TEXT,
    business_city TEXT,
    business_state TEXT,
    business_zip TEXT,
    
    -- Billing
    payment_terms TEXT DEFAULT 'net_30', -- 'net_30', 'net_60', 'net_90', 'immediate'
    credit_limit DECIMAL(12,2) DEFAULT 0,
    auto_approve_limit DECIMAL(10,2) DEFAULT 0, -- Auto-approve shipments under this amount
    
    -- API Access
    api_key TEXT UNIQUE,
    api_secret TEXT,
    webhook_url TEXT,
    
    -- Limits & Quotas
    monthly_vehicle_limit INTEGER,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    current_month_usage INTEGER DEFAULT 0,
    
    -- Status
    account_status TEXT DEFAULT 'pending' CHECK (account_status IN (
        'pending', 'active', 'suspended', 'closed'
    )),
    verified_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_commercial_accounts_user_id ON public.commercial_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_commercial_accounts_api_key ON public.commercial_accounts(api_key);
CREATE INDEX IF NOT EXISTS idx_commercial_accounts_status ON public.commercial_accounts(account_status);

-- ============================================================================
-- BILLS OF LADING (BOL) TABLE
-- Legal transport documents required for all commercial shipments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bills_of_lading (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE,
    bol_number TEXT UNIQUE NOT NULL,
    
    -- Parties
    shipper_name TEXT NOT NULL,
    shipper_address TEXT,
    shipper_city TEXT,
    shipper_state TEXT,
    shipper_zip TEXT,
    shipper_phone TEXT,
    shipper_email TEXT,
    
    consignee_name TEXT NOT NULL,
    consignee_address TEXT,
    consignee_city TEXT,
    consignee_state TEXT,
    consignee_zip TEXT,
    consignee_phone TEXT,
    consignee_email TEXT,
    
    -- Carrier
    carrier_name TEXT,
    carrier_dot TEXT,
    carrier_mc TEXT,
    driver_name TEXT,
    driver_license TEXT,
    driver_id UUID REFERENCES public.profiles(id),
    
    -- Vehicle Details
    vehicle_vin TEXT NOT NULL,
    vehicle_year INTEGER,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_color TEXT,
    vehicle_mileage INTEGER,
    vehicle_license_plate TEXT,
    vehicle_title_status TEXT,
    
    -- Condition at Pickup
    condition_notes TEXT,
    damage_report JSONB, -- Array of damage descriptions with photos
    interior_condition TEXT,
    exterior_condition TEXT,
    fuel_level TEXT, -- 'empty', '1/4', '1/2', '3/4', 'full'
    personal_items TEXT[], -- List of items in vehicle
    keys_location TEXT, -- 'ignition', 'console', 'office', 'driver'
    
    -- Locations & Dates
    pickup_location TEXT NOT NULL,
    pickup_date TIMESTAMPTZ,
    pickup_latitude DECIMAL(10, 8),
    pickup_longitude DECIMAL(11, 8),
    
    delivery_location TEXT NOT NULL,
    estimated_delivery TIMESTAMPTZ,
    actual_delivery TIMESTAMPTZ,
    delivery_latitude DECIMAL(10, 8),
    delivery_longitude DECIMAL(11, 8),
    
    -- Financial Terms
    freight_charges DECIMAL(10,2),
    insurance_amount DECIMAL(10,2),
    declared_value DECIMAL(10,2),
    
    -- Special Instructions
    special_instructions TEXT,
    hazmat_declaration BOOLEAN DEFAULT FALSE,
    
    -- Signatures (stored as JSONB with signature data, timestamp, IP)
    shipper_signature JSONB,
    carrier_signature JSONB,
    consignee_signature JSONB,
    
    -- Document URLs
    pdf_url TEXT, -- Generated PDF
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft', 'pending_pickup', 'signed_pickup', 'in_transit', 
        'signed_delivery', 'completed', 'disputed', 'cancelled'
    )),
    
    -- Dispute Information
    disputed_at TIMESTAMPTZ,
    dispute_reason TEXT,
    dispute_resolved_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bills_of_lading_shipment_id ON public.bills_of_lading(shipment_id);
CREATE INDEX IF NOT EXISTS idx_bills_of_lading_bol_number ON public.bills_of_lading(bol_number);
CREATE INDEX IF NOT EXISTS idx_bills_of_lading_status ON public.bills_of_lading(status);
CREATE INDEX IF NOT EXISTS idx_bills_of_lading_driver_id ON public.bills_of_lading(driver_id);

-- ============================================================================
-- SHIPMENT DOCUMENTS TABLE
-- Generic document management with AI extraction support
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shipment_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE,
    
    -- Document Type
    document_type TEXT NOT NULL CHECK (document_type IN (
        'bill_of_lading',
        'bill_of_sale',
        'gate_pass',
        'inspection_report',
        'proof_of_delivery',
        'insurance_certificate',
        'carrier_manifest',
        'title',
        'registration',
        'invoice',
        'receipt',
        'other'
    )),
    
    -- File Storage
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    
    -- AI Extraction Results
    extracted_data JSONB, -- AI-parsed document data
    confidence_score DECIMAL(3,2), -- AI confidence 0.00-1.00
    ocr_text TEXT, -- Raw OCR text
    
    -- Review Status
    requires_review BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Digital Signatures
    signatures JSONB, -- Electronic signatures with timestamps
    
    -- Metadata
    description TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    
    -- Upload Info
    uploaded_by UUID REFERENCES public.profiles(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipment_documents_shipment_id ON public.shipment_documents(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_documents_type ON public.shipment_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_shipment_documents_requires_review ON public.shipment_documents(requires_review);

-- ============================================================================
-- GATE PASSES TABLE
-- For facility access control (auction houses, dealerships)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.gate_passes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID REFERENCES public.shipments(id) ON DELETE CASCADE,
    pass_number TEXT UNIQUE NOT NULL,
    
    -- Authorization
    facility_name TEXT NOT NULL,
    facility_address TEXT,
    facility_contact_name TEXT,
    facility_contact_phone TEXT,
    
    vehicle_vin TEXT NOT NULL,
    vehicle_year INTEGER,
    vehicle_make TEXT,
    vehicle_model TEXT,
    lot_number TEXT, -- Auction lot number
    
    authorized_person TEXT NOT NULL,
    authorized_company TEXT,
    authorized_phone TEXT,
    driver_id UUID REFERENCES public.profiles(id),
    
    -- Validity Period
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    
    -- QR Code
    qr_code_data TEXT, -- Encrypted data for QR code
    qr_code_url TEXT, -- Image URL of generated QR code
    
    -- Usage Tracking
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    used_by TEXT, -- Name of person who used it
    scan_location TEXT,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active', 'used', 'expired', 'revoked', 'cancelled'
    )),
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    
    -- Special Instructions
    special_instructions TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gate_passes_shipment_id ON public.gate_passes(shipment_id);
CREATE INDEX IF NOT EXISTS idx_gate_passes_pass_number ON public.gate_passes(pass_number);
CREATE INDEX IF NOT EXISTS idx_gate_passes_status ON public.gate_passes(status);
CREATE INDEX IF NOT EXISTS idx_gate_passes_driver_id ON public.gate_passes(driver_id);
CREATE INDEX IF NOT EXISTS idx_gate_passes_valid_until ON public.gate_passes(valid_until);

-- ============================================================================
-- BULK UPLOADS TABLE
-- Track bulk upload operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bulk_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- File Information
    file_name TEXT NOT NULL,
    file_url TEXT,
    file_size INTEGER,
    file_type TEXT, -- 'csv', 'xlsx', 'xls'
    
    -- Processing Status
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    
    -- Results
    errors JSONB DEFAULT '[]', -- Array of error objects
    warnings JSONB DEFAULT '[]', -- Array of warning objects
    created_shipment_ids UUID[],
    
    -- Processing Options
    options JSONB DEFAULT '{}', -- Upload configuration options
    
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'validating', 'processing', 'completed', 'failed', 'cancelled'
    )),
    
    -- Progress Tracking
    progress_percent DECIMAL(5,2) DEFAULT 0,
    current_step TEXT,
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bulk_uploads_uploaded_by ON public.bulk_uploads(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_bulk_uploads_status ON public.bulk_uploads(status);
CREATE INDEX IF NOT EXISTS idx_bulk_uploads_created_at ON public.bulk_uploads(created_at DESC);

-- ============================================================================
-- Enable Row Level Security (RLS) on all new tables
-- ============================================================================
ALTER TABLE public.commercial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills_of_lading ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_uploads ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies will be added in next migration file
-- This keeps migrations focused and easier to rollback
-- ============================================================================

-- Add update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_commercial_accounts_updated_at ON public.commercial_accounts;
CREATE TRIGGER update_commercial_accounts_updated_at
    BEFORE UPDATE ON public.commercial_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bills_of_lading_updated_at ON public.bills_of_lading;
CREATE TRIGGER update_bills_of_lading_updated_at
    BEFORE UPDATE ON public.bills_of_lading
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipment_documents_updated_at ON public.shipment_documents;
CREATE TRIGGER update_shipment_documents_updated_at
    BEFORE UPDATE ON public.shipment_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_gate_passes_updated_at ON public.gate_passes;
CREATE TRIGGER update_gate_passes_updated_at
    BEFORE UPDATE ON public.gate_passes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE public.commercial_accounts IS 'B2B commercial client accounts with API access and payment terms';
COMMENT ON TABLE public.bills_of_lading IS 'Legal transport documents required for all commercial vehicle shipments';
COMMENT ON TABLE public.shipment_documents IS 'Document management with AI extraction for BOL, Bill of Sale, Gate Pass, etc.';
COMMENT ON TABLE public.gate_passes IS 'Facility access control for auction houses and dealerships';
COMMENT ON TABLE public.bulk_uploads IS 'Track bulk CSV/Excel upload operations for commercial clients';
