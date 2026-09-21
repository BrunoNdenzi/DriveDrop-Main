create table if not exists public.planner_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_key text not null default 'free' check (plan_key in ('free', 'starter', 'pro')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  payment_failed_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planner_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null check (metric in ('route_created', 'route_optimized', 'route_dispatched')),
  quantity integer not null default 1 check (quantity > 0),
  route_id uuid references public.planner_routes(id) on delete set null,
  idempotency_key text not null unique,
  occurred_at timestamptz not null default now()
);

create table if not exists public.planner_billing_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists planner_usage_user_metric_date_idx
  on public.planner_usage_events (user_id, metric, occurred_at desc);
create index if not exists planner_subscriptions_customer_idx
  on public.planner_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

alter table public.planner_subscriptions enable row level security;
alter table public.planner_usage_events enable row level security;
alter table public.planner_billing_webhook_events enable row level security;

drop policy if exists "Users read own planner subscription" on public.planner_subscriptions;
create policy "Users read own planner subscription"
  on public.planner_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users read own planner usage" on public.planner_usage_events;
create policy "Users read own planner usage"
  on public.planner_usage_events for select
  using (auth.uid() = user_id);

create or replace function public.set_planner_subscription_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists planner_subscriptions_updated_at on public.planner_subscriptions;
create trigger planner_subscriptions_updated_at
before update on public.planner_subscriptions
for each row execute function public.set_planner_subscription_updated_at();