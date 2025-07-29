-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.driver_applications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  vehicle_type USER-DEFINED NOT NULL,
  vehicle_make text NOT NULL,
  vehicle_model text NOT NULL,
  vehicle_year integer NOT NULL CHECK (vehicle_year > 1900 AND vehicle_year::numeric <= (EXTRACT(year FROM now()) + 1::numeric)),
  license_number text NOT NULL,
  license_expiry date NOT NULL,
  insurance_provider text NOT NULL,
  insurance_policy_number text NOT NULL,
  insurance_expiry date NOT NULL,
  background_check_status text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT driver_applications_pkey PRIMARY KEY (id),
  CONSTRAINT driver_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.driver_locations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  shipment_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  heading double precision,
  speed double precision,
  accuracy double precision,
  location_timestamp timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT driver_locations_pkey PRIMARY KEY (id),
  CONSTRAINT driver_locations_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id),
  CONSTRAINT driver_locations_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.driver_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL UNIQUE,
  driver_id uuid NOT NULL,
  client_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT driver_ratings_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id),
  CONSTRAINT driver_ratings_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.profiles(id),
  CONSTRAINT driver_ratings_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id)
);
CREATE TABLE public.driver_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL UNIQUE,
  available_for_jobs boolean DEFAULT true,
  notifications_enabled boolean DEFAULT true,
  preferred_radius integer DEFAULT 50,
  allow_location_tracking boolean DEFAULT true,
  preferred_job_types ARRAY DEFAULT ARRAY['standard'::text, 'express'::text],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_settings_pkey PRIMARY KEY (id),
  CONSTRAINT driver_settings_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.job_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])),
  applied_at timestamp with time zone DEFAULT now(),
  responded_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT job_applications_pkey PRIMARY KEY (id),
  CONSTRAINT job_applications_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.profiles(id),
  CONSTRAINT job_applications_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id)
);
CREATE TABLE public.message_read_status (
  id bigint NOT NULL DEFAULT nextval('messages_read_status_id_seq'::regclass),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_read_status_pkey PRIMARY KEY (id),
  CONSTRAINT message_read_status_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id),
  CONSTRAINT message_read_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  shipment_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  receiver_id uuid,
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.notification_preferences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  sms_enabled boolean NOT NULL DEFAULT false,
  shipment_updates boolean NOT NULL DEFAULT true,
  driver_assigned boolean NOT NULL DEFAULT true,
  payment_updates boolean NOT NULL DEFAULT true,
  promotions boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  shipment_id uuid NOT NULL,
  client_id uuid NOT NULL,
  amount numeric NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::payment_status,
  payment_method text,
  payment_intent_id text,
  payment_intent_client_secret text,
  refund_id text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id),
  CONSTRAINT payments_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  avatar_url text,
  role USER-DEFINED NOT NULL DEFAULT 'client'::user_role,
  is_verified boolean NOT NULL DEFAULT false,
  rating numeric CHECK (rating >= 0::numeric AND rating <= 5::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.push_tokens (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  device_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT push_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.shipment_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL,
  status text NOT NULL,
  changed_by uuid NOT NULL,
  changed_at timestamp with time zone DEFAULT now(),
  notes text,
  location_lat numeric,
  location_lng numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT shipment_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT shipment_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id),
  CONSTRAINT shipment_status_history_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id)
);
CREATE TABLE public.shipments (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL,
  driver_id uuid,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::shipment_status,
  title text NOT NULL,
  description text,
  pickup_address text NOT NULL,
  pickup_location USER-DEFINED,
  pickup_notes text,
  pickup_time_window tstzrange,
  delivery_address text NOT NULL,
  delivery_location USER-DEFINED,
  delivery_notes text,
  delivery_time_window tstzrange,
  weight_kg numeric,
  dimensions_cm jsonb,
  item_value numeric,
  is_fragile boolean DEFAULT false,
  estimated_distance_km numeric,
  estimated_price numeric NOT NULL,
  final_price numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  pickup_date timestamp with time zone,
  delivery_date timestamp with time zone,
  pickup_city text,
  pickup_state text,
  pickup_zip text,
  delivery_city text,
  delivery_state text,
  delivery_zip text,
  vehicle_type text,
  cargo_type text,
  distance numeric,
  price numeric,
  weight numeric,
  dimensions text,
  updated_by uuid,
  CONSTRAINT shipments_pkey PRIMARY KEY (id),
  CONSTRAINT shipments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id),
  CONSTRAINT shipments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.profiles(id),
  CONSTRAINT shipments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.tracking_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  shipment_id uuid NOT NULL,
  event_type USER-DEFINED NOT NULL,
  created_by uuid NOT NULL,
  location USER-DEFINED,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tracking_events_pkey PRIMARY KEY (id),
  CONSTRAINT tracking_events_shipment_id_fkey FOREIGN KEY (shipment_id) REFERENCES public.shipments(id),
  CONSTRAINT tracking_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.vehicle_photos (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  driver_application_id uuid NOT NULL,
  photo_url text NOT NULL,
  photo_type text NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_photos_pkey PRIMARY KEY (id),
  CONSTRAINT vehicle_photos_driver_application_id_fkey FOREIGN KEY (driver_application_id) REFERENCES public.driver_applications(id)
);