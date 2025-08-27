import { logger } from '@utils/logger';

// Vehicle categories supported
export type VehicleType = 'sedan' | 'suv' | 'pickup' | 'luxury' | 'motorcycle' | 'heavy';

interface PricingInput {
  vehicleType: VehicleType;
  distanceMiles: number; // total route distance in miles
  isAccidentRecovery?: boolean | undefined;
  vehicleCount?: number | undefined; // for bulk transport
  dynamicFuelCostPerMile?: number | undefined; // optional override from admin panel
  surgeMultiplier?: number | undefined; // dynamic demand multiplier (default 1)
}

interface PricingBreakdown {
  baseRatePerMile: number;
  distanceBand: 'short' | 'mid' | 'long';
  rawBasePrice: number;
  accidentRecoveryFee?: number | undefined; // optional -> allow undefined explicitly
  bulkDiscountPercent: number;
  bulkDiscountAmount: number;
  costComponentsPerMile: {
    fuel: number;
    driver: number;
    insurance: number;
    maintenance: number;
    tolls: number;
  };
  operatingCostPerMile: number;
  operatingCostTotal: number;
  profitMarginPercent: number;
  profitAmount: number;
  surgeMultiplier: number;
  total: number;
}

// Base rates table (chosen lower bound of two options for standard, higher could be used for premium tier later)
const BASE_RATES: Record<VehicleType, { short: number; mid: number; long: number; accident: number }> = {
  sedan:      { short: 1.80, mid: 0.95, long: 0.60, accident: 2.50 },
  suv:        { short: 2.00, mid: 1.05, long: 0.70, accident: 2.75 },
  pickup:     { short: 2.20, mid: 1.15, long: 0.75, accident: 3.00 },
  luxury:     { short: 3.00, mid: 1.80, long: 1.25, accident: 4.00 },
  motorcycle: { short: 1.50, mid: 0.85, long: 0.55, accident: 2.00 },
  heavy:      { short: 3.50, mid: 2.25, long: 1.80, accident: 4.50 },
};

// Cost component defaults (per mile) – midpoints of provided ranges
const COST_COMPONENT_DEFAULTS = {
  fuel: 0.525,      // 0.45–0.60
  driver: 0.625,    // 0.50–0.75
  insurance: 0.15,  // 0.10–0.20
  maintenance: 0.275, // 0.20–0.35
  tolls: 0.10,      // 0.05–0.15
};

// Bulk discount tiers
function getBulkDiscountPercent(count: number | undefined): number {
  if (!count || count <= 2) return 0;
  if (count <= 5) return 10;
  if (count <= 9) return 15;
  return 20;
}

function determineDistanceBand(miles: number): 'short' | 'mid' | 'long' {
  if (miles <= 500) return 'short';
  if (miles <= 1500) return 'mid';
  return 'long';
}

export function calculateQuote(input: PricingInput): { total: number; breakdown: PricingBreakdown } {
  const {
    vehicleType,
    distanceMiles,
    isAccidentRecovery = false,
    vehicleCount = 1,
    dynamicFuelCostPerMile,
    surgeMultiplier = 1,
  } = input;

  const distanceBand = determineDistanceBand(distanceMiles);
  const baseRates = BASE_RATES[vehicleType];
  const baseRatePerMile = isAccidentRecovery ? baseRates.accident : baseRates[distanceBand];
  const rawBasePrice = baseRatePerMile * distanceMiles;

  // Bulk discount
  const bulkDiscountPercent = getBulkDiscountPercent(vehicleCount);
  const bulkDiscountAmount = (rawBasePrice * bulkDiscountPercent) / 100;

  // Cost components (allow dynamic override for fuel)
  const costComponentsPerMile = {
    fuel: dynamicFuelCostPerMile ?? COST_COMPONENT_DEFAULTS.fuel,
    driver: COST_COMPONENT_DEFAULTS.driver,
    insurance: COST_COMPONENT_DEFAULTS.insurance,
    maintenance: COST_COMPONENT_DEFAULTS.maintenance,
    tolls: COST_COMPONENT_DEFAULTS.tolls,
  };
  const operatingCostPerMile = Object.values(costComponentsPerMile).reduce((a, b) => a + b, 0);
  const operatingCostTotal = operatingCostPerMile * distanceMiles;

  // Profit margin – choose 30% midpoint of 25–35 range; could be dynamic later
  const profitMarginPercent = 30;
  const profitAmount = (operatingCostTotal * profitMarginPercent) / 100;

  const accidentRecoveryFee: number | undefined = isAccidentRecovery ? baseRates.accident * distanceMiles : undefined;

  // Apply surge & subtract discount
  const subtotal = (rawBasePrice - bulkDiscountAmount) * surgeMultiplier;
  const total = Math.max(0, parseFloat((subtotal).toFixed(2)));

  const breakdown: PricingBreakdown = {
    baseRatePerMile,
    distanceBand,
    rawBasePrice: parseFloat(rawBasePrice.toFixed(2)),
    accidentRecoveryFee,
    bulkDiscountPercent,
    bulkDiscountAmount: parseFloat(bulkDiscountAmount.toFixed(2)),
    costComponentsPerMile,
    operatingCostPerMile: parseFloat(operatingCostPerMile.toFixed(3)),
    operatingCostTotal: parseFloat(operatingCostTotal.toFixed(2)),
    profitMarginPercent,
    profitAmount: parseFloat(profitAmount.toFixed(2)),
    surgeMultiplier,
    total,
  };

  logger.debug('Calculated pricing breakdown', { input, breakdown });
  return { total, breakdown };
}

export const pricingService = { calculateQuote };
