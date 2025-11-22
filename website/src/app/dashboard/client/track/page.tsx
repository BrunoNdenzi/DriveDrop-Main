'use client'

import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft,
  Package,
  Search,
  MapPin,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function TrackShipmentPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [trackingId, setTrackingId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = getSupabaseBrowserClient()

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!trackingId.trim()) {
      setError('Please enter a shipment ID')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Check if shipment exists and belongs to user
      const { data: shipment, error: shipmentError } = await supabase
        .from('shipments')
        .select('id, client_id')
        .eq('id', trackingId.trim())
        .single()

      if (shipmentError || !shipment) {
        setError('Shipment not found. Please check the ID and try again.')
        setLoading(false)
        return
      }

      if (profile && shipment.client_id !== profile.id) {
        setError('This shipment does not belong to your account.')
        setLoading(false)
        return
      }

      // Navigate to shipment details
      router.push(`/dashboard/client/shipments/${shipment.id}`)
    } catch (err) {
      console.error('Error tracking shipment:', err)
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard/client"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span className="font-medium">Dashboard</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="h-6 w-6 text-teal-600" />
                Track Shipment
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-teal-500 to-teal-600 p-8 text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-white/20 p-4 rounded-full">
                <Package className="h-12 w-12" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">Track Your Shipment</h2>
            <p className="text-teal-100 text-center">
              Enter your shipment ID to view real-time tracking information
            </p>
          </div>

          <div className="p-8">
            <form onSubmit={handleTrack} className="space-y-6">
              <div>
                <label htmlFor="trackingId" className="block text-sm font-medium text-gray-700 mb-2">
                  Shipment ID
                </label>
                <div className="relative">
                  <Input
                    id="trackingId"
                    type="text"
                    value={trackingId}
                    onChange={(e) => {
                      setTrackingId(e.target.value)
                      setError('')
                    }}
                    placeholder="e.g., 3aa90f68-bafd-4e8e-a874-0bba98332daa"
                    className="pl-10 h-12 text-base"
                    disabled={loading}
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  You can find your shipment ID in your email confirmation or on the My Shipments page
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-900">Error</p>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !trackingId.trim()}
                className="w-full h-12 text-base bg-teal-600 hover:bg-teal-700"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Tracking...
                  </>
                ) : (
                  <>
                    <MapPin className="h-5 w-5 mr-2" />
                    Track Shipment
                  </>
                )}
              </Button>
            </form>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Access</h3>
              <div className="grid grid-cols-1 gap-3">
                <Link
                  href="/dashboard/client/shipments"
                  className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-gray-600 group-hover:text-teal-600" />
                    <div>
                      <p className="font-medium text-gray-900">My Shipments</p>
                      <p className="text-sm text-gray-500">View all your shipments</p>
                    </div>
                  </div>
                  <ArrowLeft className="h-5 w-5 text-gray-400 group-hover:text-teal-600 rotate-180" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Need help?{' '}
            <Link href="/dashboard/client/messages" className="text-teal-600 hover:text-teal-700 font-medium">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
