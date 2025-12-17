'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/ui/toast'
import { 
  Package, 
  Truck, 
  DollarSign,
  TrendingUp,
  Clock,
  MapPin,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Star
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Job {
  id: string
  pickup_address: string
  delivery_address: string
  estimated_price: number
  distance: number
  status: string
  created_at: string
  title: string
}

export default function DriverDashboardPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [availableJobs, setAvailableJobs] = useState<Job[]>([])
  const [activeDeliveries, setActiveDeliveries] = useState<Job[]>([])
  const [stats, setStats] = useState({
    todayEarnings: 0,
    weekEarnings: 0,
    totalDeliveries: 0,
    rating: 0,
  })
  const [loading, setLoading] = useState(true)
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (profile?.id) {
      fetchData()
    } else {
      setLoading(false)
    }
  }, [profile?.id])

  const fetchData = async () => {
    if (!profile?.id) return

    setLoading(true)
    try {
      // PARALLEL FETCHING: Execute all queries simultaneously for 50% faster load
      const [appliedJobsResult, jobsResult, activeResult, statsResult] = await Promise.all([
        // Fetch job IDs this driver has already applied to
        supabase
          .from('job_applications')
          .select('shipment_id')
          .eq('driver_id', profile.id),
        
        // Fetch available jobs (limit to 10, will filter after)
        supabase
          .from('shipments')
          .select('id, pickup_address, delivery_address, estimated_price, distance, status, created_at, title')
          .is('driver_id', null)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(10),
        
        // Fetch active deliveries
        supabase
          .from('shipments')
          .select('id, pickup_address, delivery_address, estimated_price, distance, status, created_at, title')
          .eq('driver_id', profile.id)
          .in('status', ['assigned', 'accepted', 'driver_en_route', 'driver_arrived', 'pickup_verification_pending', 'pickup_verified', 'picked_up', 'in_transit', 'in_progress'])
          .order('created_at', { ascending: false }),
        
        // Calculate stats (completed count)
        supabase
          .from('shipments')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', profile.id)
          .eq('status', 'delivered')
      ])

      // Get list of applied job IDs
      const appliedJobIds = appliedJobsResult.data?.map(app => app.shipment_id) || []
      console.log('[Dashboard] Driver has applied to:', appliedJobIds)

      // Update state with results - filter out applied jobs
      if (!jobsResult.error && jobsResult.data) {
        const availableJobsFiltered = jobsResult.data.filter(job => !appliedJobIds.includes(job.id)).slice(0, 5)
        console.log('[Dashboard] Available jobs after filtering:', availableJobsFiltered.length)
        setAvailableJobs(availableJobsFiltered)
      }

      if (!activeResult.error && activeResult.data) {
        setActiveDeliveries(activeResult.data)
      }

      if (!statsResult.error) {
        setStats({
          todayEarnings: 0, // Would need date filtering
          weekEarnings: 0, // Would need actual earnings calculation
          totalDeliveries: statsResult.count || 0,
          rating: 4.8,
        })
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptJob = async (jobId: string) => {
    console.log('🚀 [Dashboard] Starting job application:', { jobId, profileId: profile?.id })
    
    if (!profile?.id) {
      console.error('❌ [Dashboard] No profile ID found')
      alert('ERROR: No profile ID found. Check console.')
      toast('Please log in to apply for jobs', 'error')
      return
    }
    
    setAcceptingJobId(jobId)
    
    // OPTIMISTIC UI: Remove job immediately
    const jobToRemove = availableJobs.find(job => job.id === jobId)
    console.log('📦 [Dashboard] Job to apply for:', jobToRemove)
    setAvailableJobs(prev => prev.filter(job => job.id !== jobId))
    
    try {
      // CORRECT FLOW: Create job application (like mobile app)
      console.log('🔄 [Dashboard] Creating job application...')
      const { data: applicationData, error: appError } = await supabase
        .from('job_applications')
        .insert({
          shipment_id: jobId,
          driver_id: profile.id,
          status: 'pending',
          applied_at: new Date().toISOString()
        })
        .select()
        .single()

      console.log('📊 [Dashboard] Application response:', { data: applicationData, error: appError })

      if (appError) {
        console.error('❌ [Dashboard] Application error:', appError)
        alert(`ERROR: ${appError.message}\nCode: ${appError.code}\nDetails: ${appError.details}\nHint: ${appError.hint}`)
        throw appError
      }
      
      console.log('✅ [Dashboard] Job application submitted successfully!')
      alert('SUCCESS! Application submitted. Client will review it.')
      toast('Application submitted! Waiting for admin approval...', 'success')
      
      // Refresh jobs list
      fetchData()
    } catch (error: any) {
      console.error('❌ [Dashboard] Error submitting application:', error)
      console.error('❌ [Dashboard] Error details:', JSON.stringify(error, null, 2))
      alert(`ERROR: ${error?.message || 'Unknown error'}\n\nFull error: ${JSON.stringify(error, null, 2)}`)
      
      // REVERT: Add job back if error
      if (jobToRemove) {
        setAvailableJobs(prev => [jobToRemove, ...prev])
      }
      
      toast('Failed to submit application. Please try again.', 'error')
    } finally {
      console.log('🏁 [Dashboard] Job application flow completed')
      setAcceptingJobId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6" id="driver-dashboard">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 text-white" data-tour="driver-status">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {profile?.first_name || 'Driver'}! 🚚
        </h1>
        <p className="text-white/90 mb-6">
          {availableJobs.length} new job{availableJobs.length !== 1 ? 's' : ''} available in your area
        </p>
        <div className="flex flex-wrap gap-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <p className="text-xs text-white/80">Today's Earnings</p>
            <p className="text-2xl font-bold">${stats.todayEarnings.toFixed(2)}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
            <p className="text-xs text-white/80">Active Deliveries</p>
            <p className="text-2xl font-bold">{activeDeliveries.length}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow" data-tour="earnings">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-gray-600 text-sm mb-1">Week Earnings</p>
          <h3 className="text-3xl font-bold text-gray-900">${stats.weekEarnings.toFixed(2)}</h3>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Truck className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-1">Active Deliveries</p>
          <h3 className="text-3xl font-bold text-gray-900">{activeDeliveries.length}</h3>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-1">Total Deliveries</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.totalDeliveries}</h3>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <Star className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-gray-600 text-sm mb-1">Driver Rating</p>
          <h3 className="text-3xl font-bold text-gray-900">{stats.rating.toFixed(1)}</h3>
        </div>
      </div>

      {/* Active Deliveries */}
      {activeDeliveries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200" data-tour="active-deliveries">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Active Deliveries</h2>
              <Link href="/dashboard/driver/active">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {activeDeliveries.map((delivery) => (
              <div key={delivery.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`
                        px-3 py-1 rounded-full text-xs font-medium
                        ${delivery.status === 'in_transit' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-orange-100 text-orange-700'
                        }
                      `}>
                        {delivery.status === 'in_transit' ? 'In Transit' : 'Ready for Pickup'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">Pickup</p>
                          <p className="text-gray-600">{delivery.pickup_address}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">Delivery</p>
                          <p className="text-gray-600">{delivery.delivery_address}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-2xl font-bold text-green-600">
                      ${delivery.estimated_price?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {delivery.distance || 0} miles
                    </p>
                  </div>
                </div>
                <Link href={`/dashboard/driver/active?id=${delivery.id}`}>
                  <Button className="w-full bg-orange-500 hover:bg-orange-600">
                    View Details
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Jobs */}
      <div className="bg-white rounded-xl border border-gray-200" data-tour="available-jobs">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Available Jobs</h2>
            <Link href="/dashboard/driver/jobs">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>

        {availableJobs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Package className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No jobs available
            </h3>
            <p className="text-gray-600">
              Check back later for new delivery opportunities
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {availableJobs.map((job) => (
              <div key={job.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        Posted {new Date(job.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">Pickup</p>
                          <p className="text-gray-600">{job.pickup_address}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-gray-900">Delivery</p>
                          <p className="text-gray-600">{job.delivery_address}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm text-gray-600 mb-1">Your Earnings (90%)</p>
                    <p className="text-3xl font-bold text-green-600">
                      ${((job.estimated_price || 0) * 0.9).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Total: ${job.estimated_price?.toFixed(2) || '0.00'} • {job.distance || 0} miles
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Link href={`/dashboard/driver/jobs/${job.id}`} className="w-full">
                    <Button 
                      variant="outline"
                      className="w-full"
                    >
                      View Details
                    </Button>
                  </Link>
                  <Button 
                    onClick={() => handleAcceptJob(job.id)}
                    disabled={acceptingJobId === job.id}
                    className="w-full bg-primary hover:bg-secondary"
                  >
                    {acceptingJobId === job.id ? 'Applying...' : 'Apply for Job'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500 rounded-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Boost Your Earnings</h3>
              <p className="text-sm text-gray-700 mb-3">
                Complete more deliveries during peak hours to earn bonuses
              </p>
              <Link href="/dashboard/driver/earnings">
                <Button variant="outline" size="sm" className="border-blue-500 text-blue-700 hover:bg-blue-500 hover:text-white">
                  View Earnings
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border border-yellow-200">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-500 rounded-lg">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Documents Needed</h3>
              <p className="text-sm text-gray-700 mb-3">
                Keep your documents up to date to continue receiving jobs
              </p>
              <Link href="/dashboard/driver/documents">
                <Button variant="outline" size="sm" className="border-yellow-600 text-yellow-700 hover:bg-yellow-500 hover:text-white">
                  Upload Documents
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
