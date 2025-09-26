import { FormStepConfig } from './ProgressiveFormProvider';

export const SHIPMENT_FORM_STEPS: FormStepConfig[] = [
  {
    id: 'basic_info',
    title: 'Basic Info',
    description: 'Tell us about your shipment',
    icon: 'info',
    isRequired: true,
    estimatedTime: 2,
    fields: [
      {
        name: 'customerName',
        label: 'Customer Name',
        type: 'text',
        isRequired: true,
        placeholder: 'Enter customer name',
        estimatedTime: 0.5,
        validation: (value: string) => {
          if (!value?.trim()) return 'Customer name is required';
          if (value.trim().length < 2) return 'Name must be at least 2 characters';
          return null;
        },
      },
      {
        name: 'customerEmail',
        label: 'Email Address',
        type: 'email',
        isRequired: true,
        placeholder: 'customer@example.com',
        estimatedTime: 0.5,
        validation: (value: string) => {
          if (!value?.trim()) return 'Email is required';
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) return 'Please enter a valid email address';
          return null;
        },
      },
      {
        name: 'customerPhone',
        label: 'Phone Number',
        type: 'phone',
        isRequired: true,
        placeholder: '(555) 123-4567',
        estimatedTime: 0.5,
        validation: (value: string) => {
          if (!value?.trim()) return 'Phone number is required';
          const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
          if (!phoneRegex.test(value)) return 'Please enter a valid phone number';
          return null;
        },
      },
      {
        name: 'shipmentType',
        label: 'Shipment Type',
        type: 'select',
        isRequired: true,
        placeholder: 'Select shipment type',
        estimatedTime: 0.5,
        suggestions: [
          'Personal Vehicle',
          'Commercial Vehicle',
          'Motorcycle',
          'Boat',
          'RV/Trailer',
          'Heavy Equipment',
          'Other',
        ],
        validation: (value: string) => {
          if (!value) return 'Please select a shipment type';
          return null;
        },
      },
    ],
  },
  
  {
    id: 'pickup_location',
    title: 'Pickup Location',
    description: 'Where should we pick up your vehicle?',
    icon: 'location-on',
    isRequired: true,
    estimatedTime: 3,
    fields: [
      {
        name: 'pickupAddress',
        label: 'Pickup Address',
        type: 'address',
        isRequired: true,
        placeholder: 'Enter pickup address',
        estimatedTime: 1,
        validation: (value: string) => {
          if (!value?.trim()) return 'Pickup address is required';
          if (value.trim().length < 10) return 'Please enter a complete address';
          return null;
        },
      },
      {
        name: 'pickupDate',
        label: 'Preferred Pickup Date',
        type: 'date',
        isRequired: true,
        estimatedTime: 0.5,
        validation: (value: string) => {
          if (!value) return 'Pickup date is required';
          const selectedDate = new Date(value);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate < today) return 'Pickup date cannot be in the past';
          return null;
        },
      },
      {
        name: 'pickupTimePreference',
        label: 'Time Preference',
        type: 'select',
        isRequired: false,
        placeholder: 'Select preferred time',
        estimatedTime: 0.5,
        suggestions: [
          'Morning (8AM - 12PM)',
          'Afternoon (12PM - 5PM)',
          'Evening (5PM - 8PM)',
          'Anytime',
        ],
      },
      {
        name: 'pickupInstructions',
        label: 'Special Pickup Instructions',
        type: 'textarea',
        isRequired: false,
        placeholder: 'Any special instructions for pickup? (e.g., gate code, specific location)',
        estimatedTime: 1,
      },
      {
        name: 'contactAtPickup',
        label: 'Contact Person at Pickup',
        type: 'text',
        isRequired: false,
        placeholder: 'Name of person to contact (if different from customer)',
        estimatedTime: 0.5,
      },
      {
        name: 'contactPhoneAtPickup',
        label: 'Contact Phone at Pickup',
        type: 'phone',
        isRequired: false,
        placeholder: 'Phone number for pickup contact',
        estimatedTime: 0.5,
        conditionalDisplay: (formData: any) => !!formData.contactAtPickup,
        validation: (value: string, formData: any) => {
          if (formData.contactAtPickup && !value?.trim()) {
            return 'Contact phone is required when contact person is specified';
          }
          if (value) {
            const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
            if (!phoneRegex.test(value)) return 'Please enter a valid phone number';
          }
          return null;
        },
      },
    ],
  },
  
  {
    id: 'delivery_location',
    title: 'Delivery Location',
    description: 'Where should we deliver your vehicle?',
    icon: 'flag',
    isRequired: true,
    estimatedTime: 3,
    fields: [
      {
        name: 'deliveryAddress',
        label: 'Delivery Address',
        type: 'address',
        isRequired: true,
        placeholder: 'Enter delivery address',
        estimatedTime: 1,
        validation: (value: string) => {
          if (!value?.trim()) return 'Delivery address is required';
          if (value.trim().length < 10) return 'Please enter a complete address';
          return null;
        },
      },
      {
        name: 'deliveryDate',
        label: 'Preferred Delivery Date',
        type: 'date',
        isRequired: false,
        estimatedTime: 0.5,
        validation: (value: string, formData: any) => {
          if (value && formData.pickupDate) {
            const deliveryDate = new Date(value);
            const pickupDate = new Date(formData.pickupDate);
            if (deliveryDate < pickupDate) {
              return 'Delivery date cannot be before pickup date';
            }
          }
          return null;
        },
      },
      {
        name: 'deliveryTimePreference',
        label: 'Time Preference',
        type: 'select',
        isRequired: false,
        placeholder: 'Select preferred time',
        estimatedTime: 0.5,
        suggestions: [
          'Morning (8AM - 12PM)',
          'Afternoon (12PM - 5PM)',
          'Evening (5PM - 8PM)',
          'Anytime',
        ],
      },
      {
        name: 'deliveryInstructions',
        label: 'Special Delivery Instructions',
        type: 'textarea',
        isRequired: false,
        placeholder: 'Any special instructions for delivery? (e.g., gate code, specific location)',
        estimatedTime: 1,
      },
      {
        name: 'contactAtDelivery',
        label: 'Contact Person at Delivery',
        type: 'text',
        isRequired: false,
        placeholder: 'Name of person to contact (if different from customer)',
        estimatedTime: 0.5,
      },
      {
        name: 'contactPhoneAtDelivery',
        label: 'Contact Phone at Delivery',
        type: 'phone',
        isRequired: false,
        placeholder: 'Phone number for delivery contact',
        estimatedTime: 0.5,
        conditionalDisplay: (formData: any) => !!formData.contactAtDelivery,
        validation: (value: string, formData: any) => {
          if (formData.contactAtDelivery && !value?.trim()) {
            return 'Contact phone is required when contact person is specified';
          }
          if (value) {
            const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
            if (!phoneRegex.test(value)) return 'Please enter a valid phone number';
          }
          return null;
        },
      },
    ],
  },
  
  {
    id: 'vehicle_details',
    title: 'Vehicle Details',
    description: 'Tell us about the vehicle being shipped',
    icon: 'directions-car',
    isRequired: true,
    estimatedTime: 4,
    fields: [
      {
        name: 'vehicleYear',
        label: 'Year',
        type: 'number',
        isRequired: true,
        placeholder: '2020',
        estimatedTime: 0.5,
        validation: (value: number) => {
          if (!value) return 'Vehicle year is required';
          const currentYear = new Date().getFullYear();
          if (value < 1900 || value > currentYear + 1) {
            return `Year must be between 1900 and ${currentYear + 1}`;
          }
          return null;
        },
      },
      {
        name: 'vehicleMake',
        label: 'Make',
        type: 'text',
        isRequired: true,
        placeholder: 'Toyota',
        estimatedTime: 0.5,
        suggestions: [
          'Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'BMW', 'Mercedes-Benz',
          'Audi', 'Volkswagen', 'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Lexus',
          'Acura', 'Infiniti', 'Cadillac', 'Buick', 'GMC', 'Jeep', 'Ram',
          'Dodge', 'Chrysler', 'Lincoln', 'Volvo', 'Jaguar', 'Land Rover',
          'Porsche', 'Tesla', 'Other'
        ],
        validation: (value: string) => {
          if (!value?.trim()) return 'Vehicle make is required';
          return null;
        },
      },
      {
        name: 'vehicleModel',
        label: 'Model',
        type: 'text',
        isRequired: true,
        placeholder: 'Camry',
        estimatedTime: 0.5,
        validation: (value: string) => {
          if (!value?.trim()) return 'Vehicle model is required';
          return null;
        },
      },
      {
        name: 'vehicleColor',
        label: 'Color',
        type: 'text',
        isRequired: false,
        placeholder: 'Blue',
        estimatedTime: 0.5,
      },
      {
        name: 'vehicleVin',
        label: 'VIN (Vehicle Identification Number)',
        type: 'text',
        isRequired: false,
        placeholder: '1HGBH41JXMN109186',
        estimatedTime: 1,
        validation: (value: string) => {
          if (value && value.length !== 17) {
            return 'VIN must be exactly 17 characters';
          }
          return null;
        },
      },
      {
        name: 'vehicleCondition',
        label: 'Vehicle Condition',
        type: 'select',
        isRequired: true,
        placeholder: 'Select condition',
        estimatedTime: 0.5,
        suggestions: [
          'Excellent - Like new, no damage',
          'Good - Minor wear, fully functional',
          'Fair - Some damage, runs well',
          'Poor - Significant damage, may not run',
          'Inoperable - Does not run',
        ],
        validation: (value: string) => {
          if (!value) return 'Please select vehicle condition';
          return null;
        },
      },
      {
        name: 'vehicleRunning',
        label: 'Is the vehicle running?',
        type: 'select',
        isRequired: true,
        placeholder: 'Select status',
        estimatedTime: 0.5,
        suggestions: ['Yes - Runs normally', 'Yes - Runs with issues', 'No - Does not run'],
        validation: (value: string) => {
          if (!value) return 'Please specify if vehicle is running';
          return null;
        },
      },
      {
        name: 'vehicleNotes',
        label: 'Additional Vehicle Notes',
        type: 'textarea',
        isRequired: false,
        placeholder: 'Any additional details about the vehicle? (damage, modifications, special handling needs)',
        estimatedTime: 1,
      },
    ],
  },
  
  {
    id: 'shipment_details',
    title: 'Shipment Details',
    description: 'Specify your shipping preferences',
    icon: 'local-shipping',
    isRequired: true,
    estimatedTime: 3,
    fields: [
      {
        name: 'transportType',
        label: 'Transport Type',
        type: 'select',
        isRequired: true,
        placeholder: 'Select transport type',
        estimatedTime: 1,
        suggestions: [
          'Open Transport - More economical',
          'Enclosed Transport - Premium protection',
        ],
        validation: (value: string) => {
          if (!value) return 'Please select a transport type';
          return null;
        },
      },
      {
        name: 'serviceSpeed',
        label: 'Service Speed',
        type: 'select',
        isRequired: true,
        placeholder: 'Select service speed',
        estimatedTime: 0.5,
        suggestions: [
          'Standard - 7-14 days',
          'Expedited - 3-7 days',
          'Rush - 1-3 days',
        ],
        validation: (value: string) => {
          if (!value) return 'Please select service speed';
          return null;
        },
      },
      {
        name: 'insuranceValue',
        label: 'Insurance Value',
        type: 'currency',
        isRequired: true,
        placeholder: '25000',
        estimatedTime: 0.5,
        validation: (value: number) => {
          if (!value || value <= 0) return 'Insurance value is required and must be greater than 0';
          if (value > 200000) return 'Insurance value cannot exceed $200,000';
          return null;
        },
      },
      {
        name: 'flexibleDates',
        label: 'Are your dates flexible?',
        type: 'select',
        isRequired: false,
        placeholder: 'Select flexibility',
        estimatedTime: 0.5,
        suggestions: [
          'Yes - I can be flexible with dates',
          'Somewhat - 1-2 days flexibility',
          'No - Dates are firm',
        ],
      },
      {
        name: 'additionalServices',
        label: 'Additional Services',
        type: 'textarea',
        isRequired: false,
        placeholder: 'Any additional services needed? (top load priority, expedited delivery, etc.)',
        estimatedTime: 0.5,
      },
    ],
  },
  
  {
    id: 'pricing_review',
    title: 'Pricing & Review',
    description: 'Review your order and pricing',
    icon: 'receipt',
    isRequired: false,
    estimatedTime: 2,
    fields: [
      {
        name: 'promotionalCode',
        label: 'Promotional Code',
        type: 'text',
        isRequired: false,
        placeholder: 'Enter promotional code if you have one',
        estimatedTime: 0.5,
      },
      {
        name: 'paymentMethod',
        label: 'Preferred Payment Method',
        type: 'select',
        isRequired: true,
        placeholder: 'Select payment method',
        estimatedTime: 0.5,
        suggestions: [
          'Credit Card',
          'Cash on Delivery',
          'Company Check',
          'Bank Transfer',
        ],
        validation: (value: string) => {
          if (!value) return 'Please select a payment method';
          return null;
        },
      },
      {
        name: 'specialRequests',
        label: 'Special Requests or Comments',
        type: 'textarea',
        isRequired: false,
        placeholder: 'Any final comments or special requests?',
        estimatedTime: 1,
      },
      {
        name: 'agreementAccepted',
        label: 'Terms and Conditions',
        type: 'select',
        isRequired: true,
        placeholder: 'Accept terms',
        estimatedTime: 0.5,
        suggestions: [
          'I accept the terms and conditions',
        ],
        validation: (value: string) => {
          if (value !== 'I accept the terms and conditions') {
            return 'You must accept the terms and conditions to proceed';
          }
          return null;
        },
      },
    ],
  },
];