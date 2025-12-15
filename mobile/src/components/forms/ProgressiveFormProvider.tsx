import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { Alert } from 'react-native';

// Enhanced progressive form types
export interface FormStepConfig {
  id: string;
  title: string;
  description: string;
  icon: string;
  isRequired: boolean;
  estimatedTime: number; // in minutes
  fields: FormFieldConfig[];
  validation?: (data: any) => FormValidationResult;
  autoAdvance?: boolean; // Auto-advance to next step when valid
  conditionalDisplay?: (formData: any) => boolean; // Conditional display based on form data
}

export interface FormFieldConfig {
  name: string;
  type: 'text' | 'email' | 'phone' | 'address' | 'date' | 'select' | 'multiselect' | 'number' | 'currency' | 'textarea';
  label: string;
  placeholder?: string;
  isRequired: boolean;
  estimatedTime?: number; // in minutes
  validation?: (value: any, formData?: any) => string | null;
  suggestions?: string[] | ((input: string) => Promise<string[]>);
  dependsOn?: string; // Field name this field depends on
  conditionalDisplay?: (formData: any) => boolean;
  autoFill?: (formData: any) => any; // Auto-fill based on other fields
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  suggestions: Record<string, string>;
}

export interface ProgressiveFormStep {
  id: string;
  data: Record<string, any>;
  isValid: boolean;
  isVisited: boolean;
  isCompleted: boolean;
  validationResult?: FormValidationResult;
  lastModified?: Date;
}

export interface ProgressiveFormState {
  steps: ProgressiveFormStep[];
  currentStepIndex: number;
  formData: Record<string, any>;
  isDraft: boolean;
  draftId?: string;
  totalProgress: number;
  isSubmitting: boolean;
  lastSaved?: Date;
  hasUnsavedChanges: boolean;
}

// Enhanced form actions
type ProgressiveFormAction =
  | { type: 'SET_CURRENT_STEP'; payload: number }
  | { type: 'UPDATE_STEP_DATA'; payload: { stepId: string; data: Record<string, any> } }
  | { type: 'SET_STEP_VALIDATION'; payload: { stepId: string; result: FormValidationResult } }
  | { type: 'MARK_STEP_VISITED'; payload: string }
  | { type: 'MARK_STEP_COMPLETED'; payload: string }
  | { type: 'SAVE_DRAFT_SUCCESS'; payload: { draftId: string; timestamp: Date } }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'LOAD_DRAFT'; payload: { formData: Record<string, any>; steps: ProgressiveFormStep[] } }
  | { type: 'RESET_FORM' }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean };

// Default step configurations for shipment creation
const DEFAULT_SHIPMENT_STEPS: FormStepConfig[] = [
  {
    id: 'basic_info',
    title: 'Basic Information',
    description: 'Tell us about your shipment',
    icon: 'info',
    isRequired: true,
    estimatedTime: 2,
    fields: [
      {
        name: 'title',
        type: 'text',
        label: 'Shipment Title',
        placeholder: 'e.g., Moving household items',
        isRequired: true,
        validation: (value) => value && value.length >= 3 ? null : 'Title must be at least 3 characters',
      },
      {
        name: 'description',
        type: 'textarea',
        label: 'Description',
        placeholder: 'Describe what you\'re shipping...',
        isRequired: false,
      },
      {
        name: 'shipment_type',
        type: 'select',
        label: 'Shipment Type',
        isRequired: true,
        suggestions: ['Vehicle Transport', 'Household Items', 'Commercial Goods', 'Documents', 'Other'],
      },
    ],
  },
  {
    id: 'pickup_location',
    title: 'Pickup Location',
    description: 'Where should we pick up your shipment?',
    icon: 'location-on',
    isRequired: true,
    estimatedTime: 3,
    fields: [
      {
        name: 'pickup_address',
        type: 'address',
        label: 'Pickup Address',
        placeholder: 'Enter pickup address or ZIP code',
        isRequired: true,
      },
      {
        name: 'pickup_date',
        type: 'date',
        label: 'Pickup Date',
        isRequired: true,
      },
      {
        name: 'pickup_time',
        type: 'select',
        label: 'Preferred Time',
        isRequired: false,
        suggestions: ['Morning (8AM-12PM)', 'Afternoon (12PM-5PM)', 'Evening (5PM-8PM)', 'Flexible'],
      },
      {
        name: 'pickup_notes',
        type: 'textarea',
        label: 'Pickup Instructions',
        placeholder: 'Include specific street address, unit/apartment number, gate codes, parking instructions, and any access details...',
        isRequired: false,
      },
    ],
  },
  {
    id: 'delivery_location',
    title: 'Delivery Location',
    description: 'Where should we deliver your shipment?',
    icon: 'place',
    isRequired: true,
    estimatedTime: 3,
    fields: [
      {
        name: 'delivery_address',
        type: 'address',
        label: 'Delivery Address',
        placeholder: 'Enter delivery address or ZIP code',
        isRequired: true,
      },
      {
        name: 'delivery_date',
        type: 'date',
        label: 'Delivery Date',
        isRequired: true,
      },
      {
        name: 'delivery_time',
        type: 'select',
        label: 'Preferred Time',
        isRequired: false,
        suggestions: ['Morning (8AM-12PM)', 'Afternoon (12PM-5PM)', 'Evening (5PM-8PM)', 'Flexible'],
      },
      {
        name: 'delivery_notes',
        type: 'textarea',
        label: 'Delivery Instructions',
        placeholder: 'Include specific street address, unit/apartment number, gate codes, parking instructions, and any access details...',
        isRequired: false,
      },
    ],
  },
  {
    id: 'vehicle_details',
    title: 'Vehicle Details',
    description: 'What vehicle are you shipping?',
    icon: 'directions-car',
    isRequired: true,
    estimatedTime: 4,
    conditionalDisplay: (formData) => formData.shipment_type === 'Vehicle Transport',
    fields: [
      {
        name: 'vehicle_type',
        type: 'select',
        label: 'Vehicle Type',
        isRequired: true,
        suggestions: ['Sedan', 'SUV', 'Truck', 'Motorcycle', 'Luxury Car'],
      },
      {
        name: 'vehicle_year',
        type: 'number',
        label: 'Year',
        isRequired: true,
      },
      {
        name: 'vehicle_make',
        type: 'text',
        label: 'Make',
        isRequired: true,
        suggestions: ['Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes', 'Audi'],
      },
      {
        name: 'vehicle_model',
        type: 'text',
        label: 'Model',
        isRequired: true,
      },
      {
        name: 'vehicle_condition',
        type: 'select',
        label: 'Vehicle Condition',
        isRequired: true,
        suggestions: ['Running', 'Not Running', 'Partially Running'],
      },
    ],
  },
  {
    id: 'shipment_details',
    title: 'Shipment Details',
    description: 'Additional shipment information',
    icon: 'inventory',
    isRequired: false,
    estimatedTime: 2,
    fields: [
      {
        name: 'weight',
        type: 'number',
        label: 'Estimated Weight (lbs)',
        isRequired: false,
      },
      {
        name: 'dimensions',
        type: 'text',
        label: 'Dimensions (L x W x H)',
        placeholder: 'e.g., 8ft x 6ft x 6ft',
        isRequired: false,
      },
      {
        name: 'value',
        type: 'currency',
        label: 'Estimated Value',
        isRequired: false,
      },
      {
        name: 'is_fragile',
        type: 'select',
        label: 'Contains Fragile Items?',
        suggestions: ['Yes', 'No'],
        isRequired: false,
      },
      {
        name: 'special_instructions',
        type: 'textarea',
        label: 'Special Instructions',
        placeholder: 'Include specific pickup/delivery addresses, gate codes, parking details, or any special handling requirements...',
        isRequired: false,
      },
    ],
  },
  {
    id: 'pricing_review',
    title: 'Pricing & Review',
    description: 'Review your quote and confirm details',
    icon: 'receipt',
    isRequired: true,
    estimatedTime: 3,
    fields: [
      {
        name: 'pricing_tier',
        type: 'select',
        label: 'Service Level',
        isRequired: true,
        suggestions: ['Standard', 'Expedited', 'White Glove'],
      },
      {
        name: 'insurance_coverage',
        type: 'select',
        label: 'Insurance Coverage',
        isRequired: false,
        suggestions: ['Basic ($1,000)', 'Standard ($5,000)', 'Premium ($10,000)', 'Custom'],
      },
    ],
  },
];

// Initial state
const initialState: ProgressiveFormState = {
  steps: DEFAULT_SHIPMENT_STEPS.map(config => ({
    id: config.id,
    data: {},
    isValid: false,
    isVisited: false,
    isCompleted: false,
  })),
  currentStepIndex: 0,
  formData: {},
  isDraft: false,
  totalProgress: 0,
  isSubmitting: false,
  hasUnsavedChanges: false,
};

// Reducer
function progressiveFormReducer(state: ProgressiveFormState, action: ProgressiveFormAction): ProgressiveFormState {
  switch (action.type) {
    case 'SET_CURRENT_STEP':
      return {
        ...state,
        currentStepIndex: action.payload,
        steps: state.steps.map((step, index) => 
          index === action.payload ? { ...step, isVisited: true } : step
        ),
      };

    case 'UPDATE_STEP_DATA':
      const updatedSteps = state.steps.map(step => 
        step.id === action.payload.stepId 
          ? { ...step, data: { ...step.data, ...action.payload.data }, lastModified: new Date() }
          : step
      );
      
      const newFormData = { ...state.formData, ...action.payload.data };
      const totalProgress = calculateProgress(updatedSteps);

      return {
        ...state,
        steps: updatedSteps,
        formData: newFormData,
        totalProgress,
        hasUnsavedChanges: true,
      };

    case 'SET_STEP_VALIDATION':
      return {
        ...state,
        steps: state.steps.map(step => 
          step.id === action.payload.stepId 
            ? { 
                ...step, 
                isValid: action.payload.result.isValid,
                validationResult: action.payload.result,
                isCompleted: action.payload.result.isValid,
              }
            : step
        ),
      };

    case 'MARK_STEP_VISITED':
      return {
        ...state,
        steps: state.steps.map(step => 
          step.id === action.payload ? { ...step, isVisited: true } : step
        ),
      };

    case 'MARK_STEP_COMPLETED':
      return {
        ...state,
        steps: state.steps.map(step => 
          step.id === action.payload ? { ...step, isCompleted: true } : step
        ),
      };

    case 'SAVE_DRAFT_SUCCESS':
      return {
        ...state,
        isDraft: true,
        draftId: action.payload.draftId,
        lastSaved: action.payload.timestamp,
        hasUnsavedChanges: false,
      };

    case 'SET_SUBMITTING':
      return {
        ...state,
        isSubmitting: action.payload,
      };

    case 'LOAD_DRAFT':
      return {
        ...state,
        formData: action.payload.formData,
        steps: action.payload.steps,
        isDraft: true,
        hasUnsavedChanges: false,
      };

    case 'RESET_FORM':
      return initialState;

    case 'SET_UNSAVED_CHANGES':
      return {
        ...state,
        hasUnsavedChanges: action.payload,
      };

    default:
      return state;
  }
}

// Helper function to calculate overall progress
function calculateProgress(steps: ProgressiveFormStep[]): number {
  const totalSteps = steps.filter(step => step.isVisited || step.isCompleted).length;
  const completedSteps = steps.filter(step => step.isCompleted).length;
  return totalSteps > 0 ? (completedSteps / steps.length) * 100 : 0;
}

// Context interface
interface ProgressiveFormContextType {
  state: ProgressiveFormState;
  stepConfigs: FormStepConfig[];
  
  // Navigation
  goToStep: (stepIndex: number) => void;
  goToNextStep: () => boolean;
  goToPreviousStep: () => boolean;
  canGoToNextStep: () => boolean;
  canGoToPreviousStep: () => boolean;
  
  // Data management
  updateStepData: (stepId: string, data: Record<string, any>) => void;
  validateStep: (stepId: string) => Promise<FormValidationResult>;
  validateAllSteps: () => Promise<boolean>;
  
  // Draft management
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  
  // Form submission
  submitForm: () => Promise<any>;
  resetForm: () => void;
  clearForm: () => void;
  
  // Utility
  getCurrentStep: () => ProgressiveFormStep;
  getCurrentStepConfig: () => FormStepConfig;
  getStepByIndex: (index: number) => ProgressiveFormStep;
  isLastStep: () => boolean;
  isFirstStep: () => boolean;
}

// Create context
const ProgressiveFormContext = createContext<ProgressiveFormContextType | undefined>(undefined);

// Provider component
interface ProgressiveFormProviderProps {
  children: ReactNode;
  stepConfigs?: FormStepConfig[];
  onSubmit: (formData: Record<string, any>) => Promise<any>;
  onSaveDraft?: (formData: Record<string, any>) => Promise<string>;
  onLoadDraft?: (draftId: string) => Promise<Record<string, any>>;
  autoSaveInterval?: number; // Auto-save interval in milliseconds
}

export function ProgressiveFormProvider({
  children,
  stepConfigs = DEFAULT_SHIPMENT_STEPS,
  onSubmit,
  onSaveDraft,
  onLoadDraft,
  autoSaveInterval = 30000, // 30 seconds
}: ProgressiveFormProviderProps) {
  const [state, dispatch] = useReducer(progressiveFormReducer, {
    ...initialState,
    steps: stepConfigs.map(config => ({
      id: config.id,
      data: {},
      isValid: false,
      isVisited: false,
      isCompleted: false,
    })),
  });

  // Auto-save functionality
  React.useEffect(() => {
    if (!state.hasUnsavedChanges || !onSaveDraft) return;

    const timer = setTimeout(async () => {
      try {
        const draftId = await onSaveDraft(state.formData);
        dispatch({ type: 'SAVE_DRAFT_SUCCESS', payload: { draftId, timestamp: new Date() } });
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, autoSaveInterval);

    return () => clearTimeout(timer);
  }, [state.hasUnsavedChanges, state.formData, autoSaveInterval, onSaveDraft]);

  // Navigation functions
  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < stepConfigs.length) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: stepIndex });
    }
  }, [stepConfigs.length]);

  const goToNextStep = useCallback(() => {
    if (state.currentStepIndex < stepConfigs.length - 1) {
      goToStep(state.currentStepIndex + 1);
      return true;
    }
    return false;
  }, [state.currentStepIndex, stepConfigs.length, goToStep]);

  const goToPreviousStep = useCallback(() => {
    if (state.currentStepIndex > 0) {
      goToStep(state.currentStepIndex - 1);
      return true;
    }
    return false;
  }, [state.currentStepIndex, goToStep]);

  const canGoToNextStep = useCallback(() => {
    const currentStep = state.steps[state.currentStepIndex];
    const currentConfig = stepConfigs[state.currentStepIndex];
    return !currentConfig.isRequired || currentStep.isValid;
  }, [state.steps, state.currentStepIndex, stepConfigs]);

  const canGoToPreviousStep = useCallback(() => {
    return state.currentStepIndex > 0;
  }, [state.currentStepIndex]);

  // Data management functions
  const updateStepData = useCallback((stepId: string, data: Record<string, any>) => {
    dispatch({ type: 'UPDATE_STEP_DATA', payload: { stepId, data } });
  }, []);

  const validateStep = useCallback(async (stepId: string): Promise<FormValidationResult> => {
    const stepConfig = stepConfigs.find(config => config.id === stepId);
    const stepState = state.steps.find(step => step.id === stepId);
    
    if (!stepConfig || !stepState) {
      return { isValid: false, errors: { general: 'Step not found' }, warnings: {}, suggestions: {} };
    }

    // Run custom validation if provided
    let result: FormValidationResult = { isValid: true, errors: {}, warnings: {}, suggestions: {} };
    
    if (stepConfig.validation) {
      result = stepConfig.validation(stepState.data);
    } else {
      // Default field validation
      for (const field of stepConfig.fields) {
        const fieldValue = (stepState.data as any)[field.name];
        if (field.isRequired && !fieldValue) {
          result.errors[field.name] = `${field.label} is required`;
          result.isValid = false;
        } else if (field.validation && fieldValue) {
          const fieldError = field.validation(fieldValue);
          if (fieldError) {
            result.errors[field.name] = fieldError;
            result.isValid = false;
          }
        }
      }
    }

    dispatch({ type: 'SET_STEP_VALIDATION', payload: { stepId, result } });
    return result;
  }, [stepConfigs, state.steps]);

  const validateAllSteps = useCallback(async (): Promise<boolean> => {
    const results = await Promise.all(
      stepConfigs.map(config => validateStep(config.id))
    );
    return results.every(result => result.isValid);
  }, [stepConfigs, validateStep]);

  // Draft management
  const saveDraft = useCallback(async () => {
    if (!onSaveDraft) return;
    
    try {
      const draftId = await onSaveDraft(state.formData);
      dispatch({ type: 'SAVE_DRAFT_SUCCESS', payload: { draftId, timestamp: new Date() } });
    } catch (error) {
      console.error('Failed to save draft:', error);
      Alert.alert('Error', 'Failed to save draft. Please try again.');
    }
  }, [state.formData, onSaveDraft]);

  const loadDraft = useCallback(async (draftId: string) => {
    if (!onLoadDraft) return;
    
    try {
      const draftData = await onLoadDraft(draftId);
      const loadedSteps = stepConfigs.map(config => ({
        id: config.id,
        data: draftData[config.id] || {},
        isValid: false, // Will be validated after loading
        isVisited: true,
        isCompleted: false,
      }));
      
      dispatch({ type: 'LOAD_DRAFT', payload: { formData: draftData, steps: loadedSteps } });
      
      // Validate all loaded steps
      for (const config of stepConfigs) {
        await validateStep(config.id);
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
      Alert.alert('Error', 'Failed to load draft. Please try again.');
    }
  }, [onLoadDraft, stepConfigs, validateStep]);

  // Form submission
  const submitForm = useCallback(async () => {
    dispatch({ type: 'SET_SUBMITTING', payload: true });
    
    try {
      const isValid = await validateAllSteps();
      if (!isValid) {
        Alert.alert('Validation Error', 'Please complete all required fields before submitting.');
        return;
      }

      const result = await onSubmit(state.formData);
      dispatch({ type: 'SET_UNSAVED_CHANGES', payload: false });
      return result;
    } catch (error) {
      console.error('Form submission failed:', error);
      Alert.alert('Error', 'Failed to submit form. Please try again.');
      throw error;
    } finally {
      dispatch({ type: 'SET_SUBMITTING', payload: false });
    }
  }, [state.formData, onSubmit, validateAllSteps]);

  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET_FORM' });
  }, []);

  // Utility functions
  const getCurrentStep = useCallback(() => {
    return state.steps[state.currentStepIndex];
  }, [state.steps, state.currentStepIndex]);

  const getCurrentStepConfig = useCallback(() => {
    return stepConfigs[state.currentStepIndex];
  }, [stepConfigs, state.currentStepIndex]);

  const getStepByIndex = useCallback((index: number) => {
    return state.steps[index];
  }, [state.steps]);

  const isLastStep = useCallback(() => {
    return state.currentStepIndex === stepConfigs.length - 1;
  }, [state.currentStepIndex, stepConfigs.length]);

  const isFirstStep = useCallback(() => {
    return state.currentStepIndex === 0;
  }, [state.currentStepIndex]);

  const clearForm = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const contextValue: ProgressiveFormContextType = {
    state,
    stepConfigs,
    goToStep,
    goToNextStep,
    goToPreviousStep,
    canGoToNextStep,
    canGoToPreviousStep,
    updateStepData,
    validateStep,
    validateAllSteps,
    saveDraft,
    loadDraft,
    submitForm,
    resetForm,
    clearForm,
    getCurrentStep,
    getCurrentStepConfig,
    getStepByIndex,
    isLastStep,
    isFirstStep,
  };

  return (
    <ProgressiveFormContext.Provider value={contextValue}>
      {children}
    </ProgressiveFormContext.Provider>
  );
}

// Hook to use the progressive form context
export function useProgressiveForm() {
  const context = useContext(ProgressiveFormContext);
  if (!context) {
    throw new Error('useProgressiveForm must be used within a ProgressiveFormProvider');
  }
  return context;
}

export default ProgressiveFormProvider;
