/**
 * Progressive Form Validation Script
 * This script validates the progressive form implementation without external testing dependencies
 */

import { SHIPMENT_FORM_STEPS } from '../components/forms/ShipmentFormSteps';

// Validation results interface
interface ValidationResult {
  component: string;
  test: string;
  passed: boolean;
  message: string;
}

// Validation function
function validateProgressiveForm(): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Test 1: Validate step configuration
  results.push({
    component: 'SHIPMENT_FORM_STEPS',
    test: 'Step count validation',
    passed: SHIPMENT_FORM_STEPS.length === 6,
    message: `Expected 6 steps, found ${SHIPMENT_FORM_STEPS.length}`
  });

  // Test 2: Validate step IDs
  const expectedStepIds = ['basic_info', 'pickup_location', 'delivery_location', 'vehicle_details', 'shipment_details', 'pricing_review'];
  const actualStepIds = SHIPMENT_FORM_STEPS.map(step => step.id);
  const stepIdsMatch = JSON.stringify(expectedStepIds) === JSON.stringify(actualStepIds);
  
  results.push({
    component: 'SHIPMENT_FORM_STEPS',
    test: 'Step ID sequence validation',
    passed: stepIdsMatch,
    message: stepIdsMatch ? 'Step IDs match expected sequence' : `Expected ${expectedStepIds.join(', ')}, found ${actualStepIds.join(', ')}`
  });

  // Test 3: Validate required fields exist
  let hasRequiredFields = true;
  let requiredFieldMessage = '';

  SHIPMENT_FORM_STEPS.forEach((step, stepIndex) => {
    const requiredFields = step.fields.filter(field => field.isRequired);
    if (requiredFields.length === 0) {
      hasRequiredFields = false;
      requiredFieldMessage += `Step ${stepIndex + 1} (${step.id}) has no required fields. `;
    }
  });

  results.push({
    component: 'SHIPMENT_FORM_STEPS',
    test: 'Required fields validation',
    passed: hasRequiredFields,
    message: hasRequiredFields ? 'All steps have required fields' : requiredFieldMessage
  });

  // Test 4: Validate field validation functions
  let validationFunctionsWork = true;
  let validationMessage = '';

  try {
    // Test basic info validations
    const basicInfoStep = SHIPMENT_FORM_STEPS[0];
    const customerNameField = basicInfoStep.fields.find(f => f.name === 'customerName');
    const customerEmailField = basicInfoStep.fields.find(f => f.name === 'customerEmail');
    const customerPhoneField = basicInfoStep.fields.find(f => f.name === 'customerPhone');

    // Test customer name validation
    if (customerNameField?.validation) {
      const nameEmptyResult = customerNameField.validation('');
      const nameValidResult = customerNameField.validation('John Doe');
      
      if (nameEmptyResult !== 'Customer name is required' || nameValidResult !== null) {
        validationFunctionsWork = false;
        validationMessage += 'Customer name validation failed. ';
      }
    }

    // Test email validation
    if (customerEmailField?.validation) {
      const emailEmptyResult = customerEmailField.validation('');
      const emailInvalidResult = customerEmailField.validation('invalid-email');
      const emailValidResult = customerEmailField.validation('test@example.com');
      
      if (emailEmptyResult !== 'Email is required' || 
          emailInvalidResult !== 'Please enter a valid email address' || 
          emailValidResult !== null) {
        validationFunctionsWork = false;
        validationMessage += 'Email validation failed. ';
      }
    }

    // Test phone validation
    if (customerPhoneField?.validation) {
      const phoneEmptyResult = customerPhoneField.validation('');
      const phoneInvalidResult = customerPhoneField.validation('invalid');
      const phoneValidResult = customerPhoneField.validation('(555) 123-4567');
      
      if (phoneEmptyResult !== 'Phone number is required' || 
          phoneInvalidResult !== 'Please enter a valid phone number' || 
          phoneValidResult !== null) {
        validationFunctionsWork = false;
        validationMessage += 'Phone validation failed. ';
      }
    }

  } catch (error) {
    validationFunctionsWork = false;
    validationMessage = `Validation function test threw error: ${error}`;
  }

  results.push({
    component: 'Field Validations',
    test: 'Validation functions work correctly',
    passed: validationFunctionsWork,
    message: validationFunctionsWork ? 'All validation functions work correctly' : validationMessage
  });

  // Test 5: Validate conditional display functions
  let conditionalDisplayWorks = true;
  let conditionalMessage = '';

  try {
    const pickupStep = SHIPMENT_FORM_STEPS[1]; // pickup_location
    const contactPhoneField = pickupStep.fields.find(f => f.name === 'contactPhoneAtPickup');
    
    if (contactPhoneField?.conditionalDisplay) {
      const hiddenResult = contactPhoneField.conditionalDisplay({ contactAtPickup: '' });
      const shownResult = contactPhoneField.conditionalDisplay({ contactAtPickup: 'John Doe' });
      
      if (hiddenResult !== false || shownResult !== true) {
        conditionalDisplayWorks = false;
        conditionalMessage = 'Conditional display logic failed';
      }
    }
  } catch (error) {
    conditionalDisplayWorks = false;
    conditionalMessage = `Conditional display test threw error: ${error}`;
  }

  results.push({
    component: 'Conditional Display',
    test: 'Conditional field display works',
    passed: conditionalDisplayWorks,
    message: conditionalDisplayWorks ? 'Conditional display logic works correctly' : conditionalMessage
  });

  // Test 6: Validate estimated time calculation
  const totalEstimatedTime = SHIPMENT_FORM_STEPS.reduce((total, step) => {
    return total + (step.estimatedTime || 0);
  }, 0);

  results.push({
    component: 'Time Estimation',
    test: 'Total estimated time calculation',
    passed: totalEstimatedTime === 17, // 2+3+3+4+3+2
    message: `Expected 17 minutes total, calculated ${totalEstimatedTime} minutes`
  });

  // Test 7: Validate step icons
  const expectedIcons = ['info', 'location-on', 'flag', 'directions-car', 'local-shipping', 'receipt'];
  const actualIcons = SHIPMENT_FORM_STEPS.map(step => step.icon);
  const iconsMatch = JSON.stringify(expectedIcons) === JSON.stringify(actualIcons);

  results.push({
    component: 'Step Icons',
    test: 'Icon configuration validation',
    passed: iconsMatch,
    message: iconsMatch ? 'All step icons are correctly configured' : `Expected icons ${expectedIcons.join(', ')}, found ${actualIcons.join(', ')}`
  });

  return results;
}

// Run validation and display results
console.log('🚀 Progressive Form Validation Starting...\n');

const results = validateProgressiveForm();
let passedTests = 0;
let totalTests = results.length;

results.forEach((result, index) => {
  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${index + 1}. [${result.component}] ${result.test}: ${status}`);
  console.log(`   ${result.message}\n`);
  
  if (result.passed) passedTests++;
});

console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('🎉 All tests passed! Progressive form implementation is valid.');
} else {
  console.log('⚠️  Some tests failed. Please review the implementation.');
}

// Additional form structure analysis
console.log('\n📋 Form Structure Analysis:');
console.log(`Total Steps: ${SHIPMENT_FORM_STEPS.length}`);
console.log(`Total Fields: ${SHIPMENT_FORM_STEPS.reduce((total, step) => total + step.fields.length, 0)}`);
console.log(`Required Fields: ${SHIPMENT_FORM_STEPS.reduce((total, step) => total + step.fields.filter(f => f.isRequired).length, 0)}`);
console.log(`Estimated Completion Time: ${SHIPMENT_FORM_STEPS.reduce((total, step) => total + (step.estimatedTime || 0), 0)} minutes`);

// Step-by-step breakdown
console.log('\n🔍 Step Breakdown:');
SHIPMENT_FORM_STEPS.forEach((step, index) => {
  const requiredFields = step.fields.filter(f => f.isRequired).length;
  const totalFields = step.fields.length;
  console.log(`${index + 1}. ${step.title}: ${totalFields} fields (${requiredFields} required) - ${step.estimatedTime}min`);
});

export default validateProgressiveForm;