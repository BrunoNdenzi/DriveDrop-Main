/**
 * Hunter.io Service
 * Domain search and email finder using the Hunter.io API
 * Docs: https://hunter.io/api-documentation
 */
import { logger } from '@utils/logger';

export interface HunterEmailResult {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  confidence: number; // 0-100
  sources: string[];
  linkedin_url?: string;
  phone_number?: string;
  department?: string;
  seniority?: string;
}

export interface HunterDomainResult {
  domain: string;
  organization: string;
  emails: HunterEmailResult[];
  total: number;
}

export interface HunterVerifyResult {
  email: string;
  result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
  score: number; // 0-100
  regexp: boolean;
  gibberish: boolean;
  disposable: boolean;
  webmail: boolean;
  mx_records: boolean;
  smtp_server: boolean;
  smtp_check: boolean;
  accept_all: boolean;
  block: boolean;
  sources: string[];
}

const BASE_URL = 'https://api.hunter.io/v2';

class HunterService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env['HUNTER_API_KEY'];
    if (!this.apiKey) {
      logger.warn('HUNTER_API_KEY not set — Hunter.io features disabled');
    }
  }

  get isEnabled(): boolean {
    return !!this.apiKey;
  }

  private async request<T>(endpoint: string, params: Record<string, string | number>): Promise<T | null> {
    if (!this.apiKey) return null;

    const url = new URL(`${BASE_URL}/${endpoint}`);
    url.searchParams.set('api_key', this.apiKey);
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, String(val));
    }

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        logger.error(`Hunter API ${endpoint} error: ${response.status} ${response.statusText}`);
        return null;
      }

      const json: any = await response.json();
      return json.data as T;
    } catch (err: any) {
      logger.error(`Hunter API ${endpoint} failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Search all emails for a domain
   */
  async domainSearch(domain: string, limit = 10): Promise<HunterDomainResult | null> {
    const data = await this.request<any>('domain-search', { domain, limit });
    if (!data) return null;

    return {
      domain: data.domain,
      organization: data.organization || '',
      total: data.total || 0,
      emails: (data.emails || []).map((e: any): HunterEmailResult => ({
        email: e.value,
        firstName: e.first_name || '',
        lastName: e.last_name || '',
        position: e.position || '',
        confidence: e.confidence || 0,
        sources: (e.sources || []).map((s: any) => s.uri),
        linkedin_url: e.linkedin || undefined,
        phone_number: e.phone_number || undefined,
        department: e.department || undefined,
        seniority: e.seniority || undefined,
      })),
    };
  }

  /**
   * Find a specific person's email at a domain
   */
  async emailFinder(domain: string, firstName: string, lastName: string): Promise<HunterEmailResult | null> {
    const data = await this.request<any>('email-finder', { domain, first_name: firstName, last_name: lastName });
    if (!data || !data.email) return null;

    return {
      email: data.email,
      firstName: data.first_name || firstName,
      lastName: data.last_name || lastName,
      position: data.position || '',
      confidence: data.confidence || 0,
      sources: (data.sources || []).map((s: any) => s.uri),
      linkedin_url: data.linkedin_url || undefined,
      phone_number: data.phone_number || undefined,
    };
  }

  /**
   * Verify an email address
   */
  async verifyEmail(email: string): Promise<HunterVerifyResult | null> {
    const data = await this.request<any>('email-verifier', { email });
    if (!data) return null;

    return {
      email: data.email,
      result: data.result,
      score: data.score || 0,
      regexp: !!data.regexp,
      gibberish: !!data.gibberish,
      disposable: !!data.disposable,
      webmail: !!data.webmail,
      mx_records: !!data.mx_records,
      smtp_server: !!data.smtp_server,
      smtp_check: !!data.smtp_check,
      accept_all: !!data.accept_all,
      block: !!data.block,
      sources: (data.sources || []).map((s: any) => s.uri),
    };
  }

  /**
   * Get remaining Hunter API quota for this month
   */
  async getAccountInfo(): Promise<{ plan: string; requestsLeft: number; requestsMax: number } | null> {
    const data = await this.request<any>('account', {});
    if (!data) return null;
    return {
      plan: data.plan_name || 'unknown',
      requestsLeft: data.requests?.month?.left || 0,
      requestsMax: data.requests?.month?.used + data.requests?.month?.left || 0,
    };
  }
}

export const hunterService = new HunterService();
