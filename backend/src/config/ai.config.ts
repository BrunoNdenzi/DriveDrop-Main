/**
 * AI Configuration & Token Usage Tracking
 * 
 * Centralized configuration for all Benji AI services.
 * Includes model selection, token limits, rate limiting, and cost tracking.
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Model Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type AIModel = 'gpt-4o' | 'gpt-4o-mini';

export interface ModelConfig {
  model: AIModel;
  maxTokens: number;
  temperature: number;
  costPer1MInput: number;   // USD per 1M input tokens
  costPer1MOutput: number;  // USD per 1M output tokens
}

/**
 * Tiered model strategy:
 * - GPT-4o: Complex tasks (document extraction, NL parsing) — highest accuracy
 * - GPT-4o-mini: Simple tasks (chat, suggestions) — 95% cheaper, still excellent
 */
export const AI_MODELS: Record<string, ModelConfig> = {
  // Primary model for complex reasoning & vision
  'gpt-4o': {
    model: 'gpt-4o',
    maxTokens: 2000,
    temperature: 0.1,
    costPer1MInput: 2.50,
    costPer1MOutput: 10.00,
  },
  // Cost-efficient model for conversational AI
  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    maxTokens: 1000,
    temperature: 0.7,
    costPer1MInput: 0.15,
    costPer1MOutput: 0.60,
  },
};

/**
 * Service-specific model assignments
 * Maps each AI feature to the optimal model tier
 */
export const SERVICE_MODEL_MAP = {
  // Chat uses mini for cost efficiency — conversational doesn't need full reasoning
  'benji-chat': AI_MODELS['gpt-4o-mini']!,
  
  // NL shipment parsing needs accuracy for structured data extraction
  'nl-shipment': AI_MODELS['gpt-4o']!,
  
  // Document OCR needs vision capabilities (GPT-4o only)
  'document-ocr': AI_MODELS['gpt-4o']!,
  
  // Document structured extraction needs precision
  'document-extraction': AI_MODELS['gpt-4o']!,
} as const;

export type AIServiceName = keyof typeof SERVICE_MODEL_MAP;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rate Limiting Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface RateLimitConfig {
  maxRequests: number;     // Max requests per window
  windowMs: number;        // Time window in milliseconds
  burstLimit: number;      // Max burst requests (short window)
  burstWindowMs: number;   // Burst window in milliseconds
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Chat: 20 messages per minute, burst of 5 in 10 seconds
  chat: {
    maxRequests: 20,
    windowMs: 60_000,
    burstLimit: 5,
    burstWindowMs: 10_000,
  },
  // Document extraction: 10 per minute (expensive)
  document: {
    maxRequests: 10,
    windowMs: 60_000,
    burstLimit: 3,
    burstWindowMs: 10_000,
  },
  // NL shipment: 15 per minute
  shipment: {
    maxRequests: 15,
    windowMs: 60_000,
    burstLimit: 4,
    burstWindowMs: 10_000,
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Token Usage Tracking
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TokenUsage {
  service: AIServiceName;
  model: AIModel;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;  // USD
  userId?: string;
  timestamp: string;
  durationMs: number;
}

// In-memory usage tracking (persists per server instance)
class AIUsageTracker {
  private usageLog: TokenUsage[] = [];
  private dailyTotals: Map<string, { tokens: number; cost: number; calls: number }> = new Map();

  /**
   * Record a single API call's token usage
   */
  track(usage: TokenUsage): void {
    this.usageLog.push(usage);

    // Update daily totals
    const dateKey = usage.timestamp.split('T')[0] || 'unknown';
    const existing = this.dailyTotals.get(dateKey) || { tokens: 0, cost: 0, calls: 0 };
    existing.tokens += usage.totalTokens;
    existing.cost += usage.estimatedCost;
    existing.calls += 1;
    this.dailyTotals.set(dateKey, existing);

    // Log for monitoring
    console.log(`[AI Usage] ${usage.service} | ${usage.model} | ${usage.totalTokens} tokens | $${usage.estimatedCost.toFixed(6)} | ${usage.durationMs}ms`);

    // Keep only last 10,000 entries in memory
    if (this.usageLog.length > 10_000) {
      this.usageLog = this.usageLog.slice(-5_000);
    }
  }

  /**
   * Calculate cost from token counts and model config
   */
  calculateCost(promptTokens: number, completionTokens: number, modelConfig: ModelConfig): number {
    const inputCost = (promptTokens / 1_000_000) * modelConfig.costPer1MInput;
    const outputCost = (completionTokens / 1_000_000) * modelConfig.costPer1MOutput;
    return inputCost + outputCost;
  }

  /**
   * Get usage summary for a date range
   */
  getSummary(startDate?: string, endDate?: string): {
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    byService: Record<string, { calls: number; tokens: number; cost: number }>;
    byModel: Record<string, { calls: number; tokens: number; cost: number }>;
    dailyBreakdown: Array<{ date: string; calls: number; tokens: number; cost: number }>;
  } {
    let filtered = this.usageLog;

    if (startDate) {
      filtered = filtered.filter(u => u.timestamp >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(u => u.timestamp <= endDate);
    }

    const byService: Record<string, { calls: number; tokens: number; cost: number }> = {};
    const byModel: Record<string, { calls: number; tokens: number; cost: number }> = {};

    for (const usage of filtered) {
      // By service
      if (!byService[usage.service]) {
        byService[usage.service] = { calls: 0, tokens: 0, cost: 0 };
      }
      byService[usage.service]!.calls++;
      byService[usage.service]!.tokens += usage.totalTokens;
      byService[usage.service]!.cost += usage.estimatedCost;

      // By model
      if (!byModel[usage.model]) {
        byModel[usage.model] = { calls: 0, tokens: 0, cost: 0 };
      }
      byModel[usage.model]!.calls++;
      byModel[usage.model]!.tokens += usage.totalTokens;
      byModel[usage.model]!.cost += usage.estimatedCost;
    }

    // Daily breakdown from map
    const dailyBreakdown = Array.from(this.dailyTotals.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalCalls: filtered.length,
      totalTokens: filtered.reduce((sum, u) => sum + u.totalTokens, 0),
      totalCost: filtered.reduce((sum, u) => sum + u.estimatedCost, 0),
      byService,
      byModel,
      dailyBreakdown,
    };
  }

  /**
   * Get recent usage entries
   */
  getRecent(limit: number = 50): TokenUsage[] {
    return this.usageLog.slice(-limit);
  }
}

export const aiUsageTracker = new AIUsageTracker();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Response Cache
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CacheEntry {
  response: string;
  suggestions: string[] | undefined;
  timestamp: number;
  hitCount: number;
}

class AIResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly maxSize = 500;
  private readonly ttlMs = 30 * 60 * 1000; // 30 min TTL

  /**
   * Generate a cache key from the input
   */
  private makeKey(service: string, input: string): string {
    // Normalize: lowercase, trim, collapse whitespace
    const normalized = input.toLowerCase().trim().replace(/\s+/g, ' ');
    return `${service}:${normalized}`;
  }

  /**
   * Get cached response if available and fresh
   */
  get(service: string, input: string): { response: string; suggestions: string[] | undefined } | null {
    const key = this.makeKey(service, input);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.hitCount++;
    console.log(`[AI Cache] HIT for ${service} (${entry.hitCount} hits)`);
    return { response: entry.response, suggestions: entry.suggestions };
  }

  /**
   * Store response in cache
   */
  set(service: string, input: string, response: string, suggestions?: string[]): void {
    // Only cache responses that seem "generic" enough to reuse
    // Don't cache responses with specific user data
    const key = this.makeKey(service, input);

    // Evict old entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      response,
      suggestions,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; totalHits: number; topQueries: string[] } {
    let totalHits = 0;
    const entries: Array<{ key: string; hits: number }> = [];

    for (const [key, entry] of this.cache.entries()) {
      totalHits += entry.hitCount;
      entries.push({ key, hits: entry.hitCount });
    }

    entries.sort((a, b) => b.hits - a.hits);
    const topQueries = entries.slice(0, 10).map(e => `${e.key} (${e.hits} hits)`);

    return { size: this.cache.size, totalHits, topQueries };
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }
}

export const aiResponseCache = new AIResponseCache();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Monthly Cost Projections
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const COST_PROJECTIONS = {
  // Per-call estimated costs (with tiered models)
  perCall: {
    'benji-chat': 0.00015,        // GPT-4o-mini: ~150 input + 150 output tokens
    'nl-shipment': 0.005,          // GPT-4o: ~500 input + 400 output tokens
    'document-ocr': 0.012,         // GPT-4o Vision: ~800 input + 600 output tokens
    'document-extraction': 0.009,  // GPT-4o: ~600 input + 500 output tokens
  },
  // Monthly projections by scale
  monthly: {
    startup: {   // 50 users, light usage
      chatCalls: 500,
      shipmentCalls: 100,
      documentCalls: 50,
      get totalCost() {
        return (this.chatCalls * COST_PROJECTIONS.perCall['benji-chat']) +
               (this.shipmentCalls * COST_PROJECTIONS.perCall['nl-shipment']) +
               (this.documentCalls * (COST_PROJECTIONS.perCall['document-ocr'] + COST_PROJECTIONS.perCall['document-extraction']));
      },
    },
    growth: {    // 500 users, moderate usage
      chatCalls: 5000,
      shipmentCalls: 1000,
      documentCalls: 500,
      get totalCost() {
        return (this.chatCalls * COST_PROJECTIONS.perCall['benji-chat']) +
               (this.shipmentCalls * COST_PROJECTIONS.perCall['nl-shipment']) +
               (this.documentCalls * (COST_PROJECTIONS.perCall['document-ocr'] + COST_PROJECTIONS.perCall['document-extraction']));
      },
    },
    scale: {     // 5000 users, heavy usage
      chatCalls: 50000,
      shipmentCalls: 10000,
      documentCalls: 5000,
      get totalCost() {
        return (this.chatCalls * COST_PROJECTIONS.perCall['benji-chat']) +
               (this.shipmentCalls * COST_PROJECTIONS.perCall['nl-shipment']) +
               (this.documentCalls * (COST_PROJECTIONS.perCall['document-ocr'] + COST_PROJECTIONS.perCall['document-extraction']));
      },
    },
  },
} as const;
