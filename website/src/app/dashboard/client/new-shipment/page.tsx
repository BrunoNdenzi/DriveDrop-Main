'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import Link from 'next/link'
import ShipmentForm from '@/components/shipment/ShipmentForm'
import { Button } from '@/components/ui/button'

export default function NewShipmentPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

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
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Create Your Shipment</h2>
          <p className="mt-2 text-gray-600">
            Fill out the form below to get started with your vehicle transport. We'll provide an instant quote and guide you through the booking process.
          </p>
        </div>

        {/* Shipment Form */}
        <ShipmentForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
      </div>
    </div>
  )
}
