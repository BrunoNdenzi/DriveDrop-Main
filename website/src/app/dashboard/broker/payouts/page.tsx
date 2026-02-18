'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { brokerProfileService, brokerPayoutService } from '@/services/brokerService';
import type { BrokerProfile, BrokerPayoutWithDetails } from '@/types/broker';

type PayoutStats = {
  totalEarnings: number;
  pendingPayouts: number;
  completedPayouts: number;
  avgCommission: number;
};

import { 
  DollarSign, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Download,
  Search,
  FileText,
  CreditCard,
  RefreshCw,
  Eye,
  X,
  Send,
  Wallet,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default function PayoutsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [payouts, setPayouts] = useState<BrokerPayoutWithDetails[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'processing' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showRequestPayoutModal, setShowRequestPayoutModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<BrokerPayoutWithDetails | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [filter, dateRange]);

  const loadData = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      const brokerProfile = await brokerProfileService.getByProfileId(user.id);
      setBroker(brokerProfile);

      const payoutData = await brokerPayoutService.getByBrokerId(brokerProfile.id);
      setPayouts(payoutData);
    } catch (err: any) {
      console.error('Error loading payouts:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (): PayoutStats => {
    const completed = payouts.filter(p => p.payout_status === 'completed');
    const pending = payouts.filter(p => p.payout_status === 'pending');
    
    return {
      totalEarnings: completed.reduce((sum, p) => sum + (p.payout_amount || 0), 0),
      pendingPayouts: pending.reduce((sum, p) => sum + (p.payout_amount || 0), 0),
      completedPayouts: completed.length,
      avgCommission: completed.length > 0 
        ? completed.reduce((sum, p) => sum + (p.payout_amount || 0), 0) / completed.length 
        : 0
    };
  };

  const getFilteredPayouts = () => {
    let filtered = [...payouts];

    if (filter !== 'all') {
      filtered = filtered.filter(p => p.payout_status === filter);
    }

    if (dateRange !== 'all') {
      const now = new Date();
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const cutoffDate = new Date(now.setDate(now.getDate() - days));
      filtered = filtered.filter(p => new Date(p.created_at) >= cutoffDate);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.id?.toLowerCase().includes(term) ||
        p.load_board?.shipment?.pickup_city?.toLowerCase().includes(term) ||
        p.load_board?.shipment?.delivery_city?.toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const exportToCSV = () => {
    const filtered = getFilteredPayouts();
    const csv = [
        ['Date', 'Payout ID', 'Route', 'Amount', 'Status', 'Payment Method'].join(','),
      ...filtered.map(p => [
        new Date(p.created_at).toLocaleDateString(),
        p.id,
        `"${p.load_board?.shipment?.pickup_city || 'N/A'} to ${p.load_board?.shipment?.delivery_city || 'N/A'}"`,
        `$${(p.payout_amount || 0).toFixed(2)}`,
        p.payout_status,
        p.payment_method || 'N/A'
      ].join(','))
    ].join('\n');    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payouts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleRequestPayout = async () => {
    console.log('Request payout functionality');
    setShowRequestPayoutModal(false);
  };

  const stats = calculateStats();
  const filteredPayouts = getFilteredPayouts();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payouts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-gray-200 rounded-md p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Payouts & Earnings</h1>
            <p className="text-xs text-gray-500">
              Manage your broker commissions and payment methods
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => setShowRequestPayoutModal(true)}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              Request Payout
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-green-100 rounded-md flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Earnings</h3>
          <p className="text-xl font-bold text-gray-900">${stats.totalEarnings.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.completedPayouts} completed payouts</p>
        </div>

        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-yellow-100 rounded-md flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Pending Payouts</h3>
          <p className="text-xl font-bold text-gray-900">${stats.pendingPayouts.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Awaiting processing</p>
        </div>

        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-blue-100 rounded-md flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Avg Commission</h3>
          <p className="text-xl font-bold text-gray-900">${stats.avgCommission.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">Per shipment</p>
        </div>

        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-purple-100 rounded-md flex items-center justify-center">
              <Wallet className="h-5 w-5 text-purple-600" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-600 mb-1">Payment Method</h3>
          <p className="text-sm font-semibold text-gray-900">{'Not set'}</p>
          <button
            onClick={() => setShowPaymentMethodModal(true)}
            className="text-xs text-teal-600 hover:text-teal-700 mt-1"
          >
            Update method →
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-md border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by payout ID or location..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'processing', 'completed', 'failed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === status
                    ? 'bg-teal-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="border border-gray-300 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>

          {/* Export Button */}
          <Button
            onClick={exportToCSV}
            variant="outline"
            className="border-gray-300"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Payout ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Carrier
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Commission
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPayouts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <div className="flex flex-col items-center">
                      <DollarSign className="h-8 w-8 text-gray-400 mb-3" />
                      <h3 className="text-sm font-medium text-gray-900 mb-1">No payouts found</h3>
                      <p className="text-sm text-gray-500">
                        {searchTerm || filter !== 'all' ? 'Try adjusting your filters' : 'Complete shipments to earn commissions'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(payout.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(payout.created_at).toLocaleTimeString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm font-mono text-gray-900">
                          {payout.id?.slice(0, 8)}...
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {payout.load_board?.shipment?.pickup_city || 'N/A'}, {payout.load_board?.shipment?.pickup_state || ''}
                      </div>
                      <div className="flex items-center text-xs text-gray-500">
                        <ArrowRight className="h-3 w-3 mx-1" />
                        {payout.load_board?.shipment?.delivery_city || 'N/A'}, {payout.load_board?.shipment?.delivery_state || ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payout.shipment?.carrier?.full_name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        ${(payout.payout_amount || 0).toLocaleString()}
                      </div>
                      {payout.payment_method && (
                        <div className="flex items-center text-xs text-gray-500">
                          <CreditCard className="h-3 w-3 mr-1" />
                          {payout.payment_method}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(payout.payout_status)}`}>
                        {getStatusIcon(payout.payout_status)}
                        {payout.payout_status.charAt(0).toUpperCase() + payout.payout_status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setSelectedPayout(payout);
                          setShowDetailsModal(true);
                        }}
                        className="text-teal-600 hover:text-teal-700 inline-flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentMethodModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md max-w-md w-full p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Update Payment Method</h3>
              <button
                onClick={() => setShowPaymentMethodModal(false)}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-1 focus:ring-teal-500">
                  <option value="">Select method</option>
                  <option value="bank_transfer">Bank Transfer (ACH)</option>
                  <option value="wire">Wire Transfer</option>
                  <option value="check">Check</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bank Account Number
                </label>
                <input
                  type="text"
                  placeholder="Enter account number"
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Routing Number
                </label>
                <input
                  type="text"
                  placeholder="Enter routing number"
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowPaymentMethodModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowPaymentMethodModal(false);
                  }}
                  className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                >
                  Save Method
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Payout Modal */}
      {showRequestPayoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md max-w-md w-full p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Request Payout</h3>
              <button
                onClick={() => setShowRequestPayoutModal(false)}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm font-medium text-green-900 mb-1">Available Balance</p>
                <p className="text-xl font-bold text-green-600">${stats.pendingPayouts.toLocaleString()}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount to Request
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    max={stats.pendingPayouts}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Maximum: ${stats.pendingPayouts.toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    {'No payment method set'}
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-xs text-blue-800">
                  <strong>Processing Time:</strong> Payouts are typically processed within 3-5 business days.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowRequestPayoutModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRequestPayout}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={stats.pendingPayouts <= 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Request Payout
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payout Details Modal */}
      {showDetailsModal && selectedPayout && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md max-w-2xl w-full p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Payout Details</h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedPayout(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Banner */}
              <div className={`rounded-md p-4 border ${getStatusColor(selectedPayout.payout_status)}`}>
                <div className="flex items-center gap-2">
                  {getStatusIcon(selectedPayout.payout_status)}
                  <span className="font-semibold">
                    {selectedPayout.payout_status.charAt(0).toUpperCase() + selectedPayout.payout_status.slice(1)}
                  </span>
                </div>
              </div>

              {/* Payment Info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Payment Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Payout ID</p>
                    <p className="text-sm font-mono text-gray-900">{selectedPayout.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Payout Amount</p>
                    <p className="text-sm font-semibold text-gray-900">
                      ${(selectedPayout.payout_amount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Created Date</p>
                    <p className="text-sm text-gray-900">
                      {new Date(selectedPayout.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Payment Method</p>
                    <p className="text-sm text-gray-900">{selectedPayout.payment_method || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Shipment Info */}
              {selectedPayout.load_board?.shipment && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Shipment Details</h4>
                  <div className="bg-gray-50 rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-900">
                          {selectedPayout.load_board.shipment.pickup_city}, {selectedPayout.load_board.shipment.pickup_state}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center my-2">
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-sm font-medium text-gray-900">
                          {selectedPayout.load_board.shipment.delivery_city}, {selectedPayout.load_board.shipment.delivery_state}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Carrier Info */}
              {selectedPayout.shipment?.carrier && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Carrier Information</h4>
                  <div className="bg-gray-50 rounded-md p-4">
                    <p className="text-sm font-medium text-gray-900">
                      {selectedPayout.shipment.carrier.full_name}
                    </p>
                    <p className="text-xs text-gray-500">{selectedPayout.shipment.carrier.email}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedPayout(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    console.log('Download receipt');
                  }}
                  className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Receipt
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
