'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/components/ui/toast'
import { 
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
  Truck,
  Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Application {
  id: string
  shipment_id: string
  driver_id: string
  status: 'pending' | 'accepted' | 'rejected'
  applied_at: string
  responded_at: string | null
  shipment: {
    id: string
    title: string
    pickup_address: string
    delivery_address: string
    pickup_city: string
    delivery_city: string
    estimated_price: number
    distance: number
    status: string
    vehicle_make: string
    vehicle_model: string
    vehicle_year: number
    created_at: string
  }
}

export default function DriverApplicationsPage() {
  const { profile } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (profile?.id) {
      fetchApplications()
    }
  }, [profile?.id])

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          *,
          shipment:shipments (
            id,
            title,
            pickup_address,
            delivery_address,
            pickup_city,
            delivery_city,
            estimated_price,
            distance,
            status,
            vehicle_make,
            vehicle_model,
            vehicle_year,
            created_at
          )
        `)
        .eq('driver_id', profile?.id)
        .order('applied_at', { ascending: false })

      if (error) throw error

      setApplications(data || [])
    } catch (error) {
      console.error('Error fetching applications:', error)
      toast('Failed to load applications', 'error')
    } finally {
      setLoading(false)
    }
  }

  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true
    return app.status === filter
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-medium px-2.5 py-1 rounded-full">
            <Clock className="h-3 w-3" />
            Pending Review
          </span>
        )
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
            <CheckCircle className="h-3 w-3" />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        )
      default:
        return null
    }
  }

  const pendingCount = applications.filter(a => a.status === 'pending').length
  const acceptedCount = applications.filter(a => a.status === 'accepted').length
  const rejectedCount = applications.filter(a => a.status === 'rejected').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">My Job Applications</h1>
        <p className="text-gray-600 mt-1">Track your shipment applications and their status</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-md p-4 border border-gray-200">
          <p className="text-sm text-gray-600 font-medium">Total Applications</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{applications.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-md p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600 font-medium">Pending Review</p>
          <p className="text-lg font-bold text-yellow-900 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-green-50 rounded-md p-4 border border-green-200">
          <p className="text-sm text-green-600 font-medium">Approved</p>
          <p className="text-lg font-bold text-green-900 mt-1">{acceptedCount}</p>
        </div>
        <div className="bg-red-50 rounded-md p-4 border border-red-200">
          <p className="text-sm text-red-600 font-medium">Rejected</p>
          <p className="text-lg font-bold text-red-900 mt-1">{rejectedCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-md border border-gray-200 p-1 inline-flex">
        {(['all', 'pending', 'accepted', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === tab
                ? 'bg-amber-500 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {filteredApplications.length === 0 ? (
          <div className="bg-white rounded-md p-8 text-center border border-gray-200">
            <Clock className="h-8 w-8 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {filter === 'all' ? 'No Applications Yet' : `No ${filter} Applications`}
            </h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all'
                ? 'Start applying for jobs to see them here.'
                : `You don't have any ${filter} applications.`}
            </p>
            <Link href="/dashboard/driver/jobs">
              <Button>Browse Available Jobs</Button>
            </Link>
          </div>
        ) : (
          filteredApplications.map((app) => (
            <div key={app.id} className="bg-white rounded-md p-4 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {app.shipment.vehicle_make} {app.shipment.vehicle_model} ({app.shipment.vehicle_year})
                    </h3>
                    {getStatusBadge(app.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Applied {new Date(app.applied_at).toLocaleDateString()}</span>
                    </div>
                    {app.responded_at && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>Reviewed {new Date(app.responded_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm text-gray-600">Your Earnings (90%)</p>
                  <p className="text-lg font-bold text-green-600">
                    ${(app.shipment.estimated_price * 0.9).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Total: ${app.shipment.estimated_price.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Route */}
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">Pickup</p>
                    <p className="text-gray-600">{app.shipment.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-gray-900">Delivery</p>
                    <p className="text-gray-600">{app.shipment.delivery_address}</p>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="flex items-center gap-6 text-sm text-gray-600 border-t border-gray-200 pt-4">
                <div className="flex items-center gap-1">
                  <Truck className="h-4 w-4" />
                  <span>{app.shipment.distance} miles</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">Shipment Status:</span>
                  <span className="capitalize">{app.shipment.status.replace(/_/g, ' ')}</span>
                </div>
              </div>

              {/* Actions */}
              {app.status === 'accepted' && app.shipment.status === 'assigned' && (
                <div className="mt-4 p-4 bg-green-50 rounded-md border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-green-900">✓ You've been assigned to this shipment!</p>
                      <p className="text-sm text-green-700 mt-1">View details and accept the job to start.</p>
                    </div>
                    <Link href={`/dashboard/driver/active/${app.shipment_id}`}>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700">
                        View Shipment
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {app.status === 'pending' && (
                <div className="mt-4 p-4 bg-yellow-50 rounded-md border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    <strong>Pending Review:</strong> An admin is reviewing your application. You'll be notified once a decision is made.
                  </p>
                </div>
              )}

              {app.status === 'rejected' && (
                <div className="mt-4 p-4 bg-red-50 rounded-md border border-red-200">
                  <p className="text-sm text-red-800">
                    <strong>Application Rejected:</strong> This application was not accepted. The shipment may have been assigned to another driver.
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
