'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Camera, Upload, X, Check, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'

interface VehiclePhotosStepProps {
  shipmentData: any
  photos: string[]
  onPhotosUpdate: (photos: string[]) => void
}

const REQUIRED_ANGLES = [
  { id: 'front', label: 'Front View', required: true },
  { id: 'rear', label: 'Rear View', required: true },
  { id: 'left', label: 'Left Side', required: true },
  { id: 'right', label: 'Right Side', required: true },
  { id: 'interior', label: 'Interior', required: false },
  { id: 'damage', label: 'Any Damage', required: false },
]

export default function VehiclePhotosStep({ shipmentData, photos, onPhotosUpdate }: VehiclePhotosStepProps) {
  const [uploading, setUploading] = useState(false)
  const [selectedAngle, setSelectedAngle] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return

    setUploading(true)
    try {
      // Convert files to base64 for preview
      const photoPromises = acceptedFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      })

      const newPhotos = await Promise.all(photoPromises)
      onPhotosUpdate([...photos, ...newPhotos])
    } catch (error) {
      console.error('Error uploading photos:', error)
      alert('Failed to upload photos. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [photos, onPhotosUpdate])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.heic']
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
  })

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index)
    onPhotosUpdate(newPhotos)
  }

  const requiredCount = REQUIRED_ANGLES.filter(a => a.required).length

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Photo Requirements:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Take clear photos from all {requiredCount} required angles</li>
              <li>Ensure good lighting and focus</li>
              <li>Document any existing damage or scratches</li>
              <li>Photos will be used for pickup verification</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="bg-gray-50 rounded-md p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Vehicle Details:</h3>
        <p className="text-gray-700">
          {shipmentData.vehicleYear} {shipmentData.vehicleMake} {shipmentData.vehicleModel}
        </p>
        <p className="text-gray-600 text-sm mt-1">
          {shipmentData.vehicleType} • {shipmentData.isOperable ? 'Operable' : 'Non-Operable'}
        </p>
      </div>

      {/* Photo Guidelines */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {REQUIRED_ANGLES.map((angle) => (
          <div
            key={angle.id}
            className={`
              p-3 border-2 rounded-md transition-all
              ${angle.required ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'}
            `}
          >
            <div className="flex items-center gap-2">
              <Camera className={`h-4 w-4 ${angle.required ? 'text-blue-500' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${angle.required ? 'text-gray-900' : 'text-gray-600'}`}>
                {angle.label}
              </span>
              {angle.required && (
                <span className="text-xs text-blue-500">*</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-all
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
        `}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto mb-4 text-gray-400" />
        {isDragActive ? (
          <p className="text-blue-500 font-medium">Drop photos here...</p>
        ) : (
          <>
            <p className="text-gray-900 font-medium mb-2">
              Click to upload or drag and drop
            </p>
            <p className="text-sm text-gray-500">
              PNG, JPG or HEIC (max. 10MB per photo)
            </p>
          </>
        )}
      </div>

      {/* Photo Preview Grid */}
      {photos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              Uploaded Photos ({photos.length})
            </h3>
            {photos.length >= requiredCount && (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="text-sm font-medium">Minimum photos met</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-md overflow-hidden bg-gray-100 border-2 border-gray-200">
                  <Image
                    src={photo}
                    alt={`Vehicle photo ${index + 1}`}
                    width={300}
                    height={300}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="mt-2 text-center">
                  <span className="text-xs text-gray-500">Photo {index + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      <div className="bg-gray-50 rounded-md p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress:</span>
          <span className="text-sm font-semibold text-gray-900">
            {Math.min(photos.length, requiredCount)}/{requiredCount} required photos
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              photos.length >= requiredCount ? 'bg-green-600' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min((photos.length / requiredCount) * 100, 100)}%` }}
          />
        </div>
      </div>

      {uploading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Uploading photos...</p>
        </div>
      )}
    </div>
  )
}
