import Stripe from 'stripe';
import config from '@config';
import { supabaseAdmin } from '@lib/supabase';
import { createError } from '@utils/error';

export type PlannerPlanKey = 'free' | 'starter' | 'pro';

export interface PlannerPlan {
  key: PlannerPlanKey;
  name: string;
  monthlyRoutes: number | null;
  maxStopsPerRoute: number;
  recurringRoutes: boolean;
  routeSharing: boolean;
}

interface BillingRecord {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan_key: PlannerPlanKey;
  status: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  payment_failed_at: string | null;
  locked_at: string | null;
}

const TRIAL_DAYS = 14;
const plans: Record<PlannerPlanKey, PlannerPlan> = {
  free: { key: 'free', name: 'Free', monthlyRoutes: 5, maxStopsPerRoute: 10, recurringRoutes: false, routeSharing: false },
  starter: { key: 'starter', name: 'Starter', monthlyRoutes: 100, maxStopsPerRoute: 50, recurringRoutes: true, routeSharing: true },
  pro: { key: 'pro', name: 'Pro', monthlyRoutes: null, maxStopsPerRoute: 100, recurringRoutes: true, routeSharing: true },
};

function isoFromEpoch(value: number | null | undefined): string | null {
  return typeof value === 'number' ? new Date(value * 1000).toISOString() : null;
}

function pricePlan(priceId: string | null | undefined): PlannerPlanKey {
  if (priceId && priceId === config.stripe.priceIdPremium) return 'pro';
  if (priceId && priceId === config.stripe.priceIdBasic) return 'starter';
  return 'free';
}

function subscriptionPeriod(subscription: Stripe.Subscription): { start: string | null; end: string | null } {
  const period = subscription as Stripe.Subscription & { current_period_start?: number; current_period_end?: number };
  const item = subscription.items.data[0] as (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number }) | undefined;
  return {
    start: isoFromEpoch(period.current_period_start ?? item?.current_period_start),
    end: isoFromEpoch(period.current_period_end ?? item?.current_period_end),
  };
}

async function billingByUser(userId: string): Promise<BillingRecord | null> {
  const { data, error } = await supabaseAdmin.from('planner_subscriptions').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw createError(error.message, 500, 'BILLING_READ_FAILED');
  return data as BillingRecord | null;
}

async function ensureAccount(userId: string): Promise<BillingRecord> {
  const existing = await billingByUser(userId);
  if (existing) {
    if (existing.status === 'trialing' && existing.trial_ends_at && new Date(existing.trial_ends_at) <= new Date() && !existing.stripe_subscription_id) {
      const { data, error } = await supabaseAdmin.from('planner_subscriptions').update({ status: 'active', plan_key: 'free' }).eq('user_id', userId).select('*').single();
      if (error) throw createError(error.message, 500, 'TRIAL_EXPIRY_UPDATE_FAILED');
      return data as BillingRecord;
    }
    return existing;
  }
  const started = new Date();
  const ends = new Date(started.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await supabaseAdmin.from('planner_subscriptions').insert({
    user_id: userId,
    plan_key: 'starter',
    status: 'trialing',
    trial_started_at: started.toISOString(),
    trial_ends_at: ends.toISOString(),
  }).select('*').single();
  if (error) throw createError(error.message, 500, 'BILLING_CREATE_FAILED');
  return data as BillingRecord;
}

function effectivePlan(record: BillingRecord): PlannerPlanKey {
  if (record.locked_at || ['past_due', 'unpaid', 'incomplete_expired', 'paused'].includes(record.status)) return 'free';
  if (record.status === 'trialing' && record.trial_ends_at && new Date(record.trial_ends_at) <= new Date()) return 'free';
  if (['canceled', 'incomplete'].includes(record.status)) return 'free';
  return record.plan_key;
}

async function monthlyUsage(userId: string, metric: string): Promise<number> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data, error } = await supabaseAdmin.from('planner_usage_events').select('quantity').eq('user_id', userId).eq('metric', metric).gte('occurred_at', start);
  if (error) throw createError(error.message, 500, 'USAGE_READ_FAILED');
  return (data ?? []).reduce((total: number, event: { quantity: number }) => total + Number(event.quantity), 0);
}

export const plannerBillingService = {
  plans,

  async getStatus(userId: string) {
    const billing = await ensureAccount(userId);
    const plan = plans[effectivePlan(billing)];
    const routesUsed = await monthlyUsage(userId, 'route_created');
    return {
      plan,
      status: billing.status,
      isLocked: Boolean(billing.locked_at) || ['past_due', 'unpaid', 'incomplete_expired', 'paused'].includes(billing.status),
      trialEndsAt: billing.trial_ends_at,
      currentPeriodEnd: billing.current_period_end,
      cancelAtPeriodEnd: billing.cancel_at_period_end,
      stripeCustomerId: billing.stripe_customer_id,
      stripeSubscriptionId: billing.stripe_subscription_id,
      usage: { routesUsed, routesLimit: plan.monthlyRoutes },
    };
  },

  async assertCustomerOwner(userId: string, customerId: string): Promise<void> {
    const billing = await ensureAccount(userId);
    if (billing.stripe_customer_id !== customerId) throw createError('Stripe customer does not belong to this user', 403, 'FORBIDDEN');
  },

  async assertSubscriptionOwner(userId: string, subscriptionId: string): Promise<void> {
    const billing = await ensureAccount(userId);
    if (billing.stripe_subscription_id !== subscriptionId) throw createError('Subscription does not belong to this user', 403, 'FORBIDDEN');
  },

  async saveCustomer(userId: string, customerId: string): Promise<void> {
    await ensureAccount(userId);
    const { error } = await supabaseAdmin.from('planner_subscriptions').update({ stripe_customer_id: customerId }).eq('user_id', userId);
    if (error) throw createError(error.message, 500, 'BILLING_CUSTOMER_SAVE_FAILED');
  },

  async assertRouteAllowed(userId: string, stopCount?: number, recurring = false): Promise<void> {
    const status = await this.getStatus(userId);
    if (status.isLocked) throw createError('Billing is past due. Update payment details to continue planning routes.', 402, 'BILLING_LOCKED');
    if (stopCount !== undefined && stopCount > status.plan.maxStopsPerRoute) {
      throw createError(`${status.plan.name} supports up to ${status.plan.maxStopsPerRoute} stops per route`, 402, 'PLAN_LIMIT_EXCEEDED');
    }
    if (recurring && !status.plan.recurringRoutes) throw createError('Recurring routes require Starter or Pro', 402, 'UPGRADE_REQUIRED');
  },

  async assertRouteCreationAllowed(userId: string, stopCount: number, recurring: boolean): Promise<void> {
    await this.assertRouteAllowed(userId, stopCount, recurring);
    const status = await this.getStatus(userId);
    if (status.plan.monthlyRoutes !== null && status.usage.routesUsed >= status.plan.monthlyRoutes) {
      throw createError(`Monthly route limit reached for ${status.plan.name}`, 402, 'PLAN_LIMIT_EXCEEDED');
    }
  },

  async assertSharingAllowed(userId: string): Promise<void> {
    const status = await this.getStatus(userId);
    if (status.isLocked) throw createError('Billing is past due. Update payment details to continue.', 402, 'BILLING_LOCKED');
    if (!status.plan.routeSharing) throw createError('Route sharing requires Starter or Pro', 402, 'UPGRADE_REQUIRED');
  },

  async recordUsage(userId: string, metric: 'route_created' | 'route_optimized' | 'route_dispatched', routeId: string, idempotencyKey: string): Promise<void> {
    const { error } = await supabaseAdmin.from('planner_usage_events').upsert({
      user_id: userId,
      metric,
      route_id: routeId,
      idempotency_key: idempotencyKey,
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true });
    if (error) throw createError(error.message, 500, 'USAGE_WRITE_FAILED');
  },

  async webhookProcessed(eventId: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.from('planner_billing_webhook_events').select('stripe_event_id').eq('stripe_event_id', eventId).maybeSingle();
    if (error) throw createError(error.message, 500, 'WEBHOOK_EVENT_READ_FAILED');
    return Boolean(data);
  },

  async markWebhookProcessed(eventId: string, eventType: string): Promise<void> {
    const { error } = await supabaseAdmin.from('planner_billing_webhook_events').upsert({ stripe_event_id: eventId, event_type: eventType });
    if (error) throw createError(error.message, 500, 'WEBHOOK_EVENT_WRITE_FAILED');
  },

  async syncSubscription(subscription: Stripe.Subscription): Promise<void> {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
    const priceId = subscription.items.data[0]?.price.id ?? null;
    const period = subscriptionPeriod(subscription);
    const locked = ['past_due', 'unpaid', 'incomplete_expired', 'paused'].includes(subscription.status);
    const subscriptionData = {
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan_key: pricePlan(priceId),
      status: subscription.status,
      trial_started_at: isoFromEpoch(subscription.trial_start),
      trial_ends_at: isoFromEpoch(subscription.trial_end),
      current_period_start: period.start,
      current_period_end: period.end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      locked_at: locked ? new Date().toISOString() : null,
    };
    const { data, error } = await supabaseAdmin.from('planner_subscriptions').update(subscriptionData).eq('stripe_customer_id', customerId).select('user_id').maybeSingle();
    if (error) throw createError(error.message, 500, 'SUBSCRIPTION_SYNC_FAILED');
    if (!data && subscription.metadata['user_id']) {
      const { error: fallbackError } = await supabaseAdmin.from('planner_subscriptions').upsert({
        user_id: subscription.metadata['user_id'],
        stripe_customer_id: customerId,
        ...subscriptionData,
      }, { onConflict: 'user_id' });
      if (fallbackError) throw createError(fallbackError.message, 500, 'SUBSCRIPTION_SYNC_FAILED');
    }
  },

  async recordInvoiceResult(invoice: Stripe.Invoice, succeeded: boolean): Promise<void> {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;
    const { error } = await supabaseAdmin.from('planner_subscriptions').update(succeeded ? {
      status: 'active',
      payment_failed_at: null,
      locked_at: null,
    } : {
      status: 'past_due',
      payment_failed_at: new Date().toISOString(),
      locked_at: new Date().toISOString(),
    }).eq('stripe_customer_id', customerId);
    if (error) throw createError(error.message, 500, 'INVOICE_SYNC_FAILED');
  },
};