import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useProgressiveForm, FormFieldConfig } from './ProgressiveFormProvider';
import { smartAutoFill } from './SmartAutoFillService';
import EnhancedGooglePlacesInput from '../EnhancedGooglePlacesInput';

// Compatibility layer for color structure
const themeColors = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  info: '#5AC8FA',
  background: '#FFFFFF',
  text: {
    primary: '#000000',
    secondary: '#6B7280',
    inverse: '#FFFFFF',
  },
  error: '#FF3B30',
  border: '#E5E7EB',
};

// AddressInput component for handling address fields
interface AddressInputProps {
  field: FormFieldConfig;
  value: string;
  onChange: (name: string, value: any) => void;
  error?: string;
  themeColors: any;
}

const AddressInput: React.FC<AddressInputProps> = ({ field, value, onChange, error, themeColors }) => {
  const handleAddressSelect = (selectedAddress: string, addressDetails: any) => {
    // Store the full formatted address instead of just zipcode
    onChange(field.name, selectedAddress);
  };

  return (
    <EnhancedGooglePlacesInput
      label={field.label}
      placeholder={field.placeholder || 'Enter address'}
      value={value}
      onAddressSelect={handleAddressSelect}
      required={field.isRequired}
      error={error}
      enableZipLookup={true}
      validateInput={true}
      style={styles.textInput}
    />
  );
};

// Progress indicator component
function ProgressIndicator() {
  const { state, stepConfigs, goToStep } = useProgressiveForm();

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${state.totalProgress}%` }
          ]} 
        />
      </View>
      
      <View style={styles.stepIndicators}>
        {stepConfigs.map((config, index) => {
          const step = state.steps[index];
          const isCurrent = index === state.currentStepIndex;
          const isCompleted = step.isCompleted;
          const isVisited = step.isVisited;
          const canNavigate = isVisited || index <= state.currentStepIndex;

          return (
            <TouchableOpacity
              key={config.id}
              style={[
                styles.stepIndicator,
                isCurrent && styles.stepIndicatorCurrent,
                isCompleted && styles.stepIndicatorCompleted,
              ]}
              onPress={() => canNavigate && goToStep(index)}
              disabled={!canNavigate}
            >
              <View style={[
                styles.stepIndicatorCircle,
                isCurrent && styles.stepIndicatorCircleCurrent,
                isCompleted && styles.stepIndicatorCircleCompleted,
              ]}>
                {isCompleted ? (
                  <MaterialIcons name="check" size={16} color={themeColors.text.inverse} />
                ) : (
                  <Text style={[
                    styles.stepIndicatorNumber,
                    isCurrent && styles.stepIndicatorNumberCurrent,
                  ]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[
                styles.stepIndicatorLabel,
                isCurrent && styles.stepIndicatorLabelCurrent,
                isCompleted && styles.stepIndicatorLabelCompleted,
              ]}>
                {config.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Form field renderer
interface FormFieldProps {
  field: FormFieldConfig;
  value: any;
  onChange: (name: string, value: any) => void;
  error?: string;
  warning?: string;
  suggestion?: string;
}

function FormField({ field, value, onChange, error, warning, suggestion }: FormFieldProps) {
  const [focused, setFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { state } = useProgressiveForm();

  // Get smart suggestions and help
  const smartSuggestions = smartAutoFill.getSmartSuggestions(field.name, state.formData);
  const contextualHelp = smartAutoFill.getContextualHelp(field.name, state.formData);
  const autoFillValue = smartAutoFill.getAutoFillValue(field.name, state.formData);

  // Auto-fill when field is focused for the first time and has no value
  useEffect(() => {
    if (focused && !value && autoFillValue) {
      onChange(field.name, autoFillValue);
    }
  }, [focused, value, autoFillValue, field.name, onChange]);

  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <TextInput
            style={[
              styles.textInput,
              focused && styles.textInputFocused,
              error && styles.textInputError,
            ]}
            value={value || ''}
            onChangeText={(text) => onChange(field.name, text)}
            placeholder={field.placeholder}
            placeholderTextColor={Colors.text.secondary}
            keyboardType={field.type === 'email' ? 'email-address' : field.type === 'phone' ? 'phone-pad' : 'default'}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize={field.type === 'email' ? 'none' : 'sentences'}
          />
        );

      case 'textarea':
        return (
          <TextInput
            style={[
              styles.textInput,
              styles.textAreaInput,
              focused && styles.textInputFocused,
              error && styles.textInputError,
            ]}
            value={value || ''}
            onChangeText={(text) => onChange(field.name, text)}
            placeholder={field.placeholder}
            placeholderTextColor={Colors.text.secondary}
            multiline
            numberOfLines={4}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            textAlignVertical="top"
          />
        );

      case 'select':
        return (
          <TouchableOpacity
            style={[
              styles.selectInput,
              error && styles.textInputError,
            ]}
            onPress={() => showSelectModal(field, value, onChange)}
          >
            <Text style={[
              styles.selectInputText,
              !value && styles.selectInputPlaceholder,
            ]}>
              {value || field.placeholder || 'Select...'}
            </Text>
            <MaterialIcons name="keyboard-arrow-down" size={24} color={Colors.text.secondary} />
          </TouchableOpacity>
        );

      case 'number':
      case 'currency':
        return (
          <TextInput
            style={[
              styles.textInput,
              focused && styles.textInputFocused,
              error && styles.textInputError,
            ]}
            value={value?.toString() || ''}
            onChangeText={(text) => {
              const numValue = field.type === 'currency' ? parseFloat(text) : parseInt(text);
              onChange(field.name, isNaN(numValue) ? null : numValue);
            }}
            placeholder={field.placeholder}
            placeholderTextColor={Colors.text.secondary}
            keyboardType="numeric"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        );

      case 'date':
        return (
          <TouchableOpacity
            style={[
              styles.selectInput,
              error && styles.textInputError,
            ]}
            onPress={() => showDatePicker(field, value, onChange)}
          >
            <MaterialIcons name="calendar-today" size={20} color={Colors.text.secondary} />
            <Text style={[
              styles.selectInputText,
              { marginLeft: 12 },
              !value && styles.selectInputPlaceholder,
            ]}>
              {value ? new Date(value).toLocaleDateString() : 'Select date'}
            </Text>
          </TouchableOpacity>
        );

      case 'address':
        return (
          <AddressInput
            field={field}
            value={value}
            onChange={onChange}
            error={error}
            themeColors={themeColors}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>
          {field.label}
          {field.isRequired && <Text style={styles.required}> *</Text>}
        </Text>
        {field.estimatedTime && (
          <Text style={styles.estimatedTime}>~{field.estimatedTime}min</Text>
        )}
      </View>

      {renderField()}

      {error && (
        <View style={styles.feedbackContainer}>
          <MaterialIcons name="error" size={16} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {warning && !error && (
        <View style={styles.feedbackContainer}>
          <MaterialIcons name="warning" size={16} color={Colors.warning} />
          <Text style={styles.warningText}>{warning}</Text>
        </View>
      )}

      {suggestion && !error && !warning && (
        <View style={styles.feedbackContainer}>
          <MaterialIcons name="lightbulb-outline" size={16} color={Colors.primary} />
          <Text style={styles.suggestionText}>{suggestion}</Text>
        </View>
      )}

      {contextualHelp && showHelp && (
        <View style={styles.helpContainer}>
          <MaterialIcons name="info-outline" size={16} color={Colors.info} />
          <Text style={styles.helpText}>{contextualHelp}</Text>
        </View>
      )}

      {smartSuggestions.length > 0 && showSuggestions && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Suggestions:</Text>
          {smartSuggestions.slice(0, 3).map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => {
                onChange(field.name, suggestion);
                setShowSuggestions(false);
              }}
            >
              <MaterialIcons name="history" size={16} color={Colors.text.secondary} />
              <Text style={styles.suggestionItemText}>{suggestion}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.fieldActions}>
        {contextualHelp && (
          <TouchableOpacity
            style={styles.helpButton}
            onPress={() => setShowHelp(!showHelp)}
          >
            <MaterialIcons 
              name={showHelp ? "help" : "help-outline"} 
              size={16} 
              color={Colors.primary} 
            />
            <Text style={styles.helpButtonText}>
              {showHelp ? 'Hide Help' : 'Help'}
            </Text>
          </TouchableOpacity>
        )}

        {smartSuggestions.length > 0 && (
          <TouchableOpacity
            style={styles.suggestionsButton}
            onPress={() => setShowSuggestions(!showSuggestions)}
          >
            <MaterialIcons 
              name={showSuggestions ? "expand-less" : "expand-more"} 
              size={16} 
              color={Colors.primary} 
            />
            <Text style={styles.suggestionsButtonText}>
              {showSuggestions ? 'Hide' : 'Suggestions'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Step content component
function StepContent() {
  const { 
    getCurrentStep, 
    getCurrentStepConfig, 
    updateStepData,
    validateStep,
    state 
  } = useProgressiveForm();

  const currentStep = getCurrentStep();
  const currentConfig = getCurrentStepConfig();
  const [localData, setLocalData] = useState(currentStep.data);

  // Sync local data with step data
  useEffect(() => {
    setLocalData(currentStep.data);
  }, [currentStep.data]);

  // Auto-validate when data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      validateStep(currentStep.id);
    }, 500); // Debounce validation

    return () => clearTimeout(timer);
  }, [localData, currentStep.id, validateStep]);

  const handleFieldChange = (name: string, value: any) => {
    const newData = { ...localData, [name]: value };
    setLocalData(newData);
    updateStepData(currentStep.id, { [name]: value });
  };

  const getFieldError = (fieldName: string) => {
    return currentStep.validationResult?.errors[fieldName];
  };

  const getFieldWarning = (fieldName: string) => {
    return currentStep.validationResult?.warnings[fieldName];
  };

  const getFieldSuggestion = (fieldName: string) => {
    return currentStep.validationResult?.suggestions[fieldName];
  };

  // Filter fields based on conditional display
  const visibleFields = currentConfig.fields.filter(field => {
    if (!field.conditionalDisplay) return true;
    return field.conditionalDisplay(state.formData);
  });

  return (
    <View style={styles.stepContentContainer}>
      <View style={styles.stepHeader}>
        <MaterialIcons name={currentConfig.icon as any} size={32} color={Colors.primary} />
        <View style={styles.stepHeaderText}>
          <Text style={styles.stepTitle}>{currentConfig.title}</Text>
          <Text style={styles.stepDescription}>{currentConfig.description}</Text>
          {currentConfig.estimatedTime && (
            <Text style={styles.stepEstimatedTime}>
              Estimated time: {currentConfig.estimatedTime} minutes
            </Text>
          )}
        </View>
      </View>

      <View style={styles.fieldsContainer}>
        {visibleFields.map((field) => (
          <FormField
            key={field.name}
            field={field}
            value={localData[field.name]}
            onChange={handleFieldChange}
            error={getFieldError(field.name)}
            warning={getFieldWarning(field.name)}
            suggestion={getFieldSuggestion(field.name)}
          />
        ))}
      </View>
    </View>
  );
}

// Navigation footer component
function NavigationFooter() {
  const {
    goToNextStep,
    goToPreviousStep,
    canGoToNextStep,
    canGoToPreviousStep,
    isLastStep,
    isFirstStep,
    submitForm,
    state,
    saveDraft,
  } = useProgressiveForm();

  const handleNext = async () => {
    if (isLastStep()) {
      try {
        await submitForm();
        Alert.alert('Success', 'Your shipment has been created successfully!');
      } catch (error) {
        // Error handling is done in submitForm
      }
    } else {
      goToNextStep();
    }
  };

  const handleSaveDraft = async () => {
    try {
      await saveDraft();
      Alert.alert('Success', 'Draft saved successfully!');
    } catch (error) {
      // Error handling is done in saveDraft
    }
  };

  return (
    <View style={styles.navigationFooter}>
      <View style={styles.draftContainer}>
        <TouchableOpacity
          style={styles.draftButton}
          onPress={handleSaveDraft}
          disabled={!state.hasUnsavedChanges}
        >
          <MaterialIcons 
            name="save" 
            size={20} 
            color={state.hasUnsavedChanges ? Colors.primary : Colors.text.secondary} 
          />
          <Text style={[
            styles.draftButtonText,
            !state.hasUnsavedChanges && styles.draftButtonTextDisabled,
          ]}>
            Save Draft
          </Text>
        </TouchableOpacity>
        
        {state.lastSaved && (
          <Text style={styles.lastSavedText}>
            Last saved: {state.lastSaved.toLocaleTimeString()}
          </Text>
        )}
      </View>

      <View style={styles.navigationButtons}>
        <TouchableOpacity
          style={[
            styles.navigationButton,
            styles.backButton,
            !canGoToPreviousStep() && styles.navigationButtonDisabled,
          ]}
          onPress={goToPreviousStep}
          disabled={!canGoToPreviousStep()}
        >
          <MaterialIcons name="arrow-back" size={20} color={Colors.text.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.navigationButton,
            styles.nextButton,
            !canGoToNextStep() && styles.navigationButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={!canGoToNextStep() || state.isSubmitting}
        >
          <Text style={styles.nextButtonText}>
            {state.isSubmitting ? 'Submitting...' : isLastStep() ? 'Submit' : 'Next'}
          </Text>
          <MaterialIcons 
            name={isLastStep() ? "check" : "arrow-forward"} 
            size={20} 
            color={Colors.text.inverse} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Main progressive form component
export default function ProgressiveFormContainer() {
  return (
    <SafeAreaView style={styles.container}>
      <ProgressIndicator />
      <StepContent />
      <NavigationFooter />
    </SafeAreaView>
  );
}

// Helper functions for modal pickers
const showSelectModal = (field: FormFieldConfig, currentValue: any, onChange: (name: string, value: any) => void) => {
  const options = Array.isArray(field.suggestions) ? field.suggestions : [];
  
  Alert.alert(
    field.label,
    'Select an option',
    options.map(option => ({
      text: option,
      onPress: () => onChange(field.name, option),
    })).concat([
      { text: 'Cancel', onPress: () => {} }
    ])
  );
};

const showDatePicker = (field: FormFieldConfig, currentValue: any, onChange: (name: string, value: any) => void) => {
  // Implementation would show a date picker
  onChange(field.name, new Date().toISOString());
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  
  // Progress indicator styles
  progressContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepIndicator: {
    alignItems: 'center',
    flex: 1,
  },
  stepIndicatorCurrent: {
    // Current step styling
  },
  stepIndicatorCompleted: {
    // Completed step styling
  },
  stepIndicatorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepIndicatorCircleCurrent: {
    backgroundColor: Colors.primary,
  },
  stepIndicatorCircleCompleted: {
    backgroundColor: Colors.success,
  },
  stepIndicatorNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  stepIndicatorNumberCurrent: {
    color: Colors.text.inverse,
  },
  stepIndicatorLabel: {
    fontSize: 12,
    textAlign: 'center',
    color: Colors.text.secondary,
    paddingHorizontal: 4,
  },
  stepIndicatorLabelCurrent: {
    color: Colors.primary,
    fontWeight: '600',
  },
  stepIndicatorLabelCompleted: {
    color: Colors.success,
  },

  // Step content styles
  stepContentContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 24,
  },
  stepHeaderText: {
    flex: 1,
    marginLeft: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  stepEstimatedTime: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  fieldsContainer: {
    flex: 1,
  },

  // Form field styles
  fieldContainer: {
    marginBottom: 24,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  required: {
    color: Colors.error,
  },
  estimatedTime: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: Colors.text.primary,
  },
  textInputFocused: {
    borderColor: Colors.primary,
  },
  textInputError: {
    borderColor: Colors.error,
  },
  textAreaInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectInputText: {
    fontSize: 16,
    color: Colors.text.primary,
    flex: 1,
  },
  selectInputPlaceholder: {
    color: Colors.text.secondary,
  },

  // Feedback styles
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    marginLeft: 8,
    flex: 1,
  },
  warningText: {
    fontSize: 14,
    color: Colors.warning,
    marginLeft: 8,
    flex: 1,
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 8,
    flex: 1,
  },

  // Help and suggestions styles
  helpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    padding: 12,
    backgroundColor: Colors.info + '20',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
  },
  helpText: {
    fontSize: 14,
    color: Colors.info,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  suggestionsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    marginBottom: 4,
  },
  suggestionItemText: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  fieldActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  helpButtonText: {
    fontSize: 12,
    color: Colors.primary,
    marginLeft: 4,
  },
  suggestionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  suggestionsButtonText: {
    fontSize: 12,
    color: Colors.primary,
    marginLeft: 4,
  },

  // Navigation footer styles
  navigationFooter: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  draftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  draftButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  draftButtonText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 8,
  },
  draftButtonTextDisabled: {
    color: Colors.text.secondary,
  },
  lastSavedText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 8,
  },
  backButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  nextButton: {
    backgroundColor: Colors.primary,
  },
  navigationButtonDisabled: {
    opacity: 0.5,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: 8,
  },
  nextButtonText: {
    fontSize: 16,
    color: Colors.text.inverse,
    fontWeight: '600',
    marginRight: 8,
  },
});

// Export TextInput for field rendering
import { TextInput } from 'react-native';