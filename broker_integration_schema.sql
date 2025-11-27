-- =====================================================
-- BROKER INTEGRATION DATABASE SCHEMA
-- Phase 1: Database Foundation
-- Created: 2025-01-30
-- =====================================================

-- =====================================================
-- 1. MODIFY EXISTING TABLES
-- =====================================================

-- Add broker role to the user_role enum type
-- First check if the enum value doesn't already exist, then add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'broker' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'broker';
    END IF;
END $$;

-- Add broker-related fields to shipments table
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS broker_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS broker_carrier_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS broker_commission_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS carrier_payout_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS broker_payout_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_broker_shipment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS assignment_type TEXT CHECK (assignment_type IN ('direct', 'broker_assigned', 'load_board')) DEFAULT 'direct';

-- Add payment distribution tracking to payments table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS payment_distribution JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS carrier_payout_status TEXT CHECK (carrier_payout_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS broker_payout_status TEXT CHECK (broker_payout_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS carrier_payout_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS broker_payout_date TIMESTAMP WITH TIME ZONE;

-- Add index for broker queries
CREATE INDEX IF NOT EXISTS idx_shipments_broker_id ON shipments(broker_id);
CREATE INDEX IF NOT EXISTS idx_shipments_broker_carrier_id ON shipments(broker_carrier_id);
CREATE INDEX IF NOT EXISTS idx_shipments_is_broker ON shipments(is_broker_shipment);

-- =====================================================
-- 2. BROKER PROFILES TABLE
-- =====================================================
-- Stores broker company information and legal compliance
CREATE TABLE IF NOT EXISTS broker_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Company Information
    company_name TEXT NOT NULL,
    dba_name TEXT,
    company_email TEXT NOT NULL,
    company_phone TEXT NOT NULL,
    
    -- Legal & Compliance (REQUIRED for US auto transport brokers)
    dot_number TEXT UNIQUE, -- US DOT Number (Department of Transportation)
    mc_number TEXT UNIQUE, -- Motor Carrier Number (FMCSA)
    tax_id TEXT, -- EIN or Tax ID
    
    -- License & Insurance
    broker_license_number TEXT,
    insurance_policy_number TEXT,
    insurance_provider TEXT,
    insurance_amount DECIMAL(12,2), -- Minimum $75,000 bond required
    insurance_expiry_date DATE,
    bond_number TEXT, -- Surety bond or trust fund
    bond_amount DECIMAL(12,2),
    
    -- Verification Status
    verification_status TEXT CHECK (verification_status IN ('pending', 'documents_submitted', 'under_review', 'verified', 'rejected', 'suspended')) DEFAULT 'pending',
    fmcsa_verified BOOLEAN DEFAULT FALSE,
    dot_verified BOOLEAN DEFAULT FALSE,
    insurance_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    
    -- Business Details
    business_structure TEXT CHECK (business_structure IN ('sole_proprietorship', 'llc', 'corporation', 's_corp', 'partnership')),
    years_in_business INTEGER,
    website_url TEXT,
    
    -- Address
    business_address TEXT NOT NULL,
    business_city TEXT NOT NULL,
    business_state TEXT NOT NULL,
    business_zip TEXT NOT NULL,
    business_country TEXT DEFAULT 'USA',
    
    -- Commission & Financials
    default_commission_rate DECIMAL(5,2) DEFAULT 25.00, -- Default 25%
    platform_fee_rate DECIMAL(5,2) DEFAULT 10.00, -- Platform takes 10%
    
    -- Performance Metrics
    total_shipments_completed INTEGER DEFAULT 0,
    total_revenue_generated DECIMAL(12,2) DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    total_ratings INTEGER DEFAULT 0,
    on_time_delivery_rate DECIMAL(5,2) DEFAULT 0,
    cancellation_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Carrier Network Stats
    total_carriers INTEGER DEFAULT 0,
    active_carriers INTEGER DEFAULT 0,
    
    -- Account Status
    account_status TEXT CHECK (account_status IN ('active', 'inactive', 'suspended', 'closed')) DEFAULT 'active',
    suspension_reason TEXT,
    suspended_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_broker_profile UNIQUE(profile_id)
);

-- Indexes for broker_profiles
CREATE INDEX IF NOT EXISTS idx_broker_profiles_profile_id ON broker_profiles(profile_id);
CREATE INDEX IF NOT EXISTS idx_broker_profiles_verification_status ON broker_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_broker_profiles_account_status ON broker_profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_broker_profiles_dot_number ON broker_profiles(dot_number);
CREATE INDEX IF NOT EXISTS idx_broker_profiles_mc_number ON broker_profiles(mc_number);

-- =====================================================
-- 3. BROKER CARRIERS TABLE
-- =====================================================
-- Junction table: tracks broker-driver relationships
CREATE TABLE IF NOT EXISTS broker_carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_id UUID NOT NULL REFERENCES broker_profiles(id) ON DELETE CASCADE,
    carrier_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, -- The driver
    
    -- Relationship Details
    relationship_status TEXT CHECK (relationship_status IN ('pending', 'active', 'inactive', 'suspended', 'terminated')) DEFAULT 'pending',
    invited_by TEXT, -- 'broker' or 'carrier'
    invitation_accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Commission Agreement
    commission_rate DECIMAL(5,2) NOT NULL, -- Broker's cut from this carrier's jobs
    payment_terms TEXT, -- e.g., "Net 7", "Upon delivery", etc.
    
    -- Performance Tracking
    total_shipments_completed INTEGER DEFAULT 0,
    total_revenue_generated DECIMAL(12,2) DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0,
    on_time_delivery_rate DECIMAL(5,2) DEFAULT 0,
    last_shipment_date TIMESTAMP WITH TIME ZONE,
    
    -- Notes & History
    notes TEXT,
    termination_reason TEXT,
    terminated_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_broker_carrier UNIQUE(broker_id, carrier_id)
);

-- Indexes for broker_carriers
CREATE INDEX IF NOT EXISTS idx_broker_carriers_broker_id ON broker_carriers(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_carriers_carrier_id ON broker_carriers(carrier_id);
CREATE INDEX IF NOT EXISTS idx_broker_carriers_status ON broker_carriers(relationship_status);

-- =====================================================
-- 4. BROKER ASSIGNMENTS TABLE
-- =====================================================
-- Links shipments to brokers and carriers with financial details
CREATE TABLE IF NOT EXISTS broker_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    broker_id UUID NOT NULL REFERENCES broker_profiles(id),
    carrier_id UUID REFERENCES profiles(id), -- Can be NULL if not yet assigned
    broker_carrier_relationship_id UUID REFERENCES broker_carriers(id),
    
    -- Assignment Details
    assignment_status TEXT CHECK (assignment_status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
    assignment_type TEXT CHECK (assignment_type IN ('direct', 'load_board_bid')) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    
    -- Financial Breakdown
    total_amount DECIMAL(10,2) NOT NULL, -- Total shipment cost
    carrier_payout DECIMAL(10,2) NOT NULL, -- Amount driver receives
    broker_commission DECIMAL(10,2) NOT NULL, -- Amount broker receives
    platform_fee DECIMAL(10,2) NOT NULL, -- Amount platform receives
    
    commission_rate DECIMAL(5,2) NOT NULL, -- Broker's commission %
    platform_fee_rate DECIMAL(5,2) NOT NULL, -- Platform's fee %
    
    -- Performance Tracking
    pickup_on_time BOOLEAN,
    delivery_on_time BOOLEAN,
    customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
    customer_feedback TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_shipment_assignment UNIQUE(shipment_id)
);

-- Indexes for broker_assignments
CREATE INDEX IF NOT EXISTS idx_broker_assignments_shipment_id ON broker_assignments(shipment_id);
CREATE INDEX IF NOT EXISTS idx_broker_assignments_broker_id ON broker_assignments(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_assignments_carrier_id ON broker_assignments(carrier_id);
CREATE INDEX IF NOT EXISTS idx_broker_assignments_status ON broker_assignments(assignment_status);

-- =====================================================
-- 5. LOAD BOARD TABLE
-- =====================================================
-- Marketplace for available shipments
CREATE TABLE IF NOT EXISTS load_board (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    posted_by UUID NOT NULL REFERENCES profiles(id), -- Client or broker who posted
    
    -- Visibility & Access
    visibility TEXT CHECK (visibility IN ('public', 'invited_only', 'network_only')) DEFAULT 'public',
    allowed_brokers UUID[], -- Array of broker IDs if invited_only
    
    -- Load Details
    load_status TEXT CHECK (load_status IN ('available', 'pending_acceptance', 'assigned', 'cancelled', 'expired')) DEFAULT 'available',
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Bidding
    bidding_enabled BOOLEAN DEFAULT TRUE,
    reserve_price DECIMAL(10,2), -- Minimum acceptable bid
    current_best_bid_id UUID,
    total_bids INTEGER DEFAULT 0,
    
    -- Pricing
    suggested_carrier_payout DECIMAL(10,2), -- What carrier should receive
    max_broker_commission DECIMAL(10,2), -- Max commission broker can take
    
    -- Assignment
    assigned_to_broker_id UUID REFERENCES broker_profiles(id),
    assigned_to_carrier_id UUID REFERENCES profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_load_board_shipment UNIQUE(shipment_id)
);

-- Indexes for load_board
CREATE INDEX IF NOT EXISTS idx_load_board_shipment_id ON load_board(shipment_id);
CREATE INDEX IF NOT EXISTS idx_load_board_status ON load_board(load_status);
CREATE INDEX IF NOT EXISTS idx_load_board_posted_by ON load_board(posted_by);
CREATE INDEX IF NOT EXISTS idx_load_board_expires_at ON load_board(expires_at);

-- =====================================================
-- 6. LOAD BOARD BIDS TABLE
-- =====================================================
-- Broker bids on available shipments
CREATE TABLE IF NOT EXISTS load_board_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    load_board_id UUID NOT NULL REFERENCES load_board(id) ON DELETE CASCADE,
    broker_id UUID NOT NULL REFERENCES broker_profiles(id),
    carrier_id UUID NOT NULL REFERENCES profiles(id), -- Driver who will do the job
    broker_carrier_relationship_id UUID REFERENCES broker_carriers(id),
    
    -- Bid Details
    bid_status TEXT CHECK (bid_status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')) DEFAULT 'pending',
    
    -- Financial Proposal
    carrier_payout DECIMAL(10,2) NOT NULL, -- What carrier gets
    broker_commission DECIMAL(10,2) NOT NULL, -- What broker gets
    total_cost DECIMAL(10,2) NOT NULL, -- Total (carrier + broker + platform fee)
    platform_fee DECIMAL(10,2) NOT NULL,
    
    commission_rate DECIMAL(5,2) NOT NULL,
    
    -- Carrier Information
    carrier_name TEXT NOT NULL,
    carrier_rating DECIMAL(3,2),
    carrier_completed_shipments INTEGER,
    estimated_pickup_date DATE,
    estimated_delivery_date DATE,
    
    -- Bid Management
    bid_notes TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    withdrawn_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for load_board_bids
CREATE INDEX IF NOT EXISTS idx_load_board_bids_load_board_id ON load_board_bids(load_board_id);
CREATE INDEX IF NOT EXISTS idx_load_board_bids_broker_id ON load_board_bids(broker_id);
CREATE INDEX IF NOT EXISTS idx_load_board_bids_carrier_id ON load_board_bids(carrier_id);
CREATE INDEX IF NOT EXISTS idx_load_board_bids_status ON load_board_bids(bid_status);

-- =====================================================
-- 7. BROKER PAYOUTS TABLE
-- =====================================================
-- Tracks broker commission payments
CREATE TABLE IF NOT EXISTS broker_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_id UUID NOT NULL REFERENCES broker_profiles(id),
    shipment_id UUID NOT NULL REFERENCES shipments(id),
    assignment_id UUID REFERENCES broker_assignments(id),
    
    -- Payout Details
    payout_status TEXT CHECK (payout_status IN ('pending', 'processing', 'completed', 'failed', 'disputed')) DEFAULT 'pending',
    payout_amount DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL,
    
    -- Payment Information
    payment_method TEXT CHECK (payment_method IN ('stripe_transfer', 'ach', 'wire', 'check', 'paypal')),
    stripe_transfer_id TEXT,
    transaction_id TEXT,
    
    -- Timing
    eligible_for_payout_at TIMESTAMP WITH TIME ZONE, -- When funds become available
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    
    -- Dispute Handling
    disputed_at TIMESTAMP WITH TIME ZONE,
    dispute_reason TEXT,
    dispute_resolved_at TIMESTAMP WITH TIME ZONE,
    dispute_resolution TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for broker_payouts
CREATE INDEX IF NOT EXISTS idx_broker_payouts_broker_id ON broker_payouts(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_payouts_shipment_id ON broker_payouts(shipment_id);
CREATE INDEX IF NOT EXISTS idx_broker_payouts_status ON broker_payouts(payout_status);
CREATE INDEX IF NOT EXISTS idx_broker_payouts_eligible_date ON broker_payouts(eligible_for_payout_at);

-- =====================================================
-- 8. BROKER DOCUMENTS TABLE
-- =====================================================
-- Stores compliance documents (insurance, licenses, bonds)
CREATE TABLE IF NOT EXISTS broker_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    broker_id UUID NOT NULL REFERENCES broker_profiles(id) ON DELETE CASCADE,
    
    -- Document Details
    document_type TEXT CHECK (document_type IN (
        'dot_authority', 
        'mc_authority', 
        'insurance_certificate', 
        'surety_bond', 
        'business_license', 
        'tax_document', 
        'fmcsa_license',
        'other'
    )) NOT NULL,
    document_name TEXT NOT NULL,
    description TEXT,
    
    -- Storage
    file_url TEXT NOT NULL, -- Supabase Storage URL
    file_name TEXT NOT NULL,
    file_size INTEGER, -- bytes
    mime_type TEXT,
    
    -- Verification
    verification_status TEXT CHECK (verification_status IN ('pending', 'approved', 'rejected', 'expired')) DEFAULT 'pending',
    verified_by UUID REFERENCES profiles(id), -- Admin who verified
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Expiry Management
    expiry_date DATE,
    expiry_reminder_sent BOOLEAN DEFAULT FALSE,
    is_expired BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for broker_documents
CREATE INDEX IF NOT EXISTS idx_broker_documents_broker_id ON broker_documents(broker_id);
CREATE INDEX IF NOT EXISTS idx_broker_documents_type ON broker_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_broker_documents_verification_status ON broker_documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_broker_documents_expiry_date ON broker_documents(expiry_date);

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE broker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_board ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_board_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Brokers can view own profile" ON broker_profiles;
DROP POLICY IF EXISTS "Brokers can update own profile" ON broker_profiles;
DROP POLICY IF EXISTS "Anyone can create broker profile" ON broker_profiles;
DROP POLICY IF EXISTS "Brokers can view their carriers" ON broker_carriers;
DROP POLICY IF EXISTS "Brokers can manage their carriers" ON broker_carriers;
DROP POLICY IF EXISTS "Brokers can view available loads" ON load_board;
DROP POLICY IF EXISTS "Users can post to load board" ON load_board;
DROP POLICY IF EXISTS "Users can update their load board posts" ON load_board;
DROP POLICY IF EXISTS "Brokers can view bids" ON load_board_bids;
DROP POLICY IF EXISTS "Brokers can place bids" ON load_board_bids;
DROP POLICY IF EXISTS "Assignment parties can view" ON broker_assignments;
DROP POLICY IF EXISTS "Brokers can view own payouts" ON broker_payouts;
DROP POLICY IF EXISTS "Brokers can view own documents" ON broker_documents;
DROP POLICY IF EXISTS "Brokers can manage own documents" ON broker_documents;

-- Broker Profiles: Brokers can view/edit their own profile, admins can view all
CREATE POLICY "Brokers can view own profile" ON broker_profiles
    FOR SELECT USING (
        auth.uid() = profile_id OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Brokers can update own profile" ON broker_profiles
    FOR UPDATE USING (auth.uid() = profile_id);

CREATE POLICY "Anyone can create broker profile" ON broker_profiles
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- Broker Carriers: Brokers can manage their carriers
CREATE POLICY "Brokers can view their carriers" ON broker_carriers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM broker_profiles WHERE id = broker_carriers.broker_id AND profile_id = auth.uid()) OR
        carrier_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Brokers can manage their carriers" ON broker_carriers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM broker_profiles WHERE id = broker_carriers.broker_id AND profile_id = auth.uid())
    );

-- Load Board: Public loads visible to all brokers
CREATE POLICY "Brokers can view available loads" ON load_board
    FOR SELECT USING (
        load_status = 'available' OR
        posted_by = auth.uid() OR
        assigned_to_broker_id IN (SELECT id FROM broker_profiles WHERE profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can post to load board" ON load_board
    FOR INSERT WITH CHECK (posted_by = auth.uid());

CREATE POLICY "Users can update their load board posts" ON load_board
    FOR UPDATE USING (posted_by = auth.uid());

-- Load Board Bids: Brokers can view/manage their bids
CREATE POLICY "Brokers can view bids" ON load_board_bids
    FOR SELECT USING (
        broker_id IN (SELECT id FROM broker_profiles WHERE profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM load_board WHERE id = load_board_bids.load_board_id AND posted_by = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Brokers can place bids" ON load_board_bids
    FOR INSERT WITH CHECK (
        broker_id IN (SELECT id FROM broker_profiles WHERE profile_id = auth.uid())
    );

-- Broker Assignments: All parties can view
CREATE POLICY "Assignment parties can view" ON broker_assignments
    FOR SELECT USING (
        carrier_id = auth.uid() OR
        broker_id IN (SELECT id FROM broker_profiles WHERE profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM shipments WHERE id = broker_assignments.shipment_id AND (client_id = auth.uid() OR driver_id = auth.uid())) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Broker Payouts: Brokers can view their payouts
CREATE POLICY "Brokers can view own payouts" ON broker_payouts
    FOR SELECT USING (
        broker_id IN (SELECT id FROM broker_profiles WHERE profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Broker Documents: Brokers can manage their documents
CREATE POLICY "Brokers can view own documents" ON broker_documents
    FOR SELECT USING (
        broker_id IN (SELECT id FROM broker_profiles WHERE profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Brokers can manage own documents" ON broker_documents
    FOR ALL USING (
        broker_id IN (SELECT id FROM broker_profiles WHERE profile_id = auth.uid())
    );

-- =====================================================
-- 10. HELPER FUNCTIONS
-- =====================================================

-- Function to calculate payment distribution
CREATE OR REPLACE FUNCTION calculate_payment_distribution(
    p_total_amount DECIMAL(10,2),
    p_broker_commission_rate DECIMAL(5,2),
    p_platform_fee_rate DECIMAL(5,2)
)
RETURNS JSONB AS $$
DECLARE
    v_broker_amount DECIMAL(10,2);
    v_platform_fee DECIMAL(10,2);
    v_carrier_amount DECIMAL(10,2);
BEGIN
    -- Calculate broker commission (e.g., 25% of total)
    v_broker_amount := ROUND(p_total_amount * (p_broker_commission_rate / 100), 2);
    
    -- Calculate platform fee (e.g., 10% of total)
    v_platform_fee := ROUND(p_total_amount * (p_platform_fee_rate / 100), 2);
    
    -- Remainder goes to carrier
    v_carrier_amount := p_total_amount - v_broker_amount - v_platform_fee;
    
    RETURN jsonb_build_object(
        'total', p_total_amount,
        'carrier', v_carrier_amount,
        'broker', v_broker_amount,
        'platform', v_platform_fee,
        'broker_rate', p_broker_commission_rate,
        'platform_rate', p_platform_fee_rate
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update broker performance metrics
CREATE OR REPLACE FUNCTION update_broker_performance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.assignment_status = 'completed' AND OLD.assignment_status != 'completed' THEN
        UPDATE broker_profiles
        SET 
            total_shipments_completed = total_shipments_completed + 1,
            total_revenue_generated = total_revenue_generated + NEW.broker_commission,
            updated_at = NOW()
        WHERE id = NEW.broker_id;
        
        -- Update broker-carrier relationship metrics
        IF NEW.broker_carrier_relationship_id IS NOT NULL THEN
            UPDATE broker_carriers
            SET
                total_shipments_completed = total_shipments_completed + 1,
                total_revenue_generated = total_revenue_generated + NEW.carrier_payout,
                last_shipment_date = NOW(),
                updated_at = NOW()
            WHERE id = NEW.broker_carrier_relationship_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for broker performance updates
DROP TRIGGER IF EXISTS trigger_update_broker_performance ON broker_assignments;
CREATE TRIGGER trigger_update_broker_performance
    AFTER UPDATE ON broker_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_broker_performance();

-- Function to check document expiry
CREATE OR REPLACE FUNCTION check_expired_documents()
RETURNS TABLE(broker_id UUID, document_type TEXT, expiry_date DATE) AS $$
BEGIN
    RETURN QUERY
    SELECT bd.broker_id, bd.document_type, bd.expiry_date
    FROM broker_documents bd
    WHERE bd.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      AND bd.verification_status = 'approved'
      AND bd.expiry_reminder_sent = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to update is_expired status on broker_documents
CREATE OR REPLACE FUNCTION update_document_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date IS NOT NULL THEN
        NEW.is_expired := (NEW.expiry_date < CURRENT_DATE);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for document expiry updates
DROP TRIGGER IF EXISTS trigger_update_document_expiry ON broker_documents;
CREATE TRIGGER trigger_update_document_expiry
    BEFORE INSERT OR UPDATE ON broker_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_document_expiry();

-- =====================================================
-- 11. UPDATED_AT TRIGGERS
-- =====================================================

-- Create or replace the update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist, then create them
DROP TRIGGER IF EXISTS update_broker_profiles_updated_at ON broker_profiles;
CREATE TRIGGER update_broker_profiles_updated_at BEFORE UPDATE ON broker_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broker_carriers_updated_at ON broker_carriers;
CREATE TRIGGER update_broker_carriers_updated_at BEFORE UPDATE ON broker_carriers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broker_assignments_updated_at ON broker_assignments;
CREATE TRIGGER update_broker_assignments_updated_at BEFORE UPDATE ON broker_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_load_board_updated_at ON load_board;
CREATE TRIGGER update_load_board_updated_at BEFORE UPDATE ON load_board
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_load_board_bids_updated_at ON load_board_bids;
CREATE TRIGGER update_load_board_bids_updated_at BEFORE UPDATE ON load_board_bids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broker_payouts_updated_at ON broker_payouts;
CREATE TRIGGER update_broker_payouts_updated_at BEFORE UPDATE ON broker_payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broker_documents_updated_at ON broker_documents;
CREATE TRIGGER update_broker_documents_updated_at BEFORE UPDATE ON broker_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- This schema adds complete broker functionality to DriveDrop
-- Supports: broker registration, carrier network management,
--           load board marketplace, bidding system, payment splits,
--           compliance document management, and performance tracking
-- =====================================================
