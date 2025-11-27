/**
 * DOT/MC Number Verification Utilities
 * Validates and verifies DOT and MC numbers for broker registration
 */

// Format DOT number (should be 7-8 digits)
export function formatDOTNumber(dot: string): string {
  return dot.replace(/\D/g, '');
}

// Format MC number (should be 6-7 digits)
export function formatMCNumber(mc: string): string {
  return mc.replace(/\D/g, '');
}

// Validate DOT number format
export function isValidDOTNumber(dot: string): boolean {
  const formatted = formatDOTNumber(dot);
  return formatted.length >= 1 && formatted.length <= 8;
}

// Validate MC number format
export function isValidMCNumber(mc: string): boolean {
  const formatted = formatMCNumber(mc);
  return formatted.length >= 1 && formatted.length <= 8;
}

/**
 * Verify DOT number with FMCSA API (placeholder - requires actual API integration)
 * FMCSA provides a public API for carrier lookup
 * Docs: https://mobile.fmcsa.dot.gov/developer/home.page
 */
export async function verifyDOTNumber(dotNumber: string): Promise<{
  valid: boolean;
  company_name?: string;
  status?: string;
  error?: string;
}> {
  try {
    const formatted = formatDOTNumber(dotNumber);
    
    if (!isValidDOTNumber(formatted)) {
      return { valid: false, error: 'Invalid DOT number format' };
    }

    // TODO: Integrate with FMCSA Safer API
    // For now, return mock validation
    // Real API endpoint: https://mobile.fmcsa.dot.gov/qc/services/carriers/{dotNumber}
    
    // Mock response for development
    return {
      valid: true,
      company_name: 'Verified Transport Company',
      status: 'ACTIVE',
    };

    /* Real API implementation would look like:
    const response = await fetch(
      `https://mobile.fmcsa.dot.gov/qc/services/carriers/${formatted}?webKey=YOUR_API_KEY`
    );
    
    if (!response.ok) {
      return { valid: false, error: 'DOT number not found in FMCSA database' };
    }
    
    const data = await response.json();
    
    return {
      valid: true,
      company_name: data.carrier.legalName,
      status: data.carrier.carrierOperationCode,
    };
    */
  } catch (error) {
    console.error('DOT verification error:', error);
    return { valid: false, error: 'Failed to verify DOT number' };
  }
}

/**
 * Verify MC number with FMCSA API (placeholder)
 */
export async function verifyMCNumber(mcNumber: string): Promise<{
  valid: boolean;
  company_name?: string;
  status?: string;
  error?: string;
}> {
  try {
    const formatted = formatMCNumber(mcNumber);
    
    if (!isValidMCNumber(formatted)) {
      return { valid: false, error: 'Invalid MC number format' };
    }

    // TODO: Integrate with FMCSA Safer API
    // Mock response for development
    return {
      valid: true,
      company_name: 'Verified Broker Company',
      status: 'ACTIVE',
    };

    /* Real API implementation would look like:
    const response = await fetch(
      `https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/${formatted}?webKey=YOUR_API_KEY`
    );
    
    if (!response.ok) {
      return { valid: false, error: 'MC number not found in FMCSA database' };
    }
    
    const data = await response.json();
    
    return {
      valid: true,
      company_name: data.carrier.legalName,
      status: data.carrier.carrierOperationCode,
    };
    */
  } catch (error) {
    console.error('MC verification error:', error);
    return { valid: false, error: 'Failed to verify MC number' };
  }
}

/**
 * Check if broker has required documents
 */
export function checkRequiredDocuments(broker: any): {
  complete: boolean;
  missing: string[];
} {
  const required = [
    'insurance_certificate',
    'surety_bond',
    'mc_authority',
  ];

  const missing: string[] = [];

  // TODO: Check broker_documents table for uploaded docs
  // This is a placeholder
  
  return {
    complete: missing.length === 0,
    missing,
  };
}

/**
 * Calculate verification progress percentage
 */
export function calculateVerificationProgress(broker: any): number {
  let progress = 0;
  
  // Basic info (20%)
  if (broker.company_name && broker.business_address) progress += 20;
  
  // DOT/MC numbers (20%)
  if (broker.dot_number || broker.mc_number) progress += 20;
  
  // Insurance info (20%)
  if (broker.insurance_policy_number && broker.insurance_amount) progress += 20;
  
  // Documents uploaded (20%)
  // TODO: Check document count
  progress += 20;
  
  // Verification status (20%)
  if (broker.verification_status === 'verified') progress += 20;
  
  return Math.min(progress, 100);
}

/**
 * Get verification status badge color
 */
export function getVerificationStatusColor(status: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'verified':
      return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' };
    case 'under_review':
      return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };
    case 'documents_submitted':
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' };
    case 'rejected':
      return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' };
    case 'suspended':
      return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
  }
}

/**
 * Format verification status for display
 */
export function formatVerificationStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
