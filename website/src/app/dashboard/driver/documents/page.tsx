'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { toast } from '@/components/ui/toast'
import { OptimizedLink } from '@/components/ui/optimized-link'
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertTriangle,
  X,
  Loader2,
  ChevronLeft,
  Calendar,
  Download,
  Eye
} from 'lucide-react'

interface Document {
  id: string
  driver_id: string
  document_type: 'license' | 'insurance' | 'registration' | 'background_check' | 'other'
  file_url: string
  file_name: string
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  expiry_date?: string
  uploaded_at: string
  verified_at?: string
  notes?: string
}

const DOCUMENT_TYPES = [
  { value: 'license', label: "Driver's License", required: true },
  { value: 'insurance', label: 'Vehicle Insurance', required: true },
  { value: 'registration', label: 'Vehicle Registration', required: true },
  { value: 'background_check', label: 'Background Check', required: false },
  { value: 'other', label: 'Other Documents', required: false }
] as const

export default function DriverDocumentsPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [expiryDate, setExpiryDate] = useState('')
  const [showUploadForm, setShowUploadForm] = useState(false)

  useEffect(() => {
    if (profile) {
      fetchDocuments()
    }
  }, [profile])

  const fetchDocuments = async () => {
    if (!profile?.id) return

    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase
        .from('driver_documents')
        .select('*')
        .eq('driver_id', profile.id)
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
      // Don't show error if table doesn't exist yet
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      toast('Please upload PDF, JPG, or PNG files only', 'error')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast('File size must be less than 10MB', 'error')
      return
    }

    setSelectedFile(file)
  }

  const handleUpload = async () => {
    if (!selectedFile || !selectedType || !profile?.id) {
      toast('Please select document type and file', 'error')
      return
    }

    setUploading(true)
    try {
      const supabase = getSupabaseBrowserClient()

      // Upload file to storage
      const fileName = `${profile.id}_${selectedType}_${Date.now()}.${selectedFile.name.split('.').pop()}`
      const filePath = `driver-documents/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      // Create document record
      const { error: dbError } = await supabase
        .from('driver_documents')
        .insert({
          driver_id: profile.id,
          document_type: selectedType,
          file_url: publicUrl,
          file_name: selectedFile.name,
          status: 'pending',
          expiry_date: expiryDate || null,
          uploaded_at: new Date().toISOString()
        })

      if (dbError) throw dbError

      toast('Document uploaded successfully! Pending review.', 'success')
      
      // Reset form
      setSelectedFile(null)
      setSelectedType('')
      setExpiryDate('')
      setShowUploadForm(false)
      
      // Refresh documents
      fetchDocuments()
    } catch (error: any) {
      console.error('Error uploading document:', error)
      toast(error.message || 'Failed to upload document', 'error')
    } finally {
      setUploading(false)
    }
  }

  const deleteDocument = async (docId: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const supabase = getSupabaseBrowserClient()

      // Delete from database
      const { error: dbError } = await supabase
        .from('driver_documents')
        .delete()
        .eq('id', docId)

      if (dbError) throw dbError

      // Delete from storage
      const filePath = fileUrl.split('/documents/')[1]
      if (filePath) {
        await supabase.storage
          .from('documents')
          .remove([filePath])
      }

      toast('Document deleted', 'success')
      setDocuments(prev => prev.filter(d => d.id !== docId))
    } catch (error: any) {
      console.error('Error deleting document:', error)
      toast(error.message || 'Failed to delete document', 'error')
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      expired: 'bg-gray-100 text-gray-700'
    }
    return styles[status as keyof typeof styles] || styles.pending
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4" />
      case 'rejected':
      case 'expired':
        return <AlertTriangle className="w-4 h-4" />
      default:
        return <Loader2 className="w-4 h-4 animate-spin" />
    }
  }

  const isDocumentExpired = (expiryDate?: string) => {
    if (!expiryDate) return false
    return new Date(expiryDate) < new Date()
  }

  const getDocumentsByType = (type: string) => {
    return documents.filter(doc => doc.document_type === type)
  }

  const hasRequiredDocuments = () => {
    return DOCUMENT_TYPES
      .filter(t => t.required)
      .every(type => {
        const docs = getDocumentsByType(type.value)
        return docs.some(d => d.status === 'approved' && !isDocumentExpired(d.expiry_date))
      })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <OptimizedLink 
                href="/dashboard/driver"
                className="text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-6 h-6" />
              </OptimizedLink>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Documents</h1>
                <p className="text-sm text-gray-600">Upload and manage your documents</p>
              </div>
            </div>
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Document</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Status Alert */}
        {!hasRequiredDocuments() && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900">Required Documents Missing</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Please upload and get approval for all required documents to continue receiving job offers.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Form */}
        {showUploadForm && (
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Upload New Document</h2>
              <button
                onClick={() => setShowUploadForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Type *
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select document type</option>
                  {DOCUMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label} {type.required && '(Required)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File (PDF, JPG, PNG - Max 10MB) *
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {selectedFile && (
                  <p className="text-sm text-gray-600 mt-1">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              {['license', 'insurance', 'registration'].includes(selectedType) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !selectedType}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload Document</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Documents by Type */}
        {DOCUMENT_TYPES.map(type => {
          const typeDocs = getDocumentsByType(type.value)
          const hasApproved = typeDocs.some(d => d.status === 'approved' && !isDocumentExpired(d.expiry_date))

          return (
            <div key={type.value} className="bg-white rounded-lg border">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{type.label}</h3>
                      {type.required && (
                        <span className="text-xs text-red-600">Required</span>
                      )}
                    </div>
                  </div>
                  {hasApproved ? (
                    <span className="flex items-center space-x-1 text-sm text-green-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approved</span>
                    </span>
                  ) : type.required ? (
                    <span className="flex items-center space-x-1 text-sm text-yellow-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Required</span>
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="p-4">
                {typeDocs.length > 0 ? (
                  <div className="space-y-3">
                    {typeDocs.map(doc => {
                      const expired = isDocumentExpired(doc.expiry_date)
                      return (
                        <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <p className="font-medium text-gray-900">{doc.file_name}</p>
                              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(expired ? 'expired' : doc.status)}`}>
                                {getStatusIcon(expired ? 'expired' : doc.status)}
                                <span>{expired ? 'Expired' : doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}</span>
                              </span>
                            </div>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                              </span>
                              {doc.expiry_date && (
                                <span className={`flex items-center space-x-1 ${expired ? 'text-red-600' : ''}`}>
                                  <Calendar className="w-3 h-3" />
                                  <span>Expires: {new Date(doc.expiry_date).toLocaleDateString()}</span>
                                </span>
                              )}
                            </div>
                            {doc.notes && (
                              <p className="text-sm text-gray-600 mt-1">Note: {doc.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="View document"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => deleteDocument(doc.id, doc.file_url)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete document"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">No {type.label.toLowerCase()} uploaded</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Click "Upload Document" to add your {type.label.toLowerCase()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {documents.length === 0 && (
          <div className="bg-white rounded-lg border p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Documents Uploaded</h3>
            <p className="text-gray-600 mb-4">
              Upload your required documents to start receiving delivery jobs
            </p>
            <button
              onClick={() => setShowUploadForm(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Your First Document</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
