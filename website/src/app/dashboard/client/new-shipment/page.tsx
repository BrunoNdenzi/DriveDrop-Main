'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Sparkles, FileText } from 'lucide-react'
import Link from 'next/link'
import ShipmentForm from '@/components/shipment/ShipmentForm'
import { Button } from '@/components/ui/button'
import NaturalLanguageShipmentCreator from '@/components/ai/NaturalLanguageShipmentCreator'
import { BenjiChat } from '@/components/benji/BenjiChat'
import { useAuth } from '@/hooks/useAuth'

type CreationMode = 'ai' | 'traditional'

export default function NewShipmentPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<CreationMode>('ai')

  const handleSubmit = async (shipmentData: any) => {
    setIsSubmitting(true)
    try {
      // Navigate to completion flow with shipment data
      // Store in sessionStorage temporarily
      sessionStorage.setItem('pendingShipment', JSON.stringify(shipmentData))
      router.push('/dashboard/client/new-shipment/completion')
    } catch (error) {
      console.error('Error processing shipment:', error)
      alert('Failed to process shipment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBenjiShipmentCreated = (shipment: any) => {
    // Redirect to shipment detail or completion
    if (shipment?.id) {
      router.push(`/dashboard/client/shipments/${shipment.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/client">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-teal-600" />
                <h1 className="text-xl font-semibold text-gray-900">New Shipment</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* AI Mode - Benji */}
        {mode === 'ai' && (
          <div className="space-y-6">
            {/* Header with Mode Selector */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Create with Benji AI</h2>
                <p className="mt-1 text-gray-600">
                  Type, speak, or scan a document to create your shipment
                </p>
              </div>
              <button
                onClick={() => setMode('traditional')}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Use traditional form instead
              </button>
            </div>

            {/* Benji Creator */}
            <NaturalLanguageShipmentCreator 
              onShipmentCreated={handleBenjiShipmentCreated}
              variant="inline"
            />
          </div>
        )}

        {/* Traditional Mode - Form */}
        {mode === 'traditional' && (
          <div>
            {/* Header with Mode Selector */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Create with Form</h2>
                <p className="mt-1 text-gray-600">
                  Fill out the traditional shipment form
                </p>
              </div>
              <button
                onClick={() => setMode('ai')}
                className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
              >
                <Sparkles className="w-4 h-4" />
                Try Benji AI instead
              </button>
            </div>

            <div className="mb-4 p-4 bg-gradient-to-r from-teal-50 to-purple-50 rounded-xl border border-teal-200">
              <p className="text-sm text-gray-700">
                💡 <strong>Tip:</strong> Benji AI can create shipments 10x faster with voice and document scanning!
              </p>
            </div>
            <ShipmentForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
          </div>
        )}
      </div>

      {/* Benji Chat Widget */}
      <BenjiChat 
        context="shipment" 
        userId={profile?.id}
        userType="client"
      />
    </div>
  )
}
