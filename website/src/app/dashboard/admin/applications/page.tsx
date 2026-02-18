'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import Link from 'next/link'
import {
  UserCheck,
  CheckCircle,
  X,
  Calendar,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DriverApplication {
  id: string
  user_id: string
  status: string
  created_at: string
  license_number: string
  license_expiry: string
  vehicle_info: any
  insurance_info: any
  background_check_status: string
  admin_notes: string | null
  user?: {
    first_name: string
    last_name: string
    email: string
    phone: string
  }
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<DriverApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    fetchApplications()
  }, [filterStatus])

  const fetchApplications = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('driver_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query

      if (error) throw error
      setApplications(data || [])
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (applicationId: string, userId: string) => {
    if (!confirm('Are you sure you want to approve this driver application?')) return

    setProcessingId(applicationId)
    try {
      // Update application status
      const { error: appError } = await supabase
        .from('driver_applications')
        .update({ status: 'approved' })
        .eq('id', applicationId)

      if (appError) throw appError

      // Update user role to driver
      const { error: userError } = await supabase
        .from('profiles')
        .update({ role: 'driver' })
        .eq('id', userId)

      if (userError) throw userError

      alert('Application approved successfully!')
      fetchApplications()
    } catch (error) {
      console.error('Error approving application:', error)
      alert('Failed to approve application')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (applicationId: string) => {
    const reason = prompt('Please provide a reason for rejection:')
    if (!reason) return

    setProcessingId(applicationId)
    try {
      const { error } = await supabase
        .from('driver_applications')
        .update({
          status: 'rejected',
          admin_notes: reason
        })
        .eq('id', applicationId)

      if (error) throw error

      alert('Application rejected')
      fetchApplications()
    } catch (error) {
      console.error('Error rejecting application:', error)
      alert('Failed to reject application')
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Loading applications...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Driver Applications</h1>
          <p className="text-xs text-gray-500">{applications.length} applications</p>
        </div>
      </div>

      <div>
        {/* Filter Tabs */}
        <div className="bg-white rounded-md border border-gray-200 mb-4">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setFilterStatus('pending')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium ${
                filterStatus === 'pending'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium ${
                filterStatus === 'approved'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setFilterStatus('rejected')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium ${
                filterStatus === 'rejected'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Rejected
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-1 px-4 py-2.5 text-xs font-medium ${
                filterStatus === 'all'
                  ? 'border-b-2 border-purple-500 text-purple-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Applications List */}
        {applications.length === 0 ? (
          <div className="bg-white rounded-md border border-gray-200 p-8 text-center">
            <UserCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              No Applications Found
            </h3>
            <p className="text-gray-600">
              There are no {filterStatus !== 'all' ? filterStatus : ''} driver applications at this time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((application) => {
              const user = application.user

              return (
                <div
                  key={application.id}
                  className="bg-white rounded-md border border-gray-200 p-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    {/* Application Details */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 mb-1">
                            {user?.first_name} {user?.last_name}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(application.status)}`}>
                              {application.status.charAt(0).toUpperCase() + application.status.slice(1)}
                            </span>
                            <span className="text-xs text-gray-500">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              Applied {formatDate(application.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="h-4 w-4" />
                          {user?.email || 'N/A'}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4" />
                          {user?.phone || 'N/A'}
                        </div>
                      </div>

                      {/* License Info */}
                      <div className="bg-gray-50 rounded-md p-3 mb-3">
                        <h4 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5" />
                          License Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">License Number</p>
                            <p className="text-sm font-medium text-gray-900">
                              {application.license_number || 'Not provided'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Expiry Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {application.license_expiry ? formatDate(application.license_expiry) : 'Not provided'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Vehicle Info */}
                      {application.vehicle_info && (
                        <div className="bg-blue-50 rounded-md p-3 mb-3">
                          <h4 className="text-xs font-semibold text-gray-900 mb-2">
                            Vehicle Information
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {typeof application.vehicle_info === 'object' && (
                              <>
                                {application.vehicle_info.make && (
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Make</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {application.vehicle_info.make}
                                    </p>
                                  </div>
                                )}
                                {application.vehicle_info.model && (
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Model</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {application.vehicle_info.model}
                                    </p>
                                  </div>
                                )}
                                {application.vehicle_info.year && (
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Year</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {application.vehicle_info.year}
                                    </p>
                                  </div>
                                )}
                                {application.vehicle_info.plate && (
                                  <div>
                                    <p className="text-xs text-gray-600 mb-1">Plate</p>
                                    <p className="text-sm font-medium text-gray-900">
                                      {application.vehicle_info.plate}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Background Check Status */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium text-gray-700">Background Check:</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          application.background_check_status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : application.background_check_status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {application.background_check_status || 'Not Started'}
                        </span>
                      </div>

                      {/* Admin Notes */}
                      {application.admin_notes && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-3">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 mb-1">Admin Notes</p>
                              <p className="text-sm text-gray-700">{application.admin_notes}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {application.status === 'pending' && (
                      <div className="lg:w-44 flex flex-col gap-2">
                        <Button
                          onClick={() => handleApprove(application.id, application.user_id)}
                          disabled={processingId === application.id}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          {processingId === application.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Processing...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Approve
                            </>
                          )}
                        </Button>

                        <Button
                          onClick={() => handleReject(application.id)}
                          disabled={processingId === application.id}
                          variant="destructive"
                          className="w-full"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
