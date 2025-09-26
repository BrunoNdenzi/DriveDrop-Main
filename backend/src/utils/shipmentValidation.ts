/**
 * Shipment validation utility functions
 */
import { DraftShipmentData, CompleteShipmentData, ValidationResult, ShipmentProgress } from '../types/api.types';

/**
 * Required fields for complete shipment submission
 */
const REQUIRED_FIELDS = [
  'pickup_address',
  'delivery_address',
  'description',
  'title',
  'pickup_location',
  'delivery_location'
] as const;

/**
 * Optional fields that improve shipment quality
 */
const RECOMMENDED_FIELDS = [
  'vehicle_type',
  'vehicle_make',
  'vehicle_model',
  'scheduled_pickup',
  'pickup_date',
  'delivery_date',
  'estimated_price'
] as const;

/**
 * Field categories for progress tracking
 */
const FIELD_SECTIONS = {
  pickup: ['pickup_address', 'pickup_location', 'pickup_city', 'pickup_state', 'pickup_zip', 'pickup_notes', 'pickup_date'],
  delivery: ['delivery_address', 'delivery_location', 'delivery_city', 'delivery_state', 'delivery_zip', 'delivery_notes', 'delivery_date'],
  vehicle: ['vehicle_type', 'vehicle_make', 'vehicle_model'],
  shipment: ['title', 'description', 'cargo_type', 'weight_kg', 'dimensions_cm', 'item_value', 'is_fragile'],
  pricing: ['estimated_price', 'distance_miles', 'is_accident_recovery', 'vehicle_count']
};

/**
 * Validate draft shipment data
 */
export function validateDraftShipment(data: DraftShipmentData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];

  // Check for data consistency
  if (data.pickup_address && !data.pickup_location) {
    warnings.push('Pickup address provided but location coordinates missing');
  }

  if (data.delivery_address && !data.delivery_location) {
    warnings.push('Delivery address provided but location coordinates missing');
  }

  if (data.vehicle_make && !data.vehicle_model) {
    warnings.push('Vehicle make provided but model missing');
  }

  if (data.vehicle_model && !data.vehicle_make) {
    warnings.push('Vehicle model provided but make missing');
  }

  if (data.pickup_date && data.delivery_date) {
    const pickupDate = new Date(data.pickup_date);
    const deliveryDate = new Date(data.delivery_date);
    
    if (pickupDate >= deliveryDate) {
      errors.push('Delivery date must be after pickup date');
    }

    if (pickupDate < new Date()) {
      errors.push('Pickup date cannot be in the past');
    }
  }

  if (data.estimated_price && data.estimated_price < 0) {
    errors.push('Estimated price cannot be negative');
  }

  if (data.distance_miles && data.distance_miles < 0) {
    errors.push('Distance cannot be negative');
  }

  if (data.weight_kg && data.weight_kg < 0) {
    errors.push('Weight cannot be negative');
  }

  if (data.vehicle_count && data.vehicle_count < 1) {
    errors.push('Vehicle count must be at least 1');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingFields
  };
}

/**
 * Validate complete shipment data for final submission
 */
export function validateCompleteShipment(data: DraftShipmentData): ValidationResult {
  const draftValidation = validateDraftShipment(data);
  const errors = [...draftValidation.errors];
  const warnings = [...draftValidation.warnings];
  const missingFields: string[] = [];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!data[field] || (typeof data[field] === 'string' && data[field]!.trim() === '')) {
      missingFields.push(field);
      errors.push(`Required field '${field}' is missing`);
    }
  }

  // Check recommended fields
  for (const field of RECOMMENDED_FIELDS) {
    if (!data[field]) {
      warnings.push(`Recommended field '${field}' is missing`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    missingFields
  };
}

/**
 * Calculate shipment completion progress
 */
export function calculateShipmentProgress(data: DraftShipmentData): ShipmentProgress {
  const completedSections: string[] = [];
  const missingSections: string[] = [];
  const nextRequiredFields: string[] = [];
  
  let totalFields = 0;
  let completedFields = 0;

  // Check each section
  for (const [sectionName, fields] of Object.entries(FIELD_SECTIONS)) {
    let sectionCompleted = 0;

    for (const field of fields) {
      totalFields++;
      if (data[field as keyof DraftShipmentData]) {
        completedFields++;
        sectionCompleted++;
      } else if (REQUIRED_FIELDS.includes(field as any)) {
        nextRequiredFields.push(field);
      }
    }

    // Section is complete if it has some data and all required fields for that section
    const sectionRequiredFields = fields.filter(f => REQUIRED_FIELDS.includes(f as any));
    const sectionRequiredComplete = sectionRequiredFields.every(f => data[f as keyof DraftShipmentData]);
    
    if (sectionCompleted > 0 && (sectionRequiredFields.length === 0 || sectionRequiredComplete)) {
      completedSections.push(sectionName);
    } else if (sectionRequiredFields.length > 0) {
      missingSections.push(sectionName);
    }
  }

  const completionPercentage = Math.round((completedFields / totalFields) * 100);

  return {
    completionPercentage,
    completedSections,
    missingSections,
    nextRequiredFields: nextRequiredFields.slice(0, 3) // Return top 3 next required fields
  };
}

/**
 * Check if draft can be converted to complete shipment
 */
export function canCompleteShipment(data: DraftShipmentData): boolean {
  const validation = validateCompleteShipment(data);
  return validation.isValid;
}

/**
 * Convert draft data to complete shipment data
 */
export function convertToCompleteShipment(data: DraftShipmentData): CompleteShipmentData | null {
  if (!canCompleteShipment(data)) {
    return null;
  }

  return {
    ...data,
    pickup_location: data.pickup_location!,
    delivery_location: data.delivery_location!,
    pickup_address: data.pickup_address!,
    delivery_address: data.delivery_address!,
    description: data.description!,
    title: data.title!
  };
}

/**
 * Get human-readable field names for UI display
 */
export function getFieldDisplayName(fieldName: string): string {
  const fieldNames: Record<string, string> = {
    pickup_address: 'Pickup Address',
    delivery_address: 'Delivery Address',
    pickup_location: 'Pickup Location',
    delivery_location: 'Delivery Location',
    description: 'Shipment Description',
    title: 'Shipment Title',
    vehicle_type: 'Vehicle Type',
    vehicle_make: 'Vehicle Make',
    vehicle_model: 'Vehicle Model',
    pickup_date: 'Pickup Date',
    delivery_date: 'Delivery Date',
    estimated_price: 'Estimated Price'
  };

  return fieldNames[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}