/**
 * Apollo.io Service
 * B2B lead database — people search, company search, enrichment
 * Docs: https://apolloio.github.io/apollo-api-docs
 * Set APOLLO_API_KEY env var once you have it.
 */
import { logger } from '@utils/logger';

export interface ApolloContact {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  emailStatus: 'verified' | 'guessed' | 'unavailable' | 'bounced' | 'pending_manual_fulfillment';
  phone: string;
  linkedin: string;
  organizationName: string;
  organizationWebsite: string;
  city: string;
  state: string;
  country: string;
  seniority: string;
  departments: string[];
}

export interface ApolloOrganization {
  id: string;
  name: string;
  website: string;
  industry: string;
  estimatedNumEmployees: number;
  foundedYear: number;
  shortDescription: string;
  phone: string;
  city: string;
  state: string;
  country: string;
  linkedinUrl: string;
  technologies: string[];
}

const BASE_URL = 'https://api.apollo.io/v1';

class ApolloService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env['APOLLO_API_KEY'];
    if (!this.apiKey) {
      logger.warn('APOLLO_API_KEY not set — Apollo.io features disabled');
    }
  }

  get isEnabled(): boolean {
    return !!this.apiKey;
  }

  private async post<T>(endpoint: string, body: Record<string, any>): Promise<T | null> {
    if (!this.apiKey) return null;

    try {
      const response = await fetch(`${BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        logger.error(`Apollo API ${endpoint} error: ${response.status} ${response.statusText}`);
        return null;
      }

      return await response.json() as T;
    } catch (err: any) {
      logger.error(`Apollo API ${endpoint} failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Search for people (contacts) by company domain or name/title
   */
  async searchPeople(params: {
    q_organization_domains?: string[];
    q_keywords?: string;
    person_titles?: string[];
    person_seniorities?: string[];
    page?: number;
    perPage?: number;
  }): Promise<{ contacts: ApolloContact[]; total: number }> {
    const data: any = await this.post('mixed_people/search', {
      q_organization_domains: params.q_organization_domains,
      q_keywords: params.q_keywords,
      person_titles: params.person_titles,
      person_seniorities: params.person_seniorities,
      // Target logistics/transportation decision makers
      contact_email_status: ['verified', 'guessed'],
      page: params.page || 1,
      per_page: params.perPage || 10,
    });

    if (!data) return { contacts: [], total: 0 };

    return {
      total: data.pagination?.total_entries || data.people?.length || 0,
      contacts: (data.people || []).map((p: any): ApolloContact => ({
        id: p.id || '',
        firstName: p.first_name || '',
        lastName: p.last_name || '',
        title: p.title || '',
        email: p.email || '',
        emailStatus: p.email_status || 'unavailable',
        phone: p.phone_numbers?.[0]?.raw_number || '',
        linkedin: p.linkedin_url || '',
        organizationName: p.organization?.name || '',
        organizationWebsite: p.organization?.website_url || '',
        city: p.city || '',
        state: p.state || '',
        country: p.country || p.location?.country || '',
        seniority: p.seniority || '',
        departments: p.departments || [],
      })),
    };
  }

  /**
   * Enrich a company by domain
   */
  async enrichOrganization(domain: string): Promise<ApolloOrganization | null> {
    const data: any = await this.post('organizations/enrich', { domain });
    if (!data?.organization) return null;

    const org = data.organization;
    return {
      id: org.id || '',
      name: org.name || '',
      website: org.website_url || domain,
      industry: org.industry || '',
      estimatedNumEmployees: org.estimated_num_employees || 0,
      foundedYear: org.founded_year || 0,
      shortDescription: org.short_description || '',
      phone: org.phone || '',
      city: org.city || '',
      state: org.state || '',
      country: org.country || '',
      linkedinUrl: org.linkedin_url || '',
      technologies: org.technologies?.map((t: any) => t.name) || [],
    };
  }

  /**
   * Enrich a contact by email
   */
  async enrichPerson(email: string): Promise<ApolloContact | null> {
    const data: any = await this.post('people/match', { email });
    if (!data?.person) return null;

    const p = data.person;
    return {
      id: p.id || '',
      firstName: p.first_name || '',
      lastName: p.last_name || '',
      title: p.title || '',
      email: p.email || email,
      emailStatus: p.email_status || 'unavailable',
      phone: p.phone_numbers?.[0]?.raw_number || '',
      linkedin: p.linkedin_url || '',
      organizationName: p.organization?.name || '',
      organizationWebsite: p.organization?.website_url || '',
      city: p.city || '',
      state: p.state || '',
      country: p.country || '',
      seniority: p.seniority || '',
      departments: p.departments || [],
    };
  }
}

export const apolloService = new ApolloService();
