-- Add notifications last viewed timestamp to profiles table
-- This allows tracking when users last viewed their notifications
-- to properly calculate unread notification counts

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notifications_last_viewed_at timestamp with time zone;

-- Set default to current time for existing users so they start fresh
-- (prevents showing all historical notifications as unread)
UPDATE public.profiles
SET notifications_last_viewed_at = now()
WHERE notifications_last_viewed_at IS NULL;
