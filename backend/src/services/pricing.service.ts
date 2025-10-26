import { logger } from '@utils/logger';
import { pricingConfigService } from './pricingConfig.service';

// Vehicle categories supported
export type VehicleType = 'sedan' | 'suv' | 'pickup' | 'luxury' | 'motorcycle' | 'heavy';

interface PricingInput {
  vehicleType: VehicleType;
  distanceMiles: number; // total route distance in miles
  isAccidentRecovery?: boolean | undefined;
  vehicleCount?: number | undefined; // for bulk transport
  dynamicFuelCostPerMile?: number | undefined; // optional override from admin panel
  surgeMultiplier?: number | undefined; // dynamic demand multiplier (default 1)
  pickupDate?: string | undefined; // ISO date string for delivery type calculation
  deliveryDate?: string | undefined; // ISO date string for delivery type calculation
  fuelPricePerGallon?: number | undefined; // current fuel price per gallon (default 3.70)
}

// Pricing constants
const MIN_MILES = 100;
const MIN_QUOTE = 150;
const ACCIDENT_MIN_QUOTE = 80;
const BASE_FUEL_PRICE = 3.70; // Base fuel price per gallon for adjustment calculation

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
  deliveryTypeMultiplier: number; // 1.25 for expedited, 0.95 for flexible, 1.0 for standard
  deliveryType: 'expedited' | 'flexible' | 'standard';
  fuelPricePerGallon: number; // Current fuel price per gallon
  fuelAdjustmentPercent: number; // Percentage adjustment based on fuel price deviation from base
  minimumApplied: boolean; // true if MIN_QUOTE or ACCIDENT_MIN_QUOTE was applied
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

/**
 * Determine delivery type based on pickup and delivery dates
 * Expedited: blank delivery date OR delivery within 7 days of pickup (1.25x multiplier)
 * Flexible: delivery 7+ days from pickup (0.95x multiplier)
 * Standard: no dates provided (1.0x multiplier)
 */
function determineDeliveryType(pickupDate?: string, deliveryDate?: string): {
  type: 'expedited' | 'flexible' | 'standard';
  multiplier: number;
} {
  // No dates provided - standard pricing
  if (!pickupDate) {
    return { type: 'standard', multiplier: 1.0 };
  }

  // Blank delivery date means expedited (ASAP)
  if (!deliveryDate) {
    return { type: 'expedited', multiplier: 1.25 };
  }

  try {
    const pickup = new Date(pickupDate);
    const delivery = new Date(deliveryDate);
    
    // Calculate days between pickup and delivery
    const daysDiff = Math.ceil((delivery.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24));
    
    // Less than 7 days = expedited, 7+ days = flexible
    if (daysDiff < 7) {
      return { type: 'expedited', multiplier: 1.25 };
    } else {
      return { type: 'flexible', multiplier: 0.95 };
    }
  } catch (error) {
    logger.warn('Error parsing dates for delivery type, using standard', { pickupDate, deliveryDate, error });
    return { type: 'standard', multiplier: 1.0 };
  }
}

export async function calculateQuoteWithDynamicConfig(input: PricingInput): Promise<{ total: number; breakdown: PricingBreakdown }> {
  try {
    // Get dynamic pricing configuration
    const config = await pricingConfigService.getActiveConfig();
    
    // Use dynamic values from config, with input overrides
    const {
      vehicleType,
      distanceMiles,
      isAccidentRecovery = false,
      vehicleCount = 1,
      dynamicFuelCostPerMile,
      surgeMultiplier: inputSurgeMultiplier,
      pickupDate,
      deliveryDate,
      fuelPricePerGallon: inputFuelPrice,
    } = input;

    // Use config values with input overrides
    const fuelPricePerGallon = inputFuelPrice ?? config.current_fuel_price;
    const baseFuelPrice = config.base_fuel_price;
    const minQuote = config.min_quote;
    const accidentMinQuote = config.accident_min_quote;
    const minMiles = config.min_miles;
    
    // Apply surge multiplier from config if enabled, or use input override
    let surgeMultiplier = inputSurgeMultiplier ?? 1;
    if (config.surge_enabled && !inputSurgeMultiplier) {
      surgeMultiplier = config.surge_multiplier;
    }

    // Determine delivery type and multiplier using config values
    const deliveryTypeInfo = determineDeliveryTypeWithConfig(
      pickupDate, 
      deliveryDate,
      config
    );

    const distanceBand = determineDistanceBandWithConfig(distanceMiles, config);
    const baseRates = BASE_RATES[vehicleType];
    const baseRatePerMile = isAccidentRecovery ? baseRates.accident : baseRates[distanceBand];
    const rawBasePrice = baseRatePerMile * distanceMiles;

    // Bulk discount
    const bulkDiscountPercent = config.bulk_discount_enabled 
      ? getBulkDiscountPercent(vehicleCount) 
      : 0;
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

    // Apply surge, delivery type multiplier, and subtract discount
    let subtotal = (rawBasePrice - bulkDiscountAmount) * surgeMultiplier * deliveryTypeInfo.multiplier;
    
    // Calculate fuel price adjustment using config values
    const fuelAdjustmentPercent = (fuelPricePerGallon - baseFuelPrice) * (config.fuel_adjustment_per_dollar / 100);
    const fuelAdjustmentMultiplier = 1 + fuelAdjustmentPercent;
    subtotal = subtotal * fuelAdjustmentMultiplier;
    
    // Apply minimum quote logic AFTER fuel adjustment using config values
    let minimumApplied = false;
    
    if (isAccidentRecovery) {
      // Accident recovery minimum
      if (subtotal < accidentMinQuote) {
        subtotal = accidentMinQuote;
        minimumApplied = true;
      }
    } else if (distanceMiles < minMiles) {
      // Standard minimum for trips under MIN_MILES
      if (subtotal < minQuote) {
        subtotal = minQuote;
        minimumApplied = true;
      }
    }

    const total = Math.max(0, parseFloat(subtotal.toFixed(2)));

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
      deliveryTypeMultiplier: deliveryTypeInfo.multiplier,
      deliveryType: deliveryTypeInfo.type,
      fuelPricePerGallon: parseFloat(fuelPricePerGallon.toFixed(2)),
      fuelAdjustmentPercent: parseFloat(fuelAdjustmentPercent.toFixed(2)),
      minimumApplied,
      total,
    };

    logger.debug('Calculated pricing with dynamic config', { input, breakdown, configId: config.id });
    return { total, breakdown };
  } catch (error) {
    logger.error('Error calculating quote with dynamic config, falling back to static', { error });
    // Fallback to static calculation
    return calculateQuote(input);
  }
}

function determineDistanceBandWithConfig(miles: number, config: any): 'short' | 'mid' | 'long' {
  if (miles <= config.short_distance_max) return 'short';
  if (miles <= config.mid_distance_max) return 'mid';
  return 'long';
}

function determineDeliveryTypeWithConfig(
  pickupDate?: string, 
  deliveryDate?: string,
  config?: any
): {
  type: 'expedited' | 'flexible' | 'standard';
  multiplier: number;
} {
  // Use config multipliers if available, otherwise use defaults
  const expeditedMult = config?.expedited_multiplier ?? 1.25;
  const standardMult = config?.standard_multiplier ?? 1.00;
  const flexibleMult = config?.flexible_multiplier ?? 0.95;
  
  // Check if services are enabled
  const expeditedEnabled = config?.expedited_service_enabled ?? true;
  const flexibleEnabled = config?.flexible_service_enabled ?? true;

  // No dates provided - standard pricing
  if (!pickupDate) {
    return { type: 'standard', multiplier: standardMult };
  }

  // Blank delivery date means expedited (ASAP)
  if (!deliveryDate) {
    return expeditedEnabled 
      ? { type: 'expedited', multiplier: expeditedMult }
      : { type: 'standard', multiplier: standardMult };
  }

  try {
    const pickup = new Date(pickupDate);
    const delivery = new Date(deliveryDate);
    
    // Calculate days between pickup and delivery
    const daysDiff = Math.ceil((delivery.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24));
    
    // Less than 7 days = expedited, 7+ days = flexible
    if (daysDiff < 7) {
      return expeditedEnabled
        ? { type: 'expedited', multiplier: expeditedMult }
        : { type: 'standard', multiplier: standardMult };
    } else {
      return flexibleEnabled
        ? { type: 'flexible', multiplier: flexibleMult }
        : { type: 'standard', multiplier: standardMult };
    }
  } catch (error) {
    logger.warn('Error parsing dates for delivery type, using standard', { pickupDate, deliveryDate, error });
    return { type: 'standard', multiplier: standardMult };
  }
}

export function calculateQuote(input: PricingInput): { total: number; breakdown: PricingBreakdown } {
  const {
    vehicleType,
    distanceMiles,
    isAccidentRecovery = false,
    vehicleCount = 1,
    dynamicFuelCostPerMile,
    surgeMultiplier = 1,
    pickupDate,
    deliveryDate,
    fuelPricePerGallon = BASE_FUEL_PRICE, // Default to $3.70/gallon
  } = input;

  // Determine delivery type and multiplier
  const deliveryTypeInfo = determineDeliveryType(pickupDate, deliveryDate);

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

  // Apply surge, delivery type multiplier, and subtract discount
  let subtotal = (rawBasePrice - bulkDiscountAmount) * surgeMultiplier * deliveryTypeInfo.multiplier;
  
  // Calculate fuel price adjustment (5% per $1 deviation from base price)
  // Formula: (current_fuel - base_fuel) × 0.05
  // Example: If fuel is $4.70 (+$1), adjustment is +5% → multiply by 1.05
  // Example: If fuel is $2.70 (-$1), adjustment is -5% → multiply by 0.95
  const fuelAdjustmentPercent = (fuelPricePerGallon - BASE_FUEL_PRICE) * 5; // Convert to percentage
  const fuelAdjustmentMultiplier = 1 + (fuelAdjustmentPercent / 100);
  subtotal = subtotal * fuelAdjustmentMultiplier;
  
  // Apply minimum quote logic AFTER fuel adjustment
  let minimumApplied = false;
  
  if (isAccidentRecovery) {
    // Accident recovery minimum
    if (subtotal < ACCIDENT_MIN_QUOTE) {
      subtotal = ACCIDENT_MIN_QUOTE;
      minimumApplied = true;
    }
  } else if (distanceMiles < MIN_MILES) {
    // Standard minimum for trips under MIN_MILES
    if (subtotal < MIN_QUOTE) {
      subtotal = MIN_QUOTE;
      minimumApplied = true;
    }
  }

  const total = Math.max(0, parseFloat(subtotal.toFixed(2)));

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
    deliveryTypeMultiplier: deliveryTypeInfo.multiplier,
    deliveryType: deliveryTypeInfo.type,
    fuelPricePerGallon: parseFloat(fuelPricePerGallon.toFixed(2)),
    fuelAdjustmentPercent: parseFloat(fuelAdjustmentPercent.toFixed(2)),
    minimumApplied,
    total,
  };

  logger.debug('Calculated pricing breakdown', { input, breakdown });
  return { total, breakdown };
}

export const pricingService = { 
  calculateQuote,
  calculateQuoteWithDynamicConfig,
};
