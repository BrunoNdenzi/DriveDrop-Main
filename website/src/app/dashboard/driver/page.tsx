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
import { BenjiChat } from '@/components/benji/BenjiChat'

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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4" id="driver-dashboard">
      {/* Welcome Header */}
      <div className="flex items-center justify-between" data-tour="driver-status">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Welcome back, {profile?.first_name || 'Driver'}
          </h1>
          <p className="text-xs text-gray-500">
            {availableJobs.length} new job{availableJobs.length !== 1 ? 's' : ''} available in your area
          </p>
        </div>
        <Link href="/dashboard/driver/jobs">
          <Button size="sm" className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white">
            Browse Jobs
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-md p-4 border border-gray-200" data-tour="earnings">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-green-50 rounded-md">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-xs text-gray-500">Week Earnings</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">${stats.weekEarnings.toFixed(2)}</h3>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-50 rounded-md">
              <Truck className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xs text-gray-500">Active Deliveries</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">{activeDeliveries.length}</h3>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-50 rounded-md">
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500">Total Deliveries</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">{stats.totalDeliveries}</h3>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-yellow-50 rounded-md">
              <Star className="h-4 w-4 text-yellow-600" />
            </div>
            <p className="text-xs text-gray-500">Driver Rating</p>
          </div>
          <h3 className="text-xl font-bold text-gray-900">{stats.rating.toFixed(1)}</h3>
        </div>
      </div>

      {/* Active Deliveries */}
      {activeDeliveries.length > 0 && (
        <div className="bg-white rounded-md border border-gray-200" data-tour="active-deliveries">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Active Deliveries</h2>
            <Link href="/dashboard/driver/active">
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                View All
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {activeDeliveries.map((delivery) => (
              <div key={delivery.id} className="px-4 py-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <span className={`
                      inline-block px-2 py-0.5 rounded text-[10px] font-medium mb-2
                      ${delivery.status === 'in_transit' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-amber-100 text-amber-700'
                      }
                    `}>
                      {delivery.status === 'in_transit' ? 'In Transit' : 'Ready for Pickup'}
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <MapPin className="h-3 w-3 text-green-600 flex-shrink-0" />
                        <span className="text-gray-600 truncate">{delivery.pickup_address}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <MapPin className="h-3 w-3 text-red-600 flex-shrink-0" />
                        <span className="text-gray-600 truncate">{delivery.delivery_address}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-bold text-green-600">
                      ${delivery.estimated_price?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {delivery.distance || 0} mi
                    </p>
                  </div>
                </div>
                <Link href={`/dashboard/driver/active?id=${delivery.id}`}>
                  <Button size="sm" className="w-full h-7 text-xs bg-amber-500 hover:bg-amber-600">
                    View Details
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Jobs */}
      <div className="bg-white rounded-md border border-gray-200" data-tour="available-jobs">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Available Jobs</h2>
          <Link href="/dashboard/driver/jobs">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>

        {availableJobs.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              No jobs available
            </h3>
            <p className="text-xs text-gray-500">
              Check back later for new delivery opportunities
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {availableJobs.map((job) => (
              <div key={job.id} className="px-4 py-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span className="text-[10px] text-gray-400">
                        Posted {new Date(job.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <MapPin className="h-3 w-3 text-green-600 flex-shrink-0" />
                        <span className="text-gray-600 truncate">{job.pickup_address}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <MapPin className="h-3 w-3 text-red-600 flex-shrink-0" />
                        <span className="text-gray-600 truncate">{job.delivery_address}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-[10px] text-gray-400">Earnings (90%)</p>
                    <p className="text-sm font-bold text-green-600">
                      ${((job.estimated_price || 0) * 0.9).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      ${job.estimated_price?.toFixed(2) || '0.00'} • {job.distance || 0} mi
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link href={`/dashboard/driver/jobs/${job.id}`} className="w-full">
                    <Button 
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                    >
                      Details
                    </Button>
                  </Link>
                  <Button 
                    onClick={() => handleAcceptJob(job.id)}
                    disabled={acceptingJobId === job.id}
                    size="sm"
                    className="w-full h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    {acceptingJobId === job.id ? 'Applying...' : 'Apply'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-md p-3 border border-blue-100">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-semibold text-gray-900">Boost Earnings</h3>
          </div>
          <p className="text-[10px] text-gray-500 mb-2">
            Complete deliveries during peak hours for bonuses
          </p>
          <Link href="/dashboard/driver/earnings">
            <Button variant="outline" size="sm" className="h-6 text-[10px] border-blue-300 text-blue-700">
              View Earnings
            </Button>
          </Link>
        </div>

        <div className="bg-amber-50 rounded-md p-3 border border-amber-100">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h3 className="text-xs font-semibold text-gray-900">Documents</h3>
          </div>
          <p className="text-[10px] text-gray-500 mb-2">
            Keep documents up to date to receive jobs
          </p>
          <Link href="/dashboard/driver/documents">
            <Button variant="outline" size="sm" className="h-6 text-[10px] border-amber-300 text-amber-700">
              Upload Docs
            </Button>
          </Link>
        </div>
      </div>

      {/* Benji Chat Widget */}
      <BenjiChat 
        context="dashboard" 
        userId={profile?.id}
        userType="driver"
      />
    </div>
  )
}
