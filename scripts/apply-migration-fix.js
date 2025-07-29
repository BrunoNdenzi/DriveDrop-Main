// Apply SQL migration fix for payment RLS
const { supabase } = require('../backend/src/lib/supabase');

async function applyMigrationFix() {
  try {
    console.log('Applying fix for payment RLS policy...');
    
    const rls_fix = `
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Only admins can manage payments" ON payments;

-- Create a more permissive policy for inserting payments
CREATE POLICY "Allow service to create payments" 
ON payments FOR INSERT 
WITH CHECK (true);  -- This allows the service to insert payments for any authenticated user

-- Create a policy to allow admins to update payments
CREATE POLICY "Only admins can update payments" 
ON payments FOR UPDATE USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);

-- Create a policy to allow admins to delete payments
CREATE POLICY "Only admins can delete payments" 
ON payments FOR DELETE USING (
    auth.uid() IN (
        SELECT id FROM profiles WHERE role = 'admin'
    )
);
    `;
    
    // Execute the SQL using the exec_sql RPC function
    const { error: rlsError } = await supabase.rpc('exec_sql', { 
      sql: rls_fix 
    });
    
    if (rlsError) {
      console.error('Error applying RLS fix:', rlsError);
      return;
    }
    
    console.log('Successfully applied RLS policy fix');
    
    const client_id_fix = `
-- Fix the create_final_payment function to use client_id instead of user_id
CREATE OR REPLACE FUNCTION create_final_payment(
  p_shipment_id UUID,
  p_user_id UUID,
  p_parent_payment_id UUID
)
RETURNS TABLE(
  payment_intent_amount INTEGER,
  payment_intent_description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  parent_payment RECORD;
  final_payment_id UUID;
BEGIN
  -- Get parent payment details
  SELECT 
    remaining_amount,
    shipment_id
  INTO parent_payment
  FROM payments
  WHERE id = p_parent_payment_id
    AND client_id = p_user_id
    AND payment_type = 'initial'
    AND status = 'completed';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid parent payment or payment not completed';
  END IF;
  
  -- Check if final payment already exists
  IF EXISTS (
    SELECT 1 FROM payments 
    WHERE parent_payment_id = p_parent_payment_id 
    AND payment_type = 'final'
  ) THEN
    RAISE EXCEPTION 'Final payment already processed for this shipment';
  END IF;
  
  -- Return payment intent details
  RETURN QUERY SELECT 
    parent_payment.remaining_amount,
    'Final 80% payment for DriveDrop shipment ' || p_shipment_id::TEXT;
END;
$$;
    `;
    
    // Execute the SQL using the exec_sql RPC function
    const { error: clientIdError } = await supabase.rpc('exec_sql', { 
      sql: client_id_fix 
    });
    
    if (clientIdError) {
      console.error('Error applying client_id fix:', clientIdError);
      return;
    }
    
    console.log('Successfully applied client_id function fix');
    
    console.log('All migration fixes applied successfully');
  } catch (err) {
    console.error('Error applying migration fixes:', err);
  }
}

// Run the migration fix
applyMigrationFix();
