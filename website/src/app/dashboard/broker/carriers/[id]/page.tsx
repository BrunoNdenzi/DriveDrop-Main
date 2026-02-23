'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { brokerCarrierService, brokerProfileService } from '@/services/brokerService';
import type { BrokerProfile } from '@/types/broker';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Star,
  Truck,
  Calendar,
  DollarSign,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit2,
  Save,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface CarrierDetail {
  id: string;
  broker_id: string;
  carrier_id: string;
  relationship_status: string;
  commission_rate: number;
  payment_terms: string;
  notes: string;
  invited_by: string;
  invitation_accepted_at: string | null;
  total_shipments_completed: number;
  total_revenue_generated: number;
  average_rating: number;
  created_at: string;
  carrier: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    phone: string;
    avatar_url: string | null;
    rating: number;
    is_verified: boolean;
    role: string;
  };
}

interface CarrierShipment {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  estimated_price: number;
  created_at: string;
  completed_at: string | null;
}

export default function CarrierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const carrierId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [carrier, setCarrier] = useState<CarrierDetail | null>(null);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [shipments, setShipments] = useState<CarrierShipment[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit mode
  const [editingCommission, setEditingCommission] = useState(false);
  const [editCommissionRate, setEditCommissionRate] = useState('');
  const [editPaymentTerms, setEditPaymentTerms] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCarrierData();
  }, [carrierId]);

  const loadCarrierData = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // Get broker profile
      const brokerProfile = await brokerProfileService.getByProfileId(user.id);
      setBroker(brokerProfile);

      // Get carrier relationship by ID
      const { data: carrierData, error: carrierError } = await supabase
        .from('broker_carriers')
        .select('*, carrier:profiles!carrier_id(*)')
        .eq('id', carrierId)
        .eq('broker_id', brokerProfile.id)
        .single();

      if (carrierError) throw carrierError;
      setCarrier(carrierData as CarrierDetail);

      // Populate edit fields
      setEditCommissionRate(carrierData.commission_rate?.toString() || '25');
      setEditPaymentTerms(carrierData.payment_terms || '');
      setEditNotes(carrierData.notes || '');

      // Load shipments assigned to this carrier
      const { data: shipmentsData } = await supabase
        .from('broker_shipments')
        .select('*')
        .eq('broker_id', user.id)
        .eq('assigned_carrier_id', carrierData.carrier_id)
        .order('created_at', { ascending: false })
        .limit(20);

      setShipments((shipmentsData || []) as CarrierShipment[]);
    } catch (err: any) {
      console.error('Error loading carrier:', err);
      setError(err.message || 'Failed to load carrier details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!carrier) return;
    setSaving(true);
    setError('');

    try {
      await brokerCarrierService.update(carrier.id, {
        commission_rate: parseFloat(editCommissionRate),
        payment_terms: editPaymentTerms,
        notes: editNotes,
      });
      setSuccess('Carrier details updated successfully');
      setEditingCommission(false);
      setTimeout(() => setSuccess(''), 3000);
      await loadCarrierData();
    } catch (err: any) {
      setError(err.message || 'Failed to update carrier');
    } finally {
      setSaving(false);
    }
  };

  const handleTerminate = async () => {
    if (!carrier) return;
    if (!confirm('Are you sure you want to terminate this carrier relationship? This action cannot be undone.')) return;

    try {
      await brokerCarrierService.terminate(carrier.id, 'Terminated by broker');
      setSuccess('Carrier relationship terminated');
      setTimeout(() => router.push('/dashboard/broker/carriers'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to terminate relationship');
    }
  };

  const handleActivate = async () => {
    if (!carrier) return;
    try {
      await brokerCarrierService.acceptInvitation(carrier.id);
      setSuccess('Carrier activated successfully');
      setTimeout(() => setSuccess(''), 3000);
      await loadCarrierData();
    } catch (err: any) {
      setError(err.message || 'Failed to activate carrier');
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      pending: { bg: 'bg-yellow-100 border-yellow-200', text: 'text-yellow-800', icon: <Clock className="h-4 w-4" /> },
      active: { bg: 'bg-green-100 border-green-200', text: 'text-green-800', icon: <CheckCircle className="h-4 w-4" /> },
      inactive: { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-600', icon: <AlertCircle className="h-4 w-4" /> },
      suspended: { bg: 'bg-red-100 border-red-200', text: 'text-red-800', icon: <XCircle className="h-4 w-4" /> },
      terminated: { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-600', icon: <XCircle className="h-4 w-4" /> },
    };
    return configs[status] || configs.pending;
  };

  const getShipmentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending_quote: 'bg-gray-100 text-gray-700',
      quoted: 'bg-blue-100 text-blue-700',
      accepted: 'bg-teal-100 text-teal-700',
      assigned: 'bg-purple-100 text-purple-700',
      picked_up: 'bg-orange-100 text-orange-700',
      in_transit: 'bg-blue-100 text-blue-700',
      delivered: 'bg-green-100 text-green-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading carrier details...</p>
        </div>
      </div>
    );
  }

  if (!carrier) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Carrier Not Found</h2>
        <p className="text-gray-600 mb-4">This carrier relationship doesn&apos;t exist or you don&apos;t have access.</p>
        <Link href="/dashboard/broker/carriers">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Carriers
          </Button>
        </Link>
      </div>
    );
  }

  const statusConfig = getStatusBadge(carrier.relationship_status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/broker/carriers">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Carriers
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Carrier Details</h1>
            <p className="text-sm text-gray-500">Manage carrier relationship and view performance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {carrier.relationship_status === 'pending' && (
            <Button onClick={handleActivate} className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle className="h-4 w-4 mr-2" />
              Activate Carrier
            </Button>
          )}
          {carrier.relationship_status === 'active' && (
            <Button onClick={handleTerminate} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
              <XCircle className="h-4 w-4 mr-2" />
              Terminate
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Carrier Profile Card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-md border border-gray-200 p-6">
            <div className="text-center mb-6">
              <div className="h-20 w-20 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-3">
                {carrier.carrier?.avatar_url ? (
                  <img src={carrier.carrier.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-teal-600">
                    {carrier.carrier?.first_name?.charAt(0) || carrier.carrier?.email?.charAt(0)?.toUpperCase() || 'C'}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {carrier.carrier?.first_name && carrier.carrier?.last_name
                  ? `${carrier.carrier.first_name} ${carrier.carrier.last_name}`
                  : carrier.carrier?.full_name || 'Unknown Carrier'}
              </h2>
              <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.bg} ${statusConfig.text}`}>
                {statusConfig.icon}
                {carrier.relationship_status}
              </div>
            </div>

            <div className="space-y-3">
              {carrier.carrier?.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700 truncate">{carrier.carrier.email}</span>
                </div>
              )}
              {carrier.carrier?.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">{carrier.carrier.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Shield className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-700">
                  {carrier.carrier?.is_verified ? '✅ Verified Driver' : '⏳ Pending Verification'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-700">
                  Added {new Date(carrier.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Performance Stats */}
          <div className="bg-white rounded-md border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Performance</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-md">
                <Package className="h-5 w-5 text-teal-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-gray-900">{carrier.total_shipments_completed}</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-md">
                <Star className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-gray-900">
                  {carrier.average_rating > 0 ? carrier.average_rating.toFixed(1) : 'N/A'}
                </p>
                <p className="text-xs text-gray-500">Rating</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-md">
                <DollarSign className="h-5 w-5 text-green-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-gray-900">
                  ${(carrier.total_revenue_generated || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Revenue</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-md">
                <Truck className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-gray-900">{shipments.length}</p>
                <p className="text-xs text-gray-500">Assignments</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Commission & Terms */}
          <div className="bg-white rounded-md border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Commission & Terms</h3>
              {!editingCommission ? (
                <Button variant="ghost" size="sm" onClick={() => setEditingCommission(true)}>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditingCommission(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveChanges} disabled={saving} className="bg-teal-500 hover:bg-teal-600 text-white">
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              )}
            </div>

            {editingCommission ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate (%)</label>
                  <input
                    type="number"
                    value={editCommissionRate}
                    onChange={(e) => setEditCommissionRate(e.target.value)}
                    min="0"
                    max="100"
                    step="0.5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={editPaymentTerms}
                    onChange={(e) => setEditPaymentTerms(e.target.value)}
                    placeholder="e.g., Net 7, Upon delivery"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-teal-50 rounded-md">
                  <p className="text-xs text-gray-500 mb-1">Commission Rate</p>
                  <p className="text-lg font-bold text-teal-700">{carrier.commission_rate}%</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="text-xs text-gray-500 mb-1">Payment Terms</p>
                  <p className="text-sm font-medium text-gray-900">{carrier.payment_terms || 'Not set'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-md">
                  <p className="text-xs text-gray-500 mb-1">Invite Status</p>
                  <p className="text-sm font-medium text-gray-900">
                    {carrier.invitation_accepted_at
                      ? `Accepted ${new Date(carrier.invitation_accepted_at).toLocaleDateString()}`
                      : carrier.invited_by === 'broker'
                      ? 'Pending acceptance'
                      : 'Invited by carrier'}
                  </p>
                </div>
                {carrier.notes && (
                  <div className="md:col-span-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-xs text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-700">{carrier.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Shipments */}
          <div className="bg-white rounded-md border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Recent Shipments</h3>
            {shipments.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No shipments assigned to this carrier yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {shipments.map((shipment) => (
                  <div key={shipment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
                        </p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getShipmentStatusColor(shipment.status)}`}>
                          {shipment.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{shipment.pickup_address}</span>
                        <span className="mx-1">→</span>
                        <span className="truncate">{shipment.delivery_address}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold text-gray-900">${shipment.estimated_price?.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{new Date(shipment.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
