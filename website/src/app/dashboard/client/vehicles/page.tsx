'use client'

import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { 
  Car,
  Plus,
  Edit,
  Trash2,
  Star,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'

interface UserVehicle {
  id: string
  user_id: string
  vehicle_type: 'car' | 'van' | 'truck' | 'motorcycle' | 'suv'
  make: string
  model: string
  year: number
  color: string | null
  license_plate: string | null
  nickname: string | null
  is_primary: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function VehicleProfilesPage() {
  const { profile } = useAuth()
  const [vehicles, setVehicles] = useState<UserVehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<UserVehicle | null>(null)
  const [formData, setFormData] = useState<{
    vehicle_type: 'car' | 'van' | 'truck' | 'motorcycle' | 'suv'
    make: string
    model: string
    year: number
    color: string
    license_plate: string
    nickname: string
  }>({
    vehicle_type: 'car',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    color: '',
    license_plate: '',
    nickname: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    if (profile?.id) {
      fetchVehicles()
    }
  }, [profile?.id])

  const fetchVehicles = async () => {
    if (!profile?.id) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_vehicles')
        .select('*')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      setVehicles(data || [])
    } catch (error) {
      console.error('Error fetching vehicles:', error)
      toast('Failed to load vehicles', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return

    setSubmitting(true)

    try {
      if (editingVehicle) {
        // Update existing vehicle
        const { error } = await supabase
          .from('user_vehicles')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingVehicle.id)

        if (error) throw error

        toast('Vehicle updated successfully', 'success')
      } else {
        // Add new vehicle
        const { error } = await supabase
          .from('user_vehicles')
          .insert({
            ...formData,
            user_id: profile.id,
            is_primary: vehicles.length === 0, // First vehicle is primary
            is_active: true,
          })

        if (error) throw error

        toast('Vehicle added successfully', 'success')
      }

      setShowAddModal(false)
      setEditingVehicle(null)
      setFormData({
        vehicle_type: 'car',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        color: '',
        license_plate: '',
        nickname: '',
      })
      fetchVehicles()
    } catch (error) {
      console.error('Error saving vehicle:', error)
      toast('Failed to save vehicle', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (vehicle: UserVehicle) => {
    setEditingVehicle(vehicle)
    setFormData({
      vehicle_type: vehicle.vehicle_type,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color || '',
      license_plate: vehicle.license_plate || '',
      nickname: vehicle.nickname || '',
    })
    setShowAddModal(true)
  }

  const handleDelete = async (vehicle: UserVehicle) => {
    if (!confirm(`Are you sure you want to delete ${vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('user_vehicles')
        .update({ is_active: false })
        .eq('id', vehicle.id)

      if (error) throw error

      toast('Vehicle deleted successfully', 'success')
      fetchVehicles()
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      toast('Failed to delete vehicle', 'error')
    }
  }

  const handleSetPrimary = async (vehicle: UserVehicle) => {
    if (!profile?.id) return

    try {
      // Remove primary from all vehicles
      await supabase
        .from('user_vehicles')
        .update({ is_primary: false })
        .eq('user_id', profile.id)

      // Set this vehicle as primary
      const { error } = await supabase
        .from('user_vehicles')
        .update({ is_primary: true })
        .eq('id', vehicle.id)

      if (error) throw error

      toast('Primary vehicle updated', 'success')
      fetchVehicles()
    } catch (error) {
      console.error('Error setting primary:', error)
      toast('Failed to set primary vehicle', 'error')
    }
  }

  const closeModal = () => {
    setShowAddModal(false)
    setEditingVehicle(null)
    setFormData({
      vehicle_type: 'car',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      color: '',
      license_plate: '',
      nickname: '',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading vehicles...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">My Vehicles</h1>
            <p className="text-xs text-gray-500">Manage your saved vehicle profiles for quick booking</p>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        </div>

        {/* Vehicles List */}
        {vehicles.length === 0 ? (
          <div className="bg-white rounded-md border border-gray-200 p-8 text-center">
            <Car className="h-10 w-10 text-gray-400 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-gray-900 mb-2">No vehicles yet</h3>
            <p className="text-gray-600 mb-3">
              Add your first vehicle profile to streamline future shipments.
            </p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Vehicle
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className={`bg-white rounded-md border ${
                  vehicle.is_primary ? 'border-blue-500 ring-1 ring-blue-100' : 'border-gray-200'
                } p-4 transition-colors`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    {vehicle.is_primary && (
                      <div className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-xs font-medium px-2 py-1 rounded-full mb-2">
                        <Star className="h-3 w-3 fill-current" />
                        Primary Vehicle
                      </div>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900">
                      {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                    </h3>
                    {vehicle.nickname && (
                      <p className="text-sm text-gray-600">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(vehicle)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(vehicle)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {vehicle.color && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-medium">Color:</span>
                      <span>{vehicle.color}</span>
                    </div>
                  )}
                  {vehicle.license_plate && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="font-medium">Plate:</span>
                      <span className="font-mono">{vehicle.license_plate}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Type:</span>
                    <span className="capitalize">{vehicle.vehicle_type}</span>
                  </div>
                </div>

                {!vehicle.is_primary && (
                  <Button
                    onClick={() => handleSetPrimary(vehicle)}
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                  >
                    Set as Primary
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-md max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">
                  {editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Vehicle Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Type
                </label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="car">Car</option>
                  <option value="suv">SUV</option>
                  <option value="truck">Truck</option>
                  <option value="van">Van</option>
                  <option value="motorcycle">Motorcycle</option>
                </select>
              </div>

              {/* Make & Model */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Make <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    placeholder="e.g., Toyota"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g., Camry"
                    required
                  />
                </div>
              </div>

              {/* Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  min="1900"
                  max={new Date().getFullYear() + 1}
                  required
                />
              </div>

              {/* Color & License Plate */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="e.g., Silver"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    License Plate
                  </label>
                  <Input
                    value={formData.license_plate}
                    onChange={(e) => setFormData({ ...formData, license_plate: e.target.value.toUpperCase() })}
                    placeholder="e.g., ABC123"
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Nickname */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nickname (Optional)
                </label>
                <Input
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  placeholder="e.g., My Daily Driver"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Give your vehicle a friendly name for easy identification
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  disabled={submitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                >
                  {submitting ? 'Saving...' : editingVehicle ? 'Update Vehicle' : 'Add Vehicle'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
