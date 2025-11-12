'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { toast } from '@/components/ui/toast'
import { OptimizedLink } from '@/components/ui/optimized-link'
import { 
  Camera, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Upload,
  ChevronLeft,
  Info,
  Loader2
} from 'lucide-react'

interface PhotoRequirement {
  id: string
  label: string
  description: string
  required: boolean
  captured: boolean
  file?: File
  preview?: string
}

interface VerificationIssue {
  type: 'not_drivable' | 'significant_damage' | 'wrong_vehicle' | 'missing_features' | 'cleanliness' | 'other'
  description: string
  severity: 'minor' | 'moderate' | 'major'
}

const PHOTO_REQUIREMENTS: Omit<PhotoRequirement, 'captured'>[] = [
  {
    id: 'front',
    label: 'Front View',
    description: 'Full front of vehicle including license plate',
    required: true
  },
  {
    id: 'rear',
    label: 'Rear View',
    description: 'Full rear of vehicle including license plate',
    required: true
  },
  {
    id: 'driver_side',
    label: 'Driver Side',
    description: 'Full side view from driver side',
    required: true
  },
  {
    id: 'passenger_side',
    label: 'Passenger Side',
    description: 'Full side view from passenger side',
    required: true
  },
  {
    id: 'interior',
    label: 'Interior',
    description: 'Dashboard and interior condition',
    required: true
  },
  {
    id: 'odometer',
    label: 'Odometer',
    description: 'Clear photo of odometer reading',
    required: true
  },
  {
    id: 'damage_1',
    label: 'Damage/Scratch (Optional)',
    description: 'Any existing damage, scratches, or dents',
    required: false
  },
  {
    id: 'damage_2',
    label: 'Additional Damage (Optional)',
    description: 'Additional damage photos if needed',
    required: false
  }
]

const ISSUE_TYPES = [
  { value: 'not_drivable', label: 'Vehicle Not Drivable', severity: 'major' },
  { value: 'significant_damage', label: 'Significant Damage', severity: 'major' },
  { value: 'wrong_vehicle', label: 'Wrong Vehicle', severity: 'major' },
  { value: 'missing_features', label: 'Missing Features/Parts', severity: 'moderate' },
  { value: 'cleanliness', label: 'Cleanliness Issues', severity: 'minor' },
  { value: 'other', label: 'Other Issue', severity: 'moderate' }
] as const

export default function PickupVerificationPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [shipment, setShipment] = useState<any>(null)
  const [photos, setPhotos] = useState<PhotoRequirement[]>(
    PHOTO_REQUIREMENTS.map(req => ({ ...req, captured: false }))
  )
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [issues, setIssues] = useState<VerificationIssue[]>([])
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [currentIssue, setCurrentIssue] = useState<Partial<VerificationIssue>>({})
  const [verificationNotes, setVerificationNotes] = useState('')

  useEffect(() => {
    if (profile) {
      fetchShipment()
      getCurrentLocation()
    }
  }, [profile, params.id])

  const fetchShipment = async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          client:profiles!shipments_client_id_fkey (
            id,
            first_name,
            last_name,
            phone
          )
        `)
        .eq('id', params.id)
        .single()

      if (error) throw error
      setShipment(data)
    } catch (error) {
      console.error('Error fetching shipment:', error)
      toast('Failed to load shipment details', 'error')
      router.push('/dashboard/driver/active')
    } finally {
      setLoading(false)
    }
  }

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          })
          setLocationError(null)
        },
        (error) => {
          console.error('Location error:', error)
          setLocationError('Unable to get your location. Please enable location services.')
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    } else {
      setLocationError('Geolocation is not supported by your browser')
    }
  }

  const handlePhotoCapture = (photoId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast('Please select an image file', 'error')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast('Image size must be less than 10MB', 'error')
      return
    }

    // Create preview URL
    const preview = URL.createObjectURL(file)

    setPhotos(prev => prev.map(photo => 
      photo.id === photoId 
        ? { ...photo, captured: true, file, preview }
        : photo
    ))

    toast('Photo captured successfully', 'success')
  }

  const removePhoto = (photoId: string) => {
    setPhotos(prev => prev.map(photo => {
      if (photo.id === photoId) {
        // Revoke old preview URL to prevent memory leaks
        if (photo.preview) {
          URL.revokeObjectURL(photo.preview)
        }
        return { ...photo, captured: false, file: undefined, preview: undefined }
      }
      return photo
    }))
  }

  const addIssue = () => {
    if (!currentIssue.type || !currentIssue.description) {
      toast('Please fill in all issue fields', 'error')
      return
    }

    const issueType = ISSUE_TYPES.find(t => t.value === currentIssue.type)
    const newIssue: VerificationIssue = {
      type: currentIssue.type as any,
      description: currentIssue.description,
      severity: issueType?.severity || 'moderate'
    }

    setIssues(prev => [...prev, newIssue])
    setCurrentIssue({})
    setShowIssueForm(false)
    toast('Issue added', 'success')
  }

  const removeIssue = (index: number) => {
    setIssues(prev => prev.filter((_, i) => i !== index))
  }

  const uploadPhotos = async () => {
    const supabase = getSupabaseBrowserClient()
    const uploadedUrls: { [key: string]: string } = {}

    for (const photo of photos) {
      if (photo.file) {
        const fileName = `${params.id}_${photo.id}_${Date.now()}.jpg`
        const filePath = `pickup-verifications/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('vehicle-photos')
          .upload(filePath, photo.file)

        if (uploadError) {
          throw new Error(`Failed to upload ${photo.label}`)
        }

        const { data: { publicUrl } } = supabase.storage
          .from('vehicle-photos')
          .getPublicUrl(filePath)

        uploadedUrls[photo.id] = publicUrl
      }
    }

    return uploadedUrls
  }

  const handleSubmit = async () => {
    // Validation
    const requiredPhotos = photos.filter(p => p.required)
    const missingPhotos = requiredPhotos.filter(p => !p.captured)

    if (missingPhotos.length > 0) {
      toast(`Please capture all required photos: ${missingPhotos.map(p => p.label).join(', ')}`, 'error')
      return
    }

    if (!location) {
      toast('Location verification is required. Please enable location services.', 'error')
      return
    }

    // Check if major issues exist
    const majorIssues = issues.filter(i => i.severity === 'major')
    if (majorIssues.length > 0) {
      const confirmed = confirm(
        `You have reported ${majorIssues.length} major issue(s). This will notify the client and may delay pickup. Continue?`
      )
      if (!confirmed) return
    }

    setSubmitting(true)

    try {
      const supabase = getSupabaseBrowserClient()

      // Upload photos to storage
      toast('Uploading photos...', 'info')
      const photoUrls = await uploadPhotos()

      // Create pickup verification record
      const verificationData = {
        shipment_id: params.id,
        driver_id: profile?.id,
        pickup_latitude: location.latitude,
        pickup_longitude: location.longitude,
        verification_photos: photoUrls,
        odometer_reading: null, // Could extract from photo
        issues_reported: issues.length > 0 ? issues : null,
        verification_notes: verificationNotes || null,
        verified_at: new Date().toISOString(),
        status: issues.filter(i => i.severity === 'major').length > 0 ? 'issues_found' : 'verified'
      }

      const { error: verificationError } = await supabase
        .from('pickup_verifications')
        .insert(verificationData)

      if (verificationError) throw verificationError

      // Update shipment status
      const { error: shipmentError } = await supabase
        .from('shipments')
        .update({ 
          status: 'picked_up',
          actual_pickup_time: new Date().toISOString()
        })
        .eq('id', params.id)

      if (shipmentError) throw shipmentError

      // Create tracking event
      await supabase
        .from('tracking_events')
        .insert({
          shipment_id: params.id,
          event_type: 'picked_up',
          description: issues.length > 0 
            ? `Vehicle picked up with ${issues.length} issue(s) reported`
            : 'Vehicle picked up successfully',
          metadata: {
            issues_count: issues.length,
            major_issues: issues.filter(i => i.severity === 'major').length,
            location: location
          },
          created_by: profile?.id
        })

      // Send notification to client if issues found
      if (issues.length > 0) {
        await supabase.functions.invoke('send-notification', {
          body: {
            user_id: shipment.client_id,
            type: 'pickup_issues',
            title: 'Pickup Verification Issues',
            message: `Driver has reported ${issues.length} issue(s) during vehicle pickup. Please check your notifications.`,
            data: {
              shipment_id: params.id,
              issues: issues
            }
          }
        })
      }

      toast('Pickup verification completed successfully!', 'success')
      
      // Redirect to shipment detail or active deliveries
      setTimeout(() => {
        router.push(`/dashboard/driver/active/${params.id}`)
      }, 1500)

    } catch (error: any) {
      console.error('Error submitting verification:', error)
      toast(error.message || 'Failed to submit verification', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading verification form...</p>
        </div>
      </div>
    )
  }

  if (!shipment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Shipment not found</p>
          <OptimizedLink href="/dashboard/driver/active" className="text-blue-600 hover:underline mt-4 inline-block">
            Return to Active Deliveries
          </OptimizedLink>
        </div>
      </div>
    )
  }

  const requiredPhotosCount = photos.filter(p => p.required && p.captured).length
  const totalRequiredPhotos = photos.filter(p => p.required).length
  const completionPercentage = (requiredPhotosCount / totalRequiredPhotos) * 100

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <OptimizedLink 
                href={`/dashboard/driver/active/${params.id}`}
                className="text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-6 h-6" />
              </OptimizedLink>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Pickup Verification</h1>
                <p className="text-sm text-gray-600">
                  {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">{requiredPhotosCount}/{totalRequiredPhotos}</p>
              <p className="text-xs text-gray-600">Required Photos</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Location Status */}
        <div className={`p-4 rounded-lg border ${
          location 
            ? 'bg-green-50 border-green-200' 
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-start space-x-3">
            <MapPin className={`w-5 h-5 mt-0.5 ${location ? 'text-green-600' : 'text-yellow-600'}`} />
            <div className="flex-1">
              <h3 className={`font-semibold ${location ? 'text-green-900' : 'text-yellow-900'}`}>
                {location ? 'Location Verified' : 'Location Required'}
              </h3>
              <p className={`text-sm mt-1 ${location ? 'text-green-700' : 'text-yellow-700'}`}>
                {location 
                  ? `GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                  : locationError || 'Verifying your location...'
                }
              </p>
              {!location && (
                <button
                  onClick={getCurrentLocation}
                  className="text-sm text-yellow-800 underline mt-2"
                >
                  Retry Location
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Verification Instructions</h3>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                <li>Capture all required photos before pickup</li>
                <li>Ensure photos are clear and well-lit</li>
                <li>Document any existing damage or issues</li>
                <li>Report major issues to the client immediately</li>
                <li>Keep your location services enabled</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Photo Capture Grid */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Photos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="border rounded-lg overflow-hidden">
                {photo.captured && photo.preview ? (
                  <div className="relative">
                    <img 
                      src={photo.preview} 
                      alt={photo.label}
                      className="w-full h-48 object-cover"
                    />
                    <button
                      onClick={() => removePhoto(photo.id)}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="text-white font-medium text-sm">{photo.label}</p>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handlePhotoCapture(photo.id, e)}
                      className="hidden"
                    />
                    <div className="h-48 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                      <Camera className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="font-medium text-gray-900">{photo.label}</p>
                      <p className="text-xs text-gray-500 mt-1 px-4 text-center">{photo.description}</p>
                      {photo.required && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          Required
                        </span>
                      )}
                    </div>
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Issues Section */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Report Issues</h2>
            <button
              onClick={() => setShowIssueForm(!showIssueForm)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {showIssueForm ? 'Cancel' : '+ Add Issue'}
            </button>
          </div>

          {showIssueForm && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Type
                </label>
                <select
                  value={currentIssue.type || ''}
                  onChange={(e) => setCurrentIssue(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select issue type</option>
                  {ISSUE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label} ({type.severity})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={currentIssue.description || ''}
                  onChange={(e) => setCurrentIssue(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the issue in detail..."
                />
              </div>
              <button
                onClick={addIssue}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                Add Issue
              </button>
            </div>
          )}

          {issues.length > 0 ? (
            <div className="space-y-2">
              {issues.map((issue, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg border flex items-start justify-between ${
                    issue.severity === 'major' 
                      ? 'bg-red-50 border-red-200' 
                      : issue.severity === 'moderate'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className={`w-4 h-4 ${
                        issue.severity === 'major' 
                          ? 'text-red-600' 
                          : issue.severity === 'moderate'
                          ? 'text-yellow-600'
                          : 'text-gray-600'
                      }`} />
                      <p className="font-medium text-sm text-gray-900">
                        {ISSUE_TYPES.find(t => t.value === issue.type)?.label}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        issue.severity === 'major' 
                          ? 'bg-red-100 text-red-700' 
                          : issue.severity === 'moderate'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 ml-6">{issue.description}</p>
                  </div>
                  <button
                    onClick={() => removeIssue(index)}
                    className="text-gray-400 hover:text-gray-600 ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p className="text-sm">No issues reported</p>
            </div>
          )}
        </div>

        {/* Additional Notes */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Notes</h2>
          <textarea
            value={verificationNotes}
            onChange={(e) => setVerificationNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add any additional notes about the pickup (optional)..."
          />
        </div>

        {/* Submit Button */}
        <div className="bg-white rounded-lg border p-6">
          <button
            onClick={handleSubmit}
            disabled={submitting || requiredPhotosCount < totalRequiredPhotos || !location}
            className="w-full bg-blue-600 text-white py-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Submitting Verification...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Complete Pickup Verification</span>
              </>
            )}
          </button>
          {(requiredPhotosCount < totalRequiredPhotos || !location) && (
            <p className="text-center text-sm text-gray-500 mt-3">
              {!location 
                ? 'Location verification required' 
                : `Capture ${totalRequiredPhotos - requiredPhotosCount} more required photo(s)`
              }
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
