-- Migration: Create voice_call_logs table
-- Stores all inbound and outbound Vapi voice agent call records (transcripts, costs, duration)
-- Run this in: Supabase SQL Editor → New Query → Run

create table if not exists public.voice_call_logs (
  id               uuid          default gen_random_uuid() primary key,
  vapi_call_id     text          unique,
  direction        text          check (direction in ('inbound', 'outbound')),
  -- 'client_support' | 'carrier_recruitment' | 'dispatch_notification' | 'driver_support' | 'admin_ops'
  call_type        text,
  caller_phone     text,
  duration_seconds int,
  ended_reason     text,
  cost_usd         numeric(10, 4),
  transcript       text,
  summary          text,
  recording_url    text,
  metadata         jsonb         not null default '{}',
  started_at       timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz   not null default now()
);

-- Indexes for common query patterns
create index if not exists idx_voice_call_logs_vapi_id  on public.voice_call_logs (vapi_call_id);
create index if not exists idx_voice_call_logs_phone    on public.voice_call_logs (caller_phone);
create index if not exists idx_voice_call_logs_type     on public.voice_call_logs (call_type);
create index if not exists idx_voice_call_logs_created  on public.voice_call_logs (created_at desc);
create index if not exists idx_voice_call_logs_dir      on public.voice_call_logs (direction);

-- RLS: admins can read all logs; backend uses service role key (bypasses RLS)
alter table public.voice_call_logs enable row level security;

create policy "Admins can read all call logs"
  on public.voice_call_logs
  for select
  to authenticated
  using ((select role from public.profiles where id = auth.uid()) = 'admin');

-- Service role (backend) inserts via supabaseAdmin — no insert policy needed for authenticated users

comment on table public.voice_call_logs is
  'Records every inbound and outbound Vapi voice agent call: transcript, duration, cost, ended reason.';

comment on column public.voice_call_logs.vapi_call_id   is 'Vapi call UUID — use for Vapi API lookups';
comment on column public.voice_call_logs.call_type      is 'Persona/campaign: client_support, carrier_recruitment, dispatch_notification, driver_support, admin_ops';
comment on column public.voice_call_logs.ended_reason   is 'Vapi ended reason: customer-ended-call, assistant-ended-call, silence-timeout, etc.';
comment on column public.voice_call_logs.metadata       is 'Vapi call metadata (campaign, shipment_id, company_name, state, etc.)';
