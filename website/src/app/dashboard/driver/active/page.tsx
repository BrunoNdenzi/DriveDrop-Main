'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import Link from 'next/link'
import {
  Package,
  MapPin,
  Clock,
  CheckCircle,
  Truck,
  Camera,
  ArrowRight,
  AlertCircle,
  Upload
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ActiveDelivery {
  id: string
  title: string
  pickup_address: string
  delivery_address: string
  estimated_price: number
  distance: number
  status: string
  pickup_date: string
  delivery_date: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  vehicle_type: string
  client_id: string
  client?: {
    first_name: string
    last_name: string
    phone: string
  }
}

const STATUS_OPTIONS = [
  { value: 'accepted', label: 'Accepted', color: 'blue' },
  { value: 'driver_en_route', label: 'En Route to Pickup', color: 'purple' },
  { value: 'driver_arrived', label: 'Arrived at Pickup', color: 'yellow' },
  { value: 'picked_up', label: 'Picked Up', color: 'orange' },
  { value: 'in_transit', label: 'In Transit', color: 'indigo' },
  { value: 'delivered', label: 'Delivered', color: 'green' },
]

export default function DriverActiveDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<ActiveDelivery[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    fetchProfile()
  }, [])

  useEffect(() => {
    if (profile?.id) {
      fetchActiveDeliveries()
      
      // Set up real-time subscription for new deliveries
      const channel = supabase
        .channel('active-deliveries-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shipments',
            filter: `driver_id=eq.${profile.id}`
          },
          (payload) => {
            console.log('Delivery updated:', payload)
            // Refresh deliveries when changes occur
            fetchActiveDeliveries()
          }
        )
        .subscribe()

      // Cleanup subscription
      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [profile?.id])

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const fetchActiveDeliveries = async () => {
    if (!profile?.id) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          client:profiles!shipments_client_id_fkey (
            first_name,
            last_name,
            phone
          )
        `)
        .eq('driver_id', profile.id)
        .in('status', ['assigned', 'accepted', 'driver_en_route', 'driver_arrived', 'pickup_verification_pending', 'pickup_verified', 'picked_up', 'in_transit', 'in_progress'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error details:', error)
        throw error
      }
      setDeliveries(data || [])
    } catch (error) {
      console.error('Error fetching active deliveries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (deliveryId: string, newStatus: string) => {
    setUpdatingStatus(deliveryId)
    try {
      const { error } = await supabase
        .from('shipments')
        .update({ status: newStatus })
        .eq('id', deliveryId)

      if (error) throw error

      // Update local state
      setDeliveries(deliveries.map(delivery =>
        delivery.id === deliveryId
          ? { ...delivery, status: newStatus }
          : delivery
      ))

      // If status is delivered, move it out of active deliveries
      if (newStatus === 'delivered') {
        setDeliveries(deliveries.filter(d => d.id !== deliveryId))
        alert('Delivery marked as completed! Great job!')
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update status. Please try again.')
    } finally {
      setUpdatingStatus(null)
    }
  }

  const getStatusColor = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === status)
    return statusOption?.color || 'gray'
  }

  const getStatusLabel = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === status)
    return statusOption?.label || status
  }

  const getNextStatus = (currentStatus: string) => {
    const statusIndex = STATUS_OPTIONS.findIndex(s => s.value === currentStatus)
    if (statusIndex >= 0 && statusIndex < STATUS_OPTIONS.length - 1) {
      return STATUS_OPTIONS[statusIndex + 1]
    }
    return null
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not specified'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading active deliveries...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Active Deliveries</h1>
              <p className="text-sm text-gray-600">{deliveries.length} active job{deliveries.length !== 1 ? 's' : ''}</p>
            </div>
            <Link href="/dashboard/driver">
              <Button variant="outline" size="sm">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-4">
        {deliveries.length === 0 ? (
          <div className="bg-white rounded-md p-8 text-center border border-gray-200">
            <Truck className="h-10 w-10 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-2">
              No Active Deliveries
            </h3>
            <p className="text-gray-600 mb-6">
              You don't have any active deliveries. Browse available jobs to get started.
            </p>
            <Link href="/dashboard/driver/jobs">
              <Button className="bg-amber-500 hover:bg-amber-600">
                Browse Available Jobs
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {deliveries.map((delivery) => {
              const nextStatus = getNextStatus(delivery.status)
              const statusColor = getStatusColor(delivery.status)
              const client = delivery.client

              return (
                <div
                  key={delivery.id}
                  className="bg-white rounded-md border border-gray-200 overflow-hidden"
                >
                  {/* Header with Status */}
                  <div className={`bg-${statusColor}-50 border-b border-${statusColor}-100 p-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-${statusColor}-100 text-${statusColor}-800`}>
                          {getStatusLabel(delivery.status)}
                        </span>
                        <span className="text-sm text-gray-600">
                          ID: {delivery.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-amber-500">
                          ${(delivery.estimated_price * 0.8).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">Your earnings</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Vehicle Info */}
                    <div className="mb-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">
                        {delivery.title || `${delivery.vehicle_make} ${delivery.vehicle_model} ${delivery.vehicle_year}`}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-md p-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Type</p>
                          <p className="text-sm font-medium text-gray-900 capitalize">{delivery.vehicle_type}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Make</p>
                          <p className="text-sm font-medium text-gray-900">{delivery.vehicle_make}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Model</p>
                          <p className="text-sm font-medium text-gray-900">{delivery.vehicle_model}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Year</p>
                          <p className="text-sm font-medium text-gray-900">{delivery.vehicle_year}</p>
                        </div>
                      </div>
                    </div>

                    {/* Client Info */}
                    {client && (
                      <div className="mb-6 bg-blue-50 rounded-md p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Client Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Name:</span> {client.first_name} {client.last_name}
                          </p>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Phone:</span> {client.phone || 'Not provided'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Addresses */}
                    <div className="space-y-4 mb-6">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 mb-1">Pickup Location</p>
                          <p className="text-sm text-gray-600">{delivery.pickup_address}</p>
                          {delivery.pickup_date && (
                            <p className="text-xs text-gray-500 mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatDate(delivery.pickup_date)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="h-px bg-gray-200"></div>

                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-900 mb-1">Delivery Location</p>
                          <p className="text-sm text-gray-600">{delivery.delivery_address}</p>
                          {delivery.delivery_date && (
                            <p className="text-xs text-gray-500 mt-1">
                              <Clock className="h-3 w-3 inline mr-1" />
                              Expected: {formatDate(delivery.delivery_date)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      {nextStatus && (
                        <Button
                          onClick={() => handleStatusUpdate(delivery.id, nextStatus.value)}
                          disabled={updatingStatus === delivery.id}
                          className={`flex-1 bg-${nextStatus.color}-600 hover:bg-${nextStatus.color}-700`}
                        >
                          {updatingStatus === delivery.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Updating...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as {nextStatus.label}
                            </>
                          )}
                        </Button>
                      )}

                      <Link href={`/dashboard/driver/active/${delivery.id}`} className={nextStatus ? 'flex-1' : 'w-full'}>
                        <Button variant="outline" className="w-full">
                          View Full Details
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </div>

                    {/* Photo Upload Reminder */}
                    {(delivery.status === 'picked_up' || delivery.status === 'delivered') && (
                      <div className="mt-4 bg-orange-50 border border-orange-200 rounded-md p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              Don't forget to upload photos!
                            </p>
                            <p className="text-xs text-gray-600">
                              {delivery.status === 'picked_up'
                                ? 'Upload photos of the vehicle at pickup to document its condition.'
                                : 'Upload delivery confirmation photos before completing.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Info Card */}
        {deliveries.length > 0 && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500 rounded-md">
                <Camera className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Remember to Document Everything
                </h3>
                <p className="text-sm text-gray-700 mb-3">
                  Take clear photos at pickup and delivery to protect yourself and provide proof of vehicle condition. This helps resolve any disputes quickly.
                </p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    All four sides of the vehicle
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Interior condition
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Odometer reading
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Any existing damage
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
