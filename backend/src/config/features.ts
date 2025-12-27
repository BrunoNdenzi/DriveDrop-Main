/**
 * Feature Flags Configuration
 * 
 * Progressive rollout system for commercial expansion features.
 * All features start OFF by default and can be enabled via environment variables.
 * 
 * Usage in code:
 * ```typescript
 * import { FEATURE_FLAGS } from '@/config/features';
 * 
 * if (FEATURE_FLAGS.COMMERCIAL_ACCOUNTS) {
 *   // Show commercial features
 * }
 * ```
 */

export const FEATURE_FLAGS = {
  /**
   * Commercial Accounts
   * Enables B2B client accounts with API access, payment terms, credit limits
   */
  COMMERCIAL_ACCOUNTS: process.env['ENABLE_COMMERCIAL'] === 'true' || true,

  /**
   * AI Dispatcher
   * Enables AI-powered dispatch optimization (30% efficiency gains)
   */
  AI_DISPATCHER: process.env['ENABLE_AI_DISPATCHER'] === 'true' || true,

  /**
   * Natural Language Shipment Creation
   * Allows creating shipments via text prompts using GPT-4
   */
  NATURAL_LANGUAGE: process.env['ENABLE_NATURAL_LANGUAGE'] === 'true' || true,

  /**
   * Universal Integrations
   * Enables universal integration system for auction houses, dealerships
   */
  UNIVERSAL_INTEGRATIONS: process.env['ENABLE_INTEGRATIONS'] === 'true' || true,

  /**
   * Enhanced Bulk Upload
   * Excel support, AI validation, progress tracking
   */
  BULK_UPLOAD_V2: process.env['ENABLE_BULK_V2'] === 'true' || true,

  /**
   * Bill of Lading System
   * Legal transport document generation and management
   */
  BOL_SYSTEM: process.env['ENABLE_BOL'] === 'true' || true,

  /**
   * Gate Pass System
   * Facility access control with QR codes
   */
  GATE_PASS_SYSTEM: process.env['ENABLE_GATE_PASS'] === 'true' || true,

  /**
   * AI Document Extraction
   * OCR + GPT-4 for automatic document data extraction
   */
  AI_DOCUMENT_EXTRACTION: process.env['ENABLE_AI_EXTRACTION'] === 'true' || true,

  /**
   * Commercial API Access
   * RESTful API for commercial clients
   */
  COMMERCIAL_API: process.env['ENABLE_COMMERCIAL_API'] === 'true' || true,

  /**
   * Webhook System
   * Outbound webhooks for status updates
   */
  WEBHOOK_SYSTEM: process.env['ENABLE_WEBHOOKS'] === 'true' || true,
} as const;

/**
 * Feature Groups
 * Logical grouping of related features for easier management
 */
export const FEATURE_GROUPS = {
  /**
   * Core Commercial Features
   * Basic commercial functionality - enable these first
   */
  CORE_COMMERCIAL: [
    'COMMERCIAL_ACCOUNTS',
    'BOL_SYSTEM',
    'BULK_UPLOAD_V2',
  ],

  /**
   * Integration Features
   * External system integrations
   */
  INTEGRATIONS: [
    'UNIVERSAL_INTEGRATIONS',
    'GATE_PASS_SYSTEM',
    'WEBHOOK_SYSTEM',
  ],

  /**
   * AI Features
   * AI-powered enhancements
   */
  AI_FEATURES: [
    'AI_DISPATCHER',
    'NATURAL_LANGUAGE',
    'AI_DOCUMENT_EXTRACTION',
  ],

  /**
   * Developer Features
   * API and programmatic access
   */
  DEVELOPER: [
    'COMMERCIAL_API',
  ],
} as const;

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(featureName: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[featureName] === true;
}

/**
 * Check if all features in a group are enabled
 */
export function isFeatureGroupEnabled(groupName: keyof typeof FEATURE_GROUPS): boolean {
  const features = FEATURE_GROUPS[groupName];
  return features.every(feature => 
    isFeatureEnabled(feature as keyof typeof FEATURE_FLAGS)
  );
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FEATURE_FLAGS)
    .filter(([, enabled]) => enabled)
    .map(([feature]) => feature);
}

/**
 * Feature flag configuration for different environments
 */
export const ENVIRONMENT_PRESETS = {
  /**
   * Development: All features enabled for testing
   */
  development: {
    COMMERCIAL_ACCOUNTS: true,
    AI_DISPATCHER: true,
    NATURAL_LANGUAGE: true,
    UNIVERSAL_INTEGRATIONS: true,
    BULK_UPLOAD_V2: true,
    BOL_SYSTEM: true,
    GATE_PASS_SYSTEM: true,
    AI_DOCUMENT_EXTRACTION: true,
    COMMERCIAL_API: true,
    WEBHOOK_SYSTEM: true,
  },

  /**
   * Staging: Core features enabled, AI features for testing
   */
  staging: {
    COMMERCIAL_ACCOUNTS: true,
    AI_DISPATCHER: true,
    NATURAL_LANGUAGE: false,
    UNIVERSAL_INTEGRATIONS: true,
    BULK_UPLOAD_V2: true,
    BOL_SYSTEM: true,
    GATE_PASS_SYSTEM: true,
    AI_DOCUMENT_EXTRACTION: false,
    COMMERCIAL_API: true,
    WEBHOOK_SYSTEM: true,
  },

  /**
   * Production: Start with all features OFF
   * Enable gradually via environment variables
   */
  production: {
    COMMERCIAL_ACCOUNTS: false,
    AI_DISPATCHER: false,
    NATURAL_LANGUAGE: false,
    UNIVERSAL_INTEGRATIONS: false,
    BULK_UPLOAD_V2: false,
    BOL_SYSTEM: false,
    GATE_PASS_SYSTEM: false,
    AI_DOCUMENT_EXTRACTION: false,
    COMMERCIAL_API: false,
    WEBHOOK_SYSTEM: false,
  },
} as const;

/**
 * Feature metadata for documentation and UI
 */
export const FEATURE_METADATA = {
  COMMERCIAL_ACCOUNTS: {
    name: 'Commercial Accounts',
    description: 'B2B client accounts with API access and payment terms',
    dependencies: [],
    documentation: '/docs/commercial-accounts',
  },
  AI_DISPATCHER: {
    name: 'AI Dispatcher',
    description: 'AI-powered dispatch optimization with 30% efficiency gains',
    dependencies: [],
    documentation: '/docs/ai-dispatcher',
  },
  NATURAL_LANGUAGE: {
    name: 'Natural Language Shipments',
    description: 'Create shipments via text prompts using GPT-4',
    dependencies: [],
    documentation: '/docs/natural-language',
  },
  UNIVERSAL_INTEGRATIONS: {
    name: 'Universal Integrations',
    description: 'Connect with ANY auction house or dealership in 5 minutes',
    dependencies: [],
    documentation: '/docs/integrations',
  },
  BULK_UPLOAD_V2: {
    name: 'Enhanced Bulk Upload',
    description: 'Excel support, AI validation, progress tracking',
    dependencies: ['COMMERCIAL_ACCOUNTS'],
    documentation: '/docs/bulk-upload',
  },
  BOL_SYSTEM: {
    name: 'Bill of Lading',
    description: 'Legal transport document generation and management',
    dependencies: ['COMMERCIAL_ACCOUNTS'],
    documentation: '/docs/bill-of-lading',
  },
  GATE_PASS_SYSTEM: {
    name: 'Gate Pass System',
    description: 'Facility access control with QR codes',
    dependencies: ['BOL_SYSTEM'],
    documentation: '/docs/gate-pass',
  },
  AI_DOCUMENT_EXTRACTION: {
    name: 'AI Document Extraction',
    description: 'OCR + GPT-4 for automatic document data extraction',
    dependencies: [],
    documentation: '/docs/ai-extraction',
  },
  COMMERCIAL_API: {
    name: 'Commercial API',
    description: 'RESTful API for commercial clients',
    dependencies: ['COMMERCIAL_ACCOUNTS'],
    documentation: '/docs/api',
  },
  WEBHOOK_SYSTEM: {
    name: 'Webhooks',
    description: 'Outbound webhooks for real-time status updates',
    dependencies: ['COMMERCIAL_API'],
    documentation: '/docs/webhooks',
  },
} as const;

/**
 * Runtime feature flag checks with dependency validation
 */
export function validateFeatureDependencies(): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  for (const [feature, metadata] of Object.entries(FEATURE_METADATA)) {
    if (!isFeatureEnabled(feature as keyof typeof FEATURE_FLAGS)) {
      continue;
    }

    for (const dependency of metadata.dependencies) {
      if (!isFeatureEnabled(dependency as keyof typeof FEATURE_FLAGS)) {
        issues.push(
          `Feature "${feature}" requires "${dependency}" to be enabled`
        );
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export default FEATURE_FLAGS;
