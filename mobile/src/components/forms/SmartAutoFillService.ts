import { FormFieldConfig } from './ProgressiveFormProvider';

// Smart auto-fill service for progressive forms
export class SmartAutoFillService {
  private static instance: SmartAutoFillService;
  private userPreferences: any = {};
  private addressHistory: string[] = [];
  private vehicleHistory: any[] = [];

  public static getInstance(): SmartAutoFillService {
    if (!SmartAutoFillService.instance) {
      SmartAutoFillService.instance = new SmartAutoFillService();
    }
    return SmartAutoFillService.instance;
  }

  // Initialize with user data
  public initialize(userProfile: any, previousShipments: any[]) {
    this.userPreferences = {
      defaultTimePreference: this.extractCommonTimePreference(previousShipments),
      preferredPaymentMethod: this.extractCommonPaymentMethod(previousShipments),
      commonPickupAddresses: this.extractCommonAddresses(previousShipments, 'pickup'),
      commonDeliveryAddresses: this.extractCommonAddresses(previousShipments, 'delivery'),
      defaultVehicleInfo: this.extractCommonVehicleInfo(previousShipments),
      defaultTransportType: this.extractCommonTransportType(previousShipments),
    };

    // Store address and vehicle history
    this.addressHistory = this.extractAllAddresses(previousShipments);
    this.vehicleHistory = this.extractAllVehicles(previousShipments);
  }

  // Get smart suggestions for a field
  public getSmartSuggestions(fieldName: string, currentData: any): string[] {
    switch (fieldName) {
      case 'pickupAddress':
        return this.getAddressSuggestions('pickup', currentData);
      
      case 'deliveryAddress':
        return this.getAddressSuggestions('delivery', currentData);
      
      case 'pickupTimePreference':
      case 'deliveryTimePreference':
        return this.getTimePreferenceSuggestions();
      
      case 'vehicleMake':
        return this.getVehicleMakeSuggestions();
      
      case 'vehicleModel':
        return this.getVehicleModelSuggestions(currentData.vehicleMake);
      
      case 'paymentMethod':
        return this.getPaymentMethodSuggestions();
      
      case 'transportType':
        return this.getTransportTypeSuggestions(currentData);
      
      default:
        return [];
    }
  }

  // Auto-fill field based on smart logic
  public getAutoFillValue(fieldName: string, currentData: any): any {
    switch (fieldName) {
      case 'customerEmail':
        return this.userPreferences.email || '';
      
      case 'customerPhone':
        return this.userPreferences.phone || '';
      
      case 'pickupTimePreference':
      case 'deliveryTimePreference':
        return this.userPreferences.defaultTimePreference || '';
      
      case 'paymentMethod':
        return this.userPreferences.preferredPaymentMethod || '';
      
      case 'transportType':
        return this.getSmartTransportType(currentData);
      
      case 'serviceSpeed':
        return this.getSmartServiceSpeed(currentData);
      
      case 'insuranceValue':
        return this.getSmartInsuranceValue(currentData);
      
      case 'vehicleColor':
        return this.getSmartVehicleColor(currentData);
      
      default:
        return null;
    }
  }

  // Get contextual help for a field
  public getContextualHelp(fieldName: string, currentData: any): string | null {
    switch (fieldName) {
      case 'pickupAddress':
        return this.getAddressHelp('pickup', currentData);
      
      case 'deliveryAddress':
        return this.getAddressHelp('delivery', currentData);
      
      case 'pickupDate':
        return this.getPickupDateHelp(currentData);
      
      case 'deliveryDate':
        return this.getDeliveryDateHelp(currentData);
      
      case 'vehicleCondition':
        return 'Vehicle condition affects transport method and pricing. Be honest about any damage.';
      
      case 'vehicleRunning':
        return 'Non-running vehicles may require special equipment and affect pricing.';
      
      case 'transportType':
        return this.getTransportTypeHelp(currentData);
      
      case 'serviceSpeed':
        return this.getServiceSpeedHelp(currentData);
      
      case 'insuranceValue':
        return 'Set insurance value to the actual market value of your vehicle for proper coverage.';
      
      case 'flexibleDates':
        return 'Flexible dates can help you get better pricing and faster service.';
      
      default:
        return null;
    }
  }

  // Private helper methods
  private extractCommonTimePreference(shipments: any[]): string {
    const preferences = shipments.map(s => s.timePreference).filter(Boolean);
    return this.getMostCommon(preferences) || 'Anytime';
  }

  private extractCommonPaymentMethod(shipments: any[]): string {
    const methods = shipments.map(s => s.paymentMethod).filter(Boolean);
    return this.getMostCommon(methods) || 'Credit Card';
  }

  private extractCommonAddresses(shipments: any[], type: 'pickup' | 'delivery'): string[] {
    const addresses = shipments.map(s => s[`${type}Address`]).filter(Boolean);
    return [...new Set(addresses)].slice(0, 5); // Top 5 unique addresses
  }

  private extractCommonVehicleInfo(shipments: any[]): any {
    const vehicles = shipments.map(s => s.vehicle).filter(Boolean);
    if (vehicles.length === 0) return null;

    return {
      make: this.getMostCommon(vehicles.map(v => v.make)),
      model: this.getMostCommon(vehicles.map(v => v.model)),
      year: this.getMostCommon(vehicles.map(v => v.year)),
      color: this.getMostCommon(vehicles.map(v => v.color)),
    };
  }

  private extractCommonTransportType(shipments: any[]): string {
    const types = shipments.map(s => s.transportType).filter(Boolean);
    return this.getMostCommon(types) || 'Open Transport - More economical';
  }

  private extractAllAddresses(shipments: any[]): string[] {
    const addresses: string[] = [];
    shipments.forEach(s => {
      if (s.pickupAddress) addresses.push(s.pickupAddress);
      if (s.deliveryAddress) addresses.push(s.deliveryAddress);
    });
    return [...new Set(addresses)];
  }

  private extractAllVehicles(shipments: any[]): any[] {
    return shipments.map(s => s.vehicle).filter(Boolean);
  }

  private getMostCommon(arr: any[]): any {
    if (arr.length === 0) return null;
    
    const counts = arr.reduce((acc, val) => {
      acc[val] = (acc[val] || 0) + 1;
      return acc;
    }, {});
    
    const keys = Object.keys(counts);
    if (keys.length === 0) return null;
    
    return keys.reduce((a, b) => counts[a] > counts[b] ? a : b);
  }

  private getAddressSuggestions(type: 'pickup' | 'delivery', currentData: any): string[] {
    const commonAddresses = this.userPreferences[`common${type.charAt(0).toUpperCase() + type.slice(1)}Addresses`] || [];
    return commonAddresses.slice(0, 3);
  }

  private getTimePreferenceSuggestions(): string[] {
    const defaultPreference = this.userPreferences.defaultTimePreference;
    const suggestions = [
      'Morning (8AM - 12PM)',
      'Afternoon (12PM - 5PM)',
      'Evening (5PM - 8PM)',
      'Anytime'
    ];
    
    if (defaultPreference) {
      return [defaultPreference, ...suggestions.filter(s => s !== defaultPreference)];
    }
    
    return suggestions;
  }

  private getVehicleMakeSuggestions(): string[] {
    const userMakes = this.vehicleHistory.map(v => v.make).filter(Boolean);
    const uniqueMakes = [...new Set(userMakes)];
    
    const popularMakes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan'];
    return [...uniqueMakes, ...popularMakes.filter(m => !uniqueMakes.includes(m))].slice(0, 5);
  }

  private getVehicleModelSuggestions(make: string): string[] {
    if (!make) return [];
    
    const modelsForMake = this.vehicleHistory
      .filter(v => v.make === make)
      .map(v => v.model)
      .filter(Boolean);
    
    return [...new Set(modelsForMake)].slice(0, 5);
  }

  private getPaymentMethodSuggestions(): string[] {
    const preferred = this.userPreferences.preferredPaymentMethod;
    const methods = ['Credit Card', 'Cash on Delivery', 'Company Check', 'Bank Transfer'];
    
    if (preferred) {
      return [preferred, ...methods.filter(m => m !== preferred)];
    }
    
    return methods;
  }

  private getTransportTypeSuggestions(currentData: any): string[] {
    const vehicleValue = currentData.insuranceValue || 0;
    
    if (vehicleValue > 50000) {
      return ['Enclosed Transport - Premium protection', 'Open Transport - More economical'];
    }
    
    return ['Open Transport - More economical', 'Enclosed Transport - Premium protection'];
  }

  private getSmartTransportType(currentData: any): string {
    const vehicleValue = currentData.insuranceValue || 0;
    const vehicleYear = currentData.vehicleYear || 0;
    const currentYear = new Date().getFullYear();
    
    // Suggest enclosed for expensive or newer vehicles
    if (vehicleValue > 50000 || (vehicleYear && vehicleYear >= currentYear - 5)) {
      return 'Enclosed Transport - Premium protection';
    }
    
    return this.userPreferences.defaultTransportType || 'Open Transport - More economical';
  }

  private getSmartServiceSpeed(currentData: any): string {
    const pickupDate = currentData.pickupDate ? new Date(currentData.pickupDate) : null;
    const today = new Date();
    
    if (pickupDate) {
      const daysUntilPickup = Math.ceil((pickupDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilPickup <= 3) {
        return 'Rush - 1-3 days';
      } else if (daysUntilPickup <= 7) {
        return 'Expedited - 3-7 days';
      }
    }
    
    return 'Standard - 7-14 days';
  }

  private getSmartInsuranceValue(currentData: any): number | null {
    const { vehicleYear, vehicleMake, vehicleModel } = currentData;
    
    if (!vehicleYear || !vehicleMake) return null;
    
    // Simple estimation based on year and make
    const currentYear = new Date().getFullYear();
    const age = currentYear - vehicleYear;
    
    const baseValues: { [key: string]: number } = {
      'BMW': 35000,
      'Mercedes-Benz': 40000,
      'Audi': 35000,
      'Lexus': 35000,
      'Toyota': 25000,
      'Honda': 23000,
      'Ford': 22000,
      'Chevrolet': 24000,
      'Nissan': 22000,
    };
    
    const baseValue = baseValues[vehicleMake] || 25000;
    const depreciationRate = 0.15; // 15% per year
    const estimatedValue = baseValue * Math.pow(1 - depreciationRate, age);
    
    return Math.max(Math.round(estimatedValue / 1000) * 1000, 5000); // Round to nearest thousand, minimum $5,000
  }

  private getSmartVehicleColor(currentData: any): string {
    const { vehicleMake, vehicleModel } = currentData;
    
    // Common colors for popular makes
    const commonColors: { [key: string]: string[] } = {
      'BMW': ['Black', 'White', 'Silver', 'Gray'],
      'Mercedes-Benz': ['Black', 'Silver', 'White'],
      'Toyota': ['White', 'Silver', 'Black', 'Gray'],
      'Honda': ['White', 'Black', 'Silver', 'Blue'],
    };
    
    const colors = commonColors[vehicleMake] || ['White', 'Black', 'Silver', 'Gray'];
    return colors[0]; // Return most common color for the make
  }

  private getAddressHelp(type: 'pickup' | 'delivery', currentData: any): string {
    const hasCommonAddresses = this.userPreferences[`common${type.charAt(0).toUpperCase() + type.slice(1)}Addresses`]?.length > 0;
    
    if (hasCommonAddresses) {
      return `We've suggested your most common ${type} addresses. Enter a new address or select from suggestions.`;
    }
    
    return `Enter the complete ${type} address including street, city, state, and ZIP code for accurate service.`;
  }

  private getPickupDateHelp(currentData: any): string {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return `Earliest pickup is tomorrow (${tomorrow.toLocaleDateString()}). Advance booking may offer better rates.`;
  }

  private getDeliveryDateHelp(currentData: any): string {
    const pickupDate = currentData.pickupDate ? new Date(currentData.pickupDate) : new Date();
    const minDelivery = new Date(pickupDate);
    minDelivery.setDate(minDelivery.getDate() + 1);
    
    return `Delivery is typically 1-14 days after pickup. Flexible dates help optimize routing and pricing.`;
  }

  private getTransportTypeHelp(currentData: any): string {
    const vehicleValue = currentData.insuranceValue || 0;
    
    if (vehicleValue > 50000) {
      return 'For high-value vehicles, enclosed transport provides superior protection from weather and road debris.';
    }
    
    return 'Open transport is cost-effective and safe for most vehicles. Enclosed transport offers premium protection.';
  }

  private getServiceSpeedHelp(currentData: any): string {
    const pickupDate = currentData.pickupDate ? new Date(currentData.pickupDate) : null;
    
    if (pickupDate) {
      const today = new Date();
      const daysUntilPickup = Math.ceil((pickupDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilPickup <= 3) {
        return 'Rush service available for urgent shipments. Premium pricing applies for expedited handling.';
      }
    }
    
    return 'Standard service offers the best value. Expedited options available for time-sensitive shipments.';
  }
}

// Export singleton instance
export const smartAutoFill = SmartAutoFillService.getInstance();