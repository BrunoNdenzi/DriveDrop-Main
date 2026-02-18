'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileText, Upload, X, Check, AlertCircle, File } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProofOfOwnershipStepProps {
  shipmentData: any
  documents: string[]
  onDocumentsUpdate: (documents: string[]) => void
}

const DOCUMENT_TYPES = [
  {
    id: 'title',
    title: 'Vehicle Title',
    description: 'Original title or registration certificate',
    required: true,
    formats: ['PDF', 'JPG', 'PNG']
  },
  {
    id: 'registration',
    title: 'Registration',
    description: 'Current vehicle registration',
    required: false,
    formats: ['PDF', 'JPG', 'PNG']
  },
  {
    id: 'insurance',
    title: 'Insurance Card',
    description: 'Proof of insurance coverage',
    required: false,
    formats: ['PDF', 'JPG', 'PNG']
  },
  {
    id: 'id',
    title: 'Photo ID',
    description: "Driver's license or government ID",
    required: false,
    formats: ['PDF', 'JPG', 'PNG']
  },
]

export default function ProofOfOwnershipStep({ shipmentData, documents, onDocumentsUpdate }: ProofOfOwnershipStepProps) {
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return

    setUploading(true)
    try {
      // Convert files to base64 with metadata
      const docPromises = acceptedFiles.map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            // Store both data and filename
            const docData = {
              data: reader.result as string,
              name: file.name,
              type: file.type,
              size: file.size,
            }
            resolve(JSON.stringify(docData))
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      })

      const newDocs = await Promise.all(docPromises)
      onDocumentsUpdate([...documents, ...newDocs])
    } catch (error) {
      console.error('Error uploading documents:', error)
      alert('Failed to upload documents. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [documents, onDocumentsUpdate])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    multiple: true,
    maxSize: 15 * 1024 * 1024, // 15MB
  })

  const removeDocument = (index: number) => {
    const newDocs = documents.filter((_, i) => i !== index)
    onDocumentsUpdate(newDocs)
  }

  const getFileInfo = (docString: string) => {
    try {
      return JSON.parse(docString)
    } catch {
      return { name: 'Document', type: 'application/pdf', size: 0 }
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Document Requirements:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>At least one proof of ownership document is required (vehicle title)</li>
              <li>Ensure all documents are clear and readable</li>
              <li>Accepted formats: PDF, JPG, PNG (max 15MB per file)</li>
              <li>Personal information will be kept secure and confidential</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="bg-gray-50 rounded-md p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Vehicle Information:</h3>
        <p className="text-gray-700">
          {shipmentData.vehicleYear} {shipmentData.vehicleMake} {shipmentData.vehicleModel}
        </p>
        <p className="text-gray-600 text-sm mt-1">
          Owner: {shipmentData.customerName}
        </p>
      </div>

      {/* Document Types Guide */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Accepted Documents:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DOCUMENT_TYPES.map((docType) => (
            <div
              key={docType.id}
              className={`
                p-4 border-2 rounded-md
                ${docType.required 
                  ? 'border-blue-200 bg-blue-50' 
                  : 'border-gray-200 bg-gray-50'
                }
              `}
            >
              <div className="flex items-start gap-3">
                <FileText className={`h-5 w-5 mt-0.5 ${docType.required ? 'text-blue-500' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {docType.title}
                    </h4>
                    {docType.required && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {docType.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Formats: {docType.formats.join(', ')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
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
          <p className="text-blue-500 font-medium">Drop documents here...</p>
        ) : (
          <>
            <p className="text-gray-900 font-medium mb-2">
              Click to upload or drag and drop
            </p>
            <p className="text-sm text-gray-500">
              PDF, PNG or JPG (max. 15MB per file)
            </p>
          </>
        )}
      </div>

      {/* Uploaded Documents */}
      {documents.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              Uploaded Documents ({documents.length})
            </h3>
            {documents.length >= 1 && (
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-5 w-5" />
                <span className="text-sm font-medium">Ready to proceed</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {documents.map((doc, index) => {
              const fileInfo = getFileInfo(doc)
              const isPDF = fileInfo.type === 'application/pdf'
              
              return (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <div className={`p-3 rounded-md ${isPDF ? 'bg-red-100' : 'bg-blue-100'}`}>
                    <File className={`h-6 w-6 ${isPDF ? 'text-red-600' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {fileInfo.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(fileInfo.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeDocument(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gray-200 rounded-md">
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 text-sm mb-1">
              Your Documents Are Secure
            </h4>
            <p className="text-sm text-gray-600">
              All uploaded documents are encrypted and stored securely. We only use them to verify vehicle ownership and comply with legal requirements.
            </p>
          </div>
        </div>
      </div>

      {uploading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-sm text-gray-600 mt-2">Uploading documents...</p>
        </div>
      )}
    </div>
  )
}
