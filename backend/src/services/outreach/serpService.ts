/**
 * SerpAPI Service
 * Company info enrichment via Google search results
 * Docs: https://serpapi.com/search-api
 */
import { logger } from '@utils/logger';

export interface CompanyInfo {
  name: string;
  website?: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  employeeCount?: string;
  industry?: string;
  founded?: string;
  knowledgeGraph?: Record<string, string>;
}

const BASE_URL = 'https://serpapi.com/search.json';

class SerpService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env['SERPAPI_KEY'];
    if (!this.apiKey) {
      logger.warn('SERPAPI_KEY not set — SerpAPI enrichment disabled');
    }
  }

  get isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search for a company and extract structured info from Google results
   */
  async enrichCompany(companyName: string, state?: string): Promise<CompanyInfo | null> {
    if (!this.apiKey) return null;

    const query = state
      ? `${companyName} trucking company ${state} contact`
      : `${companyName} trucking company contact`;

    const url = new URL(BASE_URL);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('num', '5');
    url.searchParams.set('gl', 'us');
    url.searchParams.set('hl', 'en');

    try {
      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        logger.error(`SerpAPI error: ${response.status} ${response.statusText}`);
        return null;
      }

      const json: any = await response.json();
      return this.parseCompanyInfo(companyName, json);
    } catch (err: any) {
      logger.error(`SerpAPI enrichment failed for "${companyName}": ${err.message}`);
      return null;
    }
  }

  /**
   * Parse SerpAPI response into structured company info
   */
  private parseCompanyInfo(name: string, json: any): CompanyInfo {
    const info: CompanyInfo = { name };

    // Knowledge Graph (Google's structured data panel)
    const kg = json.knowledge_graph;
    if (kg) {
      info.website = kg.website || undefined;
      info.description = kg.description || undefined;
      info.address = kg.address || undefined;
      info.phone = kg.phone || undefined;
      info.employeeCount = kg.employees || undefined;
      info.founded = kg.founded || undefined;
      const linkedin = this.extractLinkedIn(kg);
      if (linkedin) info.linkedin = linkedin;

      // Store all KG fields for raw access
      const extra: Record<string, string> = {};
      for (const [k, v] of Object.entries(kg)) {
        if (typeof v === 'string') extra[k] = v;
      }
      if (Object.keys(extra).length) info.knowledgeGraph = extra;
    }

    // Organic results — extract website from first result if not in KG
    if (!info.website && json.organic_results?.length) {
      const first = json.organic_results[0];
      if (first.link && !first.link.includes('facebook.com') && !first.link.includes('linkedin.com')) {
        try {
          info.website = new URL(first.link).origin;
        } catch {
          // Not a valid URL, skip
        }
      }
    }

    return info;
  }

  private extractLinkedIn(kg: any): string | undefined {
    // LinkedIn sometimes appears in profiles array or website
    if (kg.profiles) {
      for (const p of kg.profiles) {
        if (p.link?.includes('linkedin.com')) return p.link;
      }
    }
    return undefined;
  }
}

export const serpService = new SerpService();
