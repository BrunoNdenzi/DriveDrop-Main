'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, Camera, FileText, Shield, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import VehiclePhotosStep from '@/components/completion/VehiclePhotosStep'
import ProofOfOwnershipStep from '@/components/completion/ProofOfOwnershipStep'
import TermsAndConditionsStep from '@/components/completion/TermsAndConditionsStep'
import PaymentStep from '@/components/completion/PaymentStep'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'

const STEPS = [
  { id: 1, title: 'Vehicle Photos', icon: Camera, description: 'Document vehicle condition' },
  { id: 2, title: 'Proof of Ownership', icon: FileText, description: 'Upload ownership documents' },
  { id: 3, title: 'Terms & Conditions', icon: Shield, description: 'Review and accept terms' },
  { id: 4, title: 'Payment', icon: CreditCard, description: 'Complete 20% deposit' },
]

interface CompletionData {
  vehiclePhotos: string[]
  ownershipDocuments: string[]
  termsAccepted: boolean
  paymentCompleted: boolean
  stripePaymentIntentId?: string
}

export default function ShipmentCompletionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = getSupabaseBrowserClient()

  const [currentStep, setCurrentStep] = useState(1)
  const [shipmentData, setShipmentData] = useState<any>(null)
  const [completionData, setCompletionData] = useState<CompletionData>({
    vehiclePhotos: [],
    ownershipDocuments: [],
    termsAccepted: false,
    paymentCompleted: false,
  })

  // URL param support: ?shipmentId=xxx&mode=payment
  // When a pre-created shipment ID is provided (e.g. from Benji),
  // load the shipment from DB and optionally jump to the payment step.
  const urlShipmentId = searchParams?.get('shipmentId')
  const urlMode       = searchParams?.get('mode') // 'payment' = skip to step 4

  useEffect(() => {
    async function loadData() {
      if (urlShipmentId) {
        // Load pre-created shipment from Supabase
        const { data: shipment, error } = await supabase
          .from('shipments')
          .select('*')
          .eq('id', urlShipmentId)
          .maybeSingle()

        if (error || !shipment) {
          // Fallback: try sessionStorage
          const stored = sessionStorage.getItem('pendingShipment')
          if (!stored) {
            router.push('/dashboard/client/new-shipment')
            return
          }
          setShipmentData(JSON.parse(stored))
          return
        }

        // Map DB columns to the shape PaymentStep expects
        setShipmentData({
          id:             shipment.id,
          vehicleYear:    String(shipment.vehicle_year ?? ''),
          vehicleMake:    shipment.vehicle_make ?? '',
          vehicleModel:   shipment.vehicle_model ?? '',
          vehicleType:    shipment.vehicle_type ?? 'sedan',
          isOperable:     shipment.is_operable !== false,
          pickupAddress:  shipment.pickup_address ?? '',
          deliveryAddress: shipment.delivery_address ?? '',
          pickupDate:     shipment.pickup_date ?? null,
          estimatedPrice: typeof shipment.estimated_price === 'number' ? shipment.estimated_price : 0,
          distance:       typeof shipment.distance === 'number' ? shipment.distance : 0,
          termsAccepted:  shipment.terms_accepted === true,
          preCreated:     true,   // tells PaymentStep to UPDATE not INSERT
        })

        // If terms were already accepted (via Benji conversation), skip to payment
        if (urlMode === 'payment' || shipment.terms_accepted === true) {
          setCompletionData(prev => ({ ...prev, termsAccepted: true }))
          setCurrentStep(4)
        }
      } else {
        // Legacy flow: load from sessionStorage
        const data = sessionStorage.getItem('pendingShipment')
        if (!data) {
          router.push('/dashboard/client/new-shipment')
          return
        }
        setShipmentData(JSON.parse(data))
      }
    }
    loadData()
  }, [router, urlShipmentId, urlMode, supabase])

  const updateCompletionData = (stepData: Partial<CompletionData>) => {
    setCompletionData(prev => ({ ...prev, ...stepData }))
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return true // Vehicle photos are optional
      case 2: return completionData.ownershipDocuments.length >= 1
      case 3: return completionData.termsAccepted
      case 4: return true
      default: return false
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(current => current + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(current => current - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      router.push('/dashboard/client/new-shipment')
    }
  }

  const handleComplete = () => {
    sessionStorage.removeItem('pendingShipment')
    router.push('/dashboard/client?success=true')
  }

  if (!shipmentData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium">Back</span>
            </button>
            <h1 className="text-lg font-semibold text-gray-900">
              {STEPS[currentStep - 1].title}
            </h1>
            <div className="bg-blue-500 text-white px-2.5 py-0.5 rounded-md text-xs font-semibold">
              {currentStep}/{STEPS.length}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Progress Indicator */}
        <div className="mb-4">
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all
                      ${currentStep > step.id
                        ? 'bg-green-600 border-green-600'
                        : currentStep === step.id
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-gray-100 border-gray-300'
                      }
                    `}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-5 w-5 text-white" />
                    ) : (
                      <step.icon
                        className={`h-5 w-5 ${
                          currentStep >= step.id ? 'text-white' : 'text-gray-400'
                        }`}
                      />
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium hidden sm:block ${
                      currentStep >= step.id ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-12 sm:w-20 h-0.5 mx-2 transition-all ${
                      currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Title & Description */}
        <div className="text-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {STEPS[currentStep - 1].title}
          </h2>
          <p className="text-xs text-gray-500">
            {STEPS[currentStep - 1].description}
          </p>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-md border border-gray-200 p-4 mb-4">
          {currentStep === 1 && (
            <VehiclePhotosStep
              shipmentData={shipmentData}
              photos={completionData.vehiclePhotos}
              onPhotosUpdate={(photos) => updateCompletionData({ vehiclePhotos: photos })}
            />
          )}
          {currentStep === 2 && (
            <ProofOfOwnershipStep
              shipmentData={shipmentData}
              documents={completionData.ownershipDocuments}
              onDocumentsUpdate={(documents) => updateCompletionData({ ownershipDocuments: documents })}
            />
          )}
          {currentStep === 3 && (
            <TermsAndConditionsStep
              shipmentData={shipmentData}
              accepted={completionData.termsAccepted}
              onAcceptanceUpdate={(accepted) => updateCompletionData({ termsAccepted: accepted })}
            />
          )}
          {currentStep === 4 && (
            <PaymentStep
              shipmentData={shipmentData}
              completionData={completionData}
              onPaymentComplete={(paymentIntentId, shipmentId) => {
                updateCompletionData({ 
                  paymentCompleted: true,
                  stripePaymentIntentId: paymentIntentId
                })
              }}
              onFinalSubmit={handleComplete}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        {currentStep < STEPS.length && (
          <div className="flex justify-end">
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              size="lg"
              className="bg-blue-500 hover:bg-blue-600 px-6"
            >
              Continue
              <ArrowLeft className="h-5 w-5 ml-2 rotate-180" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
