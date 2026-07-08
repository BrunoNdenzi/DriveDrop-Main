-- Support escalation records created when a user sends HELP or Benji
-- cannot handle a message confidently.

create table public.support_escalations (
  id                 uuid primary key default gen_random_uuid(),
  session_id         text,
  user_id            uuid references public.profiles(id) on delete set null,
  phone_number       text,
  reason             text not null,
  transcript_snippet text,
  created_at         timestamptz not null default now(),
  resolved           boolean not null default false
);

create index support_escalations_user_id_idx  on public.support_escalations (user_id);
create index support_escalations_unresolved   on public.support_escalations (created_at) where resolved = false;
