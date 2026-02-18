'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { toast } from '@/components/ui/toast'
import { OptimizedLink } from '@/components/ui/optimized-link'
import { 
  User, 
  Car, 
  Bell, 
  Shield, 
  DollarSign,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Save,
  Loader2,
  ChevronLeft,
  Edit2,
  Plus,
  Trash2,
  Star,
  CheckCircle2
} from 'lucide-react'

interface Vehicle {
  id: string
  make: string
  model: string
  year: number
  color: string
  license_plate: string
  insurance_expiry: string
  is_primary: boolean
}

interface DriverSettings {
  availability_status: 'available' | 'unavailable' | 'busy'
  max_delivery_distance: number
  preferred_vehicle_types: string[]
  notification_preferences: {
    new_jobs: boolean
    messages: boolean
    payment_updates: boolean
    rating_updates: boolean
  }
  auto_accept_jobs: boolean
}

interface DriverStats {
  total_deliveries: number
  total_earnings: number
  average_rating: number
  completion_rate: number
  total_distance: number
}

export default function DriverProfilePage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'vehicles' | 'settings' | 'stats'>('profile')
  
  // Profile
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  
  // Vehicles
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [showAddVehicle, setShowAddVehicle] = useState(false)
  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({})
  
  // Settings
  const [settings, setSettings] = useState<DriverSettings>({
    availability_status: 'available',
    max_delivery_distance: 100,
    preferred_vehicle_types: [],
    notification_preferences: {
      new_jobs: true,
      messages: true,
      payment_updates: true,
      rating_updates: true
    },
    auto_accept_jobs: false
  })
  
  // Stats
  const [stats, setStats] = useState<DriverStats>({
    total_deliveries: 0,
    total_earnings: 0,
    average_rating: 0,
    completion_rate: 0,
    total_distance: 0
  })

  useEffect(() => {
    if (profile) {
      fetchData()
    }
  }, [profile])

  const fetchData = async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      
      // Fetch profile data
      if (profile) {
        setFirstName(profile.first_name || '')
        setLastName(profile.last_name || '')
        setPhone(profile.phone || '')
        setEmail(profile.email || '')
      }

      // Fetch vehicles
      const { data: vehiclesData } = await supabase
        .from('driver_vehicles')
        .select('*')
        .eq('driver_id', profile?.id)
        .order('is_primary', { ascending: false })

      if (vehiclesData) setVehicles(vehiclesData)

      // Fetch settings
      const { data: settingsData } = await supabase
        .from('driver_settings')
        .select('*')
        .eq('driver_id', profile?.id)
        .single()

      if (settingsData) {
        setSettings({
          availability_status: settingsData.availability_status,
          max_delivery_distance: settingsData.max_delivery_distance,
          preferred_vehicle_types: settingsData.preferred_vehicle_types || [],
          notification_preferences: settingsData.notification_preferences || settings.notification_preferences,
          auto_accept_jobs: settingsData.auto_accept_jobs || false
        })
      }

      // Fetch stats
      const { data: shipmentsData } = await supabase
        .from('shipments')
        .select('*, payment:payments!payments_shipment_id_fkey(driver_payout)')
        .eq('driver_id', profile?.id)

      if (shipmentsData) {
        const totalDeliveries = shipmentsData.length
        const completedDeliveries = shipmentsData.filter(s => s.status === 'delivered').length
        const totalEarnings = shipmentsData.reduce((sum, s) => {
          return sum + (s.payment?.[0]?.driver_payout || 0)
        }, 0)
        const totalDistance = shipmentsData.reduce((sum, s) => sum + (s.distance || 0), 0)

        // Fetch average rating
        const { data: ratingsData } = await supabase
          .from('driver_ratings')
          .select('rating')
          .eq('driver_id', profile?.id)

        const avgRating = ratingsData && ratingsData.length > 0
          ? ratingsData.reduce((sum, r) => sum + r.rating, 0) / ratingsData.length
          : 0

        setStats({
          total_deliveries: totalDeliveries,
          total_earnings: totalEarnings,
          average_rating: avgRating,
          completion_rate: totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0,
          total_distance: totalDistance
        })
      }

    } catch (error) {
      console.error('Error fetching data:', error)
      toast('Failed to load profile data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()
      
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          phone
        })
        .eq('id', profile?.id)

      if (error) throw error
      
      toast('Profile updated successfully', 'success')
    } catch (error: any) {
      console.error('Error saving profile:', error)
      toast(error.message || 'Failed to update profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addVehicle = async () => {
    if (!newVehicle.make || !newVehicle.model || !newVehicle.year || !newVehicle.license_plate) {
      toast('Please fill in all required vehicle fields', 'error')
      return
    }

    try {
      const supabase = getSupabaseBrowserClient()
      
      // If this is the first vehicle, make it primary
      const isPrimary = vehicles.length === 0

      const { data, error } = await supabase
        .from('driver_vehicles')
        .insert({
          driver_id: profile?.id,
          make: newVehicle.make,
          model: newVehicle.model,
          year: newVehicle.year,
          color: newVehicle.color,
          license_plate: newVehicle.license_plate,
          insurance_expiry: newVehicle.insurance_expiry,
          is_primary: isPrimary
        })
        .select()
        .single()

      if (error) throw error

      setVehicles(prev => [...prev, data])
      setNewVehicle({})
      setShowAddVehicle(false)
      toast('Vehicle added successfully', 'success')
    } catch (error: any) {
      console.error('Error adding vehicle:', error)
      toast(error.message || 'Failed to add vehicle', 'error')
    }
  }

  const deleteVehicle = async (vehicleId: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return

    try {
      const supabase = getSupabaseBrowserClient()
      
      const { error } = await supabase
        .from('driver_vehicles')
        .delete()
        .eq('id', vehicleId)

      if (error) throw error

      setVehicles(prev => prev.filter(v => v.id !== vehicleId))
      toast('Vehicle deleted', 'success')
    } catch (error: any) {
      console.error('Error deleting vehicle:', error)
      toast(error.message || 'Failed to delete vehicle', 'error')
    }
  }

  const setPrimaryVehicle = async (vehicleId: string) => {
    try {
      const supabase = getSupabaseBrowserClient()
      
      // Set all vehicles to non-primary
      await supabase
        .from('driver_vehicles')
        .update({ is_primary: false })
        .eq('driver_id', profile?.id)

      // Set selected vehicle as primary
      const { error } = await supabase
        .from('driver_vehicles')
        .update({ is_primary: true })
        .eq('id', vehicleId)

      if (error) throw error

      setVehicles(prev => prev.map(v => ({
        ...v,
        is_primary: v.id === vehicleId
      })))

      toast('Primary vehicle updated', 'success')
    } catch (error: any) {
      console.error('Error setting primary vehicle:', error)
      toast(error.message || 'Failed to update primary vehicle', 'error')
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const supabase = getSupabaseBrowserClient()
      
      const { error } = await supabase
        .from('driver_settings')
        .upsert({
          driver_id: profile?.id,
          ...settings
        })

      if (error) throw error

      toast('Settings saved successfully', 'success')
    } catch (error: any) {
      console.error('Error saving settings:', error)
      toast(error.message || 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <OptimizedLink 
                href="/dashboard/driver"
                className="text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-6 h-6" />
              </OptimizedLink>
              <div>
                <h1 className="text-sm font-semibold text-gray-900">Driver Profile</h1>
                <p className="text-sm text-gray-600">Manage your account and preferences</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="px-4">
          <div className="flex space-x-6">
            {[
              { key: 'profile', label: 'Profile', icon: User },
              { key: 'vehicles', label: 'Vehicles', icon: Car },
              { key: 'settings', label: 'Settings', icon: Bell },
              { key: 'stats', label: 'Statistics', icon: Star }
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center space-x-2 py-4 px-2 border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-6">Personal Information</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-amber-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full px-3 py-2 border rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>

                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-300 font-medium flex items-center justify-center space-x-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Profile</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vehicles Tab */}
        {activeTab === 'vehicles' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900">Your Vehicles</h2>
              <button
                onClick={() => setShowAddVehicle(!showAddVehicle)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Vehicle</span>
              </button>
            </div>

            {showAddVehicle && (
              <div className="bg-white rounded-md border p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Add New Vehicle</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Make *"
                    value={newVehicle.make || ''}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, make: e.target.value }))}
                    className="px-3 py-2 border rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="Model *"
                    value={newVehicle.model || ''}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, model: e.target.value }))}
                    className="px-3 py-2 border rounded-md"
                  />
                  <input
                    type="number"
                    placeholder="Year *"
                    value={newVehicle.year || ''}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    className="px-3 py-2 border rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="Color"
                    value={newVehicle.color || ''}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, color: e.target.value }))}
                    className="px-3 py-2 border rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="License Plate *"
                    value={newVehicle.license_plate || ''}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, license_plate: e.target.value.toUpperCase() }))}
                    className="px-3 py-2 border rounded-md"
                  />
                  <input
                    type="date"
                    placeholder="Insurance Expiry"
                    value={newVehicle.insurance_expiry || ''}
                    onChange={(e) => setNewVehicle(prev => ({ ...prev, insurance_expiry: e.target.value }))}
                    className="px-3 py-2 border rounded-md"
                  />
                </div>
                <div className="flex space-x-3 mt-4">
                  <button
                    onClick={addVehicle}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
                  >
                    Add Vehicle
                  </button>
                  <button
                    onClick={() => {
                      setShowAddVehicle(false)
                      setNewVehicle({})
                    }}
                    className="px-4 py-2 border rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {vehicles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="bg-white rounded-md border p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center">
                          <Car className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </h3>
                          <p className="text-sm text-gray-600">{vehicle.license_plate}</p>
                        </div>
                      </div>
                      {vehicle.is_primary && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                          Primary
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      {vehicle.color && (
                        <p className="text-gray-600">Color: {vehicle.color}</p>
                      )}
                      {vehicle.insurance_expiry && (
                        <p className="text-gray-600">
                          Insurance Expires: {new Date(vehicle.insurance_expiry).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex space-x-2 mt-4">
                      {!vehicle.is_primary && (
                        <button
                          onClick={() => setPrimaryVehicle(vehicle.id)}
                          className="flex-1 px-3 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 text-sm"
                        >
                          Set Primary
                        </button>
                      )}
                      <button
                        onClick={() => deleteVehicle(vehicle.id)}
                        className="px-3 py-2 border border-red-600 text-red-600 rounded-md hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-md border p-12 text-center">
                <Car className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No vehicles added yet</p>
                <p className="text-sm text-gray-500 mt-1">Add a vehicle to start accepting deliveries</p>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-6">Delivery Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Availability Status
                  </label>
                  <select
                    value={settings.availability_status}
                    onChange={(e) => setSettings(prev => ({ ...prev, availability_status: e.target.value as any }))}
                    className="w-full px-3 py-2 border rounded-md focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Delivery Distance: {settings.max_delivery_distance} miles
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={settings.max_delivery_distance}
                    onChange={(e) => setSettings(prev => ({ ...prev, max_delivery_distance: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Auto-Accept Jobs</p>
                    <p className="text-sm text-gray-600">Automatically accept jobs matching your preferences</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.auto_accept_jobs}
                    onChange={(e) => setSettings(prev => ({ ...prev, auto_accept_jobs: e.target.checked }))}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-md border p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-6">Notifications</h2>
              
              <div className="space-y-4">
                {[
                  { key: 'new_jobs', label: 'New Job Opportunities', description: 'Get notified when new jobs match your preferences' },
                  { key: 'messages', label: 'Messages', description: 'Notifications for new messages from clients' },
                  { key: 'payment_updates', label: 'Payment Updates', description: 'Updates about your earnings and payouts' },
                  { key: 'rating_updates', label: 'Rating Updates', description: 'When clients rate your service' }
                ].map((notif) => (
                  <div key={notif.key} className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{notif.label}</p>
                      <p className="text-sm text-gray-600">{notif.description}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notification_preferences[notif.key as keyof typeof settings.notification_preferences]}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        notification_preferences: {
                          ...prev.notification_preferences,
                          [notif.key]: e.target.checked
                        }
                      }))}
                      className="w-5 h-5 text-blue-600 rounded mt-0.5"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-300 font-medium flex items-center justify-center space-x-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-md border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Deliveries</h3>
                  <Car className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">{stats.total_deliveries}</p>
              </div>

              <div className="bg-white rounded-md border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Earnings</h3>
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">${stats.total_earnings.toFixed(2)}</p>
              </div>

              <div className="bg-white rounded-md border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Average Rating</h3>
                  <Star className="w-5 h-5 text-yellow-500" />
                </div>
                <p className="text-lg font-bold text-gray-900">{stats.average_rating.toFixed(1)}</p>
              </div>

              <div className="bg-white rounded-md border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Completion Rate</h3>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-lg font-bold text-gray-900">{stats.completion_rate.toFixed(0)}%</p>
              </div>
            </div>

            <div className="bg-white rounded-md border p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900 mb-4">Distance Traveled</h3>
              <div className="flex items-center space-x-3">
                <MapPin className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-lg font-bold text-gray-900">{stats.total_distance.toLocaleString()}</p>
                  <p className="text-gray-600">Total Miles</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
