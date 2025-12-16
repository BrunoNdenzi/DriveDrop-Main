-- User Onboarding Schema
-- Tracks tour completion, onboarding progress, and dismissed hints for each user

CREATE TABLE IF NOT EXISTS public.user_onboarding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Tour completion flags
  dashboard_tour_completed BOOLEAN DEFAULT FALSE,
  shipment_creation_tour_completed BOOLEAN DEFAULT FALSE,
  tracking_tour_completed BOOLEAN DEFAULT FALSE,
  payment_tour_completed BOOLEAN DEFAULT FALSE,
  admin_tour_completed BOOLEAN DEFAULT FALSE,
  broker_tour_completed BOOLEAN DEFAULT FALSE,
  driver_tour_completed BOOLEAN DEFAULT FALSE,
  
  -- Onboarding checklist progress
  checklist_progress JSONB DEFAULT '{
    "profile_completed": false,
    "payment_method_added": false,
    "first_shipment_created": false,
    "first_shipment_tracked": false,
    "documents_uploaded": false
  }'::jsonb,
  
  -- Dismissed hints/tooltips
  dismissed_hints TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Tour preferences
  show_tours BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON public.user_onboarding(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_onboarding_updated_at
  BEFORE UPDATE ON public.user_onboarding
  FOR EACH ROW
  EXECUTE FUNCTION update_user_onboarding_updated_at();

-- Function to create onboarding record when new user signs up
CREATE OR REPLACE FUNCTION create_user_onboarding_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_onboarding (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create onboarding record for new users
CREATE TRIGGER on_auth_user_created_onboarding
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_onboarding_on_signup();

-- Enable Row Level Security
ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own onboarding data
CREATE POLICY "Users can view own onboarding data"
  ON public.user_onboarding
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own onboarding data
CREATE POLICY "Users can update own onboarding data"
  ON public.user_onboarding
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own onboarding data
CREATE POLICY "Users can insert own onboarding data"
  ON public.user_onboarding
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_onboarding IS 'Stores user onboarding progress, tour completion status, and preferences';
COMMENT ON COLUMN public.user_onboarding.checklist_progress IS 'JSON object tracking onboarding checklist completion';
COMMENT ON COLUMN public.user_onboarding.dismissed_hints IS 'Array of hint IDs that user has dismissed';
