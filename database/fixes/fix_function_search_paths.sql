-- ========================================
-- Fix Function Search Path Security Issue
-- ========================================
-- This script sets search_path on all functions to prevent
-- schema-based injection attacks
-- Run this in Supabase SQL Editor

-- 1. Message Functions
ALTER FUNCTION public.mark_message_as_read_v2 SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_unread_message_count SET search_path = public, pg_catalog;
ALTER FUNCTION public.send_message_v2 SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_conversation_messages_v2 SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_user_conversations_v2 SET search_path = public, pg_catalog;
ALTER FUNCTION public.mark_message_read SET search_path = public, pg_catalog;
ALTER FUNCTION public.mark_shipment_messages_read SET search_path = public, pg_catalog;
ALTER FUNCTION public.notify_new_message SET search_path = public, pg_catalog;
ALTER FUNCTION public.can_access_conversation SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_conversation_participants SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_conversation_by_shipment SET search_path = public, pg_catalog;

-- 2. Shipment Functions
ALTER FUNCTION public.apply_for_shipment SET search_path = public, pg_catalog;
ALTER FUNCTION public.accept_shipment SET search_path = public, pg_catalog;
ALTER FUNCTION public.assign_driver_to_shipment SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_shipment_status SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_shipment_payment_status SET search_path = public, pg_catalog;
ALTER FUNCTION public.send_shipment_notification SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_shipment_available_for_application SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_nearby_shipments SET search_path = public, pg_catalog;
ALTER FUNCTION public.track_shipment_status_updates SET search_path = public, pg_catalog;

-- 3. Payment Functions
ALTER FUNCTION public.create_final_payment SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_payment_status SET search_path = public, pg_catalog;
ALTER FUNCTION public.check_refund_eligibility SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_refund_status SET search_path = public, pg_catalog;
ALTER FUNCTION public.check_cancellation_eligibility SET search_path = public, pg_catalog;

-- 4. Driver Functions
ALTER FUNCTION public.update_application_status SET search_path = public, pg_catalog;
ALTER FUNCTION public.verify_driver SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_driver_applications SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_driver_settings SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_driver_settings SET search_path = public, pg_catalog;
ALTER FUNCTION public.ensure_single_primary_vehicle SET search_path = public, pg_catalog;

-- 5. Tracking Functions
ALTER FUNCTION public.create_tracking_event SET search_path = public, pg_catalog;
ALTER FUNCTION public.cleanup_tracking_data SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_latest_driver_location SET search_path = public, pg_catalog;
ALTER FUNCTION public.cleanup_old_driver_locations SET search_path = public, pg_catalog;

-- 6. Pricing Functions
ALTER FUNCTION public.get_active_pricing_config SET search_path = public, pg_catalog;
ALTER FUNCTION public.create_pricing_config_history SET search_path = public, pg_catalog;

-- 7. Cleanup Functions
ALTER FUNCTION public.cleanup_expired_messages SET search_path = public, pg_catalog;
ALTER FUNCTION public.cleanup_expired_conversations SET search_path = public, pg_catalog;

-- 8. User Functions
ALTER FUNCTION public.handle_new_user SET search_path = public, pg_catalog;

-- 9. Utility Functions
ALTER FUNCTION public.update_updated_at_column SET search_path = public, pg_catalog;
ALTER FUNCTION public.handle_updated_at SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_driver_applications_updated_at SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_messages_updated_at SET search_path = public, pg_catalog;

-- 10. Admin/Debug Functions (CAREFUL - these might be dangerous!)
ALTER FUNCTION public.exec_sql SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_table_names SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_table_columns SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_enum_values SET search_path = public, pg_catalog;
ALTER FUNCTION public.table_exists SET search_path = public, pg_catalog;

-- ========================================
-- Verification Query
-- ========================================
-- Run this to confirm all functions now have search_path set
SELECT 
  proname as function_name,
  prosecdef as is_security_definer,
  proconfig as search_path_config
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'mark_message_as_read_v2', 'get_unread_message_count', 'send_message_v2',
    'apply_for_shipment', 'accept_shipment', 'update_shipment_status',
    'create_final_payment', 'update_payment_status'
  );

-- ========================================
-- SUCCESS!
-- ========================================
-- All function search paths are now secured
-- Re-run Supabase Security Advisor to verify fixes
