'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import {
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  AlertCircle,
  Mail,
  Handshake,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BrokerInvitation {
  id: string;
  broker_id: string;
  carrier_id: string;
  relationship_status: string;
  commission_rate: number;
  payment_terms: string | null;
  notes: string | null;
  invitation_accepted_at: string | null;
  created_at: string;
  broker: {
    id: string;
    company_name: string;
    company_email: string;
    company_phone: string;
    business_city: string;
    business_state: string;
    verification_status: string;
    total_shipments_completed: number;
    average_rating: number;
    default_commission_rate: number;
  };
}

export default function DriverInvitationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<BrokerInvitation[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'declined'>('all');

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Get all broker invitations for this driver
      const { data, error: fetchError } = await supabase
        .from('broker_carriers')
        .select('*, broker:broker_profiles!broker_id(*)')
        .eq('carrier_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setInvitations((data || []) as BrokerInvitation[]);
    } catch (err: any) {
      console.error('Error loading invitations:', err);
      setError(err.message || 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationId: string) => {
    setProcessing(invitationId);
    setError('');
    setSuccess('');

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from('broker_carriers')
        .update({
          relationship_status: 'active',
          invitation_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (updateError) throw updateError;
      setSuccess('Invitation accepted! You are now part of this broker network.');
      await loadInvitations();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
    } finally {
      setProcessing(null);
    }
  };

  const handleDecline = async (invitationId: string) => {
    if (!confirm('Are you sure you want to decline this invitation?')) return;
    
    setProcessing(invitationId);
    setError('');
    setSuccess('');

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from('broker_carriers')
        .update({
          relationship_status: 'terminated',
          termination_reason: 'Declined by driver',
          terminated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (updateError) throw updateError;
      setSuccess('Invitation declined.');
      await loadInvitations();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to decline invitation');
    } finally {
      setProcessing(null);
    }
  };

  const filteredInvitations = invitations.filter(inv => {
    if (filter === 'all') return true;
    if (filter === 'pending') return inv.relationship_status === 'pending';
    if (filter === 'active') return inv.relationship_status === 'active';
    if (filter === 'declined') return ['terminated', 'inactive', 'suspended'].includes(inv.relationship_status);
    return true;
  });

  const pendingCount = invitations.filter(i => i.relationship_status === 'pending').length;
  const activeCount = invitations.filter(i => i.relationship_status === 'active').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Handshake className="h-7 w-7 text-amber-500" />
          Broker Invitations
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage invitations from freight brokers to join their carrier network
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
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{invitations.length}</div>
          <div className="text-sm text-gray-500">Total Invitations</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-700">{pendingCount}</div>
          <div className="text-sm text-yellow-600">Pending</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">{activeCount}</div>
          <div className="text-sm text-green-600">Active Networks</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'active', 'declined'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === tab
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
            }`}
          >
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Invitations List */}
      {filteredInvitations.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <Mail className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No invitations</h3>
          <p className="text-sm text-gray-500 mt-1">
            {filter === 'all'
              ? "You haven't received any broker invitations yet."
              : `No ${filter} invitations.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInvitations.map(invitation => (
            <div
              key={invitation.id}
              className={`bg-white border rounded-lg p-5 transition-all ${
                invitation.relationship_status === 'pending'
                  ? 'border-yellow-300 shadow-sm'
                  : invitation.relationship_status === 'active'
                  ? 'border-green-200'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  {/* Broker Icon */}
                  <div className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${
                    invitation.relationship_status === 'active'
                      ? 'bg-green-100'
                      : invitation.relationship_status === 'pending'
                      ? 'bg-yellow-100'
                      : 'bg-gray-100'
                  }`}>
                    <Building2 className={`h-6 w-6 ${
                      invitation.relationship_status === 'active'
                        ? 'text-green-600'
                        : invitation.relationship_status === 'pending'
                        ? 'text-yellow-600'
                        : 'text-gray-400'
                    }`} />
                  </div>

                  {/* Details */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {invitation.broker?.company_name || 'Unknown Broker'}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        invitation.relationship_status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : invitation.relationship_status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {invitation.relationship_status === 'pending' && <Clock className="h-3 w-3" />}
                        {invitation.relationship_status === 'active' && <CheckCircle className="h-3 w-3" />}
                        {invitation.relationship_status === 'terminated' && <XCircle className="h-3 w-3" />}
                        {invitation.relationship_status}
                      </span>
                      {invitation.broker?.verification_status === 'verified' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                          <CheckCircle className="h-3 w-3" /> Verified
                        </span>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600">
                      {invitation.broker?.business_city && (
                        <div>{invitation.broker.business_city}, {invitation.broker.business_state}</div>
                      )}
                      {invitation.broker?.company_email && (
                        <div>{invitation.broker.company_email}</div>
                      )}
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                        Commission: {invitation.commission_rate}%
                      </div>
                      {invitation.broker?.total_shipments_completed > 0 && (
                        <div>{invitation.broker.total_shipments_completed} shipments completed</div>
                      )}
                    </div>

                    {invitation.payment_terms && (
                      <div className="mt-2 text-sm text-gray-500 flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        Terms: {invitation.payment_terms}
                      </div>
                    )}

                    {invitation.notes && (
                      <div className="mt-2 text-sm text-gray-500 italic">
                        &quot;{invitation.notes}&quot;
                      </div>
                    )}

                    <div className="mt-2 text-xs text-gray-400">
                      Invited {new Date(invitation.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      {invitation.invitation_accepted_at && (
                        <> · Accepted {new Date(invitation.invitation_accepted_at).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {invitation.relationship_status === 'pending' && (
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      onClick={() => handleAccept(invitation.id)}
                      disabled={processing === invitation.id}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {processing === invitation.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1.5" />
                          Accept
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDecline(invitation.id)}
                      disabled={processing === invitation.id}
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
