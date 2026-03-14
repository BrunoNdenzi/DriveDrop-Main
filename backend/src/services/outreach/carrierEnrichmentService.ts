/**
 * Carrier Enrichment Service
 * Finds contact emails for FMCSA carriers using Apollo → Hunter → Snov fallback chain.
 * Stores enriched records in carrier_contacts table.
 */
import { supabaseAdmin } from '@lib/supabase';
import { logger } from '@utils/logger';
import { hunterService } from './hunterService';
import { apolloService } from './apolloService';
import { snovService } from './snovService';
import { FMCSACarrierData, EnrichedCarrier } from '../../types/campaigns.types';

class CarrierEnrichmentService {
  /**
   * Guess a company domain from its name.
   * e.g. "ABC Trucking LLC" → "abctrucking.com"
   */
  guessDomain(companyName: string): string | null {
    if (!companyName) return null;
    const cleaned = companyName
      .toLowerCase()
      .replace(/\b(inc|llc|corp|ltd|co|company|trucking|transport|logistics|freight|carriers?|lines?|express|services?|group|enterprises?)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    if (cleaned.length < 3) return null;
    return `${cleaned}.com`;
  }

  /**
   * Verify an email using Snov (primary) or Hunter (fallback).
   */
  async verifyEmail(email: string): Promise<{ verified: boolean; score: number }> {
    // Snov.io verification
    if (snovService.isEnabled) {
      const result = await snovService.verifyEmail(email);
      if (result) {
        const score = result.valid && result.smtp ? 90 : result.valid ? 60 : 10;
        return { verified: result.valid && result.smtp, score };
      }
    }
    // Hunter fallback
    if (hunterService.isEnabled) {
      const result = await hunterService.verifyEmail(email);
      if (result) {
        const verified = result.result === 'deliverable';
        return { verified, score: result.score };
      }
    }
    return { verified: false, score: 0 };
  }

  /**
   * Enrich a single FMCSA carrier with email data.
   * Apollo → Hunter domain search → Hunter email finder → Snov
   */
  async enrichCarrier(fmcsaData: FMCSACarrierData): Promise<EnrichedCarrier | null> {
    let email: string | undefined;
    let source: EnrichedCarrier['source'] = 'manual';
    let website: string | undefined;

    const domain = fmcsaData.dotNumber
      ? undefined
      : this.guessDomain(fmcsaData.companyName) ?? undefined;

    // --- 1. Apollo people search ---
    if (apolloService.isEnabled) {
      try {
        const domains = domain ? [domain] : undefined;
        const result = await apolloService.searchPeople({
          ...(domains && { q_organization_domains: domains }),
          ...(!domains && { q_keywords: fmcsaData.companyName }),
          person_titles: ['owner', 'president', 'ceo', 'operations', 'dispatch', 'manager'],
          person_seniorities: ['owner', 'founder', 'c_suite', 'vp', 'director', 'manager'],
          perPage: 3,
        });
        const best = result.contacts.find(c => c.email && c.emailStatus === 'verified') || result.contacts.find(c => c.email);
        if (best && best.email) {
          email = best.email;
          source = 'apollo';
          if (best.organizationWebsite) website = best.organizationWebsite;
        }
      } catch (err: any) {
        logger.warn(`Apollo enrichment failed for ${fmcsaData.dotNumber}: ${err.message}`);
      }
    }

    // --- 2. Hunter domain search ---
    if (!email && hunterService.isEnabled && domain) {
      try {
        const result = await hunterService.domainSearch(domain, 5);
        if (result) {
          if (result.emails.length > 0) {
            const best = result.emails.sort((a, b) => b.confidence - a.confidence)[0];
            if (best) {
              email = best.email;
              source = 'hunter';
            }
          }
          website = `https://${domain}`;
        }
      } catch (err: any) {
        logger.warn(`Hunter enrichment failed for ${fmcsaData.dotNumber}: ${err.message}`);
      }
    }

    // --- 3. Snov domain prospects ---
    if (!email && snovService.isEnabled && domain) {
      try {
        const prospects = await snovService.findEmailsByDomain(domain, 3);
        const best = prospects[0];
        if (best?.email) {
          email = best.email;
          source = 'snov';
        }
      } catch (err: any) {
        logger.warn(`Snov enrichment failed for ${fmcsaData.dotNumber}: ${err.message}`);
      }
    }

    // Build enriched record
    const enriched: EnrichedCarrier = {
      ...fmcsaData,
      id: '',
      ...(email !== undefined && { email }),
      emailVerified: false,
      emailScore: 0,
      ...(website !== undefined && { website }),
      source,
      enrichedAt: new Date(),
    };

    // Verify email if found
    if (email) {
      const { verified, score } = await this.verifyEmail(email);
      enriched.emailVerified = verified;
      enriched.emailScore = score;
    }

    return enriched;
  }

  /**
   * Upsert an enriched carrier into carrier_contacts table.
   */
  async saveCarrierContact(carrier: EnrichedCarrier): Promise<string | null> {
    const row: Record<string, any> = {
      dot_number: carrier.dotNumber,
      company_name: carrier.companyName,
      operating_status: carrier.operatingStatus,
      address: carrier.address,
      city: carrier.city,
      state: carrier.state,
      zip: carrier.zip,
      enriched_at: carrier.enrichedAt.toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (carrier.mcNumber) row['mc_number'] = carrier.mcNumber;
    if (carrier.email) row['email'] = carrier.email;
    if (carrier.emailVerified !== undefined) row['email_verified'] = carrier.emailVerified;
    if (carrier.emailScore !== undefined) row['email_verification_score'] = carrier.emailScore;
    if (carrier.phone) row['phone'] = carrier.phone;
    if (carrier.website) row['website'] = carrier.website;
    if (carrier.powerUnits !== undefined) row['power_units'] = carrier.powerUnits;
    if (carrier.drivers !== undefined) row['drivers'] = carrier.drivers;
    if (carrier.source) row['source'] = carrier.source;

    const { data, error } = await supabaseAdmin
      .from('carrier_contacts')
      .upsert(row, { onConflict: 'dot_number' })
      .select('id')
      .single();

    if (error) {
      logger.error(`Failed to save carrier ${carrier.dotNumber}: ${error.message}`);
      return null;
    }
    return (data as any)?.id ?? null;
  }

  /**
   * Bulk enrich multiple FMCSA carriers with rate limiting.
   */
  async bulkEnrich(
    carriers: FMCSACarrierData[],
    batchSize = 10
  ): Promise<{ total: number; enriched: number; failed: number }> {
    let enriched = 0;
    let failed = 0;

    for (let i = 0; i < carriers.length; i += batchSize) {
      const batch = carriers.slice(i, i + batchSize);

      for (const carrier of batch) {
        try {
          const result = await this.enrichCarrier(carrier);
          if (result) {
            await this.saveCarrierContact(result);
            enriched++;
          } else {
            failed++;
          }
        } catch (err: any) {
          logger.error(`Bulk enrich failed for ${carrier.dotNumber}: ${err.message}`);
          failed++;
        }
      }

      // Rate limit: 2 second delay between batches
      if (i + batchSize < carriers.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    logger.info(`Bulk enrichment complete: ${enriched} enriched, ${failed} failed of ${carriers.length}`);
    return { total: carriers.length, enriched, failed };
  }
}

export const carrierEnrichmentService = new CarrierEnrichmentService();
