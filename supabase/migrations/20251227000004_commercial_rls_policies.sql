-- ============================================================================
-- Row Level Security (RLS) Policies for Commercial Tables
-- Migration: 20251227000004
-- Description: Secure access to all commercial tables
-- Author: DriveDrop Development Team
-- Date: December 27, 2025
-- ============================================================================

-- ============================================================================
-- COMMERCIAL_ACCOUNTS POLICIES
-- ============================================================================

-- Admin can view all commercial accounts
CREATE POLICY "admin_view_all_commercial_accounts"
ON public.commercial_accounts
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Users can view their own commercial account
CREATE POLICY "users_view_own_commercial_account"
ON public.commercial_accounts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can create their own commercial account
CREATE POLICY "users_create_own_commercial_account"
ON public.commercial_accounts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own commercial account
CREATE POLICY "users_update_own_commercial_account"
ON public.commercial_accounts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admin can update any commercial account
CREATE POLICY "admin_update_commercial_accounts"
ON public.commercial_accounts
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- ============================================================================
-- BILLS_OF_LADING POLICIES
-- ============================================================================

-- Admin can view all BOLs
CREATE POLICY "admin_view_all_bols"
ON public.bills_of_lading
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Users can view BOLs for their shipments
CREATE POLICY "users_view_own_shipment_bols"
ON public.bills_of_lading
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.shipments
        WHERE shipments.id = bills_of_lading.shipment_id
        AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
    )
);

-- Brokers can view BOLs for their broker shipments
CREATE POLICY "brokers_view_broker_shipment_bols"
ON public.bills_of_lading
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.broker_shipments
        WHERE broker_shipments.id = bills_of_lading.shipment_id
        AND broker_shipments.broker_id = auth.uid()
    )
);

-- Admin and brokers can create BOLs
CREATE POLICY "admin_broker_create_bols"
ON public.bills_of_lading
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'broker')
    )
);

-- Admin and assigned drivers can update BOLs (for signatures)
CREATE POLICY "admin_driver_update_bols"
ON public.bills_of_lading
FOR UPDATE
TO authenticated
USING (
    driver_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- ============================================================================
-- SHIPMENT_DOCUMENTS POLICIES
-- ============================================================================

-- Admin can view all documents
CREATE POLICY "admin_view_all_documents"
ON public.shipment_documents
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Users can view documents for their shipments
CREATE POLICY "users_view_own_shipment_documents"
ON public.shipment_documents
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.shipments
        WHERE shipments.id = shipment_documents.shipment_id
        AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
    )
    OR uploaded_by = auth.uid()
);

-- Users can upload documents for their shipments
CREATE POLICY "users_upload_own_shipment_documents"
ON public.shipment_documents
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.shipments
        WHERE shipments.id = shipment_documents.shipment_id
        AND (shipments.client_id = auth.uid() OR shipments.driver_id = auth.uid())
    )
    AND uploaded_by = auth.uid()
);

-- Admin can insert/update any document
CREATE POLICY "admin_manage_documents"
ON public.shipment_documents
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- ============================================================================
-- GATE_PASSES POLICIES
-- ============================================================================

-- Admin can view all gate passes
CREATE POLICY "admin_view_all_gate_passes"
ON public.gate_passes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Drivers can view their assigned gate passes
CREATE POLICY "drivers_view_own_gate_passes"
ON public.gate_passes
FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

-- Users can view gate passes for their shipments
CREATE POLICY "users_view_shipment_gate_passes"
ON public.gate_passes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.shipments
        WHERE shipments.id = gate_passes.shipment_id
        AND shipments.client_id = auth.uid()
    )
);

-- Admin and brokers can create gate passes
CREATE POLICY "admin_broker_create_gate_passes"
ON public.gate_passes
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'broker')
    )
);

-- Drivers can update their gate passes (mark as used)
CREATE POLICY "drivers_update_own_gate_passes"
ON public.gate_passes
FOR UPDATE
TO authenticated
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid());

-- ============================================================================
-- BULK_UPLOADS POLICIES
-- ============================================================================

-- Users can view their own bulk uploads
CREATE POLICY "users_view_own_bulk_uploads"
ON public.bulk_uploads
FOR SELECT
TO authenticated
USING (uploaded_by = auth.uid());

-- Admin can view all bulk uploads
CREATE POLICY "admin_view_all_bulk_uploads"
ON public.bulk_uploads
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Users can create their own bulk uploads
CREATE POLICY "users_create_own_bulk_uploads"
ON public.bulk_uploads
FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

-- Users and admin can update their bulk uploads
CREATE POLICY "users_update_own_bulk_uploads"
ON public.bulk_uploads
FOR UPDATE
TO authenticated
USING (
    uploaded_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- ============================================================================
-- AUCTION_INTEGRATIONS POLICIES
-- ============================================================================

-- Admin can view all integrations
CREATE POLICY "admin_view_all_integrations"
ON public.auction_integrations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Admin can create integrations
CREATE POLICY "admin_create_integrations"
ON public.auction_integrations
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
    AND created_by = auth.uid()
);

-- Admin can update integrations
CREATE POLICY "admin_update_integrations"
ON public.auction_integrations
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Admin can delete integrations
CREATE POLICY "admin_delete_integrations"
ON public.auction_integrations
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- ============================================================================
-- INTEGRATION_LOGS POLICIES
-- ============================================================================

-- Admin can view all integration logs
CREATE POLICY "admin_view_integration_logs"
ON public.integration_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- System can insert integration logs (service role only)
-- No policy needed - handled by service role

-- ============================================================================
-- DOCUMENT_EXTRACTION_QUEUE POLICIES
-- ============================================================================

-- Admin can view all document extractions
CREATE POLICY "admin_view_document_extraction_queue"
ON public.document_extraction_queue
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Admin can update document extractions (review)
CREATE POLICY "admin_update_document_extraction_queue"
ON public.document_extraction_queue
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- ============================================================================
-- AI_DISPATCH_OPTIMIZATIONS POLICIES
-- ============================================================================

-- Admin can view all AI dispatch optimizations
CREATE POLICY "admin_view_ai_dispatch"
ON public.ai_dispatch_optimizations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Admin can create AI dispatch optimizations
CREATE POLICY "admin_create_ai_dispatch"
ON public.ai_dispatch_optimizations
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Admin can update AI dispatch optimizations
CREATE POLICY "admin_update_ai_dispatch"
ON public.ai_dispatch_optimizations
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- ============================================================================
-- AI_SHIPMENT_PROMPTS POLICIES
-- ============================================================================

-- Users can view their own AI prompts
CREATE POLICY "users_view_own_ai_prompts"
ON public.ai_shipment_prompts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admin can view all AI prompts
CREATE POLICY "admin_view_all_ai_prompts"
ON public.ai_shipment_prompts
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Users can create their own AI prompts
CREATE POLICY "users_create_own_ai_prompts"
ON public.ai_shipment_prompts
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can update their own AI prompts (feedback)
CREATE POLICY "users_update_own_ai_prompts"
ON public.ai_shipment_prompts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$ 
BEGIN
    RAISE NOTICE 'RLS policies created successfully for all commercial tables!';
    RAISE NOTICE 'Security is now enabled and properly configured.';
END $$;
