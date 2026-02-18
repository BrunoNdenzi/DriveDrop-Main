'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { JobCardSkeleton } from '@/components/ui/loading'
import { toast } from '@/components/ui/toast'
import { 
  Package, 
  MapPin, 
  DollarSign, 
  Ruler, 
  Clock, 
  Filter,
  Search,
  TrendingUp,
  Truck,
  Calendar,
  CheckCircle,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import BenjiLoadRecommendations from '@/components/driver/BenjiLoadRecommendations'

interface Job {
  id: string
  title: string
  pickup_address: string
  delivery_address: string
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
}

export default function DriverJobsPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'benji' | 'browse'>('benji')
  const [jobs, setJobs] = useState<Job[]>([])
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDistance, setFilterDistance] = useState('all')
  const [filterVehicleType, setFilterVehicleType] = useState('all')
  const [filterPrice, setFilterPrice] = useState('all')
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    fetchProfile()
  }, [])

  useEffect(() => {
    if (profile?.id) {
      fetchJobs()
    }
  }, [profile?.id])

  useEffect(() => {
    applyFilters()
  }, [jobs, searchQuery, filterDistance, filterVehicleType, filterPrice])

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

  const fetchJobs = async () => {
    if (!profile?.id) return

    setLoading(true)
    try {
      // First, get all job IDs this driver has already applied to
      const { data: appliedJobs, error: appliedError } = await supabase
        .from('job_applications')
        .select('shipment_id')
        .eq('driver_id', profile.id)

      if (appliedError) {
        console.error('Error fetching applied jobs:', appliedError)
      }

      const appliedJobIds = appliedJobs?.map(app => app.shipment_id) || []
      console.log('[Jobs Page] Driver has applied to:', appliedJobIds)

      // Fetch available jobs (no driver assigned, status is pending, and not already applied)
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .is('driver_id', null)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // Filter out jobs the driver has already applied to
      const availableJobs = (data || []).filter(job => !appliedJobIds.includes(job.id))
      console.log('[Jobs Page] Available jobs after filtering:', availableJobs.length)
      
      setJobs(availableJobs)
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...jobs]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(job =>
        job.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.pickup_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.delivery_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.vehicle_make?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.vehicle_model?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Distance filter
    if (filterDistance !== 'all') {
      const maxDistance = parseInt(filterDistance)
      filtered = filtered.filter(job => job.distance != null && job.distance <= maxDistance)
    }

    // Vehicle type filter
    if (filterVehicleType !== 'all') {
      filtered = filtered.filter(job => 
        job.vehicle_type?.toLowerCase() === filterVehicleType.toLowerCase()
      )
    }

    // Price filter
    if (filterPrice !== 'all') {
      if (filterPrice === 'low') {
        filtered = filtered.filter(job => job.estimated_price < 500)
      } else if (filterPrice === 'medium') {
        filtered = filtered.filter(job => job.estimated_price >= 500 && job.estimated_price < 1000)
      } else if (filterPrice === 'high') {
        filtered = filtered.filter(job => job.estimated_price >= 1000)
      }
    }

    setFilteredJobs(filtered)
  }

  const handleApplyForJob = async (jobId: string) => {
    console.log('🚀 [Jobs Page] Starting job application:', { jobId, profileId: profile?.id })
    
    if (!profile?.id) {
      console.error('❌ [Jobs Page] No profile ID found')
      alert('ERROR: No profile ID found. Check console.')
      toast('Please log in to apply for jobs', 'error')
      return
    }

    setApplyingJobId(jobId)
    
    // OPTIMISTIC UI: Remove job immediately for instant feedback
    const jobToRemove = jobs.find(job => job.id === jobId)
    console.log('📦 [Jobs Page] Job to apply for:', jobToRemove)
    const updatedJobs = jobs.filter(job => job.id !== jobId)
    setJobs(updatedJobs)
    
    try {
      // CORRECT FLOW: Create job application (like mobile app)
      console.log('🔄 [Jobs Page] Creating job application...')
      const { data, error: shipmentError } = await supabase
        .from('job_applications')
        .insert({
          shipment_id: jobId,
          driver_id: profile.id,
          status: 'pending',
          applied_at: new Date().toISOString()
        })
        .select()
        .single()

      console.log('📊 [Jobs Page] Application response:', { data, error: shipmentError })

      if (shipmentError) {
        console.error('❌ [Jobs Page] Application error:', shipmentError)
        alert(`ERROR: ${shipmentError.message}\nCode: ${shipmentError.code}\nDetails: ${shipmentError.details}\nHint: ${shipmentError.hint}`)
        throw shipmentError
      }

      // Success! Show toast
      console.log('✅ [Jobs Page] Job application submitted successfully!')
      alert('SUCCESS! Application submitted. Client will review it.')
      toast('Application submitted! Waiting for admin approval...', 'success')
      
      // Refresh jobs list
      fetchJobs()
    } catch (error: any) {
      console.error('❌ [Jobs Page] Error submitting application:', error)
      console.error('❌ [Jobs Page] Error details:', JSON.stringify(error, null, 2))
      alert(`ERROR: ${error?.message || 'Unknown error'}\n\nFull error: ${JSON.stringify(error, null, 2)}`)
      
      // REVERT OPTIMISTIC UPDATE: Add job back if error
      if (jobToRemove) {
        setJobs([jobToRemove, ...updatedJobs])
      }
      
      toast('Failed to submit application. Please try again.', 'error')
    } finally {
      console.log('🏁 [Jobs Page] Job application flow completed')
      setApplyingJobId(null)
    }
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

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays}d ago`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Available Jobs</h1>
            <p className="text-xs text-gray-500">Loading...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <JobCardSkeleton />
          <JobCardSkeleton />
          <JobCardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Available Jobs</h1>
          <p className="text-xs text-gray-500">
            {mode === 'benji' ? 'AI-powered recommendations' : `${filteredJobs.length} jobs available`}
          </p>
        </div>
        <div className="flex bg-gray-100 rounded-md p-0.5">
          <button
            onClick={() => setMode('benji')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 ${
              mode === 'benji'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            Benji
          </button>
          <button
            onClick={() => setMode('browse')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              mode === 'browse'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Browse
          </button>
        </div>
      </div>

      {/* Benji Mode */}
      {mode === 'benji' && (
        <BenjiLoadRecommendations />
      )}

      {/* Browse Mode */}
      {mode === 'browse' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
            </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search jobs..."
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Distance Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Max Distance
              </label>
              <select
                value={filterDistance}
                onChange={(e) => setFilterDistance(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">All Distances</option>
                <option value="100">Under 100 miles</option>
                <option value="300">Under 300 miles</option>
                <option value="500">Under 500 miles</option>
                <option value="1000">Under 1000 miles</option>
              </select>
            </div>

            {/* Vehicle Type Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Vehicle Type
              </label>
              <select
                value={filterVehicleType}
                onChange={(e) => setFilterVehicleType(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">All Types</option>
                <option value="sedan">Sedan</option>
                <option value="suv">SUV</option>
                <option value="truck">Truck</option>
                <option value="van">Van</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Price Filter */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Price Range
              </label>
              <select
                value={filterPrice}
                onChange={(e) => setFilterPrice(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="all">All Prices</option>
                <option value="low">Under $500</option>
                <option value="medium">$500 - $1000</option>
                <option value="high">Over $1000</option>
              </select>
            </div>
          </div>

          {/* Active Filters Summary */}
          {(searchQuery || filterDistance !== 'all' || filterVehicleType !== 'all' || filterPrice !== 'all') && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-gray-500">Filters:</span>
                {searchQuery && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">
                    "{searchQuery}"
                    <button onClick={() => setSearchQuery('')} className="ml-1">×</button>
                  </span>
                )}
                {filterDistance !== 'all' && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">
                    &lt;{filterDistance}mi
                    <button onClick={() => setFilterDistance('all')} className="ml-1">×</button>
                  </span>
                )}
                {filterVehicleType !== 'all' && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">
                    {filterVehicleType}
                    <button onClick={() => setFilterVehicleType('all')} className="ml-1">×</button>
                  </span>
                )}
                {filterPrice !== 'all' && (
                  <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px]">
                    {filterPrice}
                    <button onClick={() => setFilterPrice('all')} className="ml-1">×</button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setFilterDistance('all')
                    setFilterVehicleType('all')
                    setFilterPrice('all')
                  }}
                  className="text-[10px] text-amber-600 hover:text-amber-700 font-medium"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-md border border-gray-200 p-8 text-center">
            <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              No Jobs Found
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              {jobs.length === 0 
                ? "No available jobs at the moment. Check back later!"
                : "No jobs match your filters."}
            </p>
            {filteredJobs.length === 0 && jobs.length > 0 && (
              <Button
                onClick={() => {
                  setSearchQuery('')
                  setFilterDistance('all')
                  setFilterVehicleType('all')
                  setFilterPrice('all')
                }}
                size="sm"
                className="h-7 text-xs bg-amber-500 hover:bg-amber-600"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-md border border-gray-200 p-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* Job Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-1">
                          {job.title || `${job.vehicle_make} ${job.vehicle_model} ${job.vehicle_year}`}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {formatTimeAgo(job.created_at)}
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                            Available
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Vehicle Info */}
                    <div className="bg-gray-50 rounded-md p-2.5 mb-2">
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <p className="text-[10px] text-gray-400">Type</p>
                          <p className="text-xs font-medium text-gray-900 capitalize">{job.vehicle_type}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">Make/Model</p>
                          <p className="text-xs font-medium text-gray-900">{job.vehicle_make} {job.vehicle_model}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">Year</p>
                          <p className="text-xs font-medium text-gray-900">{job.vehicle_year}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400">Condition</p>
                          <p className={`text-xs font-medium ${job.is_operable ? 'text-green-600' : 'text-amber-600'}`}>
                            {job.is_operable ? 'Operable' : 'Non-Op'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Addresses */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <MapPin className="h-3 w-3 text-green-600 flex-shrink-0" />
                        <span className="text-gray-600 truncate">{job.pickup_address}</span>
                        {job.pickup_date && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {formatDate(job.pickup_date)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <MapPin className="h-3 w-3 text-red-600 flex-shrink-0" />
                        <span className="text-gray-600 truncate">{job.delivery_address}</span>
                      </div>
                    </div>

                    {/* Distance */}
                    <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400">
                      <span className="flex items-center gap-0.5">
                        <Ruler className="h-3 w-3" />
                        {job.distance ? job.distance.toFixed(0) : 'N/A'} mi
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        ~{job.distance ? Math.ceil(job.distance / 500) : 'N/A'} days
                      </span>
                    </div>
                  </div>

                  {/* Price & Action */}
                  <div className="lg:w-48 flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400">Earnings (90%)</p>
                      <p className="text-lg font-bold text-amber-600">
                        ${(job.estimated_price * 0.9).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Total: ${job.estimated_price.toFixed(2)}
                      </p>
                    </div>

                    <Button
                      onClick={() => handleApplyForJob(job.id)}
                      disabled={applyingJobId === job.id}
                      size="sm"
                      className="w-full h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      {applyingJobId === job.id ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                          Applying...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Apply
                        </>
                      )}
                    </Button>

                    <Link href={`/dashboard/driver/jobs/${job.id}`} className="w-full">
                      <Button variant="outline" size="sm" className="w-full h-7 text-xs">
                        Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  )
}
