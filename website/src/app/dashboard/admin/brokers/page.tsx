'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Package,
  TrendingUp,
  ArrowRightLeft,
  CreditCard,
  BarChart3,
  MapPin,
  Calendar,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Interfaces ──────────────────────────────────────────────────────
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
  platform_fee_rate: number;
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
  broker: { company_name: string };
}

interface BrokerShipment {
  id: string;
  broker_id: string;
  client_name: string;
  client_email: string;
  pickup_city: string;
  pickup_state: string;
  delivery_city: string;
  delivery_state: string;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_type: string;
  estimated_price: number;
  broker_commission: number;
  platform_fee: number;
  distance_miles: number;
  status: string;
  assigned_carrier_id: string | null;
  load_board_id: string | null;
  created_at: string;
  booked_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
}

interface BrokerAssignment {
  id: string;
  shipment_id: string;
  broker_id: string;
  carrier_id: string | null;
  assignment_status: string;
  assignment_type: string;
  total_amount: number;
  carrier_payout: number;
  broker_commission: number;
  platform_fee: number;
  commission_rate: number;
  pickup_on_time: boolean | null;
  delivery_on_time: boolean | null;
  customer_rating: number | null;
  assigned_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  broker_profile: { company_name: string } | null;
  carrier_profile: { first_name: string; last_name: string } | null;
}

interface BrokerPayout {
  id: string;
  broker_id: string;
  shipment_id: string;
  payout_status: string;
  payout_amount: number;
  commission_rate: number;
  payment_method: string | null;
  processed_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  broker_profile: { company_name: string } | null;
}

interface CarrierRelationship {
  id: string;
  broker_id: string;
  carrier_id: string;
  relationship_status: string;
  commission_rate: number;
  payment_terms: string | null;
  total_shipments_completed: number;
  total_revenue_generated: number;
  average_rating: number;
  on_time_delivery_rate: number;
  last_shipment_date: string | null;
  created_at: string;
  broker_profile: { company_name: string } | null;
  carrier_profile: { first_name: string; last_name: string; email: string } | null;
}

type Tab = 'brokers' | 'shipments' | 'assignments' | 'carriers' | 'payouts' | 'requests';

// ─── Component ───────────────────────────────────────────────────────
export default function AdminBrokersPage() {
  const [loading, setLoading] = useState(true);
  const [brokers, setBrokers] = useState<BrokerProfile[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [shipments, setShipments] = useState<BrokerShipment[]>([]);
  const [assignments, setAssignments] = useState<BrokerAssignment[]>([]);
  const [payouts, setPayouts] = useState<BrokerPayout[]>([]);
  const [carrierRelationships, setCarrierRelationships] = useState<CarrierRelationship[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tab, setTab] = useState<Tab>('brokers');
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedBroker, setExpandedBroker] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowserClient();

      // Load all data in parallel
      const [brokersRes, requestsRes, shipmentsRes, assignmentsRes, payoutsRes, carriersRes] =
        await Promise.all([
          supabase
            .from('broker_profiles')
            .select('*, profile:profiles!profile_id(*)')
            .order('created_at', { ascending: false }),
          supabase
            .from('broker_change_requests')
            .select('*, broker:broker_profiles!broker_id(company_name)')
            .order('created_at', { ascending: false }),
          supabase
            .from('broker_shipments')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('broker_assignments')
            .select('*, broker_profile:broker_profiles!broker_id(company_name), carrier_profile:profiles!carrier_id(first_name, last_name)')
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('broker_payouts')
            .select('*, broker_profile:broker_profiles!broker_id(company_name)')
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('broker_carriers')
            .select('*, broker_profile:broker_profiles!broker_id(company_name), carrier_profile:profiles!carrier_id(first_name, last_name, email)')
            .order('created_at', { ascending: false })
            .limit(500),
        ]);

      if (brokersRes.error) throw brokersRes.error;
      setBrokers((brokersRes.data || []) as BrokerProfile[]);
      if (!requestsRes.error) setChangeRequests((requestsRes.data || []) as ChangeRequest[]);
      if (!shipmentsRes.error) setShipments((shipmentsRes.data || []) as BrokerShipment[]);
      if (!assignmentsRes.error) setAssignments((assignmentsRes.data || []) as BrokerAssignment[]);
      if (!payoutsRes.error) setPayouts((payoutsRes.data || []) as BrokerPayout[]);
      if (!carriersRes.error) setCarrierRelationships((carriersRes.data || []) as CarrierRelationship[]);
    } catch (err: any) {
      console.error('Error loading broker data:', err);
      setError(err.message || 'Failed to load broker data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ─── Broker Actions ──────────────────────────────────────────────
  const handleVerifyBroker = async (brokerId: string, newStatus: string) => {
    setProcessing(brokerId);
    setError('');
    try {
      const supabase = getSupabaseBrowserClient();
      const update: Record<string, any> = {
        verification_status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'verified') update.verified_at = new Date().toISOString();

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
    if (!confirm('Suspend this broker? They will lose access to broker features.')) return;
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

      if (action === 'approved') {
        const request = changeRequests.find(r => r.id === requestId);
        if (request?.changes) {
          const updates: Record<string, any> = { updated_at: new Date().toISOString() };
          for (const [field, change] of Object.entries(request.changes)) {
            updates[field] = change.new_value;
          }
          await supabase.from('broker_profiles').update(updates).eq('id', request.broker_id);
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

  // ─── Computed Values ─────────────────────────────────────────────
  const pendingRequests = changeRequests.filter(r => r.status === 'pending');

  // Financial aggregations
  const totalRevenue = shipments.reduce((s, sh) => s + (sh.estimated_price || 0), 0);
  const totalCommissions = shipments.reduce((s, sh) => s + (sh.broker_commission || 0), 0);
  const totalPlatformFees = shipments.reduce((s, sh) => s + (sh.platform_fee || 0), 0);
  const totalPayoutsAmount = payouts.reduce((s, p) => s + (p.payout_amount || 0), 0);
  const pendingPayouts = payouts.filter(p => p.payout_status === 'pending');
  const completedPayouts = payouts.filter(p => p.payout_status === 'completed');

  // Shipment stats
  const activeShipments = shipments.filter(
    s => !['delivered', 'cancelled'].includes(s.status)
  );
  const deliveredShipments = shipments.filter(s => s.status === 'delivered');

  // Carrier stats
  const activeRelationships = carrierRelationships.filter(r => r.relationship_status === 'active');

  // Broker name lookup
  const getBrokerName = (brokerId: string) => {
    const broker = brokers.find(b => b.profile_id === brokerId || b.id === brokerId);
    return broker?.company_name || 'Unknown';
  };

  // Filters
  const filteredBrokers = brokers.filter(b => {
    const matchesSearch = !searchTerm ||
      b.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.company_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.verification_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredShipments = shipments.filter(s => {
    const matchesSearch = !searchTerm ||
      s.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getBrokerName(s.broker_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${s.vehicle_year} ${s.vehicle_make} ${s.vehicle_model}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredAssignments = assignments.filter(a => {
    const matchesSearch = !searchTerm ||
      a.broker_profile?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${a.carrier_profile?.first_name} ${a.carrier_profile?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || a.assignment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPayouts = payouts.filter(p => {
    const matchesSearch = !searchTerm ||
      p.broker_profile?.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.payout_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredCarriers = carrierRelationships.filter(c => {
    const matchesSearch = !searchTerm ||
      c.broker_profile?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${c.carrier_profile?.first_name} ${c.carrier_profile?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.carrier_profile?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.relationship_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ─── Badge Helpers ───────────────────────────────────────────────
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

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending_quote: 'bg-gray-100 text-gray-700',
      quoted: 'bg-blue-100 text-blue-700',
      booked: 'bg-indigo-100 text-indigo-700',
      assigned: 'bg-purple-100 text-purple-700',
      in_transit: 'bg-amber-100 text-amber-700',
      picked_up: 'bg-amber-100 text-amber-700',
      delivered: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
      accepted: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-green-100 text-green-700',
      processing: 'bg-blue-100 text-blue-700',
      failed: 'bg-red-100 text-red-700',
      disputed: 'bg-orange-100 text-orange-700',
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      terminated: 'bg-red-100 text-red-700',
    };
    return map[status] || 'bg-gray-100 text-gray-700';
  };

  // Reset filter when switching tabs
  const handleTabSwitch = (newTab: Tab) => {
    setTab(newTab);
    setStatusFilter('all');
    setSearchTerm('');
  };

  // ─── Status filter options per tab ───────────────────────────────
  const getStatusOptions = () => {
    switch (tab) {
      case 'brokers':
        return ['all', 'pending', 'documents_submitted', 'under_review', 'verified', 'rejected', 'suspended'];
      case 'shipments':
        return ['all', 'pending_quote', 'quoted', 'booked', 'assigned', 'in_transit', 'picked_up', 'delivered', 'cancelled'];
      case 'assignments':
        return ['all', 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'];
      case 'payouts':
        return ['all', 'pending', 'processing', 'completed', 'failed', 'disputed'];
      case 'carriers':
        return ['all', 'active', 'pending', 'inactive', 'suspended', 'terminated'];
      default:
        return ['all'];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="h-7 w-7 text-purple-600" />
            Broker Operations Center
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Complete overview and control of all broker operations
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* ─── Financial Overview Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-500">Brokers</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{brokers.length}</div>
          <div className="text-xs text-green-600">
            {brokers.filter(b => b.verification_status === 'verified').length} verified
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Package className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-500">Shipments</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{shipments.length}</div>
          <div className="text-xs text-amber-600">
            {activeShipments.length} active
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <ArrowRightLeft className="h-4 w-4 text-indigo-500" />
            <span className="text-xs text-gray-500">Assignments</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{assignments.length}</div>
          <div className="text-xs text-green-600">
            {assignments.filter(a => a.assignment_status === 'completed').length} completed
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-teal-500" />
            <span className="text-xs text-gray-500">Carrier Network</span>
          </div>
          <div className="text-xl font-bold text-gray-900">{carrierRelationships.length}</div>
          <div className="text-xs text-green-600">
            {activeRelationships.length} active
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-500">Total Revenue</span>
          </div>
          <div className="text-xl font-bold text-gray-900">${totalRevenue.toLocaleString()}</div>
          <div className="text-xs text-purple-600">
            ${totalPlatformFees.toLocaleString()} platform fees
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-gray-500">Payouts</span>
          </div>
          <div className="text-xl font-bold text-gray-900">${totalPayoutsAmount.toLocaleString()}</div>
          <div className="text-xs text-yellow-600">
            {pendingPayouts.length} pending
          </div>
        </div>
      </div>

      {/* ─── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {[
          { key: 'brokers' as Tab, label: 'Brokers', icon: Building2, count: brokers.length },
          { key: 'shipments' as Tab, label: 'Shipments', icon: Package, count: shipments.length },
          { key: 'assignments' as Tab, label: 'Assignments', icon: ArrowRightLeft, count: assignments.length },
          { key: 'carriers' as Tab, label: 'Carrier Network', icon: Truck, count: carrierRelationships.length },
          { key: 'payouts' as Tab, label: 'Payouts', icon: DollarSign, count: payouts.length },
          { key: 'requests' as Tab, label: 'Change Requests', icon: FileText, count: pendingRequests.length, badge: true },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => handleTabSwitch(t.key)}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              tab === t.key
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.badge && t.count > 0 ? (
              <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{t.count}</span>
            ) : (
              <span className="text-xs text-gray-400">({t.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Search & Filter Bar ──────────────────────────────────── */}
      {tab !== 'requests' && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={
                tab === 'brokers' ? 'Search by company or email...' :
                tab === 'shipments' ? 'Search by client, broker, or vehicle...' :
                tab === 'assignments' ? 'Search by broker or carrier...' :
                tab === 'payouts' ? 'Search by broker...' :
                tab === 'carriers' ? 'Search by broker, carrier, or email...' :
                'Search...'
              }
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 min-w-[160px]"
          >
            {getStatusOptions().map(opt => (
              <option key={opt} value={opt}>
                {opt === 'all' ? 'All Statuses' : opt.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB: BROKERS
         ═══════════════════════════════════════════════════════════════ */}
      {tab === 'brokers' && (
        <div>
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
                const brokerShipments = shipments.filter(s => s.broker_id === broker.profile_id);
                const brokerAssignments = assignments.filter(a => a.broker_id === broker.id);
                const brokerCarriers = carrierRelationships.filter(c => c.broker_id === broker.id);
                const brokerPayoutsFiltered = payouts.filter(p => p.broker_id === broker.id);

                return (
                  <div key={broker.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    {/* Summary Row */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedBroker(isExpanded ? null : broker.id)}
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 truncate">{broker.company_name}</h3>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg}`}>
                              {badge.icon} {badge.text}
                            </span>
                            {broker.account_status === 'suspended' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                <AlertCircle className="h-3 w-3" /> Suspended
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-0.5 truncate">
                            {broker.profile?.first_name} {broker.profile?.last_name} · {broker.company_email} · {broker.business_city}, {broker.business_state}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-500 flex-shrink-0 ml-4">
                        <div className="text-center hidden sm:block">
                          <div className="font-medium text-gray-900">{broker.total_carriers}</div>
                          <div className="text-xs">Carriers</div>
                        </div>
                        <div className="text-center hidden sm:block">
                          <div className="font-medium text-gray-900">{broker.total_shipments_completed}</div>
                          <div className="text-xs">Shipments</div>
                        </div>
                        <div className="text-center hidden md:block">
                          <div className="font-medium text-gray-900">${(broker.total_revenue_generated || 0).toLocaleString()}</div>
                          <div className="text-xs">Revenue</div>
                        </div>
                        {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50">
                        {/* Broker Operations Summary */}
                        <div className="grid grid-cols-4 gap-3 p-4 border-b border-gray-200">
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <div className="text-xs text-gray-500 mb-1">Shipments</div>
                            <div className="text-lg font-bold text-gray-900">{brokerShipments.length}</div>
                            <div className="text-xs text-amber-600">
                              {brokerShipments.filter(s => !['delivered', 'cancelled'].includes(s.status)).length} active
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <div className="text-xs text-gray-500 mb-1">Assignments</div>
                            <div className="text-lg font-bold text-gray-900">{brokerAssignments.length}</div>
                            <div className="text-xs text-green-600">
                              {brokerAssignments.filter(a => a.assignment_status === 'completed').length} completed
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <div className="text-xs text-gray-500 mb-1">Carriers</div>
                            <div className="text-lg font-bold text-gray-900">{brokerCarriers.length}</div>
                            <div className="text-xs text-teal-600">
                              {brokerCarriers.filter(c => c.relationship_status === 'active').length} active
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 border border-gray-100">
                            <div className="text-xs text-gray-500 mb-1">Payouts</div>
                            <div className="text-lg font-bold text-gray-900">
                              ${brokerPayoutsFiltered.reduce((s, p) => s + p.payout_amount, 0).toLocaleString()}
                            </div>
                            <div className="text-xs text-yellow-600">
                              {brokerPayoutsFiltered.filter(p => p.payout_status === 'pending').length} pending
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 p-4">
                          {/* Business Info */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Business Details</h4>
                            <div className="space-y-1 text-sm text-gray-600">
                              {broker.dba_name && <div>DBA: {broker.dba_name}</div>}
                              <div>DOT#: {broker.dot_number || 'N/A'}</div>
                              <div>MC#: {broker.mc_number || 'N/A'}</div>
                              <div>Phone: {broker.company_phone}</div>
                              <div>Commission: {broker.default_commission_rate}%</div>
                              <div>Platform Fee: {broker.platform_fee_rate}%</div>
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
                              <div>${(broker.total_revenue_generated || 0).toLocaleString()} total revenue</div>
                              <div>Joined {new Date(broker.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Actions</h4>
                            <div className="space-y-2">
                              {['pending', 'documents_submitted', 'under_review'].includes(broker.verification_status) && (
                                <>
                                  <Button
                                    onClick={() => handleVerifyBroker(broker.id, 'verified')}
                                    disabled={processing === broker.id}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                                    size="sm"
                                  >
                                    {processing === broker.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <><CheckCircle className="h-4 w-4 mr-1.5" /> Verify Broker</>
                                    )}
                                  </Button>
                                  <Button
                                    onClick={() => handleVerifyBroker(broker.id, 'rejected')}
                                    disabled={processing === broker.id}
                                    variant="outline"
                                    className="w-full text-red-600 border-red-300 hover:bg-red-50"
                                    size="sm"
                                  >
                                    <XCircle className="h-4 w-4 mr-1.5" /> Reject
                                  </Button>
                                </>
                              )}
                              {broker.account_status === 'active' && (
                                <>
                                  <input
                                    type="text"
                                    value={adminNotes}
                                    onChange={e => setAdminNotes(e.target.value)}
                                    placeholder="Suspension reason..."
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500"
                                    onClick={e => e.stopPropagation()}
                                  />
                                  <Button
                                    onClick={() => handleSuspendBroker(broker.id)}
                                    disabled={processing === broker.id}
                                    variant="outline"
                                    className="w-full text-orange-600 border-orange-300 hover:bg-orange-50"
                                    size="sm"
                                  >
                                    <AlertCircle className="h-4 w-4 mr-1.5" /> Suspend Account
                                  </Button>
                                </>
                              )}
                              {broker.account_status === 'suspended' && (
                                <Button
                                  onClick={() => handleReactivateBroker(broker.id)}
                                  disabled={processing === broker.id}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                  size="sm"
                                >
                                  <Shield className="h-4 w-4 mr-1.5" /> Reactivate
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Recent Shipments for this broker */}
                        {brokerShipments.length > 0 && (
                          <div className="px-4 pb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Shipments</h4>
                            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
                              {brokerShipments.slice(0, 5).map(s => (
                                <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(s.status)}`}>
                                      {s.status.replace(/_/g, ' ')}
                                    </span>
                                    <span className="text-gray-900 truncate">
                                      {s.vehicle_year} {s.vehicle_make} {s.vehicle_model}
                                    </span>
                                    <span className="text-gray-500 hidden md:inline">
                                      {s.pickup_city}, {s.pickup_state} → {s.delivery_city}, {s.delivery_state}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                    <span className="font-medium text-gray-900">${s.estimated_price?.toLocaleString()}</span>
                                    <span className="text-xs text-gray-400">
                                      {new Date(s.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB: SHIPMENTS
         ═══════════════════════════════════════════════════════════════ */}
      {tab === 'shipments' && (
        <div>
          {/* Shipment Stats Row */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Pending', count: shipments.filter(s => s.status === 'pending_quote').length, color: 'text-gray-700' },
              { label: 'Booked', count: shipments.filter(s => s.status === 'booked').length, color: 'text-indigo-700' },
              { label: 'In Transit', count: shipments.filter(s => ['in_transit', 'picked_up', 'assigned'].includes(s.status)).length, color: 'text-amber-700' },
              { label: 'Delivered', count: deliveredShipments.length, color: 'text-green-700' },
              { label: 'Cancelled', count: shipments.filter(s => s.status === 'cancelled').length, color: 'text-red-700' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {filteredShipments.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No shipments found</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Broker</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Vehicle</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Route</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Price</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Commission</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Platform Fee</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredShipments.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(s.status)}`}>
                            {s.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {getBrokerName(s.broker_id)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {s.vehicle_year} {s.vehicle_make} {s.vehicle_model}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-gray-600">
                            <MapPin className="h-3 w-3" />
                            <span>{s.pickup_city}, {s.pickup_state}</span>
                            <span className="text-gray-400">→</span>
                            <span>{s.delivery_city}, {s.delivery_state}</span>
                          </div>
                          {s.distance_miles > 0 && (
                            <div className="text-xs text-gray-400">{s.distance_miles} mi</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{s.client_name}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          ${s.estimated_price?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-purple-700">
                          ${s.broker_commission?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-green-700">
                          ${s.platform_fee?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Totals Footer */}
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">{filteredShipments.length} shipments</span>
                <div className="flex items-center gap-6">
                  <span className="text-gray-900 font-medium">
                    Total: ${filteredShipments.reduce((s, sh) => s + (sh.estimated_price || 0), 0).toLocaleString()}
                  </span>
                  <span className="text-purple-700">
                    Commissions: ${filteredShipments.reduce((s, sh) => s + (sh.broker_commission || 0), 0).toLocaleString()}
                  </span>
                  <span className="text-green-700">
                    Fees: ${filteredShipments.reduce((s, sh) => s + (sh.platform_fee || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB: ASSIGNMENTS
         ═══════════════════════════════════════════════════════════════ */}
      {tab === 'assignments' && (
        <div>
          {/* Assignment Stats */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Pending', count: assignments.filter(a => a.assignment_status === 'pending').length, color: 'text-yellow-700' },
              { label: 'Accepted', count: assignments.filter(a => a.assignment_status === 'accepted').length, color: 'text-blue-700' },
              { label: 'In Progress', count: assignments.filter(a => a.assignment_status === 'in_progress').length, color: 'text-amber-700' },
              { label: 'Completed', count: assignments.filter(a => a.assignment_status === 'completed').length, color: 'text-green-700' },
              { label: 'Cancelled', count: assignments.filter(a => a.assignment_status === 'cancelled').length, color: 'text-red-700' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <ArrowRightLeft className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No assignments found</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Broker</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Carrier</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Carrier Payout</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Commission</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Platform Fee</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Rating</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredAssignments.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(a.assignment_status)}`}>
                            {a.assignment_status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            a.assignment_type === 'direct' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                          }`}>
                            {a.assignment_type === 'direct' ? 'Direct' : 'Load Board'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {a.broker_profile?.company_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {a.carrier_profile ? `${a.carrier_profile.first_name} ${a.carrier_profile.last_name}` : 'Unassigned'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          ${a.total_amount?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-700">
                          ${a.carrier_payout?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-purple-700">
                          ${a.broker_commission?.toLocaleString()} ({a.commission_rate}%)
                        </td>
                        <td className="px-4 py-3 text-right text-green-700">
                          ${a.platform_fee?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {a.customer_rating ? (
                            <span className="flex items-center justify-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> {a.customer_rating}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">{filteredAssignments.length} assignments</span>
                <div className="flex items-center gap-6">
                  <span className="text-gray-900 font-medium">
                    Total: ${filteredAssignments.reduce((s, a) => s + (a.total_amount || 0), 0).toLocaleString()}
                  </span>
                  <span className="text-blue-700">
                    Carrier: ${filteredAssignments.reduce((s, a) => s + (a.carrier_payout || 0), 0).toLocaleString()}
                  </span>
                  <span className="text-purple-700">
                    Commission: ${filteredAssignments.reduce((s, a) => s + (a.broker_commission || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB: CARRIER NETWORK
         ═══════════════════════════════════════════════════════════════ */}
      {tab === 'carriers' && (
        <div>
          {/* Carrier Stats */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Active', count: carrierRelationships.filter(c => c.relationship_status === 'active').length, color: 'text-green-700' },
              { label: 'Pending', count: carrierRelationships.filter(c => c.relationship_status === 'pending').length, color: 'text-yellow-700' },
              { label: 'Inactive', count: carrierRelationships.filter(c => c.relationship_status === 'inactive').length, color: 'text-gray-700' },
              { label: 'Suspended', count: carrierRelationships.filter(c => c.relationship_status === 'suspended').length, color: 'text-orange-700' },
              { label: 'Terminated', count: carrierRelationships.filter(c => c.relationship_status === 'terminated').length, color: 'text-red-700' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {filteredCarriers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No carrier relationships found</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Broker</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Carrier</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Commission %</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Shipments</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Revenue</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Rating</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">On-Time %</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Payment Terms</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Last Shipment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCarriers.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(c.relationship_status)}`}>
                            {c.relationship_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {c.broker_profile?.company_name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900">
                            {c.carrier_profile ? `${c.carrier_profile.first_name} ${c.carrier_profile.last_name}` : '—'}
                          </div>
                          {c.carrier_profile?.email && (
                            <div className="text-xs text-gray-400">{c.carrier_profile.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-purple-700 font-medium">
                          {c.commission_rate}%
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {c.total_shipments_completed}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          ${(c.total_revenue_generated || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.average_rating > 0 ? (
                            <span className="flex items-center justify-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              {c.average_rating.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {c.on_time_delivery_rate > 0 ? (
                            <span className={c.on_time_delivery_rate >= 90 ? 'text-green-700' : c.on_time_delivery_rate >= 70 ? 'text-yellow-700' : 'text-red-700'}>
                              {c.on_time_delivery_rate}%
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {c.payment_terms || 'Standard'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {c.last_shipment_date ? new Date(c.last_shipment_date).toLocaleDateString() : 'None'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">{filteredCarriers.length} relationships</span>
                <div className="flex items-center gap-6">
                  <span className="text-gray-900 font-medium">
                    Total Revenue: ${filteredCarriers.reduce((s, c) => s + (c.total_revenue_generated || 0), 0).toLocaleString()}
                  </span>
                  <span className="text-gray-600">
                    Total Shipments: {filteredCarriers.reduce((s, c) => s + c.total_shipments_completed, 0)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB: PAYOUTS
         ═══════════════════════════════════════════════════════════════ */}
      {tab === 'payouts' && (
        <div>
          {/* Payout Stats */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Pending', count: pendingPayouts.length, amount: pendingPayouts.reduce((s, p) => s + p.payout_amount, 0), color: 'text-yellow-700' },
              { label: 'Processing', count: payouts.filter(p => p.payout_status === 'processing').length, amount: payouts.filter(p => p.payout_status === 'processing').reduce((s, p) => s + p.payout_amount, 0), color: 'text-blue-700' },
              { label: 'Completed', count: completedPayouts.length, amount: completedPayouts.reduce((s, p) => s + p.payout_amount, 0), color: 'text-green-700' },
              { label: 'Failed', count: payouts.filter(p => p.payout_status === 'failed').length, amount: payouts.filter(p => p.payout_status === 'failed').reduce((s, p) => s + p.payout_amount, 0), color: 'text-red-700' },
              { label: 'Disputed', count: payouts.filter(p => p.payout_status === 'disputed').length, amount: payouts.filter(p => p.payout_status === 'disputed').reduce((s, p) => s + p.payout_amount, 0), color: 'text-orange-700' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.count}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className="text-xs font-medium text-gray-700 mt-1">${s.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>

          {filteredPayouts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
              <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No payouts found</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Broker</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Commission Rate</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Payment Method</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Processed</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPayouts.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(p.payout_status)}`}>
                            {p.payout_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {p.broker_profile?.company_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">
                          ${p.payout_amount?.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-purple-700">
                          {p.commission_rate}%
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {p.payment_method?.replace(/_/g, ' ') || 'Not set'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {p.processed_at ? new Date(p.processed_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {p.failure_reason && (
                            <span className="text-red-600">{p.failure_reason}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-gray-500">{filteredPayouts.length} payouts</span>
                <span className="text-gray-900 font-medium">
                  Total: ${filteredPayouts.reduce((s, p) => s + (p.payout_amount || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB: CHANGE REQUESTS
         ═══════════════════════════════════════════════════════════════ */}
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
                              <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve</>
                            )}
                          </Button>
                          <Button
                            onClick={() => handleChangeRequest(request.id, 'rejected')}
                            disabled={processing === request.id}
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                            size="sm"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
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
