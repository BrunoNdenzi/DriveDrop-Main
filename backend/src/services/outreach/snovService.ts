/**
 * Snov.io Service
 * Email verification and prospect enrichment
 * Docs: https://snov.io/api
 * Set SNOV_CLIENT_ID and SNOV_CLIENT_SECRET env vars once you have them.
 */
import { logger } from '@utils/logger';

export interface SnovVerifyResult {
  email: string;
  valid: boolean;
  smtp: boolean;
  mx: boolean;
  domainExists: boolean;
  reason: string; // 'valid', 'invalid', 'catch_all', 'unverifiable'
}

export interface SnovProspect {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  position: string;
  country: string;
  source: string;
}

class SnovService {
  private clientId: string | undefined;
  private clientSecret: string | undefined;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor() {
    this.clientId = process.env['SNOV_CLIENT_ID'];
    this.clientSecret = process.env['SNOV_CLIENT_SECRET'];
    if (!this.clientId || !this.clientSecret) {
      logger.warn('SNOV_CLIENT_ID / SNOV_CLIENT_SECRET not set — Snov.io features disabled');
    }
  }

  get isEnabled(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Get / refresh OAuth2 access token
   */
  private async getToken(): Promise<string | null> {
    if (!this.clientId || !this.clientSecret) return null;
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;

    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      });

      const response = await fetch('https://api.snov.io/v1/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        logger.error(`Snov token error: ${response.status}`);
        return null;
      }

      const json: any = await response.json();
      this.accessToken = json.access_token;
      // Tokens last 1 hour; refresh 5 minutes early
      this.tokenExpiry = Date.now() + (3300 * 1000);
      return this.accessToken;
    } catch (err: any) {
      logger.error(`Snov token fetch failed: ${err.message}`);
      return null;
    }
  }

  private async post<T>(endpoint: string, body: Record<string, any>): Promise<T | null> {
    const token = await this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(`https://api.snov.io/v1/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        logger.error(`Snov API ${endpoint} error: ${response.status}`);
        return null;
      }

      return await response.json() as T;
    } catch (err: any) {
      logger.error(`Snov API ${endpoint} failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Verify a single email address
   */
  async verifyEmail(email: string): Promise<SnovVerifyResult | null> {
    const data: any = await this.post('get-emails-verification-status', {
      emails: [email],
    });

    if (!data?.data?.[0]) return null;
    const r = data.data[0];

    return {
      email,
      valid: r.status === 'Valid',
      smtp: r.smtp_check === true,
      mx: r.mx_check === true,
      domainExists: r.domain_check === true,
      reason: r.status || 'unknown',
    };
  }

  /**
   * Verify multiple emails in one call (up to 100)
   */
  async verifyBatch(emails: string[]): Promise<SnovVerifyResult[]> {
    if (emails.length === 0) return [];

    const data: any = await this.post('get-emails-verification-status', { emails });
    if (!data?.data) return [];

    return data.data.map((r: any): SnovVerifyResult => ({
      email: r.email,
      valid: r.status === 'Valid',
      smtp: r.smtp_check === true,
      mx: r.mx_check === true,
      domainExists: r.domain_check === true,
      reason: r.status || 'unknown',
    }));
  }

  /**
   * Find email addresses by company domain
   */
  async findEmailsByDomain(domain: string, limit = 10): Promise<SnovProspect[]> {
    const data: any = await this.post('get-prospects-by-domain', {
      domain,
      limit,
      lastId: 0,
    });

    if (!data?.data) return [];

    return data.data.map((p: any): SnovProspect => ({
      id: p.id?.toString() || '',
      email: p.email || '',
      firstName: p.firstName || p.first_name || '',
      lastName: p.lastName || p.last_name || '',
      companyName: p.companyName || domain,
      position: p.position || '',
      country: p.country || '',
      source: p.sourceUrl || domain,
    }));
  }
}

export const snovService = new SnovService();
