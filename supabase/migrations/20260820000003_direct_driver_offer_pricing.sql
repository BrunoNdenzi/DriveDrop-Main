-- Canonical pricing contract for DriveDrop's direct client-to-driver marketplace.
-- Driver offers are all-in and must preserve payment costs, risk reserve, and margin.

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS driver_offer_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS driver_offer_status TEXT NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS driver_offer_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_offer_reviewed_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS driver_offer_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS payment_processing_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS risk_reserve_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS projected_contribution_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS projected_contribution_margin_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS direct_pricing_policy_snapshot JSONB;

UPDATE shipments
SET assignment_type = 'direct'
WHERE assignment_type IS NULL;

ALTER TABLE shipments
  ALTER COLUMN assignment_type SET DEFAULT 'direct',
  ALTER COLUMN assignment_type SET NOT NULL;

ALTER TABLE shipments
  DROP CONSTRAINT IF EXISTS shipments_driver_offer_amount_nonnegative,
  ADD CONSTRAINT shipments_driver_offer_amount_nonnegative
    CHECK (driver_offer_amount IS NULL OR driver_offer_amount >= 0),
  DROP CONSTRAINT IF EXISTS shipments_driver_offer_status_valid,
  ADD CONSTRAINT shipments_driver_offer_status_valid
    CHECK (driver_offer_status IN ('pending_review', 'approved', 'accepted', 'declined', 'cancelled')),
  DROP CONSTRAINT IF EXISTS shipments_assignment_type_valid,
  ADD CONSTRAINT shipments_assignment_type_valid
    CHECK (assignment_type IN ('direct', 'broker_assigned', 'load_board'));

CREATE INDEX IF NOT EXISTS idx_shipments_direct_offer_review
  ON shipments (driver_offer_status, created_at)
  WHERE assignment_type = 'direct' AND driver_id IS NULL;

CREATE OR REPLACE FUNCTION enforce_direct_driver_offer_pricing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_rate CONSTANT NUMERIC := 0.029;
  payment_fixed_fee CONSTANT NUMERIC := 0.30;
  reserve_rate CONSTANT NUMERIC := 0.02;
  minimum_margin_rate CONSTANT NUMERIC := 0.30;
  client_price NUMERIC;
  projected_margin_rate NUMERIC;
BEGIN
  IF COALESCE(NEW.assignment_type, 'direct') <> 'direct' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.driver_offer_status = 'accepted'
    AND (
      NEW.driver_offer_amount IS DISTINCT FROM OLD.driver_offer_amount
      OR NEW.driver_offer_reviewed_by IS DISTINCT FROM OLD.driver_offer_reviewed_by
      OR NEW.driver_offer_reviewed_at IS DISTINCT FROM OLD.driver_offer_reviewed_at
    )
  THEN
    RAISE EXCEPTION 'An accepted driver offer is immutable';
  END IF;

  IF NEW.driver_offer_status IN ('approved', 'accepted') THEN
    client_price := NEW.estimated_price;

    IF client_price IS NULL OR client_price <= 0 THEN
      RAISE EXCEPTION 'A positive client price is required before approving a driver offer';
    END IF;

    IF NEW.driver_offer_amount IS NULL OR NEW.driver_offer_amount <= 0 THEN
      RAISE EXCEPTION 'A positive all-in driver offer is required before approval';
    END IF;

    IF NEW.driver_offer_reviewed_by IS NULL OR NEW.driver_offer_reviewed_at IS NULL THEN
      RAISE EXCEPTION 'Driver offer approval requires an admin reviewer and review timestamp';
    END IF;

    NEW.payment_processing_cost := ROUND((client_price * payment_rate) + payment_fixed_fee, 2);
    NEW.risk_reserve_amount := ROUND(client_price * reserve_rate, 2);
    NEW.projected_contribution_amount := ROUND(
      client_price
        - NEW.driver_offer_amount
        - NEW.payment_processing_cost
        - NEW.risk_reserve_amount,
      2
    );
    projected_margin_rate := NEW.projected_contribution_amount / client_price;
    NEW.projected_contribution_margin_percent := ROUND(projected_margin_rate * 100, 2);

    IF projected_margin_rate < minimum_margin_rate THEN
      RAISE EXCEPTION
        'Unsafe driver offer: projected contribution margin % is below required 30%%',
        ROUND(projected_margin_rate * 100, 2);
    END IF;

    NEW.direct_pricing_policy_snapshot := jsonb_build_object(
      'version', 'direct-launch-v1',
      'driver_offer_basis', 'all_in',
      'payment_processing_percent', 2.9,
      'payment_processing_fixed', payment_fixed_fee,
      'risk_reserve_percent', 2,
      'minimum_contribution_margin_percent', 30,
      'evaluated_at', NOW()
    );
  ELSE
    NEW.payment_processing_cost := NULL;
    NEW.risk_reserve_amount := NULL;
    NEW.projected_contribution_amount := NULL;
    NEW.projected_contribution_margin_percent := NULL;
    NEW.direct_pricing_policy_snapshot := NULL;
  END IF;

  IF NEW.driver_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR OLD.driver_id IS DISTINCT FROM NEW.driver_id)
  THEN
    IF NEW.driver_offer_status NOT IN ('approved', 'accepted') THEN
      RAISE EXCEPTION 'Direct driver assignment requires an approved or accepted safe driver offer';
    END IF;
    NEW.driver_offer_status := 'accepted';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_direct_driver_offer_pricing ON shipments;
CREATE TRIGGER trg_enforce_direct_driver_offer_pricing
  BEFORE INSERT OR UPDATE OF
    estimated_price,
    assignment_type,
    driver_id,
    driver_offer_amount,
    driver_offer_status,
    driver_offer_reviewed_at,
    driver_offer_reviewed_by
  ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_direct_driver_offer_pricing();

CREATE OR REPLACE FUNCTION require_approved_direct_offer_for_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shipment_assignment_type TEXT;
  shipment_offer_status TEXT;
BEGIN
  SELECT COALESCE(assignment_type, 'direct'), driver_offer_status
  INTO shipment_assignment_type, shipment_offer_status
  FROM shipments
  WHERE id = NEW.shipment_id;

  IF shipment_assignment_type = 'direct' AND shipment_offer_status <> 'approved' THEN
    RAISE EXCEPTION 'This shipment is awaiting an approved driver offer';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_approved_direct_offer_for_application ON job_applications;
CREATE TRIGGER trg_require_approved_direct_offer_for_application
  BEFORE INSERT ON job_applications
  FOR EACH ROW
  EXECUTE FUNCTION require_approved_direct_offer_for_application();

COMMENT ON COLUMN shipments.driver_offer_amount IS
  'Admin-approved all-in amount offered to the direct driver; includes driver operating costs.';
COMMENT ON COLUMN shipments.projected_contribution_margin_percent IS
  'Projected DriveDrop contribution margin after driver offer, payment processing, and risk reserve.';