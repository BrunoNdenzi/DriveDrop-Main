'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import {
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Search,
  Shield,
  Users,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Truck,
  DollarSign,
  Eye,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BrokerProfile {
  id: string;
  profile_id: string;
  company_name: string;
  dba_name: string | null;
  company_email: string;
  company_phone: string;
  dot_number: string | null;
  mc_number: string | null;
  verification_status: string;
  business_city: string;
  business_state: string;
  default_commission_rate: number;
  total_shipments_completed: number;
  total_revenue_generated: number;
  average_rating: number;
  total_carriers: number;
  active_carriers: number;
  account_status: string;
  created_at: string;
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    is_verified: boolean;
  };
}

interface ChangeRequest {
  id: string;
  broker_id: string;
  changes: Record<string, { old_value: string; new_value: string }>;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  broker: {
    company_name: string;
  };
}

export default function AdminBrokersPage() {
  const [loading, setLoading] = useState(true);
  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tab, setTab] = useState<'brokers' | 'requests'>('brokers');
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedBroker, setExpandedBroker] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const supabase = getSupabaseBrowserClient();

      // Load all broker profiles with their user profiles
      const { data: brokerData, error: brokerError } = await supabase
        .from('broker_profiles')
        .select('*, profile:profiles!profile_id(*)')
        .order('created_at', { ascending: false });

      if (brokerError) throw brokerError;
      setBrokers((brokerData || []) as BrokerProfile[]);

      // Load pending change requests
      const { data: requestData, error: requestError } = await supabase
        .from('broker_change_requests')
        .select('*, broker:broker_profiles!broker_id(company_name)')
        .order('created_at', { ascending: false });

      if (!requestError) {
        setChangeRequests((requestData || []) as ChangeRequest[]);
      }
    } catch (err: any) {
      console.error('Error loading broker data:', err);
      setError(err.message || 'Failed to load broker data');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBroker = async (brokerId: string, newStatus: string) => {
    setProcessing(brokerId);
    setError('');

    try {
      const supabase = getSupabaseBrowserClient();
      const update: Record<string, any> = {
        verification_status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'verified') {
        update.verified_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('broker_profiles')
        .update(update)
        .eq('id', brokerId);

      if (updateError) throw updateError;
      setSuccess(`Broker ${newStatus} successfully`);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update broker');
    } finally {
      setProcessing(null);
    }
  };

  const handleSuspendBroker = async (brokerId: string) => {
    if (!confirm('Are you sure you want to suspend this broker? They will lose access to broker features.')) return;
    setProcessing(brokerId);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from('broker_profiles')
        .update({
          account_status: 'suspended',
          suspension_reason: adminNotes || 'Suspended by admin',
          suspended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', brokerId);

      if (updateError) throw updateError;
      setSuccess('Broker suspended');
      setAdminNotes('');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to suspend broker');
    } finally {
      setProcessing(null);
    }
  };

  const handleReactivateBroker = async (brokerId: string) => {
    setProcessing(brokerId);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from('broker_profiles')
        .update({
          account_status: 'active',
          suspension_reason: null,
          suspended_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', brokerId);

      if (updateError) throw updateError;
      setSuccess('Broker reactivated');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reactivate broker');
    } finally {
      setProcessing(null);
    }
  };

  const handleChangeRequest = async (requestId: string, action: 'approved' | 'rejected') => {
    setProcessing(requestId);
    setError('');

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { error: updateError } = await supabase
        .from('broker_change_requests')
        .update({
          status: action,
          admin_notes: adminNotes || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // If approved, apply the changes to broker_profiles
      if (action === 'approved') {
        const request = changeRequests.find(r => r.id === requestId);
        if (request?.changes) {
          const updates: Record<string, any> = { updated_at: new Date().toISOString() };
          for (const [field, change] of Object.entries(request.changes)) {
            updates[field] = change.new_value;
          }
          
          await supabase
            .from('broker_profiles')
            .update(updates)
            .eq('id', request.broker_id);
        }
      }

      setSuccess(`Change request ${action}`);
      setAdminNotes('');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || `Failed to ${action} change request`);
    } finally {
      setProcessing(null);
    }
  };

  // Filtered brokers
  const filteredBrokers = brokers.filter(b => {
    const matchesSearch = !searchTerm || 
      b.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.company_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || b.verification_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingRequests = changeRequests.filter(r => r.status === 'pending');

  const getVerificationBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      pending: { bg: 'bg-yellow-100 text-yellow-800', text: 'Pending', icon: <Clock className="h-3 w-3" /> },
      documents_submitted: { bg: 'bg-blue-100 text-blue-800', text: 'Docs Submitted', icon: <FileText className="h-3 w-3" /> },
      under_review: { bg: 'bg-purple-100 text-purple-800', text: 'Under Review', icon: <Eye className="h-3 w-3" /> },
      verified: { bg: 'bg-green-100 text-green-800', text: 'Verified', icon: <CheckCircle className="h-3 w-3" /> },
      rejected: { bg: 'bg-red-100 text-red-800', text: 'Rejected', icon: <XCircle className="h-3 w-3" /> },
      suspended: { bg: 'bg-gray-100 text-gray-800', text: 'Suspended', icon: <AlertCircle className="h-3 w-3" /> },
    };
    return map[status] || map.pending;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Building2 className="h-7 w-7 text-purple-600" />
          Broker Management
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage broker accounts, verify credentials, and review change requests
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{brokers.length}</div>
          <div className="text-sm text-gray-500">Total Brokers</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">
            {brokers.filter(b => b.verification_status === 'verified').length}
          </div>
          <div className="text-sm text-green-600">Verified</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-700">
            {brokers.filter(b => ['pending', 'documents_submitted', 'under_review'].includes(b.verification_status)).length}
          </div>
          <div className="text-sm text-yellow-600">Pending Review</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-700">{pendingRequests.length}</div>
          <div className="text-sm text-purple-600">Change Requests</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab('brokers')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'brokers'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 className="h-4 w-4 inline mr-1.5" />
          Brokers ({brokers.length})
        </button>
        <button
          onClick={() => setTab('requests')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'requests'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4 inline mr-1.5" />
          Change Requests
          {pendingRequests.length > 0 && (
            <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Brokers Tab */}
      {tab === 'brokers' && (
        <div>
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search by company name or email..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="documents_submitted">Docs Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          {/* Broker List */}
          {filteredBrokers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No brokers found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBrokers.map(broker => {
                const badge = getVerificationBadge(broker.verification_status);
                const isExpanded = expandedBroker === broker.id;

                return (
                  <div key={broker.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {/* Summary Row */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedBroker(isExpanded ? null : broker.id)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{broker.company_name}</h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg}`}>
                              {badge.icon} {badge.text}
                            </span>
                            {broker.account_status === 'suspended' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                <AlertCircle className="h-3 w-3" /> Suspended
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-0.5">
                            {broker.profile?.first_name} {broker.profile?.last_name} · {broker.company_email} · {broker.business_city}, {broker.business_state}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="text-center">
                          <div className="font-medium text-gray-900">{broker.total_carriers}</div>
                          <div className="text-xs">Carriers</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-gray-900">{broker.total_shipments_completed}</div>
                          <div className="text-xs">Shipments</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-gray-900">${(broker.total_revenue_generated || 0).toLocaleString()}</div>
                          <div className="text-xs">Revenue</div>
                        </div>
                        {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 p-4 bg-gray-50">
                        <div className="grid grid-cols-3 gap-6">
                          {/* Business Info */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Business Details</h4>
                            <div className="space-y-1 text-sm text-gray-600">
                              {broker.dba_name && <div>DBA: {broker.dba_name}</div>}
                              <div>DOT#: {broker.dot_number || 'N/A'}</div>
                              <div>MC#: {broker.mc_number || 'N/A'}</div>
                              <div>Phone: {broker.company_phone}</div>
                              <div>Commission: {broker.default_commission_rate}%</div>
                            </div>
                          </div>

                          {/* Performance */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Performance</h4>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Star className="h-3.5 w-3.5 text-yellow-500" />
                                Rating: {broker.average_rating || 'N/A'}
                              </div>
                              <div>{broker.active_carriers} active / {broker.total_carriers} total carriers</div>
                              <div>{broker.total_shipments_completed} shipments completed</div>
                              <div>Joined {new Date(broker.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Actions</h4>
                            <div className="space-y-2">
                              {['pending', 'documents_submitted', 'under_review'].includes(broker.verification_status) && (
                                <Button
                                  onClick={() => handleVerifyBroker(broker.id, 'verified')}
                                  disabled={processing === broker.id}
                                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                                  size="sm"
                                >
                                  {processing === broker.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-1.5" />
                                      Verify Broker
                                    </>
                                  )}
                                </Button>
                              )}
                              {['pending', 'documents_submitted', 'under_review'].includes(broker.verification_status) && (
                                <Button
                                  onClick={() => handleVerifyBroker(broker.id, 'rejected')}
                                  disabled={processing === broker.id}
                                  variant="outline"
                                  className="w-full text-red-600 border-red-300 hover:bg-red-50"
                                  size="sm"
                                >
                                  <XCircle className="h-4 w-4 mr-1.5" />
                                  Reject
                                </Button>
                              )}
                              {broker.account_status === 'active' && (
                                <Button
                                  onClick={() => handleSuspendBroker(broker.id)}
                                  disabled={processing === broker.id}
                                  variant="outline"
                                  className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                                  size="sm"
                                >
                                  <AlertCircle className="h-4 w-4 mr-1.5" />
                                  Suspend Account
                                </Button>
                              )}
                              {broker.account_status === 'suspended' && (
                                <Button
                                  onClick={() => handleReactivateBroker(broker.id)}
                                  disabled={processing === broker.id}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                  size="sm"
                                >
                                  <Shield className="h-4 w-4 mr-1.5" />
                                  Reactivate
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Change Requests Tab */}
      {tab === 'requests' && (
        <div>
          {changeRequests.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No change requests</p>
              <p className="text-sm text-gray-400 mt-1">Broker field change requests will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {changeRequests.map(request => (
                <div
                  key={request.id}
                  className={`bg-white border rounded-lg p-5 ${
                    request.status === 'pending'
                      ? 'border-yellow-300'
                      : request.status === 'approved'
                      ? 'border-green-200'
                      : 'border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          {request.broker?.company_name || 'Unknown Broker'}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          request.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : request.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {request.status === 'pending' && <Clock className="h-3 w-3" />}
                          {request.status === 'approved' && <CheckCircle className="h-3 w-3" />}
                          {request.status === 'rejected' && <XCircle className="h-3 w-3" />}
                          {request.status}
                        </span>
                      </div>

                      {/* Changes Detail */}
                      <div className="space-y-2 mb-3">
                        {Object.entries(request.changes).map(([field, change]) => (
                          <div key={field} className="text-sm">
                            <span className="font-medium text-gray-700">{field.replace(/_/g, ' ')}:</span>
                            <div className="ml-4 flex items-center gap-2">
                              <span className="line-through text-red-500">{change.old_value || '(empty)'}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-600 font-medium">{change.new_value}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {request.reason && (
                        <div className="text-sm text-gray-500 italic mb-2">
                          Reason: &quot;{request.reason}&quot;
                        </div>
                      )}

                      <div className="text-xs text-gray-400">
                        Submitted {new Date(request.created_at).toLocaleDateString('en-US', {
                          month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                        {request.reviewed_at && (
                          <> · Reviewed {new Date(request.reviewed_at).toLocaleDateString()}</>
                        )}
                      </div>

                      {request.admin_notes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                          Admin notes: {request.admin_notes}
                        </div>
                      )}
                    </div>

                    {/* Actions for pending requests */}
                    {request.status === 'pending' && (
                      <div className="ml-4 space-y-2">
                        <input
                          type="text"
                          value={adminNotes}
                          onChange={e => setAdminNotes(e.target.value)}
                          placeholder="Admin notes (optional)"
                          className="w-48 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleChangeRequest(request.id, 'approved')}
                            disabled={processing === request.id}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                          >
                            {processing === request.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Approve
                              </>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleChangeRequest(request.id, 'rejected')}
                            disabled={processing === request.id}
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                            size="sm"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
