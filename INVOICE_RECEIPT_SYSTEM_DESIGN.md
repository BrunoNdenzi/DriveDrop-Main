## Invoice & Receipt Email System Design

### Overview
We need to send professional invoices/receipts at two key payment moments:
1. **Booking Confirmation** - When 20% upfront payment is authorized & captured
2. **Delivery Receipt** - When remaining 80% is captured upon delivery

---

## 📧 Email Flow

### 1. **Booking Confirmation Email** (Sent immediately after booking)
**Trigger:** After successful 20% payment capture
**Recipients:** Client
**Content:**
- Shipment details (pickup/delivery addresses, vehicle info)
- Price breakdown:
  - Base price (distance × rate)
  - Delivery speed multiplier
  - Fuel adjustment
  - Subtotal
  - Amount charged now (20%)
  - Amount reserved (80%)
- Payment method (last 4 digits)
- Estimated delivery date
- Tracking link
- Terms & conditions link

**Subject:** `Booking Confirmed - Shipment #[ID] | DriveDrop`

---

### 2. **Delivery Receipt Email** (Sent when delivery is completed)
**Trigger:** After successful 80% payment capture
**Recipients:** Client & Driver
**Content:**
- Shipment summary
- Complete payment breakdown:
  - Total amount: $XXX.XX
  - Upfront payment (20%): $XXX.XX (charged on [date])
  - Remaining payment (80%): $XXX.XX (charged on [date])
  - Payment method used
- Delivery confirmation details:
  - Completed on: [date/time]
  - Driver: [name]
  - Delivery photos (links)
- Driver earnings breakdown (driver email only):
  - Total shipment: $XXX.XX
  - Platform fee (20%): $XXX.XX
  - Your earnings (80%): $XXX.XX
  - Payout method: [Stripe Connect account]

**Subject:** `Delivery Complete - Receipt for Shipment #[ID] | DriveDrop`

---

### 3. **Full Invoice PDF** (Optional - generated on request)
**Trigger:** User clicks "Download Invoice" button
**Format:** PDF attachment
**Content:**
- Professional header with logo
- Invoice number & date
- Client details
- Shipment details
- Itemized pricing breakdown
- Payment history table
- Terms & conditions
- Tax information (if applicable)

---

## 💰 Pricing Breakdown Format

### For Client Emails:
```
Shipment Pricing Breakdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Distance: 1,346 miles
Vehicle Type: Sedan
Distance Band: Mid-distance (501-1500 miles)

Base Rate: $0.95/mile
Raw Price: $1,278.70

Delivery Speed: Standard (1.0x)
Fuel Adjustment: +0% ($3.70/gal)

Subtotal: $1,278.70
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: $1,278.70

Payment Schedule:
├─ Upfront (20%): $255.74 ✓ Charged [date]
└─ On Delivery (80%): $1,022.96 ⏳ Reserved
```

### For Driver Emails (Delivery):
```
Your Earnings Breakdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Shipment: $1,278.70

Your Earnings (80%): $1,022.96
Platform Fee (20%): $255.74
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NET PAYOUT: $1,022.96

Payout Method: Stripe Connect
Expected in: 2-5 business days
```

---

## 🎨 Email Design Requirements

### Visual Elements:
- **Colors:** Teal (#00B8A9) primary, White background, Gray text
- **Logo:** DriveDrop logo at top
- **Layout:** Clean, mobile-responsive HTML
- **Buttons:** 
  - "View Shipment Details" (links to shipment page)
  - "Download Invoice PDF" (optional)
  - "Contact Support" (mailto link)

### Typography:
- Headers: 24px, bold, teal
- Body: 16px, regular, dark gray
- Amounts: 18px, bold, dark
- Tables: 14px with zebra striping

### Mobile Optimization:
- Single column layout
- Large touch-friendly buttons (min 44px height)
- Readable font sizes (min 14px)

---

## 🔐 Security & Compliance

### Data to Include:
✅ Shipment ID
✅ Transaction dates
✅ Amount charged
✅ Last 4 digits of payment method
✅ Receipt number (unique)

### Data to EXCLUDE:
❌ Full credit card numbers
❌ CVV codes
❌ Full bank account numbers
❌ Social security numbers

### Legal Requirements:
- Clearly state "This is not a tax invoice" (if no tax collected)
- Include business registration details
- Provide unsubscribe option (transactional emails exempt but good practice)
- Include privacy policy link

---

## 📊 Implementation Checklist

### Backend (Node.js):
- [ ] Create `sendBookingConfirmationEmail()` function
- [ ] Create `sendDeliveryReceiptEmail()` function
- [ ] Create `sendDriverPayoutNotification()` function
- [ ] Create HTML email templates
- [ ] Add receipt number generation logic
- [ ] Integrate with existing email service (Brevo/Gmail)
- [ ] Add webhook handlers for payment events

### Database:
- [ ] Add `receipt_number` field to payments table
- [ ] Store email sent timestamps
- [ ] Track email delivery status

### Frontend:
- [ ] Add "Download Invoice" button to shipment details
- [ ] Create PDF generation endpoint
- [ ] Display receipt numbers in payment history

---

## 📝 Email Content Examples

### Booking Confirmation Subject Lines:
- `✅ Booking Confirmed - Shipment #12345 | DriveDrop`
- `🚗 Your Vehicle Transport is Booked! | DriveDrop`
- `Confirmation: Dallas to San Diego Transport | DriveDrop`

### Delivery Receipt Subject Lines:
- `✅ Delivered - Receipt for Shipment #12345 | DriveDrop`
- `🎉 Delivery Complete! Your Receipt is Ready | DriveDrop`
- `Receipt: Your Vehicle Has Arrived | DriveDrop`

---

## 🚀 Next Steps

1. **Create Email Templates** - HTML with inline CSS for compatibility
2. **Add to Stripe Webhooks** - Trigger emails on payment events
3. **Test with Test Mode** - Use Stripe test cards to verify flow
4. **Add PDF Generation** - Use library like `pdfkit` or `puppeteer`
5. **Deploy & Monitor** - Track email delivery rates

---

## 🔄 Future Enhancements

- **Multi-language support** for emails
- **SMS notifications** for key events
- **Branded invoice PDFs** with QR codes
- **Email analytics dashboard** (open rates, click rates)
- **Customizable email templates** for admins
- **Automated reminders** for pending payments

---

**Should I proceed with implementing these email templates and functions?**
