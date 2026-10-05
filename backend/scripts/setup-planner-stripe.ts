import fs from 'node:fs';
import path from 'node:path';
import Stripe from 'stripe';
import config from '@config';

// Creates (or reuses) one Route Planner product per plan with a monthly price, plus a customer-portal
// configuration that lets subscribers switch between them. Safe to run more than once.
//   test key:  ts-node -r tsconfig-paths/register scripts/setup-planner-stripe.ts [--write-env]
//   live key:  add --confirm-live (prints the values; set them on the host yourself)
const PLANS = [
  { key: 'solo', name: 'Solo', amount: 1900, env: 'STRIPE_PRICE_ID_PLANNER_SOLO' },
  { key: 'team', name: 'Team', amount: 4900, env: 'STRIPE_PRICE_ID_PLANNER_TEAM' },
  { key: 'business', name: 'Business', amount: 9900, env: 'STRIPE_PRICE_ID_PLANNER_BUSINESS' },
] as const;

const PRODUCT_TAG = 'route_planner';
const PORTAL_ENV = 'STRIPE_PORTAL_CONFIGURATION_PLANNER';
const lookupKey = (key: string) => `planner_${key}_monthly`;

async function activeProducts(stripe: Stripe): Promise<Stripe.Product[]> {
  const products: Stripe.Product[] = [];
  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (product.metadata?.['drivedrop_product'] === PRODUCT_TAG) products.push(product);
  }
  return products;
}

async function ensurePlan(stripe: Stripe, plan: (typeof PLANS)[number], products: Stripe.Product[]) {
  const product = products.find(item => item.metadata?.['plan_key'] === plan.key)
    ?? await stripe.products.create({
      name: `DriveDrop Route Planner ${plan.name}`,
      description: 'Route optimization, live tracking and driver management.',
      metadata: { drivedrop_product: PRODUCT_TAG, plan_key: plan.key },
    });

  const prices = await stripe.prices.list({ lookup_keys: [lookupKey(plan.key)], active: true, limit: 1 });
  const current = prices.data[0];
  const usable = current
    && current.product === product.id
    && current.unit_amount === plan.amount
    && current.currency === 'usd'
    && current.recurring?.interval === 'month';
  if (usable) return { product, price: current };

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: plan.amount,
    recurring: { interval: 'month' },
    nickname: `Route Planner ${plan.name}`,
    lookup_key: lookupKey(plan.key),
    transfer_lookup_key: true,
    metadata: { plan_key: plan.key },
  });
  if (current) await stripe.prices.update(current.id, { active: false });
  return { product, price };
}

function writeEnv(values: Record<string, string>): void {
  const file = path.resolve(__dirname, '../.env');
  let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  for (const [name, value] of Object.entries(values)) {
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    content = pattern.test(content) ? content.replace(pattern, line) : `${content.replace(/\s*$/, '')}\n${line}\n`;
  }
  fs.writeFileSync(file, content);
}

async function main(): Promise<void> {
  const secret = config.stripe.secretKey;
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not set');
  const live = secret.startsWith('sk_live_');
  if (live && !process.argv.includes('--confirm-live')) {
    throw new Error('This is a LIVE Stripe key. Re-run with --confirm-live to create live prices.');
  }
  if (live && process.argv.includes('--write-env')) {
    throw new Error('--write-env is for test keys only. Set live values on your host instead.');
  }

  const stripe = new Stripe(secret);
  console.log(`Stripe mode: ${live ? 'LIVE' : 'test'}`);

  const products = await activeProducts(stripe);
  const planned = [];
  for (const plan of PLANS) planned.push({ plan, ...await ensurePlan(stripe, plan, products) });

  // An earlier layout put all three prices on one product, which the portal cannot switch between.
  const keep = new Set(planned.map(item => item.product.id));
  for (const product of products) {
    if (!keep.has(product.id) && !product.metadata?.['plan_key']) await stripe.products.update(product.id, { active: false });
  }

  const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
    customer_update: { enabled: true, allowed_updates: ['email', 'name', 'address', 'phone'] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations',
      products: planned.map(item => ({ product: item.product.id, prices: [item.price.id] })),
    },
  };
  const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const portal = configurations.data.find(item => item.metadata?.['drivedrop_product'] === PRODUCT_TAG);
  const portalConfig = portal
    ? await stripe.billingPortal.configurations.update(portal.id, { features })
    : await stripe.billingPortal.configurations.create({
      features,
      business_profile: { headline: 'Manage your DriveDrop Route Planner plan' },
      metadata: { drivedrop_product: PRODUCT_TAG },
    });

  const values: Record<string, string> = Object.fromEntries(planned.map(item => [item.plan.env, item.price.id]));
  values[PORTAL_ENV] = portalConfig.id;

  console.log(`Portal configuration: ${portalConfig.id} (plan switching enabled for Solo, Team and Business)`);
  console.log('\nSet these on the backend host:');
  for (const [name, value] of Object.entries(values)) console.log(`${name}=${value}`);

  if (process.argv.includes('--write-env')) {
    writeEnv(values);
    console.log('\nWrote the values to backend/.env.');
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
