-- Capture pricing outcomes from authoritative shipment and financial lifecycle records.

ALTER TABLE quote_history
  ADD COLUMN IF NOT EXISTS shipment_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_total_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS actual_revenue NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS actual_gross_profit NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS actual_contribution_margin_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS financial_outcome_recorded_at TIMESTAMPTZ;

ALTER TABLE quote_history
  DROP CONSTRAINT IF EXISTS quote_history_actual_total_cost_nonnegative,
  ADD CONSTRAINT quote_history_actual_total_cost_nonnegative
    CHECK (actual_total_cost IS NULL OR actual_total_cost >= 0),
  DROP CONSTRAINT IF EXISTS quote_history_actual_revenue_nonnegative,
  ADD CONSTRAINT quote_history_actual_revenue_nonnegative
    CHECK (actual_revenue IS NULL OR actual_revenue >= 0);

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quote_history(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_quote_once
  ON shipments (quote_id)
  WHERE quote_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_events_quote_acceptance_once
  ON pricing_events (aggregate_id, event_type)
  WHERE aggregate_type = 'quote' AND event_type = 'quote_accepted';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_events_shipment_delivery_once
  ON pricing_events (aggregate_id, event_type)
  WHERE aggregate_type = 'shipment' AND event_type = 'shipment_delivery_recorded';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_events_shipment_financials_once
  ON pricing_events (aggregate_id, event_type)
  WHERE aggregate_type = 'shipment' AND event_type = 'shipment_financials_finalized';

CREATE OR REPLACE FUNCTION validate_shipment_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owned_quote quote_history%ROWTYPE;
BEGIN
  IF NEW.quote_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO owned_quote
  FROM quote_history
  WHERE id = NEW.quote_id
    AND user_id = NEW.client_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote does not belong to the shipment client';
  END IF;

  IF owned_quote.expires_at IS NOT NULL AND owned_quote.expires_at < NOW() THEN
    RAISE EXCEPTION 'Quote has expired';
  END IF;

  IF owned_quote.was_booked AND owned_quote.shipment_id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Quote has already been used';
  END IF;

  NEW.estimated_price := owned_quote.quoted_price;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_shipment_quote ON shipments;
CREATE TRIGGER trg_validate_shipment_quote
  BEFORE INSERT OR UPDATE OF quote_id ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION validate_shipment_quote();

CREATE OR REPLACE FUNCTION record_pricing_quote_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepted_at TIMESTAMPTZ := COALESCE(NEW.created_at, NOW());
  quote_created_at TIMESTAMPTZ;
BEGIN
  IF NEW.quote_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE quote_history
  SET
    was_booked = TRUE,
    booked_at = accepted_at,
    time_to_booking_ms = GREATEST(
      0,
      FLOOR(EXTRACT(EPOCH FROM (accepted_at - created_at)) * 1000)::BIGINT
    ),
    shipment_id = NEW.id,
    booking_price = NEW.estimated_price
  WHERE id = NEW.quote_id
    AND user_id = NEW.client_id
    AND was_booked = FALSE
  RETURNING created_at INTO quote_created_at;

  IF quote_created_at IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO pricing_events (
    event_type,
    aggregate_id,
    aggregate_type,
    user_id,
    event_payload,
    occurred_at,
    source_service,
    source_version
  )
  VALUES (
    'quote_accepted',
    NEW.quote_id,
    'quote',
    NEW.client_id,
    jsonb_build_object(
      'quote_id', NEW.quote_id,
      'shipment_id', NEW.id,
      'booking_price', NEW.estimated_price,
      'accepted_at', accepted_at,
      'source', 'shipment_created'
    ),
    accepted_at,
    'database_shipment_lifecycle',
    '1'
  )
  ON CONFLICT (aggregate_id, event_type)
    WHERE aggregate_type = 'quote' AND event_type = 'quote_accepted'
  DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_pricing_quote_acceptance ON shipments;
CREATE TRIGGER trg_record_pricing_quote_acceptance
  AFTER INSERT ON shipments
  FOR EACH ROW
  EXECUTE FUNCTION record_pricing_quote_acceptance();

CREATE OR REPLACE FUNCTION record_pricing_shipment_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  completion_time TIMESTAMPTZ;
BEGIN
  completion_time := COALESCE(NEW.delivered_at, NEW.updated_at, NOW());

  UPDATE quote_history
  SET shipment_completed_at = completion_time
  WHERE shipment_id = NEW.id;

  INSERT INTO pricing_events (
    event_type,
    aggregate_id,
    aggregate_type,
    event_payload,
    occurred_at,
    source_service,
    source_version
  )
  VALUES (
    'shipment_delivery_recorded',
    NEW.id,
    'shipment',
    jsonb_build_object(
      'shipment_id', NEW.id,
      'completed_at', completion_time,
      'source', 'shipment_status_transition'
    ),
    completion_time,
    'database_shipment_lifecycle',
    '1'
  )
  ON CONFLICT (aggregate_id, event_type)
    WHERE aggregate_type = 'shipment' AND event_type = 'shipment_delivery_recorded'
  DO UPDATE SET
    event_payload = EXCLUDED.event_payload,
    occurred_at = EXCLUDED.occurred_at,
    recorded_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_pricing_shipment_delivery ON shipments;
CREATE TRIGGER trg_record_pricing_shipment_delivery
  AFTER UPDATE OF status ON shipments
  FOR EACH ROW
  WHEN (NEW.status::TEXT = 'delivered' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION record_pricing_shipment_delivery();

CREATE OR REPLACE FUNCTION record_pricing_shipment_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE quote_history
  SET
    actual_total_cost = NEW.total_cost,
    actual_revenue = NEW.revenue,
    actual_gross_profit = NEW.gross_profit,
    actual_contribution_margin_percent = NEW.profit_margin_percent,
    financial_outcome_recorded_at = NEW.finalized_at
  WHERE shipment_id = NEW.shipment_id;

  INSERT INTO pricing_events (
    event_type,
    aggregate_id,
    aggregate_type,
    event_payload,
    occurred_at,
    source_service,
    source_version
  )
  VALUES (
    'shipment_financials_finalized',
    NEW.shipment_id,
    'shipment',
    jsonb_build_object(
      'shipment_id', NEW.shipment_id,
      'actual_total_cost', NEW.total_cost,
      'actual_revenue', NEW.revenue,
      'actual_gross_profit', NEW.gross_profit,
      'actual_contribution_margin_percent', NEW.profit_margin_percent,
      'finalized_at', NEW.finalized_at,
      'source', 'shipment_costs'
    ),
    NEW.finalized_at,
    'database_financial_lifecycle',
    '1'
  )
  ON CONFLICT (aggregate_id, event_type)
    WHERE aggregate_type = 'shipment' AND event_type = 'shipment_financials_finalized'
  DO UPDATE SET
    event_payload = EXCLUDED.event_payload,
    occurred_at = EXCLUDED.occurred_at,
    recorded_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_pricing_shipment_financials ON shipment_costs;
CREATE TRIGGER trg_record_pricing_shipment_financials
  AFTER INSERT OR UPDATE ON shipment_costs
  FOR EACH ROW
  EXECUTE FUNCTION record_pricing_shipment_financials();

COMMENT ON COLUMN quote_history.actual_total_cost IS
  'Final total cost copied from the admin-controlled shipment_costs ledger.';
COMMENT ON COLUMN quote_history.actual_revenue IS
  'Final recognized shipment revenue copied from the shipment_costs ledger.';
COMMENT ON FUNCTION record_pricing_shipment_financials() IS
  'Generates idempotent pricing feedback from finalized shipment financial records.';