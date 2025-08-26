import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
} from 'react';
import { ShipmentService } from '../services/shipmentService';
import { useAuth } from './AuthContext';

// Types for the booking form data
export interface CustomerDetails {
  fullName: string;
  address: string;
  phone: string;
  email: string;
}

export interface VehicleInformation {
  make: string;
  model: string;
  year: string;
  vin: string;
  licensePlate: string;
  conditionNotes: string;
}

export interface PickupDetails {
  address: string;
  date: string;
  time: string;
  contactPerson: string;
  contactPhone: string;
}

export interface DeliveryDetails {
  address: string;
  date: string;
  time: string;
  contactPerson: string;
  contactPhone: string;
  specialInstructions: string;
}

export interface TowingTransport {
  operability: 'running' | 'not_running' | 'partially_running';
  equipmentNeeds: string[];
  specialRequirements: string;
}

export interface InsuranceDocumentation {
  proofOfOwnership: string[]; // File URIs
  insurance: string[]; // File URIs
  otherDocuments: string[]; // File URIs
}

export interface VisualDocumentation {
  frontView: string[]; // File URIs
  rearView: string[]; // File URIs
  leftSide: string[]; // File URIs
  rightSide: string[]; // File URIs
  interior: string[]; // File URIs
  damagePhotos: string[]; // File URIs
}

export interface TermsAuthorization {
  serviceAgreementAccepted: boolean;
  cancellationPolicyAccepted: boolean;
  digitalSignature: string; // Base64 signature or typed name
  signatureDate: string;
}

export interface PaymentDetails {
  selectedQuote?: {
    id: string;
    service: string;
    price: number;
    estimatedDays: number;
    features: string[];
  };
  paymentMethod: 'credit_card' | 'debit_card' | 'bank_transfer' | '';
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
  billingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

export interface BookingFormData {
  quoteId?: string;
  customerDetails: Partial<CustomerDetails>;
  vehicleInformation: Partial<VehicleInformation>;
  pickupDetails: Partial<PickupDetails>;
  deliveryDetails: Partial<DeliveryDetails>;
  towingTransport: Partial<TowingTransport>;
  insuranceDocumentation: Partial<InsuranceDocumentation>;
  visualDocumentation: Partial<VisualDocumentation>;
  termsAuthorization: Partial<TermsAuthorization>;
  paymentDetails: Partial<PaymentDetails>;
}

export type BookingStep =
  | 'customer'
  | 'vehicle'
  | 'pickup'
  | 'delivery'
  | 'towing'
  | 'insurance'
  | 'visual'
  | 'terms'
  | 'payment';

interface BookingState {
  currentStep: BookingStep;
  formData: BookingFormData;
  isValid: Record<BookingStep, boolean>;
  isDraft: boolean;
}

type BookingAction =
  | { type: 'SET_STEP'; payload: BookingStep }
  | { type: 'UPDATE_FORM_DATA'; payload: { step: BookingStep; data: any } }
  | {
      type: 'SET_STEP_VALIDITY';
      payload: { step: BookingStep; isValid: boolean };
    }
  | { type: 'SAVE_DRAFT' }
  | { type: 'LOAD_DRAFT'; payload: BookingFormData }
  | { type: 'RESET_FORM' }
  | { type: 'SET_QUOTE_ID'; payload: string };

const initialState: BookingState = {
  currentStep: 'customer',
  formData: {
    customerDetails: {
      fullName: '',
      address: '',
      phone: '',
      email: '',
    },
    vehicleInformation: {},
    pickupDetails: {},
    deliveryDetails: {},
    towingTransport: { equipmentNeeds: [] },
    insuranceDocumentation: {
      proofOfOwnership: [],
      insurance: [],
      otherDocuments: [],
    },
    visualDocumentation: {
      frontView: [],
      rearView: [],
      leftSide: [],
      rightSide: [],
      interior: [],
      damagePhotos: [],
    },
    termsAuthorization: {},
    paymentDetails: {
      paymentMethod: '',
      cardNumber: '',
      expiryDate: '',
      cvv: '',
      cardholderName: '',
      billingAddress: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
      },
    },
  },
  isValid: {
    customer: false,
    vehicle: false,
    pickup: false,
    delivery: false,
    towing: false,
    insurance: false,
    visual: false,
    terms: false,
    payment: false,
  },
  isDraft: false,
};

function bookingReducer(
  state: BookingState,
  action: BookingAction
): BookingState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };

    case 'UPDATE_FORM_DATA':
      const stepKey = action.payload.step;
      // Map step names to form data keys
      const stepToFormKeyMap: Record<BookingStep, keyof BookingFormData> = {
        customer: 'customerDetails',
        vehicle: 'vehicleInformation',
        pickup: 'pickupDetails',
        delivery: 'deliveryDetails',
        towing: 'towingTransport',
        insurance: 'insuranceDocumentation',
        visual: 'visualDocumentation',
        terms: 'termsAuthorization',
        payment: 'paymentDetails',
      };

      const formDataKey = stepToFormKeyMap[stepKey];
      const currentStepData = state.formData[formDataKey] || {};

      return {
        ...state,
        formData: {
          ...state.formData,
          [formDataKey]: {
            ...(typeof currentStepData === 'object' ? currentStepData : {}),
            ...action.payload.data,
          },
        },
        isDraft: true,
      };

    case 'SET_STEP_VALIDITY':
      return {
        ...state,
        isValid: {
          ...state.isValid,
          [action.payload.step]: action.payload.isValid,
        },
      };

    case 'SAVE_DRAFT':
      return { ...state, isDraft: true };

    case 'LOAD_DRAFT':
      return {
        ...state,
        formData: action.payload,
        isDraft: true,
      };

    case 'SET_QUOTE_ID':
      return {
        ...state,
        formData: {
          ...state.formData,
          quoteId: action.payload,
        },
      };

    case 'RESET_FORM':
      return initialState;

    default:
      return state;
  }
}

interface BookingContextType {
  state: BookingState;
  dispatch: React.Dispatch<BookingAction>;
  updateFormData: (step: BookingStep, data: any) => void;
  setStepValidity: (step: BookingStep, isValid: boolean) => void;
  goToStep: (step: BookingStep) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  canGoToNextStep: () => boolean;
  canGoToPreviousStep: () => boolean;
  getStepProgress: () => number;
  saveDraft: () => Promise<void>;
  loadDraft: () => Promise<void>;
  resetForm: () => void;
  setQuoteId: (quoteId: string) => void;
  submitShipment: () => Promise<any>;
  isSubmitting: boolean;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

const stepOrder: BookingStep[] = [
  'customer',
  'vehicle',
  'pickup',
  'delivery',
  'towing',
  'insurance',
  'visual',
  'terms',
  'payment',
];

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bookingReducer, initialState);
  const { user } = useAuth();

  const updateFormData = useCallback((step: BookingStep, data: any) => {
    dispatch({ type: 'UPDATE_FORM_DATA', payload: { step, data } });
  }, []);

  const setStepValidity = useCallback((step: BookingStep, isValid: boolean) => {
    dispatch({ type: 'SET_STEP_VALIDITY', payload: { step, isValid } });
  }, []);

  const goToStep = (step: BookingStep) => {
    dispatch({ type: 'SET_STEP', payload: step });
  };

  const goToNextStep = () => {
    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1];
      dispatch({ type: 'SET_STEP', payload: nextStep });
    }
  };

  const goToPreviousStep = () => {
    const currentIndex = stepOrder.indexOf(state.currentStep);
    if (currentIndex > 0) {
      const previousStep = stepOrder[currentIndex - 1];
      dispatch({ type: 'SET_STEP', payload: previousStep });
    }
  };

  const canGoToNextStep = () => {
    return (
      state.isValid[state.currentStep] &&
      stepOrder.indexOf(state.currentStep) < stepOrder.length - 1
    );
  };

  const canGoToPreviousStep = () => {
    return stepOrder.indexOf(state.currentStep) > 0;
  };

  const getStepProgress = () => {
    const currentIndex = stepOrder.indexOf(state.currentStep);
    return ((currentIndex + 1) / stepOrder.length) * 100;
  };

  const saveDraft = async () => {
    // TODO: Implement draft saving to AsyncStorage
    dispatch({ type: 'SAVE_DRAFT' });
  };

  const loadDraft = async () => {
    // TODO: Implement draft loading from AsyncStorage
  };

  const resetForm = () => {
    dispatch({ type: 'RESET_FORM' });
  };

  const setQuoteId = (quoteId: string) => {
    dispatch({ type: 'SET_QUOTE_ID', payload: quoteId });
  };

  const submitShipment = async () => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Convert booking form data to shipment data
      const shipmentData = ShipmentService.convertBookingToShipment(
        state.formData,
        250
      );
      const response = await ShipmentService.createShipment(
        shipmentData,
        user.id
      );
      dispatch({ type: 'RESET_FORM' });
      return response;
    } catch (error) {
      console.error('Error submitting shipment:', error);
      throw error;
    }
  };

  return (
    <BookingContext.Provider
      value={{
        state,
        dispatch,
        updateFormData,
        setStepValidity,
        goToStep,
        goToNextStep,
        goToPreviousStep,
        canGoToNextStep,
        canGoToPreviousStep,
        getStepProgress,
        saveDraft,
        loadDraft,
        resetForm,
        setQuoteId,
        submitShipment,
        isSubmitting: false, // Placeholder, implement loading state if needed
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}
