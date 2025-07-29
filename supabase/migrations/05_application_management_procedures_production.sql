/**
 * Migration: Application Management Functions
 * 
 * This migration implements a comprehensive set of functions for handling driver
 * applications to shipments in the DriveDrop system.
 *
 * Functions included:
 * - get_driver_applications: Retrieves applications submitted by a specific driver
 * - update_application_status: Updates an application's status with proper validation
 * - apply_for_shipment: Handles driver applications for shipments with validation
 * - assign_driver_to_shipment: Assigns a driver to a shipment with application updates
 *
 * Notes for future developers:
 * - These functions assume auth is handled at the API level
 * - Row-level security should also be configured for the job_applications table
 * - Be careful when modifying the status workflow logic in update_application_status
 * 
 * IMPORTANT MIGRATION PRACTICE:
 * - Always use DROP FUNCTION IF EXISTS for all possible overloaded versions before 
 *   creating new functions to avoid "function name is not unique" errors
 * - PostgreSQL requires explicit argument signatures when dropping overloaded functions
 * - Document all dropped signatures for reference
 *
 * Author: DriveDrop Engineering
 * Date: July 23, 2025
 */

-- Additional procedures for driver application management
-- This file should be executed after the table consolidation migration

-- =============================================================================
-- CLEANUP: Remove any existing versions of functions to prevent conflicts
-- =============================================================================

-- Clean up all possible versions of get_driver_applications
-- (handles cases where function may exist with different signatures)
DROP FUNCTION IF EXISTS get_driver_applications(UUID);
DROP FUNCTION IF EXISTS get_driver_applications(UUID, TEXT);
DROP FUNCTION IF EXISTS get_driver_applications(p_driver_id UUID);
DROP FUNCTION IF EXISTS get_driver_applications(p_driver_id UUID, p_status TEXT);

-- Clean up all possible versions of update_application_status
DROP FUNCTION IF EXISTS update_application_status(UUID, TEXT);
DROP FUNCTION IF EXISTS update_application_status(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_application_status(p_application_id UUID, p_status TEXT);
DROP FUNCTION IF EXISTS update_application_status(p_application_id UUID, p_status TEXT, p_notes TEXT);

-- Clean up all possible versions of apply_for_shipment
DROP FUNCTION IF EXISTS apply_for_shipment(UUID, UUID);
DROP FUNCTION IF EXISTS apply_for_shipment(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS apply_for_shipment(p_shipment_id UUID, p_driver_id UUID);
DROP FUNCTION IF EXISTS apply_for_shipment(p_shipment_id UUID, p_driver_id UUID, p_notes TEXT);

-- Clean up all possible versions of assign_driver_to_shipment
DROP FUNCTION IF EXISTS assign_driver_to_shipment(UUID, UUID);
DROP FUNCTION IF EXISTS assign_driver_to_shipment(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS assign_driver_to_shipment(p_shipment_id UUID, p_driver_id UUID);
DROP FUNCTION IF EXISTS assign_driver_to_shipment(p_shipment_id UUID, p_driver_id UUID, p_create_application BOOLEAN);

-- =============================================================================
-- FUNCTION DEFINITIONS: Create the latest versions
-- =============================================================================

/**
 * get_driver_applications
 *
 * Retrieves all applications submitted by a specific driver, optionally filtered by status.
 *
 * Parameters:
 * - p_driver_id UUID: The UUID of the driver whose applications should be retrieved
 * - p_status TEXT (optional): Filter applications by status ('pending', 'accepted', 'rejected')
 *
 * Returns:
 * - TABLE of job_applications records sorted by application date (newest first)
 *
 * Example usage:
 *   SELECT * FROM get_driver_applications('a1b2c3d4-e5f6-4321-8765-1a2b3c4d5e6f');
 *   SELECT * FROM get_driver_applications('a1b2c3d4-e5f6-4321-8765-1a2b3c4d5e6f', 'pending');
 */
CREATE OR REPLACE FUNCTION get_driver_applications(
  p_driver_id UUID,
  p_status TEXT DEFAULT NULL
) 
RETURNS TABLE (
  id UUID,
  shipment_id UUID,
  driver_id UUID,
  status TEXT,
  applied_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) 
AS $$
BEGIN
  -- Validate driver_id
  IF p_driver_id IS NULL THEN
    RAISE EXCEPTION 'Driver ID cannot be null';
  END IF;

  -- Validate status if provided
  IF p_status IS NOT NULL AND p_status NOT IN ('pending', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %. Status must be pending, accepted, or rejected', p_status;
  END IF;

  -- Return filtered applications
  IF p_status IS NULL THEN
    RETURN QUERY 
    SELECT 
      ja.id,
      ja.shipment_id,
      ja.driver_id,
      ja.status,
      ja.applied_at,
      ja.responded_at,
      ja.notes,
      ja.created_at,
      ja.updated_at
    FROM job_applications ja
    WHERE ja.driver_id = p_driver_id
    ORDER BY ja.applied_at DESC;
  ELSE
    RETURN QUERY 
    SELECT 
      ja.id,
      ja.shipment_id,
      ja.driver_id,
      ja.status,
      ja.applied_at,
      ja.responded_at,
      ja.notes,
      ja.created_at,
      ja.updated_at
    FROM job_applications ja
    WHERE ja.driver_id = p_driver_id AND ja.status = p_status
    ORDER BY ja.applied_at DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION get_driver_applications IS 
  'Retrieves all applications submitted by a specific driver, with optional status filtering';

/**
 * update_application_status
 *
 * Updates the status of a job application with proper validation and cascading effects.
 * When an application is accepted, all other applications for the same shipment are automatically rejected,
 * and the shipment is assigned to the accepted driver.
 *
 * Parameters:
 * - p_application_id UUID: The UUID of the application to update
 * - p_status TEXT: The new status ('pending', 'accepted', 'rejected')
 * - p_notes TEXT (optional): Optional notes about the status change
 *
 * Returns:
 * - RECORD of the updated application
 *
 * Errors:
 * - If application not found
 * - If status is invalid
 * - If the shipment is already assigned to another driver
 *
 * Example usage:
 *   SELECT * FROM update_application_status('a1b2c3d4-e5f6-4321-8765-1a2b3c4d5e6f', 'accepted', 'Driver has excellent ratings');
 */
CREATE OR REPLACE FUNCTION update_application_status(
  p_application_id UUID,
  p_status TEXT,
  p_notes TEXT DEFAULT NULL
) 
RETURNS SETOF job_applications 
AS $$
DECLARE
  v_application job_applications;
  v_shipment_id UUID;
  v_shipment_status TEXT;
  v_current_driver_id UUID;
BEGIN
  -- Validate inputs
  IF p_application_id IS NULL THEN
    RAISE EXCEPTION 'Application ID cannot be null';
  END IF;
  
  IF p_status IS NULL THEN
    RAISE EXCEPTION 'Status cannot be null';
  END IF;
  
  -- Validate the status value
  IF p_status NOT IN ('pending', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %. Status must be pending, accepted, or rejected', p_status;
  END IF;
  
  -- Get the application and validate it exists
  SELECT * INTO v_application 
  FROM job_applications 
  WHERE id = p_application_id;
  
  IF v_application IS NULL THEN
    RAISE EXCEPTION 'Application with ID % not found', p_application_id;
  END IF;
  
  v_shipment_id := v_application.shipment_id;
  
  -- If accepting application, check shipment availability
  IF p_status = 'accepted' THEN
    -- Check if shipment exists and get current status
    SELECT status, driver_id INTO v_shipment_status, v_current_driver_id
    FROM shipments
    WHERE id = v_shipment_id;
    
    IF v_shipment_status IS NULL THEN
      RAISE EXCEPTION 'Shipment with ID % not found', v_shipment_id;
    END IF;
    
    -- Check if already assigned to a different driver
    IF v_current_driver_id IS NOT NULL AND v_current_driver_id != v_application.driver_id THEN
      RAISE EXCEPTION 'Shipment is already assigned to another driver';
    END IF;
    
    -- Check if shipment is in a status that can be assigned
    IF v_shipment_status NOT IN ('pending', 'open') THEN
      RAISE EXCEPTION 'Shipment status (%) does not allow driver assignment', v_shipment_status;
    END IF;
  END IF;

  -- Update the application
  UPDATE job_applications
  SET 
    status = p_status,
    responded_at = CASE WHEN p_status != 'pending' THEN now() ELSE responded_at END,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_application_id
  RETURNING * INTO v_application;
  
  -- If the application is accepted, handle related updates
  IF p_status = 'accepted' THEN
    -- First reject all other applications for this shipment
    UPDATE job_applications
    SET 
      status = 'rejected',
      responded_at = now(),
      notes = COALESCE(notes, '') || E'\nAutomatically rejected because another driver was selected.',
      updated_at = now()
    WHERE 
      shipment_id = v_shipment_id AND
      id != p_application_id;
      
    -- Then update the shipment with the driver
    UPDATE shipments
    SET 
      driver_id = v_application.driver_id,
      status = 'assigned',
      updated_at = now()
    WHERE id = v_shipment_id;
    
    -- Create a tracking event if that table exists
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tracking_events' AND schemaname = 'public') THEN
      BEGIN
        INSERT INTO tracking_events (
          shipment_id, 
          event_type, 
          created_by,
          notes,
          created_at
        ) VALUES (
          v_shipment_id,
          'accepted',
          v_application.driver_id,
          'Driver assigned to shipment',
          now()
        );
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Could not create tracking event: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  RETURN NEXT v_application;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION update_application_status IS 
  'Updates application status with validation and handles cascading effects for acceptance';

/**
 * apply_for_shipment
 *
 * Allows a driver to apply for a specific shipment with comprehensive validation.
 * Prevents duplicate applications and ensures the shipment is available.
 *
 * Parameters:
 * - p_shipment_id UUID: The UUID of the shipment to apply for
 * - p_driver_id UUID: The UUID of the driver applying
 * - p_notes TEXT (optional): Optional application notes
 *
 * Returns:
 * - JSONB containing application details and status message
 *
 * Errors:
 * - If shipment not found
 * - If shipment already has a driver assigned
 * - If shipment is not in a status that allows applications
 *
 * Example usage:
 *   SELECT * FROM apply_for_shipment('a1b2c3d4-e5f6-4321-8765-1a2b3c4d5e6f', 'b2c3d4e5-f6a7-5432-8765-2b3c4d5e6f7a');
 */
CREATE OR REPLACE FUNCTION apply_for_shipment(
  p_shipment_id UUID,
  p_driver_id UUID,
  p_notes TEXT DEFAULT NULL
) 
RETURNS JSONB 
AS $$
DECLARE
  v_is_available BOOLEAN;
  v_result JSONB;
  v_existing_application_id UUID;
  v_shipment_status TEXT;
BEGIN
  -- Validate inputs
  IF p_shipment_id IS NULL THEN
    RAISE EXCEPTION 'Shipment ID cannot be null';
  END IF;
  
  IF p_driver_id IS NULL THEN
    RAISE EXCEPTION 'Driver ID cannot be null';
  END IF;
  
  -- Check if the shipment exists and get its status
  SELECT status INTO v_shipment_status
  FROM shipments
  WHERE id = p_shipment_id;
  
  IF v_shipment_status IS NULL THEN
    RAISE EXCEPTION 'Shipment with ID % not found', p_shipment_id;
  END IF;
  
  -- Check if the shipment is available for applications
  SELECT 
    (status = 'pending' OR status = 'open') AND driver_id IS NULL INTO v_is_available
  FROM 
    shipments
  WHERE 
    id = p_shipment_id;
  
  IF NOT v_is_available THEN
    -- Check if it's assigned to a driver
    IF EXISTS (SELECT 1 FROM shipments WHERE id = p_shipment_id AND driver_id IS NOT NULL) THEN
      RAISE EXCEPTION 'This shipment has already been assigned to a driver';
    ELSE
      RAISE EXCEPTION 'This shipment is not available for applications (status: %)', v_shipment_status;
    END IF;
  END IF;
  
  -- Check if the driver has already applied
  SELECT id INTO v_existing_application_id
  FROM job_applications
  WHERE shipment_id = p_shipment_id AND driver_id = p_driver_id;
  
  IF v_existing_application_id IS NOT NULL THEN
    -- Return existing application
    SELECT jsonb_build_object(
      'id', id,
      'shipment_id', shipment_id,
      'driver_id', driver_id,
      'status', status,
      'applied_at', applied_at,
      'responded_at', responded_at,
      'notes', notes,
      'created_at', created_at,
      'updated_at', updated_at,
      'message', 'You have already applied for this shipment',
      'is_new_application', FALSE
    ) INTO v_result
    FROM job_applications
    WHERE id = v_existing_application_id;
    
    RETURN v_result;
  END IF;
  
  -- Create a new application
  INSERT INTO job_applications (
    shipment_id,
    driver_id,
    status,
    applied_at,
    notes,
    created_at,
    updated_at
  ) 
  VALUES (
    p_shipment_id,
    p_driver_id,
    'pending',
    now(),
    p_notes,
    now(),
    now()
  )
  RETURNING jsonb_build_object(
    'id', id,
    'shipment_id', shipment_id,
    'driver_id', driver_id,
    'status', status,
    'applied_at', applied_at,
    'responded_at', responded_at,
    'notes', notes,
    'created_at', created_at,
    'updated_at', updated_at,
    'message', 'Application submitted successfully',
    'is_new_application', TRUE
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION apply_for_shipment IS 
  'Allows a driver to apply for a specific shipment with validation';

/**
 * assign_driver_to_shipment
 *
 * Assigns a driver to a shipment directly (typically used by admins).
 * Updates the shipment record, application statuses, and creates tracking events.
 *
 * Parameters:
 * - p_shipment_id UUID: The UUID of the shipment to assign
 * - p_driver_id UUID: The UUID of the driver to assign
 * - p_create_application BOOLEAN (optional): Whether to create an application record if none exists
 *
 * Returns:
 * - BOOLEAN indicating success
 * - JSONB with details about the assignment
 *
 * Errors:
 * - If shipment not found
 * - If shipment already assigned to another driver
 * - If shipment status doesn't allow assignment
 *
 * Example usage:
 *   SELECT * FROM assign_driver_to_shipment('a1b2c3d4-e5f6-4321-8765-1a2b3c4d5e6f', 'b2c3d4e5-f6a7-5432-8765-2b3c4d5e6f7a');
 */
CREATE OR REPLACE FUNCTION assign_driver_to_shipment(
  p_shipment_id UUID,
  p_driver_id UUID,
  p_create_application BOOLEAN DEFAULT TRUE
) 
RETURNS JSONB 
AS $$
DECLARE
  v_current_driver_id UUID;
  v_shipment_status TEXT;
  v_application_id UUID := NULL;
  v_tracking_event_id UUID;
  v_result JSONB;
BEGIN
  -- Validate inputs
  IF p_shipment_id IS NULL THEN
    RAISE EXCEPTION 'Shipment ID cannot be null';
  END IF;
  
  IF p_driver_id IS NULL THEN
    RAISE EXCEPTION 'Driver ID cannot be null';
  END IF;
  
  -- Check if shipment exists and get current status
  SELECT status, driver_id INTO v_shipment_status, v_current_driver_id 
  FROM shipments 
  WHERE id = p_shipment_id;
  
  IF v_shipment_status IS NULL THEN
    RAISE EXCEPTION 'Shipment with ID % not found', p_shipment_id;
  END IF;
  
  -- Check if already assigned to a different driver
  IF v_current_driver_id IS NOT NULL AND v_current_driver_id != p_driver_id THEN
    RAISE EXCEPTION 'This shipment has already been assigned to another driver (ID: %)', v_current_driver_id;
  END IF;
  
  -- Check if shipment is in a status that can be assigned
  IF v_shipment_status NOT IN ('pending', 'open') THEN
    RAISE EXCEPTION 'Shipment status (%) does not allow driver assignment', v_shipment_status;
  END IF;
  
  -- Check if an application exists for this driver
  SELECT id INTO v_application_id
  FROM job_applications
  WHERE shipment_id = p_shipment_id AND driver_id = p_driver_id;
  
  -- Create an application if requested and none exists
  IF v_application_id IS NULL AND p_create_application = TRUE THEN
    INSERT INTO job_applications (
      shipment_id,
      driver_id,
      status,
      applied_at,
      responded_at,
      notes,
      created_at,
      updated_at
    ) VALUES (
      p_shipment_id,
      p_driver_id,
      'accepted',  -- directly accepted
      now(),       -- applied now
      now(),       -- responded now (auto-accepted)
      'Automatically created and accepted by admin assignment',
      now(),
      now()
    )
    RETURNING id INTO v_application_id;
  ELSIF v_application_id IS NOT NULL THEN
    -- Update existing application to accepted
    UPDATE job_applications
    SET 
      status = 'accepted',
      responded_at = now(),
      notes = COALESCE(notes, '') || E'\nAccepted via direct assignment',
      updated_at = now()
    WHERE id = v_application_id;
  END IF;
  
  -- Reject all other applications for this shipment
  UPDATE job_applications
  SET 
    status = 'rejected',
    responded_at = now(),
    notes = COALESCE(notes, '') || E'\nAutomatically rejected because another driver was assigned',
    updated_at = now()
  WHERE 
    shipment_id = p_shipment_id AND
    driver_id != p_driver_id;
  
  -- Update the shipment with the driver ID
  UPDATE shipments 
  SET 
    driver_id = p_driver_id,
    status = 'assigned',
    updated_at = now()
  WHERE 
    id = p_shipment_id;
  
  -- Create a tracking event if that table exists
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tracking_events' AND schemaname = 'public') THEN
    BEGIN
      INSERT INTO tracking_events (
        shipment_id, 
        event_type, 
        created_by,
        notes,
        created_at
      ) VALUES (
        p_shipment_id,
        'accepted',
        p_driver_id,
        'Driver assigned to shipment by admin',
        now()
      )
      RETURNING id INTO v_tracking_event_id;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the transaction
      RAISE WARNING 'Could not create tracking event: %', SQLERRM;
    END;
  END IF;
  
  -- Build result object
  SELECT jsonb_build_object(
    'success', TRUE,
    'shipment_id', p_shipment_id,
    'driver_id', p_driver_id,
    'application_id', v_application_id,
    'application_created', (v_application_id IS NOT NULL AND p_create_application = TRUE),
    'tracking_event_id', v_tracking_event_id,
    'message', 'Driver successfully assigned to shipment'
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
COMMENT ON FUNCTION assign_driver_to_shipment IS 
  'Assigns a driver to a shipment with proper validation and status updates';

-- Additional index for performance on common queries
CREATE INDEX IF NOT EXISTS job_applications_driver_status_idx 
  ON job_applications(driver_id, status);

-- =============================================================================
-- VERIFICATION AND BEST PRACTICES
-- =============================================================================

-- Verify that functions were created successfully (should return 4 functions)
DO $$
BEGIN
  -- Check that all functions exist
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_driver_applications') THEN
    RAISE EXCEPTION 'MIGRATION FAILED: get_driver_applications function was not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_application_status') THEN
    RAISE EXCEPTION 'MIGRATION FAILED: update_application_status function was not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'apply_for_shipment') THEN
    RAISE EXCEPTION 'MIGRATION FAILED: apply_for_shipment function was not created';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'assign_driver_to_shipment') THEN
    RAISE EXCEPTION 'MIGRATION FAILED: assign_driver_to_shipment function was not created';
  END IF;
  
  RAISE NOTICE 'MIGRATION SUCCESS: All application management functions created successfully';
END $$;

-- Verification instructions:
/*
  To verify these functions after migration:
  
  1. Test get_driver_applications:
     SELECT * FROM get_driver_applications('00000000-0000-0000-0000-000000000000');
     SELECT * FROM get_driver_applications('00000000-0000-0000-0000-000000000000', 'pending');
  
  2. Test apply_for_shipment with a valid shipment:
     -- First create a test shipment if needed
     INSERT INTO shipments (id, client_id, status, title, pickup_address, delivery_address, estimated_price)
     VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'pending', 'Test Shipment', 'Test Address', 'Test Address', 100)
     RETURNING id;
     
     -- Then apply using the returned ID
     SELECT * FROM apply_for_shipment('[shipment_id]', '00000000-0000-0000-0000-000000000000');
  
  3. Test update_application_status:
     -- Use application ID from previous step
     SELECT * FROM update_application_status('[application_id]', 'accepted');
  
  4. Test assign_driver_to_shipment:
     -- Create another test shipment
     INSERT INTO shipments (id, client_id, status, title, pickup_address, delivery_address, estimated_price)
     VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'pending', 'Test Shipment 2', 'Test Address', 'Test Address', 100)
     RETURNING id;
     
     -- Then assign directly
     SELECT * FROM assign_driver_to_shipment('[shipment_id]', '00000000-0000-0000-0000-000000000000');

  BEST PRACTICES FOR FUTURE MIGRATIONS:
  
  1. Always DROP existing function versions before CREATE OR REPLACE
  2. Include all possible argument signatures when dropping overloaded functions
  3. Use explicit parameter names to avoid ambiguity
  4. Test functions immediately after creation with verification queries
  5. Document any breaking changes in migration comments
  
  Example template for future function migrations:
  
  -- Clean up existing versions
  DROP FUNCTION IF EXISTS my_function(arg1_type);
  DROP FUNCTION IF EXISTS my_function(arg1_type, arg2_type);
  DROP FUNCTION IF EXISTS my_function(param1 arg1_type, param2 arg2_type);
  
  -- Create new version
  CREATE OR REPLACE FUNCTION my_function(...)
  RETURNS ... AS $$ ... $$ LANGUAGE plpgsql SECURITY DEFINER;
*/
