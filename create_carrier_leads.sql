-- Migration: Create carrier_leads table
-- Stores carrier contact info captured during outbound voice agent recruitment calls.
-- The primary goal of each call is to capture an email for follow-up invites & marketing.
-- Run this in: Supabase SQL Editor → New Query → Run

create table if not exists public.carrier_leads (
  id              uuid          default gen_random_uuid() primary key,
  carrier_phone   text          not null unique,      -- deduplicated by phone
  carrier_email   text,                               -- the main prize — captured during call
  contact_name    text,
  company_name    text,
  fleet_size      int,
  states_served   text,
  vehicle_types   text,                               -- e.g. "open, enclosed, motorcycles"
  interest_level  text          default 'warm'
                  check (interest_level in ('hot','warm','cold')),
  notes           text,
  last_contacted  timestamptz   not null default now(),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

-- Indexes
create index if not exists idx_carrier_leads_phone   on public.carrier_leads (carrier_phone);
create index if not exists idx_carrier_leads_email   on public.carrier_leads (carrier_email) where carrier_email is not null;
create index if not exists idx_carrier_leads_interest on public.carrier_leads (interest_level);

-- RLS: only admins can read/write
alter table public.carrier_leads enable row level security;

create policy "Admins can manage carrier leads"
  on public.carrier_leads
  for all
  to authenticated
  using  ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Allow the service role (backend) to bypass RLS
-- (supabaseAdmin uses the service_role key, which skips RLS automatically)

comment on table public.carrier_leads is
  'Carrier contact records captured by the AI voice agent during outbound recruitment calls. carrier_email is the primary capture target for follow-up email campaigns.';
comment on column public.carrier_leads.carrier_email   is 'Email captured during the call — used for invite emails, load alerts, and newsletter.';
comment on column public.carrier_leads.interest_level  is 'hot = ready to sign up, warm = open/sent link, cold = not interested but gave contact.';
