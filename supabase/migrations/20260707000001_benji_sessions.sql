-- Benji persistent session storage
-- Replaces the in-process V3SessionStore so sessions survive server restarts.
-- All channels (web, mobile, sms, voice) share this table.

create table public.benji_sessions (
  session_id     text primary key,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  user_type      text not null,
  channel        text not null default 'web' check (channel in ('web','mobile','sms','voice')),
  phone_number   text,                    -- E.164, set when channel = 'sms'
  messages       jsonb not null default '[]'::jsonb,
  context        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  last_active    timestamptz not null default now(),
  expires_at     timestamptz not null
);

create index benji_sessions_user_id_idx on public.benji_sessions (user_id);
create index benji_sessions_phone_idx   on public.benji_sessions (phone_number) where phone_number is not null;
create index benji_sessions_expires_idx on public.benji_sessions (expires_at);

-- Service-role only; backend always accesses via supabaseAdmin.
-- No RLS policies added on purpose — only the service role key can touch this table.
alter table public.benji_sessions enable row level security;

-- Cleanup helper: call periodically (cron or backend timer) to prevent unbounded growth.
create or replace function public.cleanup_expired_benji_sessions()
returns void
language sql
security definer
as $$
  delete from public.benji_sessions where expires_at < now();
$$;
