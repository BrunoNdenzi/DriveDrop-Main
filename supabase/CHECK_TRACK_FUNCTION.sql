-- =====================================================================
-- CHECK THE ENABLED TRIGGER FUNCTION
-- =====================================================================

SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'track_shipment_status_updates'
LIMIT 1;
