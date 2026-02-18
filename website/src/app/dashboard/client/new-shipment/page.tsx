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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/client">
            <Button variant="ghost" size="sm" className="h-8 text-xs">
              <ArrowLeft className="h-3 w-3 mr-1" />
              Dashboard
            </Button>
          </Link>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500" />
            <h1 className="text-lg font-bold text-gray-900">New Shipment</h1>
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="bg-white rounded-md border border-gray-200 p-1 flex">
        <button
          onClick={() => setMode('ai')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
            mode === 'ai'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Benji AI
        </button>
        <button
          onClick={() => setMode('traditional')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
            mode === 'traditional'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <FileText className="h-4 w-4" />
          Traditional Form
        </button>
      </div>

      {/* Content */}
      <div>
        {/* AI Mode - Benji */}
        {mode === 'ai' && (
          <div className="space-y-4">
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
