-- Extend profiles with phone verification timestamp and guest flag.
-- These two concepts are distinct — do not conflate them:
--   is_guest          → auto-created from a cold inbound SMS (no prior account)
--   phone_verified_at → set when the user completes a Twilio Verify OTP challenge

alter table public.profiles
  add column if not exists phone_verified_at timestamptz,
  add column if not exists is_guest boolean not null default false;

-- Enforce uniqueness only among verified phones so unverified/null values don't collide.
create unique index if not exists profiles_verified_phone_unique
  on public.profiles (phone)
  where phone_verified_at is not null;
