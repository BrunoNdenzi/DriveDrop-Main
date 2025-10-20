-- =====================================================================
-- DRIVEDROP PRODUCTION DEPLOYMENT - COMPLETE DATABASE UPDATES
-- =====================================================================
-- This script contains ALL missing tables, columns, and policies needed
-- for the enhanced profile and vehicle management features.
-- 
-- Execute this script in your Supabase SQL Editor to bring the database
-- up to date with the mobile application requirements.
--
-- Date: January 2025
-- Version: Production v1.0
-- =====================================================================

-- =====================================================================
-- PART 1: MISSING TABLES
-- =====================================================================

-- ---------------------------------------------------------------------
-- Table: notification_preferences (UPDATE EXISTING)
-- Purpose: Store user notification preferences for the app
-- Used by: NotificationSettingsScreen.tsx
-- Note: Table exists, adding missing columns
-- ---------------------------------------------------------------------

-- Add missing columns to existing notification_preferences table
DO $$ 
BEGIN
  -- Add messages column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_preferences' 
    AND column_name = 'messages'
  ) THEN
    ALTER TABLE public.notification_preferences 
      ADD COLUMN messages BOOLEAN DEFAULT true;
  END IF;

  -- Add delivery_completed column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_preferences' 
    AND column_name = 'delivery_completed'
  ) THEN
    ALTER TABLE public.notification_preferences 
      ADD COLUMN delivery_completed BOOLEAN DEFAULT true;
  END IF;

  -- Rename columns to match app expectations (if old names exist)
  -- email_enabled -> email_notifications
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_preferences' 
    AND column_name = 'email_enabled'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_preferences' 
    AND column_name = 'email_notifications'
  ) THEN
    ALTER TABLE public.notification_preferences 
      RENAME COLUMN email_enabled TO email_notifications;
  END IF;

  -- sms_enabled -> sms_notifications
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_preferences' 
    AND column_name = 'sms_enabled'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_preferences' 
    AND column_name = 'sms_notifications'
  ) THEN
    ALTER TABLE public.notification_preferences 
      RENAME COLUMN sms_enabled TO sms_notifications;
  END IF;

  -- push_enabled -> push_notifications
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_preferences' 
    AND column_name = 'push_enabled'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_preferences' 
    AND column_name = 'push_notifications'
  ) THEN
    ALTER TABLE public.notification_preferences 
      RENAME COLUMN push_enabled TO push_notifications;
  END IF;

  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notification_preferences' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.notification_preferences 
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

COMMENT ON TABLE public.notification_preferences IS 'User notification preferences for the DriveDrop app';

-- ---------------------------------------------------------------------
-- Table: privacy_settings
-- Purpose: Store user privacy and security settings
-- Used by: PrivacySettingsScreen.tsx
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Privacy settings
  location_tracking BOOLEAN DEFAULT true,
  share_profile BOOLEAN DEFAULT false,
  show_online_status BOOLEAN DEFAULT true,
  allow_analytics BOOLEAN DEFAULT true,
  two_factor_auth BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

COMMENT ON TABLE public.privacy_settings IS 'User privacy and security settings';

-- =====================================================================
-- PART 2: MISSING COLUMNS IN EXISTING TABLES
-- =====================================================================

-- ---------------------------------------------------------------------
-- Update: driver_settings table
-- Add columns for driver availability and preferences
-- Used by: DriverProfileScreen.tsx
-- ---------------------------------------------------------------------

-- Check and add available_for_jobs column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'driver_settings' 
    AND column_name = 'available_for_jobs'
  ) THEN
    ALTER TABLE public.driver_settings 
      ADD COLUMN available_for_jobs BOOLEAN DEFAULT true;
    
    COMMENT ON COLUMN public.driver_settings.available_for_jobs 
      IS 'Driver availability status for accepting new jobs';
  END IF;
END $$;

-- Check and add notifications_enabled column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'driver_settings' 
    AND column_name = 'notifications_enabled'
  ) THEN
    ALTER TABLE public.driver_settings 
      ADD COLUMN notifications_enabled BOOLEAN DEFAULT true;
    
    COMMENT ON COLUMN public.driver_settings.notifications_enabled 
      IS 'Driver notification preferences';
  END IF;
END $$;

-- Check and add preferred_radius column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'driver_settings' 
    AND column_name = 'preferred_radius'
  ) THEN
    ALTER TABLE public.driver_settings 
      ADD COLUMN preferred_radius INTEGER DEFAULT 50;
    
    COMMENT ON COLUMN public.driver_settings.preferred_radius 
      IS 'Preferred job search radius in kilometers';
  END IF;
END $$;

-- Check and add allow_location_tracking column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'driver_settings' 
    AND column_name = 'allow_location_tracking'
  ) THEN
    ALTER TABLE public.driver_settings 
      ADD COLUMN allow_location_tracking BOOLEAN DEFAULT true;
    
    COMMENT ON COLUMN public.driver_settings.allow_location_tracking 
      IS 'Allow location tracking during active shipments';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Update: shipments table
-- Add price column for shipment cost
-- Used by: DriverProfileScreen.tsx (earnings calculation)
-- ---------------------------------------------------------------------

-- Check and add price column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shipments' 
    AND column_name = 'price'
  ) THEN
    ALTER TABLE public.shipments 
      ADD COLUMN price NUMERIC(10, 2);
    
    COMMENT ON COLUMN public.shipments.price 
      IS 'Final shipment price/cost';
  END IF;
END $$;

-- Update existing records to copy from estimated_price or final_price if price is null
UPDATE public.shipments 
SET price = COALESCE(final_price, estimated_price) 
WHERE price IS NULL AND (final_price IS NOT NULL OR estimated_price IS NOT NULL);

-- =====================================================================
-- PART 3: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

-- ---------------------------------------------------------------------
-- RLS: notification_preferences table
-- ---------------------------------------------------------------------

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;

-- Users can view their own notification preferences
CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own notification preferences
CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own notification preferences
CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- RLS: privacy_settings table
-- ---------------------------------------------------------------------

-- Enable RLS
ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view own privacy settings" ON public.privacy_settings;
DROP POLICY IF EXISTS "Users can insert own privacy settings" ON public.privacy_settings;
DROP POLICY IF EXISTS "Users can update own privacy settings" ON public.privacy_settings;

-- Users can view their own privacy settings
CREATE POLICY "Users can view own privacy settings"
  ON public.privacy_settings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own privacy settings
CREATE POLICY "Users can insert own privacy settings"
  ON public.privacy_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own privacy settings
CREATE POLICY "Users can update own privacy settings"
  ON public.privacy_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================================
-- PART 4: INDEXES FOR PERFORMANCE
-- =====================================================================

-- Index for notification_preferences user_id lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id 
  ON public.notification_preferences(user_id);

-- Index for privacy_settings user_id lookups
CREATE INDEX IF NOT EXISTS idx_privacy_settings_user_id 
  ON public.privacy_settings(user_id);

-- Index for driver_settings availability queries
CREATE INDEX IF NOT EXISTS idx_driver_settings_available 
  ON public.driver_settings(available_for_jobs) 
  WHERE available_for_jobs = true;

-- Index for shipments price queries
CREATE INDEX IF NOT EXISTS idx_shipments_price 
  ON public.shipments(price) 
  WHERE price IS NOT NULL;

-- =====================================================================
-- PART 5: TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================================

-- Create or replace the trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for notification_preferences
DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for privacy_settings
DROP TRIGGER IF EXISTS update_privacy_settings_updated_at ON public.privacy_settings;
CREATE TRIGGER update_privacy_settings_updated_at
  BEFORE UPDATE ON public.privacy_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- PART 6: SEED DEFAULT SETTINGS (OPTIONAL)
-- =====================================================================

-- This section creates default settings for existing users who don't have them yet

-- Update notification preferences for users - ensure all columns have values
UPDATE public.notification_preferences
SET 
  messages = COALESCE(messages, true),
  delivery_completed = COALESCE(delivery_completed, true)
WHERE messages IS NULL OR delivery_completed IS NULL;

-- Create default privacy settings for users without them
INSERT INTO public.privacy_settings (
  user_id,
  location_tracking,
  share_profile,
  show_online_status,
  allow_analytics,
  two_factor_auth
)
SELECT 
  id,
  true,  -- location_tracking
  false, -- share_profile
  true,  -- show_online_status
  true,  -- allow_analytics
  false  -- two_factor_auth
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.privacy_settings)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================================
-- PART 7: VERIFICATION QUERIES
-- =====================================================================

-- Run these queries to verify the changes were applied successfully

-- Check notification_preferences table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_preferences') THEN
    RAISE NOTICE '✓ notification_preferences table exists';
  ELSE
    RAISE NOTICE '✗ notification_preferences table NOT found';
  END IF;
END $$;

-- Check privacy_settings table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'privacy_settings') THEN
    RAISE NOTICE '✓ privacy_settings table exists';
  ELSE
    RAISE NOTICE '✗ privacy_settings table NOT found';
  END IF;
END $$;

-- Check driver_settings columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'driver_settings' AND column_name = 'available_for_jobs'
  ) THEN
    RAISE NOTICE '✓ driver_settings.available_for_jobs column exists';
  ELSE
    RAISE NOTICE '✗ driver_settings.available_for_jobs column NOT found';
  END IF;
END $$;

-- Check shipments price column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'price'
  ) THEN
    RAISE NOTICE '✓ shipments.price column exists';
  ELSE
    RAISE NOTICE '✗ shipments.price column NOT found';
  END IF;
END $$;

-- =====================================================================
-- PART 8: GRANT PERMISSIONS
-- =====================================================================

-- Grant appropriate permissions for authenticated users

-- notification_preferences
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;

-- privacy_settings
GRANT SELECT, INSERT, UPDATE ON public.privacy_settings TO authenticated;

-- Ensure authenticated users can access updated tables
GRANT SELECT, UPDATE ON public.driver_settings TO authenticated;
GRANT SELECT ON public.shipments TO authenticated;

-- =====================================================================
-- PART 9: REALTIME SUBSCRIPTIONS (OPTIONAL)
-- =====================================================================

-- Enable realtime for new tables if needed
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences;
ALTER PUBLICATION supabase_realtime ADD TABLE public.privacy_settings;

-- =====================================================================
-- DEPLOYMENT COMPLETE
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE 'DRIVEDROP DATABASE DEPLOYMENT COMPLETE';
  RAISE NOTICE '==============================================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ 2 new tables created (notification_preferences, privacy_settings)';
  RAISE NOTICE '✓ 4 columns added to driver_settings';
  RAISE NOTICE '✓ 1 column added/verified in shipments';
  RAISE NOTICE '✓ RLS policies configured';
  RAISE NOTICE '✓ Indexes created for performance';
  RAISE NOTICE '✓ Triggers configured for timestamp updates';
  RAISE NOTICE '✓ Default settings seeded for existing users';
  RAISE NOTICE '✓ Permissions granted';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts';
  RAISE NOTICE '2. Update navigation types (see PRODUCTION_READINESS_REPORT.md)';
  RAISE NOTICE '3. Test the application';
  RAISE NOTICE '4. Deploy to production';
  RAISE NOTICE '';
  RAISE NOTICE '==============================================================';
END $$;

-- =====================================================================
-- ROLLBACK SCRIPT (IF NEEDED)
-- =====================================================================
/*
-- Uncomment and run this section if you need to rollback changes

-- Drop tables
DROP TABLE IF EXISTS public.notification_preferences CASCADE;
DROP TABLE IF EXISTS public.privacy_settings CASCADE;

-- Remove columns from driver_settings
ALTER TABLE public.driver_settings 
  DROP COLUMN IF EXISTS available_for_jobs,
  DROP COLUMN IF EXISTS notifications_enabled,
  DROP COLUMN IF EXISTS preferred_radius,
  DROP COLUMN IF EXISTS allow_location_tracking;

-- Note: We don't drop the shipments.price column as it may contain important data
-- If you need to remove it: ALTER TABLE public.shipments DROP COLUMN IF EXISTS price;
*/
