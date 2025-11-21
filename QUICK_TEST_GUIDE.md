# Quick Testing Guide - Invoice/Receipt System

## ✅ System Ready!

Your invoice/receipt email system is **fully integrated** and ready to test!

---

## 🧪 Quick Test (5 minutes)

### Step 1: Create Test Shipment
1. Go to: `https://drivedrop.us.com/dashboard/new-shipment`
2. Fill in shipment details:
   - **Pickup:** Dallas, TX
   - **Delivery:** San Diego, CA
   - **Vehicle:** 2020 Toyota Camry (Sedan)
3. Complete payment (20% upfront)

### Step 2: Check Your Email
📧 **You should receive:** Booking Confirmation Email

**Subject:** `✅ Booking Confirmed - Shipment #[ID] | DriveDrop`

**Look for:**
- ✅ Teal gradient header
- ✅ Complete pricing breakdown (7 factors)
- ✅ Payment split: 20% ✓ charged / 80% ⏳ reserved
- ✅ "What's Next?" section
- ✅ Track Shipment button

### Step 3: Download Receipt
1. Go to shipment details page
2. Click **"Receipt"** button (top right)
3. ✅ Downloads `DriveDrop-Receipt-[ID].txt`
4. Open file - verify it contains:
   - Receipt number
   - Shipment details
   - Pricing breakdown
   - Payment status

### Step 4: Check Database (Optional)
```sql
-- Check email was sent
SELECT id, upfront_payment_sent 
FROM shipments 
WHERE id = 'your-shipment-id';
-- Should show: upfront_payment_sent = TRUE

-- Check receipt record
SELECT receipt_number, receipt_type, amount, sent_to_email
FROM payment_receipts
WHERE shipment_id = 'your-shipment-id';
-- Should show: DD-{id}-01, upfront, $255.74
```

---

## 🎉 Test Delivery Flow (Full Test)

### Step 5: Mark as Delivered (Admin)
1. Log in as admin
2. Go to shipment in admin panel
3. Update status to "delivered"
4. Capture 80% payment

### Step 6: Check Emails
📧 **Client receives:** Delivery Receipt Email
- **Subject:** `🎉 Delivery Complete - Receipt for Shipment #[ID]`
- Green gradient header
- Complete payment summary (both 20% + 80%)
- Delivery confirmation

📧 **Driver receives:** Payout Notification Email
- **Subject:** `💰 Payout Confirmed - $1,022.96`
- Green gradient header
- Earnings breakdown (80/20 split)
- Payout timeline

### Step 7: Verify Database
```sql
-- All flags should be TRUE
SELECT 
  upfront_payment_sent,
  final_receipt_sent,
  driver_payout_notified
FROM shipments
WHERE id = 'your-shipment-id';

-- Should have 2 receipts
SELECT receipt_number, receipt_type, amount
FROM payment_receipts
WHERE shipment_id = 'your-shipment-id'
ORDER BY sent_at;
-- Shows: DD-{id}-01 (upfront) + DD-{id}-02 (final)
```

---

## 🔍 Where to Look for Issues

### If Email Not Received:
1. **Check spam folder** (Brevo sometimes goes to spam first time)
2. **Check backend logs:**
   ```bash
   # In Railway dashboard or local terminal
   # Look for:
   "Sending booking confirmation email"
   "Booking confirmation email sent successfully"
   ```
3. **Verify environment variables:**
   - `BREVO_API_KEY` is set
   - `FRONTEND_URL` is correct
4. **Check Brevo dashboard:**
   - https://app.brevo.com/
   - Go to "Transactional" → "Emails"
   - See delivery status

### If Receipt Download Fails:
1. **Check browser console** (F12)
2. **Verify shipment data** is loaded
3. **Check popup blocker** settings

### If Database Queries Fail:
1. **Verify migration ran:**
   ```sql
   -- Check columns exist
   SELECT column_name 
   FROM information_schema.columns
   WHERE table_name = 'shipments'
   AND column_name IN ('upfront_payment_sent', 'final_receipt_sent');
   
   -- Check table exists
   SELECT * FROM payment_receipts LIMIT 1;
   ```

---

## 📊 Backend Logs to Watch

### Successful Email Flow Logs:
```
✅ Payment succeeded
✅ Sending booking confirmation email
✅ Booking confirmation email sent successfully
✅ Brevo email service initialized successfully
✅ Email sent via Brevo
```

### What Good Logs Look Like:
```javascript
{
  "level": "info",
  "message": "Payment succeeded",
  "paymentIntentId": "pi_xxx",
  "shipmentId": "11c701ed-xxx",
  "amount": 25574
}

{
  "level": "info",
  "message": "Sending booking confirmation email",
  "shipmentId": "11c701ed-xxx",
  "clientEmail": "client@example.com"
}

{
  "level": "info",
  "message": "Booking confirmation email sent successfully",
  "shipmentId": "11c701ed-xxx"
}
```

---

## 🎯 Expected Results

### After 20% Payment:
| What | Expected Result |
|------|----------------|
| Client Email | ✅ Booking confirmation received |
| Database Flag | `upfront_payment_sent = TRUE` |
| Receipt Record | `DD-{id}-01` exists |
| Payment Status | `partial_paid` |
| Download Button | ✅ Works and shows 20% charged |

### After 80% Payment:
| What | Expected Result |
|------|----------------|
| Client Email | ✅ Delivery receipt received |
| Driver Email | ✅ Payout notification received |
| Database Flags | All 3 flags = `TRUE` |
| Receipt Records | Both `DD-{id}-01` and `DD-{id}-02` exist |
| Payment Status | `paid` (full) |
| Download Button | ✅ Shows both payments |

---

## 🚀 You're Ready!

### What's Automatic:
- ✅ Emails send on Stripe webhook events
- ✅ Receipt records inserted in database
- ✅ Flags updated automatically
- ✅ Driver notifications sent on delivery

### What You Control:
- ✅ Receipt download (client clicks button)
- ✅ Shipment status updates (admin or driver)
- ✅ Payment captures (Stripe dashboard or API)

### No Manual Configuration Needed:
- ✅ Webhooks already integrated in code
- ✅ Email service already initialized
- ✅ Database functions already created
- ✅ Receipt templates already designed

---

## 📞 Support

**If something doesn't work:**
1. Check logs in Railway dashboard
2. Verify environment variables
3. Check Brevo dashboard for email delivery
4. Query database for flags/receipts
5. Review `INVOICE_SYSTEM_INTEGRATED.md`

---

## 🎉 Start Testing!

**Just create a shipment and complete payment.**  
The emails will send automatically! 🚀

No webhook configuration needed - it's all in the code! ✅
