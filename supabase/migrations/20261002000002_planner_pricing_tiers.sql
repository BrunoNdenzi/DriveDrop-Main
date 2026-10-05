-- Route planner pricing tiers: Solo, Team and Business join Free. Starter and Pro stay valid so
-- existing subscribers keep their plan and price; they are simply no longer sold.
DO $$
DECLARE
  existing_check text;
BEGIN
  FOR existing_check IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.planner_subscriptions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%plan_key%'
  LOOP
    EXECUTE format('ALTER TABLE public.planner_subscriptions DROP CONSTRAINT %I', existing_check);
  END LOOP;
END $$;

ALTER TABLE public.planner_subscriptions
  ADD CONSTRAINT planner_subscriptions_plan_key_check
  CHECK (plan_key IN ('free', 'solo', 'team', 'business', 'starter', 'pro'));
