'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Camera, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { aiService, DocumentExtractionResponse } from '@/services/aiService'
import { cn } from '@/lib/utils'

interface AIDocumentUploadProps {
  onExtracted: (data: any) => void
  documentType?: 'registration' | 'title' | 'insurance' | 'bill_of_sale'
  className?: string
}

export default function AIDocumentUpload({
  onExtracted,
  documentType = 'registration',
  className
}: AIDocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<DocumentExtractionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [processingStage, setProcessingStage] = useState<'uploading' | 'extracting' | 'completed'>('uploading')

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setError(null)
    setResult(null)
    setIsProcessing(true)
    setProcessingStage('uploading')

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    try {
      // Simulate uploading stage
      await new Promise(resolve => setTimeout(resolve, 500))
      setProcessingStage('extracting')

      const extractedData = await aiService.extractDocument(file, documentType)
      setResult(extractedData)
      setProcessingStage('completed')

      if (extractedData.success && extractedData.data) {
        onExtracted(extractedData.data)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to extract document data')
      setProcessingStage('uploading')
    } finally {
      setIsProcessing(false)
    }
  }, [documentType, onExtracted])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  const handleClear = () => {
    setResult(null)
    setError(null)
    setPreview(null)
    setIsProcessing(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getDocumentTypeLabel = () => {
    switch (documentType) {
      case 'registration': return 'Vehicle Registration'
      case 'title': return 'Vehicle Title'
      case 'insurance': return 'Insurance Card'
      case 'bill_of_sale': return 'Bill of Sale'
      default: return 'Document'
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with AI badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-teal-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Upload {getDocumentTypeLabel()}
          </h3>
        </div>
        <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-teal-50 px-3 py-1.5 rounded-full border border-purple-200">
          <Sparkles className="h-4 w-4 text-purple-600" />
          <span className="text-xs font-semibold text-purple-700">AI Powered</span>
        </div>
      </div>

      {/* Upload Area */}
      {!preview && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'relative border-2 border-dashed rounded-xl p-8 transition-all duration-200 cursor-pointer hover:border-teal-400 hover:bg-teal-50/50',
            isDragging ? 'border-teal-500 bg-teal-50 scale-105' : 'border-gray-300 bg-gray-50',
            isProcessing && 'pointer-events-none opacity-60'
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-4">
            {isProcessing ? (
              <>
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
                  </div>
                  <div className="absolute -top-1 -right-1">
                    <Sparkles className="h-6 w-6 text-purple-500 animate-pulse" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-gray-900">
                    {processingStage === 'uploading' && 'Uploading document...'}
                    {processingStage === 'extracting' && '🤖 AI is extracting vehicle data...'}
                    {processingStage === 'completed' && 'Completed!'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    This usually takes 2-5 seconds
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-teal-100 flex items-center justify-center">
                  <Upload className="h-8 w-8 text-teal-600" />
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-gray-900">
                    Drop your {getDocumentTypeLabel().toLowerCase()} here
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    or click to browse files
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>JPG, PNG up to 10MB</span>
                  <span>•</span>
                  <span>AI will auto-fill vehicle details</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Preview with Result */}
      {preview && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border-2 border-gray-200">
            <img
              src={preview}
              alt="Document preview"
              className="w-full h-64 object-contain bg-gray-50"
            />
            <button
              onClick={handleClear}
              className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/* Success Result */}
          {result?.success && (
            <div className={cn(
              'rounded-xl p-6 border-2',
              result.requiresReview
                ? 'bg-amber-50 border-amber-200'
                : 'bg-green-50 border-green-200'
            )}>
              <div className="flex items-start gap-4">
                {result.requiresReview ? (
                  <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className={cn(
                      'font-semibold text-lg',
                      result.requiresReview ? 'text-amber-900' : 'text-green-900'
                    )}>
                      {result.requiresReview ? '⚠️ Please Review' : '✅ Data Extracted Successfully'}
                    </h4>
                    <p className={cn(
                      'text-sm mt-1',
                      result.requiresReview ? 'text-amber-700' : 'text-green-700'
                    )}>
                      Extracted with {(result.confidence * 100).toFixed(0)}% confidence
                    </p>
                  </div>

                  {result.data && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {result.data.year && (
                        <div>
                          <span className="text-gray-600">Year:</span>
                          <span className="ml-2 font-medium text-gray-900">{result.data.year}</span>
                        </div>
                      )}
                      {result.data.make && (
                        <div>
                          <span className="text-gray-600">Make:</span>
                          <span className="ml-2 font-medium text-gray-900">{result.data.make}</span>
                        </div>
                      )}
                      {result.data.model && (
                        <div>
                          <span className="text-gray-600">Model:</span>
                          <span className="ml-2 font-medium text-gray-900">{result.data.model}</span>
                        </div>
                      )}
                      {result.data.vin && (
                        <div>
                          <span className="text-gray-600">VIN:</span>
                          <span className="ml-2 font-mono text-xs font-medium text-gray-900">{result.data.vin}</span>
                        </div>
                      )}
                      {result.data.color && (
                        <div>
                          <span className="text-gray-600">Color:</span>
                          <span className="ml-2 font-medium text-gray-900">{result.data.color}</span>
                        </div>
                      )}
                      {result.data.licensePlate && (
                        <div>
                          <span className="text-gray-600">Plate:</span>
                          <span className="ml-2 font-medium text-gray-900">{result.data.licensePlate}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {result.requiresReview && result.lowConfidenceFields.length > 0 && (
                    <div className="text-sm text-amber-700 bg-amber-100 rounded-lg p-3">
                      <p className="font-medium">Low confidence fields:</p>
                      <p className="mt-1">{result.lowConfidenceFields.join(', ')}</p>
                    </div>
                  )}

                  <Button
                    onClick={handleClear}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    Upload Different Photo
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900">Upload Failed</h4>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <Button
                onClick={handleClear}
                variant="outline"
                size="sm"
                className="mt-3"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      {!preview && !isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <Camera className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Tips for best results:</p>
              <ul className="mt-2 space-y-1 text-blue-700 list-disc list-inside">
                <li>Ensure the entire document is visible</li>
                <li>Use good lighting (avoid shadows)</li>
                <li>Keep the document flat and in focus</li>
                <li>Avoid glare or reflections</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
