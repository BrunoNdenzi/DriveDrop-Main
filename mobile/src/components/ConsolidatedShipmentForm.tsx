import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Animated,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../constants/Colors';
import EnhancedGooglePlacesInput from './EnhancedGooglePlacesInput';
import { pricingService } from '../services/pricingService';
import { useAuth } from '../context/AuthContext';

interface ShipmentData {
  // Customer Info
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  
  // Locations
  pickupAddress: string;
  pickupCoordinates?: { lat: number; lng: number };
  deliveryAddress: string;
  deliveryCoordinates?: { lat: number; lng: number };
  pickupDate: string;
  deliveryDate: string;
  
  // Vehicle Details
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  isOperable: boolean;
  
  // Shipment Details
  shipmentType: string;
  specialInstructions: string;
  
  // Pricing
  estimatedPrice: number;
  distance: number;
}

// Vehicle database
const VEHICLE_DATABASE = {
  'Sedan': {
    'Toyota': ['Camry', 'Corolla', 'Avalon', 'Prius'],
    'Honda': ['Civic', 'Accord', 'Insight'],
    'BMW': ['3 Series', '5 Series', '7 Series'],
    'Mercedes-Benz': ['C-Class', 'E-Class', 'S-Class'],
    'Audi': ['A3', 'A4', 'A6', 'A8'],
    'Nissan': ['Altima', 'Sentra', 'Maxima'],
    'Ford': ['Fusion', 'Focus'],
    'Hyundai': ['Elantra', 'Sonata'],
    'Kia': ['Forte', 'Optima'],
    'Volkswagen': ['Jetta', 'Passat'],
    'Subaru': ['Legacy', 'Impreza'],
    'Mazda': ['Mazda3', 'Mazda6']
  },
  'SUV': {
    'Toyota': ['RAV4', 'Highlander', '4Runner', 'Sequoia', 'Land Cruiser'],
    'Honda': ['CR-V', 'Pilot', 'Passport', 'HR-V'],
    'Ford': ['Explorer', 'Expedition', 'Escape', 'Edge', 'Bronco'],
    'Chevrolet': ['Suburban', 'Tahoe', 'Traverse', 'Equinox', 'Blazer'],
    'BMW': ['X3', 'X5', 'X7', 'iX'],
    'Mercedes-Benz': ['GLE', 'GLS', 'GLA', 'GLB', 'GLC'],
    'Audi': ['Q3', 'Q5', 'Q7', 'Q8', 'e-tron'],
    'Nissan': ['Rogue', 'Pathfinder', 'Armada', 'Murano'],
    'Hyundai': ['Tucson', 'Santa Fe', 'Palisade'],
    'Kia': ['Sorento', 'Telluride', 'Sportage'],
    'Jeep': ['Grand Cherokee', 'Wrangler', 'Cherokee', 'Compass'],
    'Cadillac': ['Escalade', 'XT5', 'XT6'],
    'Lincoln': ['Navigator', 'Aviator', 'Corsair']
  },
  'Truck': {
    'Ford': ['F-150', 'F-250', 'F-350', 'Ranger', 'Maverick'],
    'Chevrolet': ['Silverado 1500', 'Silverado 2500', 'Colorado'],
    'Ram': ['1500', '2500', '3500'],
    'Toyota': ['Tacoma', 'Tundra'],
    'Nissan': ['Frontier', 'Titan'],
    'GMC': ['Sierra 1500', 'Sierra 2500', 'Canyon'],
    'Jeep': ['Gladiator'],
    'Honda': ['Ridgeline']
  },
  'Coupe': {
    'BMW': ['2 Series', '4 Series', '8 Series'],
    'Mercedes-Benz': ['C-Class Coupe', 'E-Class Coupe', 'S-Class Coupe'],
    'Audi': ['A5', 'TT'],
    'Ford': ['Mustang'],
    'Chevrolet': ['Camaro', 'Corvette'],
    'Dodge': ['Challenger', 'Charger'],
    'Nissan': ['370Z', 'GT-R'],
    'Toyota': ['Supra', '86'],
    'Subaru': ['BRZ'],
    'Porsche': ['911', 'Cayman', 'Panamera']
  },
  'Convertible': {
    'BMW': ['2 Series Convertible', '4 Series Convertible', '8 Series Convertible'],
    'Mercedes-Benz': ['C-Class Convertible', 'E-Class Convertible', 'SL-Class'],
    'Audi': ['A5 Convertible', 'TT Roadster'],
    'Ford': ['Mustang Convertible'],
    'Chevrolet': ['Camaro Convertible', 'Corvette Convertible'],
    'Mazda': ['MX-5 Miata'],
    'Porsche': ['911 Convertible', 'Boxster'],
    'Mini': ['Cooper Convertible'],
    'Jeep': ['Wrangler']
  },
  'Van': {
    'Ford': ['Transit', 'E-Series'],
    'Chevrolet': ['Express', 'City Express'],
    'Mercedes-Benz': ['Sprinter', 'Metris'],
    'RAM': ['ProMaster', 'ProMaster City'],
    'Nissan': ['NV200', 'NV1500', 'NV2500', 'NV3500']
  },
  'Motorcycle': {
    'Harley-Davidson': ['Street', 'Sportster', 'Touring', 'CVO', 'Softail'],
    'Honda': ['CBR', 'CRF', 'Gold Wing', 'Rebel', 'Africa Twin'],
    'Yamaha': ['YZF', 'MT', 'Tenere', 'Star', 'FJR'],
    'Kawasaki': ['Ninja', 'Z', 'Versys', 'Vulcan', 'Concours'],
    'BMW': ['S', 'R', 'K', 'F', 'G'],
    'Ducati': ['Panigale', 'Monster', 'Multistrada', 'Diavel'],
    'Triumph': ['Bonneville', 'Speed Triple', 'Tiger'],
    'Indian': ['Scout', 'Chief', 'Chieftain']
  },
  'RV/Trailer': {
    'Thor': ['Ace', 'Hurricane', 'Windsport', 'Palazzo'],
    'Forest River': ['Berkshire', 'Georgetown', 'Legacy', 'FR3'],
    'Winnebago': ['Vista', 'Adventurer', 'Forza', 'Intent'],
    'Jayco': ['Precept', 'Embark', 'Seneca', 'Alante'],
    'Newmar': ['Bay Star', 'Canyon Star', 'Dutch Star'],
    'Coachmen': ['Mirada', 'Pursuit', 'Cross Trail'],
    'Fleetwood': ['Bounder', 'Discovery', 'Pace Arrow']
  },
  'Boat': {
    'Sea Ray': ['Sundancer', 'SLX', 'SPX', 'Fly'],
    'Boston Whaler': ['Outrage', 'Conquest', 'Dauntless', 'Montauk'],
    'Bayliner': ['VR', 'DX', 'Element', 'Trophy'],
    'Chaparral': ['SSi', 'OSX', 'Surf', 'Suncoast'],
    'Mastercraft': ['NXT', 'XT', 'XStar', 'ProStar'],
    'Cobalt': ['R Series', 'A Series', 'CS Series'],
    'Formula': ['Bowrider', 'Cruiser', 'Performance']
  },
  'Heavy Equipment': {
    'Caterpillar': ['Excavator', 'Bulldozer', 'Loader', 'Grader', 'Skid Steer'],
    'John Deere': ['Excavator', 'Bulldozer', 'Loader', 'Backhoe', 'Grader'],
    'Komatsu': ['Excavator', 'Bulldozer', 'Loader', 'Grader'],
    'Bobcat': ['Skid Steer', 'Excavator', 'Loader', 'Telehandler'],
    'Case': ['Excavator', 'Bulldozer', 'Backhoe', 'Skid Steer'],
    'Volvo': ['Excavator', 'Loader', 'Grader', 'Articulated Hauler'],
    'Liebherr': ['Excavator', 'Crane', 'Loader', 'Dozer']
  }
};

interface CollapsibleSectionProps {
  title: string;
  icon: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isValid?: boolean;
  summary?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
  isValid = false,
  summary
}) => {
  const [animation] = useState(new Animated.Value(isExpanded ? 1 : 0));

  useEffect(() => {
    Animated.timing(animation, {
      toValue: isExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isExpanded]);

  const contentHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1000], // Adjust max height as needed
  });

  return (
    <View style={styles.section}>
      <TouchableOpacity 
        style={[
          styles.sectionHeader, 
          isValid && styles.sectionHeaderValid,
          isExpanded && styles.sectionHeaderExpanded
        ]} 
        onPress={onToggle}
      >
        <View style={styles.sectionHeaderLeft}>
          <MaterialIcons 
            name={icon as any} 
            size={24} 
            color={isValid ? Colors.success : Colors.primary} 
          />
          <Text style={styles.sectionTitle} numberOfLines={1} ellipsizeMode="tail">
            {title}
          </Text>
          {isValid && !isExpanded && (
            <MaterialIcons name="check-circle" size={20} color={Colors.success} />
          )}
        </View>
        <View style={styles.sectionHeaderRight}>
          {!isExpanded && summary && (
            <Text style={styles.sectionSummary} numberOfLines={1} ellipsizeMode="tail">
              {summary}
            </Text>
          )}
          <MaterialIcons 
            name={isExpanded ? "expand-less" : "expand-more"} 
            size={24} 
            color={Colors.text.secondary} 
          />
        </View>
      </TouchableOpacity>
      
      <Animated.View style={[styles.sectionContent, { maxHeight: contentHeight }]}>
        <View style={styles.sectionInner}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
};

interface ConsolidatedShipmentFormProps {
  onSubmit: (data: ShipmentData) => void;
  initialData?: Partial<ShipmentData>;
}

const ConsolidatedShipmentForm: React.FC<ConsolidatedShipmentFormProps> = ({
  onSubmit,
  initialData = {}
}) => {
  const { userProfile } = useAuth();

  const [formData, setFormData] = useState<ShipmentData>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    pickupAddress: '',
    deliveryAddress: '',
    pickupDate: '',
    deliveryDate: '',
    vehicleType: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    isOperable: true,
    shipmentType: 'Personal Vehicle',
    specialInstructions: '',
    estimatedPrice: 0,
    distance: 0,
    ...initialData
  });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    customer: false, // Start collapsed since it will be auto-populated
    pickup: true,    // Start with pickup section expanded
    delivery: false,
    vehicle: false,
    details: false,
    pricing: false
  });

  const [sectionValidation, setSectionValidation] = useState<Record<string, boolean>>({
    customer: false,
    pickup: false,
    delivery: false,
    vehicle: false,
    details: false,
    pricing: false
  });

  const [realTimePrice, setRealTimePrice] = useState<number>(0);
  const [showPickupDatePicker, setShowPickupDatePicker] = useState(false);
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);
  const [availableMakes, setAvailableMakes] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  
  // Modal states for enhanced dropdowns
  const [showVehicleTypeModal, setShowVehicleTypeModal] = useState(false);
  const [showVehicleMakeModal, setShowVehicleMakeModal] = useState(false);
  const [showVehicleModelModal, setShowVehicleModelModal] = useState(false);
  const [showShipmentTypeModal, setShowShipmentTypeModal] = useState(false);

  // Auto-populate customer information on component mount
  useEffect(() => {
    if (userProfile) {
      const customerName = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim();
      setFormData(prev => ({
        ...prev,
        customerName: customerName || prev.customerName,
        customerEmail: userProfile.email || prev.customerEmail,
        customerPhone: userProfile.phone || prev.customerPhone,
      }));
    }
  }, [userProfile]);

  // Update available makes when vehicle type changes
  useEffect(() => {
    if (formData.vehicleType && VEHICLE_DATABASE[formData.vehicleType as keyof typeof VEHICLE_DATABASE]) {
      const makes = Object.keys(VEHICLE_DATABASE[formData.vehicleType as keyof typeof VEHICLE_DATABASE]);
      setAvailableMakes(makes);
      
      // Reset make and model if current selection is not valid for new type
      if (!makes.includes(formData.vehicleMake)) {
        setFormData(prev => ({ ...prev, vehicleMake: '', vehicleModel: '' }));
        setAvailableModels([]);
      }
    } else {
      setAvailableMakes([]);
      setAvailableModels([]);
    }
  }, [formData.vehicleType]);

  // Update available models when make changes
  useEffect(() => {
    if (formData.vehicleType && formData.vehicleMake && VEHICLE_DATABASE[formData.vehicleType as keyof typeof VEHICLE_DATABASE]) {
      const vehicleTypeData = VEHICLE_DATABASE[formData.vehicleType as keyof typeof VEHICLE_DATABASE];
      const models = vehicleTypeData[formData.vehicleMake as keyof typeof vehicleTypeData];
      const modelArray: string[] = Array.isArray(models) ? models : [];
      setAvailableModels(modelArray);
      
      // Reset model if current selection is not valid for new make
      if (modelArray.length > 0 && formData.vehicleModel && !modelArray.includes(formData.vehicleModel)) {
        setFormData(prev => ({ ...prev, vehicleModel: '' }));
      }
    } else {
      setAvailableModels([]);
    }
  }, [formData.vehicleMake]);

  // Real-time pricing calculation using backend API
  useEffect(() => {
    const calculatePrice = async () => {
      if (formData.pickupAddress && formData.deliveryAddress && formData.vehicleType) {
        try {
          // First get distance calculation
          const pricingData = await pricingService.getProgressiveEstimate({
            pickupAddress: formData.pickupAddress,
            deliveryAddress: formData.deliveryAddress,
            vehicleType: formData.vehicleType,
          });
          
          const distance = pricingData.distance.miles;
          
          // Now call backend API for accurate pricing with minimums and delivery type logic
          try {
            const backendPricing = await pricingService.getBackendPricing({
              vehicleType: formData.vehicleType,
              distanceMiles: distance,
              pickupDate: formData.pickupDate || undefined,
              deliveryDate: formData.deliveryDate || undefined,
              isAccidentRecovery: false,
              vehicleCount: 1,
              surgeMultiplier: 1.0,
            });
            
            const estimatedPrice = backendPricing.total;
            
            console.log('Backend pricing result:', {
              distance,
              vehicleType: formData.vehicleType,
              pickupDate: formData.pickupDate,
              deliveryDate: formData.deliveryDate,
              total: estimatedPrice,
              breakdown: backendPricing.breakdown
            });
            
            setRealTimePrice(estimatedPrice);
            setFormData(prev => ({ 
              ...prev, 
              estimatedPrice: estimatedPrice,
              distance: distance 
            }));
          } catch (backendError) {
            console.error('Backend pricing API failed, using client-side estimate:', backendError);
            // Fallback to client-side pricing if backend fails
            const estimatedPrice = pricingData.estimate.total;
            setRealTimePrice(estimatedPrice);
            setFormData(prev => ({ 
              ...prev, 
              estimatedPrice: estimatedPrice,
              distance: distance 
            }));
          }
        } catch (error) {
          console.error('Error calculating price:', error);
          // Fallback to simple calculation if everything fails
          const basePrice = 200;
          const vehicleMultiplier = formData.vehicleType === 'SUV' ? 1.3 : 
                                   formData.vehicleType === 'Truck' ? 1.5 : 1.0;
          const operableDiscount = formData.isOperable ? 1.0 : 1.2;
          const mockDistance = Math.floor(Math.random() * 500) + 100;
          
          const estimatedPrice = Math.floor(basePrice * vehicleMultiplier * operableDiscount + (mockDistance * 0.5));
          
          setRealTimePrice(estimatedPrice);
          setFormData(prev => ({ 
            ...prev, 
            estimatedPrice: estimatedPrice,
            distance: mockDistance 
          }));
        }
      }
    };

    const debounceTimer = setTimeout(calculatePrice, 1000);
    return () => clearTimeout(debounceTimer);
  }, [formData.pickupAddress, formData.deliveryAddress, formData.vehicleType, formData.isOperable, formData.pickupDate, formData.deliveryDate]);

  // Selection helpers
  const vehicleTypes = [
    { type: 'Sedan', enabled: true },
    { type: 'SUV', enabled: true },
    { type: 'Truck', enabled: true },
    { type: 'Coupe', enabled: false },
    { type: 'Convertible', enabled: false },
    { type: 'Van', enabled: false },
    { type: 'Motorcycle', enabled: false },
    { type: 'RV/Trailer', enabled: false },
    { type: 'Boat', enabled: false },
    { type: 'Heavy Equipment', enabled: false },
    { type: 'Other', enabled: false }
  ];

  const shipmentTypes = [
    'Personal Vehicle',
    'Commercial Vehicle', 
    'Motorcycle',
    'Boat',
    'RV/Trailer',
    'Heavy Equipment',
    'Other'
  ];

  const showVehicleTypePicker = () => {
    setShowVehicleTypeModal(true);
  };

  const showShipmentTypePicker = () => {
    setShowShipmentTypeModal(true);
  };

  const selectVehicleType = (type: string) => {
    updateField('vehicleType', type);
    setShowVehicleTypeModal(false);
  };

  const selectVehicleMake = (make: string) => {
    updateField('vehicleMake', make);
    setShowVehicleMakeModal(false);
  };

  const selectVehicleModel = (model: string) => {
    updateField('vehicleModel', model);
    setShowVehicleModelModal(false);
  };

  const selectShipmentType = (type: string) => {
    updateField('shipmentType', type);
    setShowShipmentTypeModal(false);
  };

  // Validation logic
  useEffect(() => {
    const customerValid = !!(formData.customerName && formData.customerEmail && formData.customerPhone);
    const pickupValid = !!(formData.pickupAddress && formData.pickupDate);
    const deliveryValid = !!(formData.deliveryAddress);
    const vehicleValid = !!(formData.vehicleType && formData.vehicleMake && formData.vehicleModel && formData.vehicleYear);
    const detailsValid = !!(formData.shipmentType);
    const pricingValid = realTimePrice > 0;

    setSectionValidation({
      customer: customerValid,
      pickup: pickupValid,
      delivery: deliveryValid,
      vehicle: vehicleValid,
      details: detailsValid,
      pricing: pricingValid
    });

    // Auto-complete customer section if all fields are filled from user profile
    if (customerValid && userProfile && !expandedSections.customer) {
      setExpandedSections(prev => ({ ...prev, customer: false }));
    }
  }, [formData, realTimePrice, userProfile, expandedSections.customer]);

  const updateField = (field: keyof ShipmentData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getSectionSummary = (section: string): string => {
    switch (section) {
      case 'customer':
        return formData.customerName || 'Enter customer details';
      case 'pickup':
        return formData.pickupAddress || 'Enter pickup location';
      case 'delivery':
        return formData.deliveryAddress || 'Enter delivery location';
      case 'vehicle':
        return formData.vehicleType ? `${formData.vehicleYear} ${formData.vehicleMake} ${formData.vehicleModel}` : 'Select vehicle';
      case 'details':
        return formData.shipmentType || 'Shipment details';
      case 'pricing':
        return realTimePrice > 0 ? `$${realTimePrice.toFixed(2)}` : 'Calculating...';
      default:
        return '';
    }
  };

  const handleSubmit = () => {
    const allValid = Object.values(sectionValidation).every(Boolean);
    if (!allValid) {
      Alert.alert('Incomplete Form', 'Please complete all required sections before submitting.');
      return;
    }
    onSubmit(formData);
  };

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Real-time Price Display */}
      {realTimePrice > 0 && (
        <View style={styles.priceHeader}>
          <Text style={styles.priceLabel}>Estimated Total</Text>
          <Text style={styles.priceValue}>${realTimePrice.toFixed(2)}</Text>
          {formData.distance > 0 && (
            <Text style={styles.distanceText}>{formData.distance} miles</Text>
          )}
        </View>
      )}

      {/* Customer Information */}
      <CollapsibleSection
        title="Customer Information"
        icon="person"
        isExpanded={expandedSections.customer}
        onToggle={() => toggleSection('customer')}
        isValid={sectionValidation.customer}
        summary={getSectionSummary('customer')}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Customer Name *</Text>
          <TextInput
            style={styles.textInput}
            value={formData.customerName}
            onChangeText={(value) => updateField('customerName', value)}
            placeholder="Enter customer name"
          />
        </View>
        
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email Address *</Text>
          <TextInput
            style={styles.textInput}
            value={formData.customerEmail}
            onChangeText={(value) => updateField('customerEmail', value)}
            placeholder="customer@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
        
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Phone Number *</Text>
          <TextInput
            style={styles.textInput}
            value={formData.customerPhone}
            onChangeText={(value) => updateField('customerPhone', value)}
            placeholder="(555) 123-4567"
            keyboardType="phone-pad"
          />
        </View>
      </CollapsibleSection>

      {/* Pickup Location */}
      <CollapsibleSection
        title="Pickup Location"
        icon="location-on"
        isExpanded={expandedSections.pickup}
        onToggle={() => toggleSection('pickup')}
        isValid={sectionValidation.pickup}
        summary={getSectionSummary('pickup')}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Pickup Address *</Text>
          <EnhancedGooglePlacesInput
            label="Pickup Address"
            placeholder="Street, City, State ZIP"
            value={formData.pickupAddress}
            onAddressSelect={(address, details) => {
              const fullAddress = `${details.components.streetNumber || ''} ${details.components.streetName || ''}, ${details.components.city || ''}, ${details.components.state || ''} ${details.components.zipCode || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, '');
              setFormData(prev => ({ 
                ...prev, 
                pickupAddress: fullAddress,
                pickupCoordinates: details.coordinates
              }));
            }}
            required={true}
            enableZipLookup={true}
            validateInput={true}
          />
        </View>
        
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Preferred Pickup Date *</Text>
          <TouchableOpacity 
            style={[styles.textInput, styles.dateInput]} 
            onPress={() => setShowPickupDatePicker(true)}
          >
            <Text style={formData.pickupDate ? styles.dateText : styles.dateTextPlaceholder}>
              {formData.pickupDate || 'Select pickup date'}
            </Text>
          </TouchableOpacity>
          
          {showPickupDatePicker && (
            <DateTimePicker
              value={formData.pickupDate ? new Date(formData.pickupDate) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()} // Prevent past dates
              onChange={(event, selectedDate) => {
                setShowPickupDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  updateField('pickupDate', selectedDate.toISOString().split('T')[0]);
                }
              }}
            />
          )}
        </View>
      </CollapsibleSection>

      {/* Delivery Location */}
      <CollapsibleSection
        title="Delivery Location"
        icon="flag"
        isExpanded={expandedSections.delivery}
        onToggle={() => toggleSection('delivery')}
        isValid={sectionValidation.delivery}
        summary={getSectionSummary('delivery')}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Delivery Address *</Text>
          <EnhancedGooglePlacesInput
            label="Delivery Address"
            placeholder="Street, City, State ZIP"
            value={formData.deliveryAddress}
            onAddressSelect={(address, details) => {
              const fullAddress = `${details.components.streetNumber || ''} ${details.components.streetName || ''}, ${details.components.city || ''}, ${details.components.state || ''} ${details.components.zipCode || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, '');
              setFormData(prev => ({ 
                ...prev, 
                deliveryAddress: fullAddress,
                deliveryCoordinates: details.coordinates
              }));
            }}
            required={true}
            enableZipLookup={true}
            validateInput={true}
          />
        </View>
        
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Delivery Date</Text>
          <TouchableOpacity 
            style={[styles.textInput, styles.dateInput]} 
            onPress={() => setShowDeliveryDatePicker(true)}
          >
            <Text style={formData.deliveryDate ? styles.dateText : styles.dateTextPlaceholder}>
              {formData.deliveryDate || 'Flexible (leave empty for ASAP)'}
            </Text>
          </TouchableOpacity>
          
          {showDeliveryDatePicker && (
            <DateTimePicker
              value={formData.deliveryDate ? new Date(formData.deliveryDate) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={formData.pickupDate ? new Date(formData.pickupDate) : new Date()} // Must be after pickup date
              onChange={(event, selectedDate) => {
                setShowDeliveryDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  updateField('deliveryDate', selectedDate.toISOString().split('T')[0]);
                }
              }}
            />
          )}
        </View>
      </CollapsibleSection>

      {/* Vehicle Details */}
      <CollapsibleSection
        title="Vehicle Details"
        icon="directions-car"
        isExpanded={expandedSections.vehicle}
        onToggle={() => toggleSection('vehicle')}
        isValid={sectionValidation.vehicle}
        summary={getSectionSummary('vehicle')}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Vehicle Type *</Text>
          <TouchableOpacity 
            style={styles.selectInput}
            onPress={showVehicleTypePicker}
          >
            <Text style={formData.vehicleType ? styles.selectText : styles.selectPlaceholder}>
              {formData.vehicleType || 'Select vehicle type'}
            </Text>
            <MaterialIcons name="expand-more" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.fieldRow}>
          <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.fieldLabel}>Year *</Text>
            <TextInput
              style={styles.textInput}
              value={formData.vehicleYear}
              onChangeText={(value) => updateField('vehicleYear', value)}
              placeholder="2020"
              keyboardType="numeric"
            />
          </View>
          
          <View style={[styles.fieldGroup, { flex: 2 }]}>
            <Text style={styles.fieldLabel}>Make *</Text>
            <TouchableOpacity
              style={[styles.textInput, styles.selectInput]}
              onPress={() => {
                if (availableMakes.length === 0) {
                  Alert.alert('Please select a vehicle type first');
                  return;
                }
                setShowVehicleMakeModal(true);
              }}
              disabled={availableMakes.length === 0}
            >
              <Text style={[
                formData.vehicleMake ? styles.selectText : styles.selectPlaceholder,
                availableMakes.length === 0 && styles.disabledText
              ]}>
                {formData.vehicleMake || (availableMakes.length === 0 ? 'Select vehicle type first' : 'Select make')}
              </Text>
              <MaterialIcons name="expand-more" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Model *</Text>
          <TouchableOpacity
            style={[styles.textInput, styles.selectInput]}
            onPress={() => {
              if (availableModels.length === 0) {
                Alert.alert('Please select a vehicle make first');
                return;
              }
              setShowVehicleModelModal(true);
            }}
            disabled={availableModels.length === 0}
          >
            <Text style={[
              formData.vehicleModel ? styles.selectText : styles.selectPlaceholder,
              availableModels.length === 0 && styles.disabledText
            ]}>
              {formData.vehicleModel || (availableModels.length === 0 ? 'Select vehicle make first' : 'Select model')}
            </Text>
            <MaterialIcons name="expand-more" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.fieldGroup}>
          <TouchableOpacity 
            style={styles.checkboxRow}
            onPress={() => updateField('isOperable', !formData.isOperable)}
          >
            <MaterialIcons 
              name={formData.isOperable ? "check-box" : "check-box-outline-blank"} 
              size={24} 
              color={Colors.primary} 
            />
            <Text style={styles.checkboxLabel}>Vehicle is operable</Text>
          </TouchableOpacity>
        </View>
      </CollapsibleSection>

      {/* Additional Details */}
      <CollapsibleSection
        title="Shipment Details"
        icon="info"
        isExpanded={expandedSections.details}
        onToggle={() => toggleSection('details')}
        isValid={sectionValidation.details}
        summary={getSectionSummary('details')}
      >
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Shipment Type *</Text>
          <TouchableOpacity 
            style={styles.selectInput}
            onPress={showShipmentTypePicker}
          >
            <Text style={formData.shipmentType ? styles.selectText : styles.selectPlaceholder}>
              {formData.shipmentType || 'Select shipment type'}
            </Text>
            <MaterialIcons name="expand-more" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Special Instructions</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={formData.specialInstructions}
            onChangeText={(value) => updateField('specialInstructions', value)}
            placeholder="Any special handling instructions..."
            multiline
            numberOfLines={3}
          />
        </View>
      </CollapsibleSection>

      {/* Submit Button */}
      <View style={styles.submitContainer}>
        <TouchableOpacity 
          style={[
            styles.submitButton,
            Object.values(sectionValidation).every(Boolean) && styles.submitButtonEnabled
          ]}
          onPress={handleSubmit}
          disabled={!Object.values(sectionValidation).every(Boolean)}
        >
          <Text style={styles.submitButtonText}>
            Create Shipment - ${realTimePrice.toFixed(2)}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>

    {/* Vehicle Type Modal */}
    <Modal
      visible={showVehicleTypeModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowVehicleTypeModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Vehicle Type</Text>
            <TouchableOpacity onPress={() => setShowVehicleTypeModal(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={vehicleTypes}
            keyExtractor={(item) => item.type}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  formData.vehicleType === item.type && styles.modalItemSelected,
                  !item.enabled && styles.modalItemDisabled
                ]}
                onPress={() => item.enabled && selectVehicleType(item.type)}
                disabled={!item.enabled}
              >
                <Text style={[
                  styles.modalItemText,
                  formData.vehicleType === item.type && styles.modalItemTextSelected,
                  !item.enabled && styles.modalItemTextDisabled
                ]}>
                  {item.type}
                  {!item.enabled && ' (Coming Soon)'}
                </Text>
                {formData.vehicleType === item.type && (
                  <MaterialIcons name="check" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>

    {/* Vehicle Make Modal */}
    <Modal
      visible={showVehicleMakeModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowVehicleMakeModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Vehicle Make</Text>
            <TouchableOpacity onPress={() => setShowVehicleMakeModal(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={availableMakes}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  formData.vehicleMake === item && styles.modalItemSelected
                ]}
                onPress={() => selectVehicleMake(item)}
              >
                <Text style={[
                  styles.modalItemText,
                  formData.vehicleMake === item && styles.modalItemTextSelected
                ]}>
                  {item}
                </Text>
                {formData.vehicleMake === item && (
                  <MaterialIcons name="check" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>

    {/* Vehicle Model Modal */}
    <Modal
      visible={showVehicleModelModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowVehicleModelModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Vehicle Model</Text>
            <TouchableOpacity onPress={() => setShowVehicleModelModal(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={availableModels}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  formData.vehicleModel === item && styles.modalItemSelected
                ]}
                onPress={() => selectVehicleModel(item)}
              >
                <Text style={[
                  styles.modalItemText,
                  formData.vehicleModel === item && styles.modalItemTextSelected
                ]}>
                  {item}
                </Text>
                {formData.vehicleModel === item && (
                  <MaterialIcons name="check" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>

    {/* Shipment Type Modal */}
    <Modal
      visible={showShipmentTypeModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowShipmentTypeModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Shipment Type</Text>
            <TouchableOpacity onPress={() => setShowShipmentTypeModal(false)}>
              <MaterialIcons name="close" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={shipmentTypes}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  formData.shipmentType === item && styles.modalItemSelected
                ]}
                onPress={() => selectShipmentType(item)}
              >
                <Text style={[
                  styles.modalItemText,
                  formData.shipmentType === item && styles.modalItemTextSelected
                ]}>
                  {item}
                </Text>
                {formData.shipmentType === item && (
                  <MaterialIcons name="check" size={20} color={Colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  priceHeader: {
    backgroundColor: Colors.primary,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  priceLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  priceValue: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  distanceText: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16, // More vertical padding
    paddingHorizontal: 12, // Horizontal padding
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 60, // Ensure minimum height for breathing room
  },
  sectionHeaderValid: {
    backgroundColor: '#f0f9f0',
  },
  sectionHeaderExpanded: {
    backgroundColor: '#f8f9fa',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12, // Add spacing before right section
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0, // Prevent shrinking
    gap: 8, // Add gap between summary and icon
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    marginRight: 8, // Add spacing after title
    color: Colors.text.primary,
    flex: 1, // Allow title to take available space
  },
  sectionSummary: {
    fontSize: 12,
    color: Colors.text.secondary,
    maxWidth: 150, // Increased from 120
    flexShrink: 1, // Allow shrinking if needed
  },
  sectionContent: {
    overflow: 'hidden',
  },
  sectionInner: {
    padding: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.text.primary,
    backgroundColor: 'white',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  selectText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  selectPlaceholder: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  dateTextPlaceholder: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  disabledText: {
    opacity: 0.5,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: 8,
  },
  submitContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  submitButton: {
    backgroundColor: Colors.border,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonEnabled: {
    backgroundColor: Colors.primary,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  modalItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  modalItemText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  modalItemTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  modalItemDisabled: {
    backgroundColor: '#f9f9f9',
    opacity: 0.6,
  },
  modalItemTextDisabled: {
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
});

export default ConsolidatedShipmentForm;
