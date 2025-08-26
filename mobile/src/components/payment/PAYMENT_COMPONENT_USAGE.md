# How to Use the Payment Policy Component

## Import the Component

```javascript
import { PaymentPolicyCard } from '../components/payment/PaymentPolicyCard';
```

## Basic Usage

```jsx
// Display for a new shipment (initial payment)
<PaymentPolicyCard
  totalAmount={12500} // Amount in cents (e.g., $125.00)
  paymentType="initial"
  isRefundable={true}
  refundDeadline="2025-07-29T10:30:00Z" // 1 hour after booking
/>

// Display for completed shipment (final payment)
<PaymentPolicyCard
  totalAmount={12500}
  initialAmount={2500} // 20% in cents
  remainingAmount={10000} // 80% in cents
  paymentType="final"
/>

// Display for fully paid shipment
<PaymentPolicyCard
  totalAmount={12500}
  paymentType="complete"
/>
```

## Integration with Shipment Details Screen

```jsx
// In ShipmentDetailsScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { PaymentPolicyCard } from '../components/payment/PaymentPolicyCard';
import { getShipmentDetails } from '../services/shipmentService';

export function ShipmentDetailsScreen({ route }) {
  const { shipmentId } = route.params;
  const [shipment, setShipment] = useState(null);
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    // Fetch shipment and payment details
    const loadDetails = async () => {
      const details = await getShipmentDetails(shipmentId);
      setShipment(details.shipment);
      setPayment(details.payment);
    };

    loadDetails();
  }, [shipmentId]);

  if (!shipment || !payment) {
    return <LoadingIndicator />;
  }

  return (
    <ScrollView>
      <ShipmentInfoCard shipment={shipment} />

      <PaymentPolicyCard
        totalAmount={payment.amount}
        initialAmount={payment.initial_amount}
        remainingAmount={payment.remaining_amount}
        refundDeadline={payment.refund_deadline}
        isRefundable={payment.is_refundable}
        paymentType={payment.payment_type}
      />

      {/* Other shipment details components */}
    </ScrollView>
  );
}
```

## Styling Customization

The PaymentPolicyCard uses the DriveDrop design system for consistent styling. You can customize its appearance by providing a style prop:

```jsx
<PaymentPolicyCard
  totalAmount={12500}
  style={{ marginHorizontal: 24, marginVertical: 16 }}
/>
```
