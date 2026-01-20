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
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Create Your Shipment</h2>
          <p className="mt-2 text-gray-600">
            Choose how you'd like to create your shipment - use Benji AI for instant creation or the traditional form.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-3 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-gray-200 max-w-md">
          <button
            onClick={() => setMode('ai')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              mode === 'ai'
                ? 'bg-gradient-to-r from-teal-600 to-purple-600 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Sparkles className="w-5 h-5" />
            <span>Benji AI</span>
            {mode === 'ai' && <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">Recommended</span>}
          </button>
          <button
            onClick={() => setMode('traditional')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              mode === 'traditional'
                ? 'bg-gradient-to-r from-teal-600 to-purple-600 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            <span>Form</span>
          </button>
        </div>

        {/* AI Mode - Benji */}
        {mode === 'ai' && (
          <div className="space-y-6">
            {/* Benji Intro Card */}
            <div className="bg-gradient-to-br from-teal-50 to-purple-50 rounded-2xl p-6 border-2 border-teal-200">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Meet Benji - Your AI Shipping Assistant
                  </h3>
                  <p className="text-gray-700 mb-4">
                    Create your shipment in seconds using natural language, voice, or by scanning a document. 
                    I'll handle all the details for you!
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-full">
                      <span>💬</span>
                      <span>Type naturally</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-full">
                      <span>🎤</span>
                      <span>Speak</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-full">
                      <span>📸</span>
                      <span>Scan document</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Natural Language Creator */}
            <NaturalLanguageShipmentCreator 
              onShipmentCreated={handleBenjiShipmentCreated}
              variant="inline"
            />
          </div>
        )}

        {/* Traditional Mode - Form */}
        {mode === 'traditional' && (
          <div>
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                💡 <strong>Tip:</strong> Try Benji AI for faster shipment creation with voice and document scanning!
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
