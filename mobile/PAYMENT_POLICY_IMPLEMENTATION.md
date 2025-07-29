# Mobile Payment Policy Implementation Plan

## Overview

This document outlines the steps needed to implement the payment policy visualization in the DriveDrop mobile app, showcasing the 20%/80% payment split and refund policy.

## Components to Implement

1. **PaymentPolicyCard**
   - ✓ Created base component
   - ✓ Added payment breakdown visualization
   - ✓ Added refund policy information
   - ✓ Created time remaining countdown

2. **Shipment Payment Screen**
   - [ ] Update to show 20% initial payment calculation
   - [ ] Add payment policy explanation
   - [ ] Enhance confirmation messaging

3. **Shipment Details Screen**
   - [ ] Add payment status section
   - [ ] Show refund eligibility with countdown
   - [ ] Add button for requesting refund when eligible

4. **Delivery Completion Screen**
   - [ ] Add final payment section (80%)
   - [ ] Show payment breakdown
   - [ ] Implement final payment flow

## Implementation Steps

### 1. Add the PaymentPolicyCard to the Shipment Payment Screen

```jsx
// In ShipmentPaymentScreen.tsx
import { PaymentPolicyCard } from '../components/payment/PaymentPolicyCard';

// Inside the render function
<View style={styles.container}>
  <Text style={styles.title}>Payment Details</Text>
  
  <PaymentPolicyCard
    totalAmount={shipmentAmount}
    paymentType="initial"
    isRefundable={true}
  />
  
  <StripePaymentForm
    amount={Math.round(shipmentAmount * 0.2)}
    shipmentId={shipmentId}
    onPaymentSuccess={handlePaymentSuccess}
    onPaymentError={handlePaymentError}
  />
</View>
```

### 2. Update the Shipment Details Screen

```jsx
// In ShipmentDetailsScreen.tsx
import { PaymentPolicyCard } from '../components/payment/PaymentPolicyCard';

// Add this section
const renderPaymentSection = () => {
  if (!payment) return null;
  
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Payment Information</Text>
      
      <PaymentPolicyCard
        totalAmount={payment.amount}
        initialAmount={payment.initial_amount}
        remainingAmount={payment.remaining_amount}
        refundDeadline={payment.refund_deadline}
        isRefundable={payment.is_refundable}
        paymentType={payment.payment_type}
      />
      
      {payment.is_refundable && (
        <Button
          title="Request Refund"
          onPress={handleRefundRequest}
          style={styles.refundButton}
        />
      )}
    </View>
  );
};
```

### 3. Implement the Delivery Completion Screen

```jsx
// In DeliveryCompletionScreen.tsx
import { PaymentPolicyCard } from '../components/payment/PaymentPolicyCard';

// Inside the render function
<View style={styles.container}>
  <Text style={styles.title}>Delivery Completed</Text>
  
  <View style={styles.paymentSection}>
    <Text style={styles.sectionTitle}>Final Payment Required</Text>
    
    <PaymentPolicyCard
      totalAmount={shipment.payment.amount}
      initialAmount={shipment.payment.initial_amount}
      remainingAmount={shipment.payment.remaining_amount}
      paymentType="final"
    />
    
    <Button
      title="Make Final Payment"
      onPress={handleFinalPayment}
      style={styles.paymentButton}
    />
  </View>
</View>
```

## API Integration

To fully implement this UI, make sure the following API endpoints are called:

1. **Get Payment Details**
   - `GET /api/v1/payments/:id` - Get payment details including initial/remaining amounts
   
2. **Check Refund Eligibility**
   - `GET /api/v1/payments/:id/refund-eligibility` - Check if payment is eligible for refund
   
3. **Process Refund**
   - `POST /api/v1/payments/:id/refund` - Process a refund for the initial payment
   
4. **Create Final Payment**
   - `POST /api/v1/payments/:id/final-payment` - Create the final payment for a shipment

## Testing Plan

1. **Initial Payment Flow**
   - Create a new shipment
   - Verify the payment card shows 20% of total
   - Complete payment and check payment status
   
2. **Refund Testing**
   - Create a shipment and make initial payment
   - View shipment details within 1-hour window
   - Verify refund countdown is displayed
   - Test requesting a refund
   
3. **Final Payment Flow**
   - Complete a shipment delivery
   - Verify final payment shows correct 80% amount
   - Process final payment and check status updates

## Timeline

- Day 1: Implement PaymentPolicyCard component (COMPLETED)
- Day 2: Update Shipment Payment Screen
- Day 3: Update Shipment Details Screen
- Day 4: Implement Delivery Completion Screen
- Day 5: Testing and refinement
