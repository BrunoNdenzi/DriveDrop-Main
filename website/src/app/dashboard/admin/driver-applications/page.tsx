'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { toast } from '@/components/ui/toast'
import { 
  Users,
  CheckCircle,
  XCircle,
  FileText,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Download,
  Eye,
  Clock,
  Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DriverApplication {
  id: string
  full_name: string
  email: string
  phone: string
  date_of_birth: string
  address: any // JSONB - {street, city, state, zipCode}
  
  // License Info
  license_number: string
  license_expiration: string
  license_state: string
  license_front_url: string | null
  license_back_url: string | null
  proof_of_address_url: string | null
  
  // Insurance Info
  insurance_provider: string
  insurance_policy_number: string
  insurance_expiration: string
  insurance_proof_url: string | null
  coverage_amount: string
  
  // Driving History
  has_suspensions: boolean
  has_criminal_record: boolean
  incident_description: string | null
  
  // Background Check
  background_check_status: string
  
  // Status
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
}

export default function AdminDriverApplicationsPage() {
  const [applications, setApplications] = useState<DriverApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [viewingDocs, setViewingDocs] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    fetchApplications()
  }, [filter])

  const fetchApplications = async () => {
    setLoading(true)
    try {
      console.log('[DriverApplications] Fetching with filter:', filter)
      
      let query = supabase
        .from('driver_applications')
        .select('*')
        .order('submitted_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      console.log('[DriverApplications] Query result:', { data, error, count: data?.length })

      if (error) throw error

      setApplications(data || [])
    } catch (error) {
      console.error('Error fetching applications:', error)
      toast('Failed to load applications', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (applicationId: string, email: string, fullName: string) => {
    const comment = prompt('Optional: Add a note for the driver (will be included in approval email):')
    
    if (!confirm(`Approve driver application for ${fullName}? This will:\n- Create a driver account\n- Send login credentials via email\n- Allow them to start accepting shipments`)) {
      return
    }

    setProcessing(applicationId)
    try {
      // Call API to approve application and create user account
      const response = await fetch(`/api/drivers/applications/${applicationId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminComment: comment }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve application')
      }

      toast('✅ Driver approved! Account created and welcome email sent.', 'success')
      fetchApplications()
    } catch (error: any) {
      console.error('Error approving application:', error)
      toast(error.message || 'Failed to approve application', 'error')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (applicationId: string) => {
    const reason = prompt('Rejection reason (will be sent to applicant):')
    
    if (!reason || !reason.trim()) {
      toast('Please provide a rejection reason', 'error')
      return
    }

    if (!confirm('Reject this driver application? The applicant will be notified via email.')) {
      return
    }

    setProcessing(applicationId)
    try {
      // Call API to reject application
      const response = await fetch(`/api/drivers/applications/${applicationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reject application')
      }

      toast('Application rejected and applicant notified', 'success')
      fetchApplications()
    } catch (error: any) {
      console.error('Error rejecting application:', error)
      toast(error.message || 'Failed to reject application', 'error')
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs font-medium px-2.5 py-1 rounded-full">
            <Clock className="h-3 w-3" />
            Pending Review
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
            <CheckCircle className="h-3 w-3" />
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        )
    }
  }

  const getBackgroundCheckBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="text-yellow-600 font-medium">⏳ Pending</span>
      case 'approved':
        return <span className="text-green-600 font-medium">✓ Cleared</span>
      case 'rejected':
        return <span className="text-red-600 font-medium">✗ Failed</span>
      default:
        return <span className="text-gray-600 font-medium">Not Started</span>
    }
  }

  const pendingCount = applications.filter(a => a.status === 'pending').length
  const approvedCount = applications.filter(a => a.status === 'approved').length
  const rejectedCount = applications.filter(a => a.status === 'rejected').length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Driver Applications</h1>
        <p className="text-gray-600 mt-1">Review and approve driver applications to join the platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-600 font-medium">Total Applications</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{applications.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600 font-medium">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-900 mt-1">{pendingCount}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-sm text-green-600 font-medium">Approved</p>
          <p className="text-2xl font-bold text-green-900 mt-1">{approvedCount}</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <p className="text-sm text-red-600 font-medium">Rejected</p>
          <p className="text-2xl font-bold text-red-900 mt-1">{rejectedCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 p-1 inline-flex">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === tab
                ? 'bg-orange-500 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {applications.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No {filter !== 'all' ? filter : ''} Applications
            </h3>
            <p className="text-gray-600">
              {filter === 'pending'
                ? 'No applications are waiting for review.'
                : `There are no ${filter} applications.`}
            </p>
          </div>
        ) : (
          applications.map((app) => (
            <div key={app.id} className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      {app.full_name}
                    </h3>
                    {getStatusBadge(app.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span>{app.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{app.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {app.address && typeof app.address === 'object' 
                          ? `${app.address.street}, ${app.address.city}, ${app.address.state} ${app.address.zipCode}`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>DOB: {new Date(app.date_of_birth).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm text-gray-600 mb-1">Submitted</p>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(app.submitted_at).toLocaleDateString()}
                  </p>
                  {app.reviewed_at && (
                    <>
                      <p className="text-sm text-gray-600 mt-2 mb-1">Reviewed</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(app.reviewed_at).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* License & Insurance */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">License & Insurance</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Driver's License:</span>{' '}
                    <span className="font-medium">{app.license_number} ({app.license_state})</span>
                    <br />
                    <span className="text-gray-600">Expires:</span>{' '}
                    <span className="font-medium">{new Date(app.license_expiration).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Insurance Provider:</span>{' '}
                    <span className="font-medium">{app.insurance_provider}</span>
                    <br />
                    <span className="text-gray-600">Policy:</span>{' '}
                    <span className="font-medium">{app.insurance_policy_number}</span>
                    <br />
                    <span className="text-gray-600">Expires:</span>{' '}
                    <span className="font-medium">{new Date(app.insurance_expiration).toLocaleDateString()}</span>
                    <br />
                    <span className="text-gray-600">Coverage:</span>{' '}
                    <span className="font-medium">${app.coverage_amount}</span>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Submitted Documents
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {app.license_front_url ? '✓' : '✗'} License Front
                    </span>
                    {app.license_front_url && (
                      <a
                        href={app.license_front_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {app.license_back_url ? '✓' : '✗'} License Back
                    </span>
                    {app.license_back_url && (
                      <a
                        href={app.license_back_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {app.insurance_proof_url ? '✓' : '✗'} Insurance Proof
                    </span>
                    {app.insurance_proof_url && (
                      <a
                        href={app.insurance_proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">
                      {app.proof_of_address_url ? '✓' : '✗'} Proof of Address
                    </span>
                    {app.proof_of_address_url && (
                      <a
                        href={app.proof_of_address_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Background Check */}
              <div className="flex items-center gap-2 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Shield className="h-5 w-5 text-gray-600" />
                <span className="text-sm text-gray-700 font-medium">Background Check Status:</span>
                {getBackgroundCheckBadge(app.background_check_status)}
              </div>

              {/* Rejection Reason (if rejected) */}
              {app.status === 'rejected' && app.rejection_reason && (
                <div className="bg-red-50 rounded-lg p-4 mb-4 border border-red-200">
                  <p className="text-sm font-semibold text-red-900 mb-1">Rejection Reason:</p>
                  <p className="text-sm text-red-700">{app.rejection_reason}</p>
                </div>
              )}

              {/* Actions */}
              {app.status === 'pending' && (
                <div className="border-t border-gray-200 pt-4 space-y-4">
                  {viewingDocs === app.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter rejection reason (required)..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        rows={3}
                      />
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={() => handleReject(app.id)}
                          disabled={!rejectionReason.trim() || processing === app.id}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {processing === app.id ? 'Rejecting...' : 'Confirm Rejection'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setViewingDocs(null)
                            setRejectionReason('')
                          }}
                          disabled={processing === app.id}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleApprove(app.id, app.email, app.full_name)}
                        disabled={processing === app.id}
                        className="bg-green-600 hover:bg-green-700 gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {processing === app.id ? 'Approving...' : 'Approve Application'}
                      </Button>
                      <Button
                        onClick={() => setViewingDocs(app.id)}
                        disabled={processing === app.id}
                        variant="outline"
                        className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
