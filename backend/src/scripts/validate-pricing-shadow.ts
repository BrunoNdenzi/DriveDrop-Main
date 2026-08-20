import { pricingDecisionService } from '@services/pricingDecision.service';
import { supabaseAdmin } from '@lib/supabase';

interface SourceHealth {
  provider?: string;
  status?: string;
  observed_at?: string;
  fresh_until?: string;
  latency_ms?: number;
  error_code?: string | null;
}

async function validatePricingShadow(): Promise<void> {
  let quoteId: string | undefined;

  try {
    const result = await pricingDecisionService.generateQuote({
      vehicleType: 'sedan',
      distanceMiles: 245,
      routeOrigin: 'Charlotte, NC',
      routeDestination: 'Atlanta, GA',
      pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      intelligenceMode: 'shadow',
      logToHistory: true,
      requestSource: 'admin',
      requestId: 'shadow-runtime-validation',
    });
    quoteId = result.quoteId;

    const { data: quote, error } = await supabaseAdmin
      .from('quote_history')
      .select(
        'intelligence_mode, feature_snapshot, intelligence_snapshot, recommendation_snapshot, source_health_snapshot'
      )
      .eq('id', quoteId)
      .single();

    if (error || !quote) {
      throw new Error(`Persisted quote could not be loaded: ${error?.message || 'not found'}`);
    }

    const recommendation = quote.recommendation_snapshot as Record<string, unknown> | null;
    const sourceHealth = quote.source_health_snapshot as Record<string, SourceHealth> | null;
    const baselinePrice = Number(recommendation?.['baseline_price']);
    const customerPrice = Number(recommendation?.['customer_price']);

    if (quote.intelligence_mode !== 'shadow') {
      throw new Error(`Expected shadow mode, received ${String(quote.intelligence_mode)}`);
    }
    if (!quote.feature_snapshot || !quote.intelligence_snapshot || !recommendation || !sourceHealth) {
      throw new Error('One or more required shadow snapshots were not persisted');
    }
    if (result.total !== result.decision.baselinePrice || customerPrice !== baselinePrice) {
      throw new Error('Shadow recommendation changed the customer-facing price');
    }

    const providers = ['traffic', 'tolls', 'weather', 'fuel'] as const;
    for (const provider of providers) {
      if (!sourceHealth[provider]?.status) {
        throw new Error(`Missing source health for ${provider}`);
      }
    }

    console.log(JSON.stringify({
      validation: 'passed',
      quoteId,
      prices: {
        baseline: result.decision.baselinePrice,
        recommended: result.decision.intelligentPrice,
        customer: result.total,
      },
      sources: Object.fromEntries(
        providers.map(provider => [provider, {
          provider: sourceHealth[provider]?.provider,
          status: sourceHealth[provider]?.status,
          latencyMs: sourceHealth[provider]?.latency_ms,
          errorCode: sourceHealth[provider]?.error_code,
        }])
      ),
    }, null, 2));
  } finally {
    if (quoteId) {
      await supabaseAdmin.from('pricing_events').delete().eq('aggregate_id', quoteId);
      await supabaseAdmin.from('quote_history').delete().eq('id', quoteId);
    }
  }
}

validatePricingShadow().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});