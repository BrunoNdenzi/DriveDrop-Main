-- Migration: Create carrier_call_logs table
-- Stores outcomes of outbound voice agent carrier recruitment calls
-- Run this in: Supabase SQL Editor → New Query → Run

create table if not exists public.carrier_call_logs (
  id             uuid          default gen_random_uuid() primary key,
  carrier_phone  text          not null,
  outcome        text          not null check (outcome in ('interested','not_interested','callback_requested','no_answer','voicemail','sent_link')),
  notes          text,
  callback_date  timestamptz,
  fleet_size     int,
  states_served  text,
  called_at      timestamptz   not null default now(),
  created_at     timestamptz   not null default now()
);

-- Index for quick lookup by phone and outcome
create index if not exists idx_carrier_call_logs_phone   on public.carrier_call_logs (carrier_phone);
create index if not exists idx_carrier_call_logs_outcome on public.carrier_call_logs (outcome);
create index if not exists idx_carrier_call_logs_called  on public.carrier_call_logs (called_at desc);

-- RLS: only admins can read/write
alter table public.carrier_call_logs enable row level security;

create policy "Admins can manage carrier call logs"
  on public.carrier_call_logs
  for all
  to authenticated
  using  ((select role from public.profiles where id = auth.uid()) = 'admin')
  with check ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Comment
comment on table public.carrier_call_logs is
  'Logs outcomes of outbound AI voice agent calls to FMCSA-registered carriers for recruitment.';
