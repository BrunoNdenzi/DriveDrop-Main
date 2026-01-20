'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/components/ui/toast'
import { 
  Package, 
  User,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Star,
  Phone,
  Mail,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import BenjiDispatcher from '@/components/admin/BenjiDispatcher'

interface Driver {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  avatar_url: string
  rating: number
}

interface Application {
  id: string
  driver_id: string
  shipment_id: string
  status: 'pending' | 'accepted' | 'rejected'
  applied_at: string
  driver: Driver
}

interface Shipment {
  id: string
  title: string
  pickup_address: string
  delivery_address: string
  pickup_city: string
  delivery_city: string
  estimated_price: number
  distance: number
  status: string
  created_at: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number
  client_id: string
  driver_id: string | null
}

export default function AdminAssignmentsPage() {
  const { profile } = useAuth()
  const [mode, setMode] = useState<'benji' | 'manual'>('benji')
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [applications, setApplications] = useState<Record<string, Application[]>>({})
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedShipment, setExpandedShipment] = useState<string | null>(null)
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null)
  const [showDriverModal, setShowDriverModal] = useState(false)
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchData()
    }
  }, [profile])

  const fetchData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchPendingShipments(),
        fetchAvailableDrivers()
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingShipments = async () => {
    try {
      // Get shipments without assigned drivers
      const { data: shipmentsData, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('status', 'pending')
        .is('driver_id', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      setShipments(shipmentsData || [])

      // Fetch applications for each shipment
      if (shipmentsData && shipmentsData.length > 0) {
        const shipmentIds = shipmentsData.map(s => s.id)
        
        const { data: appsData, error: appsError } = await supabase
          .from('job_applications')
          .select(`
            *,
            driver:profiles!job_applications_driver_id_fkey (
              id,
              first_name,
              last_name,
              email,
              phone,
              avatar_url
            )
          `)
          .in('shipment_id', shipmentIds)
          .order('applied_at', { ascending: false })

        if (appsError) throw appsError

        // Group applications by shipment
        const appsByShipment: Record<string, Application[]> = {}
        appsData?.forEach((app: any) => {
          if (!appsByShipment[app.shipment_id]) {
            appsByShipment[app.shipment_id] = []
          }
          appsByShipment[app.shipment_id].push({
            id: app.id,
            driver_id: app.driver_id,
            shipment_id: app.shipment_id,
            status: app.status,
            applied_at: app.applied_at,
            driver: {
              id: app.driver.id,
              first_name: app.driver.first_name,
              last_name: app.driver.last_name,
              email: app.driver.email,
              phone: app.driver.phone,
              avatar_url: app.driver.avatar_url,
              rating: 4.5 // TODO: Get from driver_ratings table
            }
          })
        })

        setApplications(appsByShipment)
      }
    } catch (error) {
      console.error('Error fetching shipments:', error)
      toast('Failed to load shipments', 'error')
    }
  }

  const fetchAvailableDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, avatar_url')
        .eq('role', 'driver')
        .order('first_name')

      if (error) throw error
      
      setAvailableDrivers(data?.map(d => ({ ...d, rating: 4.5 })) || [])
    } catch (error) {
      console.error('Error fetching drivers:', error)
      toast('Failed to load drivers', 'error')
    }
  }

  const handleApproveApplication = async (applicationId: string, shipmentId: string, driverId: string) => {
    setProcessingAction(applicationId)
    try {
      // 1. Update application status
      const { error: appError } = await supabase
        .from('job_applications')
        .update({ status: 'accepted' })
        .eq('id', applicationId)

      if (appError) throw appError

      // 2. Assign driver to shipment
      const { error: shipmentError } = await supabase
        .from('shipments')
        .update({ 
          driver_id: driverId,
          status: 'assigned'
        })
        .eq('id', shipmentId)

      if (shipmentError) throw shipmentError

      // 3. Reject other applications for this shipment
      const { error: rejectError } = await supabase
        .from('job_applications')
        .update({ status: 'rejected' })
        .eq('shipment_id', shipmentId)
        .neq('id', applicationId)

      if (rejectError) throw rejectError

      toast('Driver assigned successfully!', 'success')
      fetchData() // Refresh
    } catch (error) {
      console.error('Error approving application:', error)
      toast('Failed to approve application', 'error')
    } finally {
      setProcessingAction(null)
    }
  }

  const handleRejectApplication = async (applicationId: string) => {
    setProcessingAction(applicationId)
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ status: 'rejected' })
        .eq('id', applicationId)

      if (error) throw error

      toast('Application rejected', 'success')
      fetchData()
    } catch (error) {
      console.error('Error rejecting application:', error)
      toast('Failed to reject application', 'error')
    } finally {
      setProcessingAction(null)
    }
  }

  const handleDirectAssign = async (shipmentId: string, driverId: string) => {
    setProcessingAction(shipmentId)
    try {
      // Assign driver directly
      const { error } = await supabase
        .from('shipments')
        .update({ 
          driver_id: driverId,
          status: 'assigned'
        })
        .eq('id', shipmentId)

      if (error) throw error

      toast('Driver assigned successfully!', 'success')
      setShowDriverModal(false)
      setSelectedShipment(null)
      fetchData()
    } catch (error) {
      console.error('Error assigning driver:', error)
      toast('Failed to assign driver', 'error')
    } finally {
      setProcessingAction(null)
    }
  }

  const toggleShipmentExpansion = (shipmentId: string) => {
    setExpandedShipment(expandedShipment === shipmentId ? null : shipmentId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Access denied. Admin privileges required.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Assignments</h1>
          <p className="text-gray-600 mt-1">AI-powered dispatch or manual assignment</p>
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
              Benji AI
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-all ${
                mode === 'manual'
                  ? 'bg-white text-gray-900 shadow-md'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Manual
            </button>
          </div>
          <Button onClick={fetchData} variant="outline">
            Refresh
          </Button>
        </div>
      </div>

      {/* Benji AI Mode */}
      {mode === 'benji' && (
        <BenjiDispatcher />
      )}

      {/* Manual Mode */}
      {mode === 'manual' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Pending Shipments</p>
                  <p className="text-2xl font-bold text-blue-900">{shipments.length}</p>
                </div>
                <Package className="h-8 w-8 text-blue-500" />
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Total Applications</p>
                  <p className="text-2xl font-bold text-green-900">
                    {Object.values(applications).reduce((sum, apps) => sum + apps.length, 0)}
                  </p>
                </div>
                <User className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Available Drivers</p>
                  <p className="text-2xl font-bold text-purple-900">{availableDrivers.length}</p>
                </div>
                <User className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

      {/* Shipments List */}
      <div className="space-y-4">
        {shipments.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Pending Shipments</h3>
            <p className="text-gray-600">All shipments have been assigned to drivers.</p>
          </div>
        ) : (
          shipments.map((shipment) => {
            const shipmentApps = applications[shipment.id] || []
            const pendingApps = shipmentApps.filter(a => a.status === 'pending')
            const isExpanded = expandedShipment === shipment.id

            return (
              <div key={shipment.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Shipment Header */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {shipment.vehicle_make} {shipment.vehicle_model} ({shipment.vehicle_year})
                        </h3>
                        {pendingApps.length > 0 && (
                          <span className="bg-orange-100 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full">
                            {pendingApps.length} Application{pendingApps.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900">Pickup</p>
                            <p className="text-gray-600">{shipment.pickup_address}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900">Delivery</p>
                            <p className="text-gray-600">{shipment.delivery_address}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-2xl font-bold text-green-600">
                        ${shipment.estimated_price.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600">{shipment.distance} miles</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Posted {new Date(shipment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setSelectedShipment(shipment.id)
                        setShowDriverModal(true)
                      }}
                      className="flex-1"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Direct Assign
                    </Button>
                    {pendingApps.length > 0 && (
                      <Button
                        onClick={() => toggleShipmentExpansion(shipment.id)}
                        variant="outline"
                        className="flex-1"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Hide Applications
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            View {pendingApps.length} Application{pendingApps.length !== 1 ? 's' : ''}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Applications List */}
                {isExpanded && pendingApps.length > 0 && (
                  <div className="border-t border-gray-200 bg-gray-50 p-6">
                    <h4 className="font-semibold text-gray-900 mb-4">Driver Applications</h4>
                    <div className="space-y-3">
                      {pendingApps.map((app) => (
                        <div key={app.id} className="bg-white rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                                {app.driver.avatar_url ? (
                                  <img src={app.driver.avatar_url} alt="" className="h-12 w-12 rounded-full" />
                                ) : (
                                  <User className="h-6 w-6 text-gray-500" />
                                )}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {app.driver.first_name} {app.driver.last_name}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                    <span>{app.driver.rating.toFixed(1)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Mail className="h-4 w-4" />
                                    <span>{app.driver.email}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-4 w-4" />
                                    <span>{app.driver.phone}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  Applied {new Date(app.applied_at).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleApproveApplication(app.id, shipment.id, app.driver_id)}
                                disabled={processingAction === app.id}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {processingAction === app.id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Assigning...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve & Assign
                                  </>
                                )}
                              </Button>
                              <Button
                                onClick={() => handleRejectApplication(app.id)}
                                disabled={processingAction === app.id}
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-600 hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Direct Assignment Modal */}
      {showDriverModal && selectedShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Select Driver to Assign</h3>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-3">
                {availableDrivers.map((driver) => (
                  <div key={driver.id} className="border border-gray-200 rounded-lg p-4 hover:border-orange-500 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                          {driver.avatar_url ? (
                            <img src={driver.avatar_url} alt="" className="h-12 w-12 rounded-full" />
                          ) : (
                            <User className="h-6 w-6 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {driver.first_name} {driver.last_name}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              <span>{driver.rating.toFixed(1)}</span>
                            </div>
                            <span>{driver.email}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDirectAssign(selectedShipment, driver.id)}
                        disabled={processingAction === selectedShipment}
                        size="sm"
                      >
                        {processingAction === selectedShipment ? 'Assigning...' : 'Assign'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <Button
                onClick={() => {
                  setShowDriverModal(false)
                  setSelectedShipment(null)
                }}
                variant="outline"
                className="w-full"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  )
}
