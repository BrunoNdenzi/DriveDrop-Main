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
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Available Jobs</h1>
                <p className="text-sm text-gray-600">Loading...</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Available Jobs</h1>
              <p className="text-sm text-gray-600">
                {mode === 'benji' ? 'AI-powered recommendations' : `${filteredJobs.length} jobs available`}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setMode('benji')}
                  className={`px-4 py-2 rounded-md font-medium text-sm transition-all flex items-center gap-2 ${
                    mode === 'benji'
                      ? 'bg-gradient-to-r from-teal-600 to-purple-600 text-white shadow-md'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  Benji
                </button>
                <button
                  onClick={() => setMode('browse')}
                  className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                    mode === 'browse'
                      ? 'bg-white text-gray-900 shadow-md'
                      : 'text-gray-700 hover:text-gray-900'
                  }`}
                >
                  Browse All
                </button>
              </div>
              <Link href="/dashboard/driver">
                <Button variant="outline" size="sm">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Benji Mode */}
        {mode === 'benji' && (
          <BenjiLoadRecommendations />
        )}

        {/* Browse Mode */}
        {mode === 'browse' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="h-5 w-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
              </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search jobs..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Distance Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Distance
              </label>
              <select
                value={filterDistance}
                onChange={(e) => setFilterDistance(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Type
              </label>
              <select
                value={filterVehicleType}
                onChange={(e) => setFilterVehicleType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price Range
              </label>
              <select
                value={filterPrice}
                onChange={(e) => setFilterPrice(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600">Active filters:</span>
                {searchQuery && (
                  <span className="inline-flex items-center px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                    Search: "{searchQuery}"
                    <button onClick={() => setSearchQuery('')} className="ml-2">×</button>
                  </span>
                )}
                {filterDistance !== 'all' && (
                  <span className="inline-flex items-center px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                    Distance: Under {filterDistance}mi
                    <button onClick={() => setFilterDistance('all')} className="ml-2">×</button>
                  </span>
                )}
                {filterVehicleType !== 'all' && (
                  <span className="inline-flex items-center px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                    Type: {filterVehicleType}
                    <button onClick={() => setFilterVehicleType('all')} className="ml-2">×</button>
                  </span>
                )}
                {filterPrice !== 'all' && (
                  <span className="inline-flex items-center px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm">
                    Price: {filterPrice}
                    <button onClick={() => setFilterPrice('all')} className="ml-2">×</button>
                  </span>
                )}
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setFilterDistance('all')
                    setFilterVehicleType('all')
                    setFilterPrice('all')
                  }}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-gray-200">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Jobs Found
            </h3>
            <p className="text-gray-600 mb-6">
              {jobs.length === 0 
                ? "There are no available jobs at the moment. Check back later!"
                : "No jobs match your filters. Try adjusting your search criteria."}
            </p>
            {filteredJobs.length === 0 && jobs.length > 0 && (
              <Button
                onClick={() => {
                  setSearchQuery('')
                  setFilterDistance('all')
                  setFilterVehicleType('all')
                  setFilterPrice('all')
                }}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  {/* Job Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {job.title || `${job.vehicle_make} ${job.vehicle_model} ${job.vehicle_year}`}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Posted {formatTimeAgo(job.created_at)}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Available
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Vehicle Info */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Vehicle Type</p>
                          <p className="text-sm font-medium text-gray-900 capitalize">
                            <Truck className="h-4 w-4 inline mr-1" />
                            {job.vehicle_type}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Make & Model</p>
                          <p className="text-sm font-medium text-gray-900">
                            {job.vehicle_make} {job.vehicle_model}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Year</p>
                          <p className="text-sm font-medium text-gray-900">{job.vehicle_year}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Condition</p>
                          <p className={`text-sm font-medium ${job.is_operable ? 'text-green-600' : 'text-orange-600'}`}>
                            {job.is_operable ? 'Operable' : 'Non-Operable'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Addresses */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Pickup Location</p>
                          <p className="text-sm text-gray-600">{job.pickup_address}</p>
                          {job.pickup_date && (
                            <p className="text-xs text-gray-500 mt-1">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              Pickup: {formatDate(job.pickup_date)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Delivery Location</p>
                          <p className="text-sm text-gray-600">{job.delivery_address}</p>
                        </div>
                      </div>
                    </div>

                    {/* Distance */}
                    <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Ruler className="h-4 w-4" />
                        {job.distance ? job.distance.toFixed(0) : 'N/A'} miles
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        ~{job.distance ? Math.ceil(job.distance / 500) : 'N/A'} days estimated
                      </span>
                    </div>
                  </div>

                  {/* Price & Action */}
                  <div className="lg:w-64 flex flex-col items-end gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-600 mb-1">Your Earnings (90%)</p>
                      <p className="text-4xl font-bold text-teal-600">
                        ${(job.estimated_price * 0.9).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Total: ${job.estimated_price.toFixed(2)}
                      </p>
                    </div>

                    <Button
                      onClick={() => handleApplyForJob(job.id)}
                      disabled={applyingJobId === job.id}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      {applyingJobId === job.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Applying...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Apply for Job
                        </>
                      )}
                    </Button>

                    <Link href={`/dashboard/driver/jobs/${job.id}`} className="w-full">
                      <Button variant="outline" className="w-full">
                        View Details
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
