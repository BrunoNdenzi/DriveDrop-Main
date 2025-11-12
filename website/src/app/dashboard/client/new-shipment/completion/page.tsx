'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Camera, FileText, Shield, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import VehiclePhotosStep from '@/components/completion/VehiclePhotosStep'
import ProofOfOwnershipStep from '@/components/completion/ProofOfOwnershipStep'
import TermsAndConditionsStep from '@/components/completion/TermsAndConditionsStep'
import PaymentStep from '@/components/completion/PaymentStep'

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
  const [currentStep, setCurrentStep] = useState(1)
  const [shipmentData, setShipmentData] = useState<any>(null)
  const [completionData, setCompletionData] = useState<CompletionData>({
    vehiclePhotos: [],
    ownershipDocuments: [],
    termsAccepted: false,
    paymentCompleted: false,
  })

  useEffect(() => {
    // Load shipment data from sessionStorage
    const data = sessionStorage.getItem('pendingShipment')
    if (!data) {
      router.push('/dashboard/client/new-shipment')
      return
    }
    setShipmentData(JSON.parse(data))
  }, [router])

  const updateCompletionData = (stepData: Partial<CompletionData>) => {
    setCompletionData(prev => ({ ...prev, ...stepData }))
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return completionData.vehiclePhotos.length >= 4
      case 2:
        return completionData.ownershipDocuments.length >= 1
      case 3:
        return completionData.termsAccepted
      case 4:
        return true
      default:
        return false
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
    // Clear session storage
    sessionStorage.removeItem('pendingShipment')
    // Redirect to dashboard
    router.push('/dashboard/client?success=true')
  }

  if (!shipmentData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
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
            <div className="bg-teal-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
              {currentStep}/{STEPS.length}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all
                      ${currentStep > step.id
                        ? 'bg-green-600 border-green-600'
                        : currentStep === step.id
                        ? 'bg-teal-600 border-teal-600'
                        : 'bg-gray-100 border-gray-300'
                      }
                    `}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-6 w-6 text-white" />
                    ) : (
                      <step.icon
                        className={`h-6 w-6 ${
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
                    className={`w-16 sm:w-24 h-1 mx-2 transition-all ${
                      currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Title & Description */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {STEPS[currentStep - 1].title}
          </h2>
          <p className="text-gray-600 text-lg">
            {STEPS[currentStep - 1].description}
          </p>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 mb-6">
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
              className="bg-teal-600 hover:bg-teal-700 px-8"
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
