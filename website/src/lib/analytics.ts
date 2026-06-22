/**
 * DriveDrop Analytics Helper
 * All GA4 custom events + Google Ads conversions in one place.
 *
 * HOW TO VIEW IN GA4:
 *  Reports → Engagement → Events  (live within 24 hrs)
 *  Explore → Funnel exploration   (build funnel from the event names below)
 *
 * EVENT FUNNEL (in order):
 *  1. quote_form_submitted     — user submits quote request form
 *  2. signup_completed         — user creates account
 *  3. payment_initiated        — user lands on checkout / payment step
 *  4. booking_payment_success  — Stripe payment confirmed, shipment created
 *  5. service_payment_success  — services/pay page paid=1 reached
 */

declare global {
  interface Window {
    gtag: (...args: any[]) => void
  }
}

const ADS_ID = 'AW-7855297599'

function gtag(...args: any[]) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args)
  }
}

// ── Step 1: Quote form submitted ─────────────────────────
export function trackQuoteSubmitted(estimatedPrice?: number) {
  gtag('event', 'quote_form_submitted', {
    event_category: 'funnel',
    event_label: 'quote_step',
    value: estimatedPrice ?? 0,
    currency: 'USD',
  })
  // Google Ads conversion
  gtag('event', 'conversion', {
    send_to: ADS_ID,
    event_category: 'request_quote',
    value: estimatedPrice ?? 0,
    currency: 'USD',
  })
}

// ── Step 2: Sign-up completed ────────────────────────────
export function trackSignupCompleted(role?: string) {
  gtag('event', 'signup_completed', {
    event_category: 'funnel',
    event_label: role ?? 'unknown',
  })
  gtag('event', 'conversion', {
    send_to: ADS_ID,
    event_category: 'sign_up',
  })
}

// ── Step 3: Payment initiated (user reaches checkout) ────
export function trackPaymentInitiated(amount: number) {
  gtag('event', 'payment_initiated', {
    event_category: 'funnel',
    event_label: 'checkout_step',
    value: amount,
    currency: 'USD',
  })
}

// ── Step 4: Booking payment success (vehicle shipping) ───
export function trackBookingPaymentSuccess(params: {
  shipmentId: string
  paymentIntentId: string
  amount: number
}) {
  gtag('event', 'booking_payment_success', {
    event_category: 'funnel',
    event_label: 'payment_complete',
    transaction_id: params.shipmentId,
    value: params.amount,
    currency: 'USD',
  })
  // GA4 purchase event (shows in Monetisation reports automatically)
  gtag('event', 'purchase', {
    transaction_id: params.shipmentId,
    value: params.amount,
    currency: 'USD',
    items: [{ item_name: 'Vehicle Shipping Booking', price: params.amount, quantity: 1 }],
  })
}

// ── Step 5: Service payment success (tiles/tree/etc) ─────
export function trackServicePaymentSuccess(params: {
  service: string
  amount: number
  bookingRef: string
}) {
  gtag('event', 'service_payment_success', {
    event_category: 'funnel',
    event_label: params.service,
    transaction_id: params.bookingRef,
    value: params.amount,
    currency: 'USD',
  })
  gtag('event', 'purchase', {
    transaction_id: params.bookingRef,
    value: params.amount,
    currency: 'USD',
    items: [{ item_name: params.service, price: params.amount, quantity: 1 }],
  })
}
