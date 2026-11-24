CREATE TABLE IF NOT EXISTS public.sellbird_accepted_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  email text NOT NULL,
  first_name text,
  last_name text,
  company_name text,
  website_url text,
  accepted_reply text,
  accepted_offer text,
  converted_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sellbird_accepted_leads_email_normalized CHECK (email = lower(email))
);

CREATE INDEX IF NOT EXISTS idx_sellbird_accepted_leads_email
  ON public.sellbird_accepted_leads(email);

CREATE INDEX IF NOT EXISTS idx_sellbird_accepted_leads_conversion
  ON public.sellbird_accepted_leads(converted_user_id)
  WHERE converted_user_id IS NOT NULL;

ALTER TABLE public.sellbird_accepted_leads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.link_sellbird_accepted_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sellbird_accepted_leads
  SET converted_user_id = NEW.id,
      converted_at = COALESCE(converted_at, now())
  WHERE email = lower(NEW.email)
    AND converted_user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_sellbird_accepted_lead_on_profile ON public.profiles;
CREATE TRIGGER link_sellbird_accepted_lead_on_profile
  AFTER INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW
  WHEN (NEW.email IS NOT NULL)
  EXECUTE FUNCTION public.link_sellbird_accepted_lead();

CREATE OR REPLACE FUNCTION public.match_existing_sellbird_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT id INTO NEW.converted_user_id
  FROM public.profiles
  WHERE lower(email) = NEW.email
  LIMIT 1;
  IF NEW.converted_user_id IS NOT NULL THEN
    NEW.converted_at = COALESCE(NEW.converted_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_existing_sellbird_user_on_lead ON public.sellbird_accepted_leads;
CREATE TRIGGER match_existing_sellbird_user_on_lead
  BEFORE INSERT OR UPDATE OF email ON public.sellbird_accepted_leads
  FOR EACH ROW EXECUTE FUNCTION public.match_existing_sellbird_user();
