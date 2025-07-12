-- migration_push_notifications.sql
-- Create the push_tokens table
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create an index for faster lookups by user
CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_idx ON public.push_tokens(token);

-- Create the notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  shipment_updates BOOLEAN NOT NULL DEFAULT TRUE,
  driver_assigned BOOLEAN NOT NULL DEFAULT TRUE,
  payment_updates BOOLEAN NOT NULL DEFAULT TRUE,
  promotions BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create a unique index for user_id to ensure one preference record per user
CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_user_id_idx ON public.notification_preferences(user_id);

-- Row Level Security for push_tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own push tokens
CREATE POLICY "Users can view their own tokens" ON public.push_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own push tokens
CREATE POLICY "Users can insert their own tokens" ON public.push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own push tokens
CREATE POLICY "Users can update their own tokens" ON public.push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own push tokens
CREATE POLICY "Users can delete their own tokens" ON public.push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Row Level Security for notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notification preferences
CREATE POLICY "Users can view their own preferences" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own notification preferences
CREATE POLICY "Users can insert their own preferences" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own notification preferences
CREATE POLICY "Users can update their own preferences" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Function to send a notification to users
CREATE OR REPLACE FUNCTION public.send_shipment_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- When a shipment status changes, insert a notification record
  IF (TG_OP = 'UPDATE' AND OLD.status != NEW.status) THEN
    -- Insert client notification
    INSERT INTO public.tracking_events(shipment_id, event_type, created_by, notes)
    VALUES (NEW.id, NEW.status::tracking_event_type, NEW.driver_id, 'Shipment status updated to ' || NEW.status);
    
    -- We'd typically call an external notification service here
    -- For now, we'll just log the event
    
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to fire the notification function when a shipment is updated
DROP TRIGGER IF EXISTS shipment_notification_trigger ON public.shipments;
CREATE TRIGGER shipment_notification_trigger
  AFTER UPDATE ON public.shipments
  FOR EACH ROW
  EXECUTE FUNCTION public.send_shipment_notification();
