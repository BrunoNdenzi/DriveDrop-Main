-- SQL queries to create missing tables for driver and client profile functionality

-- Create driver_security_settings table
CREATE TABLE IF NOT EXISTS public.driver_security_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    biometric_enabled BOOLEAN DEFAULT FALSE,
    location_sharing_enabled BOOLEAN DEFAULT TRUE,
    data_analytics_enabled BOOLEAN DEFAULT TRUE,
    marketing_emails_enabled BOOLEAN DEFAULT FALSE,
    push_notifications_enabled BOOLEAN DEFAULT TRUE,
    emergency_contacts_enabled BOOLEAN DEFAULT TRUE,
    trip_history_visibility TEXT DEFAULT 'limited' CHECK (trip_history_visibility IN ('public', 'limited', 'private')),
    profile_visibility TEXT DEFAULT 'limited' CHECK (profile_visibility IN ('public', 'limited', 'private')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(driver_id)
);

-- Create driver_privacy_preferences table
CREATE TABLE IF NOT EXISTS public.driver_privacy_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    share_location_with_customers BOOLEAN DEFAULT TRUE,
    share_phone_with_customers BOOLEAN DEFAULT FALSE,
    allow_rating_and_reviews BOOLEAN DEFAULT TRUE,
    data_retention_period TEXT DEFAULT '2years' CHECK (data_retention_period IN ('1year', '2years', '5years', 'indefinite')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(driver_id)
);

-- Create client_settings table
CREATE TABLE IF NOT EXISTS public.client_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    auto_quotes BOOLEAN DEFAULT TRUE,
    preferred_communication TEXT DEFAULT 'email' CHECK (preferred_communication IN ('email', 'sms', 'push')),
    quote_notifications BOOLEAN DEFAULT TRUE,
    shipment_updates BOOLEAN DEFAULT TRUE,
    promotional_offers BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id)
);

-- Create client_addresses table
CREATE TABLE IF NOT EXISTS public.client_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- e.g., 'Home', 'Work', 'Warehouse'
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    country TEXT DEFAULT 'United States',
    is_default BOOLEAN DEFAULT FALSE,
    is_pickup_location BOOLEAN DEFAULT TRUE,
    is_delivery_location BOOLEAN DEFAULT TRUE,
    contact_name TEXT,
    contact_phone TEXT,
    special_instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create client_payment_methods table
CREATE TABLE IF NOT EXISTS public.client_payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('credit_card', 'debit_card', 'bank_account', 'paypal')),
    provider TEXT NOT NULL, -- e.g., 'stripe', 'paypal'
    provider_payment_method_id TEXT NOT NULL, -- External payment method ID
    last_four TEXT, -- Last 4 digits for display
    card_brand TEXT, -- e.g., 'visa', 'mastercard'
    expiry_month INTEGER,
    expiry_year INTEGER,
    is_default BOOLEAN DEFAULT FALSE,
    billing_address JSONB, -- Store billing address details
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('technical', 'account', 'payment', 'general', 'shipping', 'billing')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    assigned_to UUID REFERENCES auth.users(id),
    shipment_id UUID REFERENCES shipments(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create driver_vehicles table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.driver_vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    color TEXT NOT NULL,
    license_plate TEXT NOT NULL,
    vehicle_type TEXT DEFAULT 'standard' CHECK (vehicle_type IN ('standard', 'large', 'refrigerated', 'hazmat')),
    capacity_weight DECIMAL,
    capacity_volume DECIMAL,
    insurance_provider TEXT,
    insurance_policy_number TEXT,
    insurance_expiry_date DATE,
    registration_number TEXT,
    registration_expiry_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(driver_id, license_plate)
);

-- Create avatars storage bucket (this needs to be run in the Supabase dashboard SQL editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the new tables

-- Enable RLS on all tables
ALTER TABLE public.driver_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_privacy_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_vehicles ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_security_settings (create only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_security_settings' AND policyname = 'Users can view their own security settings') THEN
        CREATE POLICY "Users can view their own security settings" ON public.driver_security_settings
            FOR SELECT USING (auth.uid() = driver_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_security_settings' AND policyname = 'Users can insert their own security settings') THEN
        CREATE POLICY "Users can insert their own security settings" ON public.driver_security_settings
            FOR INSERT WITH CHECK (auth.uid() = driver_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_security_settings' AND policyname = 'Users can update their own security settings') THEN
        CREATE POLICY "Users can update their own security settings" ON public.driver_security_settings
            FOR UPDATE USING (auth.uid() = driver_id);
    END IF;
END $$;

-- RLS policies for driver_privacy_preferences (create only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_privacy_preferences' AND policyname = 'Users can view their own privacy preferences') THEN
        CREATE POLICY "Users can view their own privacy preferences" ON public.driver_privacy_preferences
            FOR SELECT USING (auth.uid() = driver_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_privacy_preferences' AND policyname = 'Users can insert their own privacy preferences') THEN
        CREATE POLICY "Users can insert their own privacy preferences" ON public.driver_privacy_preferences
            FOR INSERT WITH CHECK (auth.uid() = driver_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_privacy_preferences' AND policyname = 'Users can update their own privacy preferences') THEN
        CREATE POLICY "Users can update their own privacy preferences" ON public.driver_privacy_preferences
            FOR UPDATE USING (auth.uid() = driver_id);
    END IF;
END $$;

-- RLS policies for client_settings (create only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_settings' AND policyname = 'Users can view their own client settings') THEN
        CREATE POLICY "Users can view their own client settings" ON public.client_settings
            FOR SELECT USING (auth.uid() = client_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_settings' AND policyname = 'Users can insert their own client settings') THEN
        CREATE POLICY "Users can insert their own client settings" ON public.client_settings
            FOR INSERT WITH CHECK (auth.uid() = client_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_settings' AND policyname = 'Users can update their own client settings') THEN
        CREATE POLICY "Users can update their own client settings" ON public.client_settings
            FOR UPDATE USING (auth.uid() = client_id);
    END IF;
END $$;

-- RLS policies for client_addresses (create only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_addresses' AND policyname = 'Users can view their own addresses') THEN
        CREATE POLICY "Users can view their own addresses" ON public.client_addresses
            FOR SELECT USING (auth.uid() = client_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_addresses' AND policyname = 'Users can insert their own addresses') THEN
        CREATE POLICY "Users can insert their own addresses" ON public.client_addresses
            FOR INSERT WITH CHECK (auth.uid() = client_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_addresses' AND policyname = 'Users can update their own addresses') THEN
        CREATE POLICY "Users can update their own addresses" ON public.client_addresses
            FOR UPDATE USING (auth.uid() = client_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_addresses' AND policyname = 'Users can delete their own addresses') THEN
        CREATE POLICY "Users can delete their own addresses" ON public.client_addresses
            FOR DELETE USING (auth.uid() = client_id);
    END IF;
END $$;

-- RLS policies for client_payment_methods (create only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_payment_methods' AND policyname = 'Users can view their own payment methods') THEN
        CREATE POLICY "Users can view their own payment methods" ON public.client_payment_methods
            FOR SELECT USING (auth.uid() = client_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_payment_methods' AND policyname = 'Users can insert their own payment methods') THEN
        CREATE POLICY "Users can insert their own payment methods" ON public.client_payment_methods
            FOR INSERT WITH CHECK (auth.uid() = client_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_payment_methods' AND policyname = 'Users can update their own payment methods') THEN
        CREATE POLICY "Users can update their own payment methods" ON public.client_payment_methods
            FOR UPDATE USING (auth.uid() = client_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'client_payment_methods' AND policyname = 'Users can delete their own payment methods') THEN
        CREATE POLICY "Users can delete their own payment methods" ON public.client_payment_methods
            FOR DELETE USING (auth.uid() = client_id);
    END IF;
END $$;

-- RLS policies for support_tickets (create only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users can view their own support tickets') THEN
        CREATE POLICY "Users can view their own support tickets" ON public.support_tickets
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users can create their own support tickets') THEN
        CREATE POLICY "Users can create their own support tickets" ON public.support_tickets
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users can update their own support tickets') THEN
        CREATE POLICY "Users can update their own support tickets" ON public.support_tickets
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- RLS policies for driver_vehicles (create only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_vehicles' AND policyname = 'Users can view their own vehicles') THEN
        CREATE POLICY "Users can view their own vehicles" ON public.driver_vehicles
            FOR SELECT USING (auth.uid() = driver_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_vehicles' AND policyname = 'Users can insert their own vehicles') THEN
        CREATE POLICY "Users can insert their own vehicles" ON public.driver_vehicles
            FOR INSERT WITH CHECK (auth.uid() = driver_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_vehicles' AND policyname = 'Users can update their own vehicles') THEN
        CREATE POLICY "Users can update their own vehicles" ON public.driver_vehicles
            FOR UPDATE USING (auth.uid() = driver_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'driver_vehicles' AND policyname = 'Users can delete their own vehicles') THEN
        CREATE POLICY "Users can delete their own vehicles" ON public.driver_vehicles
            FOR DELETE USING (auth.uid() = driver_id);
    END IF;
END $$;

-- Storage policies for avatars bucket (create only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Avatar images are publicly accessible') THEN
        CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
            FOR SELECT USING (bucket_id = 'avatars');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can upload their own avatar') THEN
        CREATE POLICY "Users can upload their own avatar" ON storage.objects
            FOR INSERT WITH CHECK (
                bucket_id = 'avatars' 
                AND auth.role() = 'authenticated'
                AND (storage.foldername(name))[1] = auth.uid()::text
            );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can update their own avatar') THEN
        CREATE POLICY "Users can update their own avatar" ON storage.objects
            FOR UPDATE USING (
                bucket_id = 'avatars' 
                AND auth.role() = 'authenticated'
                AND (storage.foldername(name))[1] = auth.uid()::text
            );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Users can delete their own avatar') THEN
        CREATE POLICY "Users can delete their own avatar" ON storage.objects
            FOR DELETE USING (
                bucket_id = 'avatars' 
                AND auth.role() = 'authenticated'
                AND (storage.foldername(name))[1] = auth.uid()::text
            );
    END IF;
END $$;

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables (with existence checks)
DO $$
BEGIN
    -- Trigger for driver_security_settings
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_updated_at_driver_security_settings') THEN
        CREATE TRIGGER handle_updated_at_driver_security_settings
            BEFORE UPDATE ON public.driver_security_settings
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    -- Trigger for driver_privacy_preferences
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_updated_at_driver_privacy_preferences') THEN
        CREATE TRIGGER handle_updated_at_driver_privacy_preferences
            BEFORE UPDATE ON public.driver_privacy_preferences
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    -- Trigger for client_settings
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_updated_at_client_settings') THEN
        CREATE TRIGGER handle_updated_at_client_settings
            BEFORE UPDATE ON public.client_settings
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    -- Trigger for client_addresses
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_updated_at_client_addresses') THEN
        CREATE TRIGGER handle_updated_at_client_addresses
            BEFORE UPDATE ON public.client_addresses
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    -- Trigger for client_payment_methods
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_updated_at_client_payment_methods') THEN
        CREATE TRIGGER handle_updated_at_client_payment_methods
            BEFORE UPDATE ON public.client_payment_methods
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    -- Trigger for support_tickets
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_updated_at_support_tickets') THEN
        CREATE TRIGGER handle_updated_at_support_tickets
            BEFORE UPDATE ON public.support_tickets
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
    END IF;

    -- Trigger for driver_vehicles
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_updated_at_driver_vehicles') THEN
        CREATE TRIGGER handle_updated_at_driver_vehicles
            BEFORE UPDATE ON public.driver_vehicles
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_settings_client_id ON public.client_settings(client_id);
CREATE INDEX IF NOT EXISTS idx_client_addresses_client_id ON public.client_addresses(client_id);
CREATE INDEX IF NOT EXISTS idx_client_payment_methods_client_id ON public.client_payment_methods(client_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_driver_vehicles_driver_id ON public.driver_vehicles(driver_id);