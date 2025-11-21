'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { CreditCard, Lock, Check, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PaymentStepProps {
  shipmentData: any
  completionData: {
    vehiclePhotos: string[]
    ownershipDocuments: string[]
    termsAccepted: boolean
  }
  onPaymentComplete: (paymentIntentId: string, shipmentId: string) => void
  onFinalSubmit: () => void
}

interface PaymentFormProps extends PaymentStepProps {
  clientSecret: string
}

function PaymentForm({ shipmentData, completionData, onPaymentComplete, onFinalSubmit, clientSecret }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const { profile, user } = useAuth()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [paymentSuccessful, setPaymentSuccessful] = useState(false)

  const supabase = getSupabaseBrowserClient()

  const upfrontAmount = Math.round(shipmentData.estimatedPrice * 0.20 * 100) // Convert to cents
  const totalAmount = Math.round(shipmentData.estimatedPrice * 100) // Convert to cents

  // Extract payment intent ID from clientSecret
  useEffect(() => {
    if (clientSecret) {
      const piId = clientSecret.split('_secret_')[0]
      setPaymentIntentId(piId)
      console.log('[PaymentForm] Payment Intent ID extracted:', piId)
    }
  }, [clientSecret])

  const createShipmentInDatabase = async (paymentIntentId: string) => {
    try {
      console.log('Creating shipment with data:', {
        client_id: profile?.id,
        vehicle: `${shipmentData.vehicleYear} ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
        pickup: shipmentData.pickupAddress,
        delivery: shipmentData.deliveryAddress,
      })

      // Create shipment record
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .insert({
          client_id: profile?.id,
          title: `${shipmentData.vehicleYear} ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
          description: `${shipmentData.vehicleType} transport - ${shipmentData.isOperable ? 'Operable' : 'Non-Operable'}`,
          pickup_address: shipmentData.pickupAddress,
          delivery_address: shipmentData.deliveryAddress,
          pickup_date: shipmentData.pickupDate ? new Date(shipmentData.pickupDate).toISOString() : null,
          estimated_price: shipmentData.estimatedPrice,
          status: 'pending',
          vehicle_type: shipmentData.vehicleType,
          vehicle_make: shipmentData.vehicleMake,
          vehicle_model: shipmentData.vehicleModel,
          vehicle_year: parseInt(shipmentData.vehicleYear),
          is_operable: shipmentData.isOperable,
          distance: shipmentData.distance,
          terms_accepted: true,
          payment_intent_id: paymentIntentId,
          payment_status: 'processing',
          client_vehicle_photos: JSON.stringify({
            front: completionData.vehiclePhotos[0] || null,
            rear: completionData.vehiclePhotos[1] || null,
            left: completionData.vehiclePhotos[2] || null,
            right: completionData.vehiclePhotos[3] || null,
            interior: completionData.vehiclePhotos[4] || null,
            damage: completionData.vehiclePhotos[5] || null,
          }),
        })
        .select()
        .single()

      if (shipmentError) {
        console.error('Shipment creation error:', shipmentError)
        throw shipmentError
      }

      console.log('Shipment created successfully:', shipment.id)

      // Create payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          shipment_id: shipment.id,
          client_id: profile?.id,
          amount: shipmentData.estimatedPrice,
          initial_amount: upfrontAmount,
          remaining_amount: totalAmount - upfrontAmount,
          status: 'completed',
          payment_method: 'card',
          payment_intent_id: paymentIntentId,
          metadata: {
            vehicle: `${shipmentData.vehicleYear} ${shipmentData.vehicleMake} ${shipmentData.vehicleModel}`,
            upfront_percentage: 20,
            delivery_percentage: 80,
          },
        })

      if (paymentError) {
        console.error('Payment record error:', paymentError)
        throw paymentError
      }

      console.log('Payment record created successfully')
      return shipment.id
    } catch (error: any) {
      console.error('Error creating shipment:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      throw new Error(error.message || 'Failed to create shipment record')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      setError('Stripe has not loaded yet. Please try again.')
      return
    }

    if (!clientSecret || !paymentIntentId) {
      setError('Payment not initialized. Please refresh and try again.')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      console.log('[PaymentForm] Starting payment confirmation...')
      
      // Confirm payment with Stripe (supports all payment methods)
      // Note: Don't pass payment_method_data here - let Elements handle it
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/client`,
        },
        redirect: 'if_required', // Only redirect if payment method requires it
      })

      console.log('[PaymentForm] Confirmation result:', { confirmError, paymentIntent })

      if (confirmError) {
        console.error('[PaymentForm] Confirmation error:', confirmError)
        throw new Error(confirmError.message)
      }

      // For manual capture, the status will be 'requires_capture' not 'succeeded'
      if (paymentIntent?.status === 'requires_capture' || paymentIntent?.status === 'succeeded') {
        console.log('[PaymentForm] Payment confirmed! Status:', paymentIntent.status)
        console.log('[PaymentForm] About to create shipment in database...')
        
        // Create shipment in database
        const shipmentId = await createShipmentInDatabase(paymentIntentId)
        console.log('[PaymentForm] Shipment created, ID:', shipmentId)
        
        // Trigger backend email notification
        console.log('[PaymentForm] Starting email notification process...')
        try {
          console.log('[PaymentForm] Triggering email notification...', {
            url: `${process.env.NEXT_PUBLIC_API_URL}/payments/notify-payment-success`,
            paymentIntentId: paymentIntent.id,
            shipmentId
          })
          
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/payments/notify-payment-success`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ 
              paymentIntentId: paymentIntent.id,
              shipmentId 
            })
          })
          
          const data = await response.json()
          console.log('[PaymentForm] Email notification response:', { status: response.status, data })
          
          if (!response.ok) {
            console.error('[PaymentForm] Email notification failed:', data)
          }
        } catch (emailError) {
          console.error('[PaymentForm] Failed to trigger email notification:', emailError)
          // Don't fail the payment flow if email fails
        }
        
        // Mark as successful
        setPaymentSuccessful(true)
        onPaymentComplete(paymentIntentId, shipmentId)
        
        // Wait a moment then trigger final submit
        setTimeout(() => {
          onFinalSubmit()
        }, 2000)
      } else {
        console.error('[PaymentForm] Unexpected payment status:', paymentIntent?.status)
        throw new Error('Payment confirmation did not complete successfully')
      }
    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'Payment failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  if (paymentSuccessful) {
    return (
      <div className="text-center py-12">
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="h-10 w-10 text-green-600" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
        <p className="text-gray-600 mb-4">
          Your shipment has been created and the initial payment has been processed.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-md mx-auto">
          <p className="text-sm text-green-800">
            You'll receive a confirmation email shortly. We'll notify you when a driver is assigned to your shipment.
          </p>
        </div>
      </div>
    )
  }

  // Wait for clientSecret before rendering Stripe Elements
  if (!clientSecret) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment</h2>
          <p className="text-gray-600">Complete your payment to confirm the shipment</p>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Initializing payment...</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Summary */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Payment Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-700">Total Quote:</span>
            <span className="font-semibold text-gray-900">
              ${shipmentData.estimatedPrice.toFixed(2)}
            </span>
          </div>
          <div className="border-t border-teal-300 pt-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-900">Initial Payment (20%)</p>
                <p className="text-sm text-gray-600">Charged today</p>
              </div>
              <span className="text-2xl font-bold text-teal-600">
                ${(upfrontAmount / 100).toFixed(2)}
              </span>
            </div>
          </div>
          <div className="border-t border-teal-300 pt-3">
            <div className="flex justify-between items-center text-gray-600">
              <div>
                <p className="font-medium">Remaining Balance (80%)</p>
                <p className="text-xs">Captured on delivery</p>
              </div>
              <span className="font-semibold">
                ${((totalAmount - upfrontAmount) / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Authorization Hold Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
            <Lock className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-900 mb-2">How Payment Works</h4>
            <div className="text-sm text-blue-800 space-y-2">
              <div className="flex items-start gap-2">
                <span className="font-bold mt-0.5">1.</span>
                <p>
                  We'll <strong>authorize the full ${shipmentData.estimatedPrice.toFixed(2)}</strong> on your card 
                  (this temporarily reserves the funds but doesn't charge them yet)
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold mt-0.5">2.</span>
                <p>
                  We immediately <strong>charge ${(upfrontAmount / 100).toFixed(2)} (20%)</strong> as your initial payment
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold mt-0.5">3.</span>
                <p>
                  The remaining <strong>${((totalAmount - upfrontAmount) / 100).toFixed(2)} (80%)</strong> stays 
                  "on hold" on your card - you'll see it as pending
                </p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold mt-0.5">4.</span>
                <p>
                  Upon successful delivery, we automatically capture the remaining 80% - 
                  <strong className="text-blue-900"> no cash needed!</strong>
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-300">
              <p className="text-xs text-blue-700 flex items-start gap-2">
                <Lock className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>
                  This is the same secure payment method used by hotels and rental car companies. 
                  If delivery cannot be completed, the hold will be released within 7 days.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Remaining Payment Info - OLD VERSION - REMOVE THIS */}
      <div className="hidden bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Remaining Payment:</p>
            <p>
              The remaining <strong>${((totalAmount - upfrontAmount) / 100).toFixed(2)} (80%)</strong> will be charged automatically to the same card upon successful delivery of your vehicle.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Method - PaymentElement (supports all methods) */}
      {clientSecret ? (
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            Payment Method
          </label>
          <div className="border-2 border-gray-300 rounded-lg p-4">
            <PaymentElement
              options={{
                layout: {
                  type: 'tabs',
                  defaultCollapsed: false,
                },
                wallets: {
                  applePay: 'auto',
                  googlePay: 'auto',
                },
                terms: {
                  card: 'never',
                },
                // Pre-fill billing details from shipment data
                defaultValues: {
                  billingDetails: {
                    name: shipmentData.customerName || '',
                    email: profile?.email || shipmentData.customerEmail || '',
                    phone: shipmentData.customerPhone || '',
                  }
                },
                // Enable billing details collection
                fields: {
                  billingDetails: {
                    name: 'auto',
                    email: 'auto',
                    phone: 'auto',
                    address: 'auto',
                  }
                }
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💳 Credit/Debit Card • 🍎 Apple Pay • 📱 Google Pay • 🏦 Bank Account
          </p>
        </div>
      ) : (
        <div className="border-2 border-gray-300 rounded-lg p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600">Initializing payment...</p>
        </div>
      )}

      {/* Billing Information */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-3 text-sm">Billing Information</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Name:</span>
            <span className="font-medium text-gray-900">{shipmentData.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Email:</span>
            <span className="font-medium text-gray-900">{profile?.email || shipmentData.customerEmail}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Phone:</span>
            <span className="font-medium text-gray-900">{shipmentData.customerPhone}</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-gray-600" />
          <p className="text-sm text-gray-700">
            Your payment information is encrypted and secure. We never store your card details.
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={!stripe || !clientSecret || processing}
        className="w-full bg-teal-600 hover:bg-teal-700 text-white py-6 text-lg font-semibold"
      >
        {processing ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard className="h-5 w-5 mr-2" />
            Pay ${(upfrontAmount / 100).toFixed(2)} Now
          </>
        )}
      </Button>

      <p className="text-center text-xs text-gray-500">
        By completing this payment, you agree to our Terms of Service and confirm that the information provided is accurate.
      </p>
    </form>
  )
}

export default function PaymentStep(props: PaymentStepProps) {
  const { profile } = useAuth()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const upfrontAmount = Math.round(props.shipmentData.estimatedPrice * 0.20 * 100)
  const totalAmount = Math.round(props.shipmentData.estimatedPrice * 100)

  // Create payment intent when component mounts
  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: upfrontAmount,
            totalAmount: totalAmount,
            customerEmail: profile?.email || props.shipmentData.customerEmail,
            customerName: props.shipmentData.customerName,
            metadata: {
              userId: profile?.id || props.shipmentData.customerId,
              vehicle: `${props.shipmentData.vehicleYear} ${props.shipmentData.vehicleMake} ${props.shipmentData.vehicleModel}`,
              pickupLocation: `${props.shipmentData.pickupCity}, ${props.shipmentData.pickupState}`,
              deliveryLocation: `${props.shipmentData.deliveryCity}, ${props.shipmentData.deliveryState}`,
            },
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to create payment intent')
        }

        const data = await response.json()
        setClientSecret(data.clientSecret)
      } catch (err: any) {
        console.error('[PaymentStep] Payment intent creation error:', err)
        setError(err.message || 'Failed to initialize payment')
      }
    }

    if (props.shipmentData?.estimatedPrice && upfrontAmount > 0 && !clientSecret) {
      createPaymentIntent()
    }
  }, [])

  // Show loading state while waiting for clientSecret
  if (!clientSecret) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment</h2>
          <p className="text-gray-600">Complete your payment to confirm the shipment</p>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Initializing payment...</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm {...props} clientSecret={clientSecret} />
    </Elements>
  )
}
