'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/components/ui/toast'
import { 
  MapPin, 
  DollarSign, 
  Calendar,
  Truck,
  Package,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Clock,
  Info,
  Car
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BenjiChat } from '@/components/benji/BenjiChat'

interface JobDetails {
  id: string
  title: string
  description: string
  pickup_address: string
  pickup_city: string
  pickup_state: string
  pickup_zip: string
  pickup_notes: string
  delivery_address: string
  delivery_city: string
  delivery_state: string
  delivery_zip: string
  delivery_notes: string
  estimated_price: number
  distance: number
  status: string
  created_at: string
  pickup_date: string
  vehicle_type: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  is_operable: boolean
  is_accident_recovery: boolean
  weight_kg: number
  dimensions_cm: any
  item_value: number
  is_fragile: boolean
  client_id: string
  client: {
    first_name: string
    last_name: string
    phone: string
  }
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const [job, setJob] = useState<JobDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (params.id) {
      fetchJobDetails()
    }
  }, [params.id])

  const fetchJobDetails = async () => {
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
        .eq('id', params.id)
        .is('driver_id', null)
        .eq('status', 'pending')
        .single()

      if (error) throw error
      setJob(data)
    } catch (error) {
      console.error('Error fetching job details:', error)
      toast('Failed to load job details', 'error')
      router.push('/dashboard/driver/jobs')
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptJob = async () => {
    console.log('🚀 [Job Details] Starting job application:', { jobId: job?.id, profileId: profile?.id })
    
    if (!profile?.id || !job) {
      console.error('❌ [Job Details] Missing profile or job:', { hasProfile: !!profile?.id, hasJob: !!job })
      toast('Unable to apply for job. Please try again.', 'error')
      return
    }

    setAccepting(true)
    try {
      // CORRECT FLOW: Create job application (like mobile app)
      console.log('🔄 [Job Details] Creating job application...')
      const { data, error } = await supabase
        .from('job_applications')
        .insert({
          shipment_id: job.id,
          driver_id: profile.id,
          status: 'pending',
          applied_at: new Date().toISOString()
        })
        .select()
        .single()

      console.log('📊 [Job Details] Application response:', { data, error })

      if (error) {
        console.error('❌ [Job Details] Application error:', error)
        alert(`ERROR: ${error.message}\nCode: ${error.code}\nDetails: ${error.details}\nHint: ${error.hint}`)
        throw error
      }

      console.log('✅ [Job Details] Job application submitted successfully!')
      alert('SUCCESS! Application submitted. Admin will review it.')
      toast('Application submitted! Waiting for admin approval...', 'success')
      
      setTimeout(() => {
        router.push('/dashboard/driver/jobs')
      }, 2000)
    } catch (error: any) {
      console.error('❌ [Job Details] Error submitting application:', error)
      console.error('❌ [Job Details] Error details:', JSON.stringify(error, null, 2))
      alert(`ERROR: ${error?.message || 'Unknown error'}\n\nFull error: ${JSON.stringify(error, null, 2)}`)
      toast('Failed to submit application. Please try again.', 'error')
    } finally {
      console.log('🏁 [Job Details] Job application flow completed')
      setAccepting(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not specified'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-4" />
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Job Not Found</h2>
        <p className="text-gray-600 mb-6">This job may have been taken by another driver.</p>
        <Button onClick={() => router.push('/dashboard/driver/jobs')}>
          View Available Jobs
        </Button>
      </div>
    )
  }

  const driverEarnings = job.estimated_price * 0.90 // 90% to driver

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{job.title}</h1>
          <p className="text-gray-600">Posted {formatDate(job.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Earnings Card */}
          <div className="bg-white border rounded-md p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 mb-1">Your Earnings (90%)</p>
                <p className="text-lg font-bold text-gray-900">${driverEarnings.toFixed(2)}</p>
                <p className="text-gray-500 text-sm mt-2">
                  Total: ${job.estimated_price.toFixed(2)} • {job.distance} miles
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-gray-300" />
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="bg-white rounded-md p-4 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <Car className="h-5 w-5 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900">Vehicle Information</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Make & Model</p>
                <p className="font-medium text-gray-900">
                  {job.vehicle_make} {job.vehicle_model}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Year</p>
                <p className="font-medium text-gray-900">{job.vehicle_year}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium text-gray-900">{job.vehicle_type || 'Standard'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Condition</p>
                <p className="font-medium text-gray-900">
                  {job.is_operable ? (
                    <span className="text-green-600">✓ Operable</span>
                  ) : (
                    <span className="text-yellow-600">⚠ Not Operable</span>
                  )}
                </p>
              </div>
              {job.is_accident_recovery && (
                <div className="col-span-2">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Accident Recovery Vehicle
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pickup & Delivery */}
          <div className="bg-white rounded-md p-4 border border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Route Details</h2>
            
            {/* Pickup */}
            <div className="mb-6">
              <div className="flex items-start gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-md">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 mb-1">Pickup Location</p>
                  <p className="text-gray-700">{job.pickup_address}</p>
                  <p className="text-gray-600 text-sm">
                    {job.pickup_city}, {job.pickup_state} {job.pickup_zip}
                  </p>
                  {job.pickup_notes && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-sm text-blue-900">
                        <strong>Notes:</strong> {job.pickup_notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {job.pickup_date && (
                <div className="ml-12 mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  Pickup: {formatDate(job.pickup_date)}
                </div>
              )}
            </div>

            {/* Route Line */}
            <div className="ml-6 border-l-2 border-dashed border-gray-300 h-8"></div>

            {/* Delivery */}
            <div>
              <div className="flex items-start gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-md">
                  <MapPin className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 mb-1">Delivery Location</p>
                  <p className="text-gray-700">{job.delivery_address}</p>
                  <p className="text-gray-600 text-sm">
                    {job.delivery_city}, {job.delivery_state} {job.delivery_zip}
                  </p>
                  {job.delivery_notes && (
                    <div className="mt-2 bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-sm text-blue-900">
                        <strong>Notes:</strong> {job.delivery_notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Additional Details */}
          {job.description && (
            <div className="bg-white rounded-md p-4 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <Info className="h-5 w-5 text-amber-500" />
                <h2 className="text-sm font-semibold text-gray-900">Job Description</h2>
              </div>
              <p className="text-gray-700">{job.description}</p>
            </div>
          )}

          {/* Additional Info */}
          <div className="bg-white rounded-md p-4 border border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Additional Information</h2>
            <div className="grid grid-cols-2 gap-4">
              {job.weight_kg && (
                <div>
                  <p className="text-sm text-gray-500">Weight</p>
                  <p className="font-medium text-gray-900">{job.weight_kg} kg</p>
                </div>
              )}
              {job.item_value && (
                <div>
                  <p className="text-sm text-gray-500">Vehicle Value</p>
                  <p className="font-medium text-gray-900">${job.item_value.toLocaleString()}</p>
                </div>
              )}
              {job.is_fragile && (
                <div className="col-span-2">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-sm font-medium text-yellow-800 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Handle with Extra Care - Fragile
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Accept Job Card */}
          <div className="bg-white rounded-md p-4 border border-gray-200">
            <Button
              onClick={handleAcceptJob}
              disabled={accepting}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 text-sm font-semibold mb-4"
            >
              {accepting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Apply for Job
                </>
              )}
            </Button>
            
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>Total Payment</span>
                <span className="font-semibold text-gray-900">
                  ${job.estimated_price.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Your Earnings (90%)</span>
                <span className="font-semibold text-green-600">
                  ${driverEarnings.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Distance</span>
                <span className="font-semibold text-gray-900">{job.distance} miles</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Est. per Mile</span>
                <span className="font-semibold text-gray-900">
                  ${(driverEarnings / job.distance).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Client Info */}
          <div className="bg-white rounded-md p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Client Information</h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-700">
                <strong>Name:</strong> {job.client?.first_name} {job.client?.last_name}
              </p>
              <p className="text-gray-700">
                <strong>Phone:</strong> {job.client?.phone || 'Will be provided after acceptance'}
              </p>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 rounded-md p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <Info className="h-5 w-5" />
              Before You Accept
            </h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li>• Verify pickup and delivery locations</li>
              <li>• Check vehicle specifications</li>
              <li>• Review any special requirements</li>
              <li>• Ensure you have proper equipment</li>
              <li>• Confirm pickup date and time</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Benji Chat Widget - Context-aware for this job */}
      <BenjiChat 
        context="shipment" 
        userId={profile?.id}
        userType="driver"
        shipmentId={job.id}
      />
    </div>
  )
}
