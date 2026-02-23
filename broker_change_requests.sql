-- =============================================================================
-- Broker Change Requests Table
-- Stores change requests for critical business fields that require admin approval
-- =============================================================================

CREATE TABLE IF NOT EXISTS broker_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES broker_profiles(id) ON DELETE CASCADE,
  changes JSONB NOT NULL DEFAULT '{}',
  -- changes format: { "field_name": { "old_value": "...", "new_value": "..." } }
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by broker and status
CREATE INDEX IF NOT EXISTS idx_broker_change_requests_broker_status 
  ON broker_change_requests(broker_id, status);

CREATE INDEX IF NOT EXISTS idx_broker_change_requests_status 
  ON broker_change_requests(status);

-- Enable RLS
ALTER TABLE broker_change_requests ENABLE ROW LEVEL SECURITY;

-- Brokers can view their own change requests
CREATE POLICY broker_change_requests_broker_select ON broker_change_requests
  FOR SELECT USING (
    broker_id IN (
      SELECT bp.id FROM broker_profiles bp
      JOIN profiles p ON bp.profile_id = p.id
      WHERE p.id = auth.uid()
    )
  );

-- Brokers can insert their own change requests
CREATE POLICY broker_change_requests_broker_insert ON broker_change_requests
  FOR INSERT WITH CHECK (
    broker_id IN (
      SELECT bp.id FROM broker_profiles bp
      JOIN profiles p ON bp.profile_id = p.id
      WHERE p.id = auth.uid()
    )
  );

-- Admins can view and update all change requests
CREATE POLICY broker_change_requests_admin_all ON broker_change_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_broker_change_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER broker_change_request_updated
  BEFORE UPDATE ON broker_change_requests
  FOR EACH ROW EXECUTE FUNCTION update_broker_change_request_timestamp();

-- Function to approve a change request and apply changes to broker_profiles
CREATE OR REPLACE FUNCTION approve_broker_change_request(
  p_request_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_broker_id UUID;
  v_changes JSONB;
  v_field TEXT;
  v_new_value TEXT;
BEGIN
  -- Get the change request
  SELECT broker_id, changes INTO v_broker_id, v_changes
  FROM broker_change_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change request not found or already processed';
  END IF;

  -- Apply each change to broker_profiles
  FOR v_field, v_new_value IN
    SELECT key, value->>'new_value'
    FROM jsonb_each(v_changes)
  LOOP
    EXECUTE format(
      'UPDATE broker_profiles SET %I = $1, updated_at = NOW() WHERE id = $2',
      v_field
    ) USING v_new_value, v_broker_id;
  END LOOP;

  -- Mark change request as approved
  UPDATE broker_change_requests
  SET status = 'approved',
      reviewed_by = p_admin_id,
      reviewed_at = NOW(),
      admin_notes = p_admin_notes
  WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reject a change request
CREATE OR REPLACE FUNCTION reject_broker_change_request(
  p_request_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE broker_change_requests
  SET status = 'rejected',
      reviewed_by = p_admin_id,
      reviewed_at = NOW(),
      admin_notes = COALESCE(p_admin_notes, 'Request rejected by admin')
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Change request not found or already processed';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
