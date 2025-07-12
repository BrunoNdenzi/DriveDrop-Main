-- Updated trigger function with better error handling and debugging
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_first_name text;
  user_last_name text;
  user_role text;
  user_phone text;
BEGIN
  -- Extract metadata with better error handling
  user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  user_phone := NEW.raw_user_meta_data->>'phone';

  -- Insert into profiles table
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    email,
    role,
    phone,
    avatar_url,
    is_verified,
    rating,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    user_first_name,
    user_last_name,
    NEW.email,
    user_role::text,
    user_phone,
    NULL, -- avatar_url
    false, -- is_verified
    null, -- rating
    NOW(),
    NOW()
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't prevent user creation
    RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Drop and recreate the trigger to ensure it's fresh
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
