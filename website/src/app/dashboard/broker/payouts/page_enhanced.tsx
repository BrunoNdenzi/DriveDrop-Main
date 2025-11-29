'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { brokerProfileService, brokerPayoutService } from '@/services/brokerService';
import type { BrokerProfile, BrokerPayout } from '@/types/broker';

// Extended type for payouts with relations
type BrokerPayoutWithRelations = BrokerPayout & {
  shipment?: {
    carrier?: {
      id: string;
      email: string;
      full_name?: string;
    };
  };
};

import { 
  DollarSign, 
  TrendingUp, 
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  ArrowRight,
  Download,
  Filter,
  Search,
  CreditCard,
  Receipt,
  FileText,
  RefreshCw,
  ExternalLink,
  Eye,
  Send,
  Plus,
  Wallet,
  BarChart3,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default function PayoutsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [payouts, setPayouts] = useState<BrokerPayoutWithRelations[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'processing'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showRequestPayoutModal, setShowRequestPayoutModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<BrokerPayoutWithRelations | null>(null);

  useEffect(() => {
    loadData();
  }, [filter]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
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

  const getStatusLabel = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleExportCSV = () => {
    const csv = [
      ['Transaction ID', 'Shipment', 'Carrier', 'Amount', 'Commission', 'Status', 'Date'],
      ...filteredPayouts.map(p => [
        p.id.slice(0, 8),
        p.shipment_id?.slice(0, 8) || 'N/A',
        p.shipment?.carrier?.full_name || 'N/A',
        p.payout_amount || 0,
        ((p.payout_amount || 0) * (p.commission_rate || 0) / 100),
        p.payout_status,
        new Date(p.created_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `broker-payouts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleRequestPayout = () => {
    setShowRequestPayoutModal(true);
  };

  const handleViewDetails = (payout: BrokerPayoutWithRelations) => {
    setSelectedPayout(payout);
  };

  const filterByDateRange = (payout: BrokerPayoutWithRelations) => {
    if (dateRange === 'all') return true;
    const date = new Date(payout.created_at);
    const now = new Date();
    const daysAgo = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
    }[dateRange] || 30;
    const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return date >= cutoff;
  };

  const filteredPayouts = payouts
    .filter(payout => {
      if (filter !== 'all' && payout.payout_status !== filter) return false;
      if (!filterByDateRange(payout)) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          payout.id.toLowerCase().includes(term) ||
          payout.shipment_id?.toLowerCase().includes(term) ||
          payout.shipment?.carrier?.full_name?.toLowerCase().includes(term)
        );
      }
      return true;
    });

  const totalPaid = payouts
    .filter(p => p.payout_status === 'completed')
    .reduce((sum, p) => sum + (p.payout_amount || 0), 0);

  const totalPending = payouts
    .filter(p => p.payout_status === 'pending')
    .reduce((sum, p) => sum + (p.payout_amount || 0), 0);

  const totalProcessing = payouts
    .filter(p => p.payout_status === 'processing')
    .reduce((sum, p) => sum + (p.payout_amount || 0), 0);

  const availableBalance = payouts
    .filter(p => p.payout_status === 'completed')
    .reduce((sum, p) => sum + ((p.payout_amount || 0) * (p.commission_rate || 0) / 100), 0);

  const lifetimeEarnings = payouts
    .filter(p => p.payout_status === 'completed')
    .reduce((sum, p) => sum + ((p.payout_amount || 0) * (p.commission_rate || 0) / 100), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Actions */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Payouts & Earnings</h1>
            <p className="text-green-100">
              Manage your commission earnings, carrier payouts, and payment methods
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleRequestPayout}
              className="bg-white text-green-600 hover:bg-green-50"
            >
              <Send className="h-4 w-4 mr-2" />
              Request Payout
            </Button>
            <Button
              onClick={() => setShowPaymentMethodModal(true)}
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Payment Methods
            </Button>
          </div>
        </div>

        {/* Enhanced Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-green-100 text-sm">Available Balance</p>
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <p className="text-3xl font-bold mb-1">${availableBalance.toLocaleString()}</p>
            <p className="text-xs text-green-100">Ready to withdraw</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-green-100 text-sm">Lifetime Earnings</p>
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <p className="text-3xl font-bold mb-1">${lifetimeEarnings.toLocaleString()}</p>
            <p className="text-xs text-green-100">{payouts.filter(p => p.payout_status === 'completed').length} completed</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-green-100 text-sm">Processing</p>
              <Clock className="h-5 w-5 text-white" />
            </div>
            <p className="text-3xl font-bold mb-1">${totalProcessing.toLocaleString()}</p>
            <p className="text-xs text-green-100">Being processed</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-green-100 text-sm">Pending</p>
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <p className="text-3xl font-bold mb-1">${totalPending.toLocaleString()}</p>
            <p className="text-xs text-green-100">Awaiting approval</p>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <span className="text-sm text-gray-600">Completed Payouts</span>
              <p className="text-2xl font-bold text-gray-900">
                {payouts.filter(p => p.payout_status === 'completed').length}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total Amount</span>
            <span className="font-semibold text-green-600">${totalPaid.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-blue-50 rounded-xl">
              <RefreshCw className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <span className="text-sm text-gray-600">Processing</span>
              <p className="text-2xl font-bold text-gray-900">
                {payouts.filter(p => p.payout_status === 'processing').length}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total Amount</span>
            <span className="font-semibold text-blue-600">${totalProcessing.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-yellow-50 rounded-xl">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <span className="text-sm text-gray-600">Pending</span>
              <p className="text-2xl font-bold text-gray-900">
                {payouts.filter(p => p.payout_status === 'pending').length}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Total Amount</span>
            <span className="font-semibold text-yellow-600">${totalPending.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-3 bg-purple-50 rounded-xl">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <span className="text-sm text-gray-600">All Transactions</span>
              <p className="text-2xl font-bold text-gray-900">{payouts.length}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Combined Total</span>
            <span className="font-semibold text-purple-600">
              ${(totalPaid + totalProcessing + totalPending).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Status Filters */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'processing', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === status
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Date Range & Search */}
          <div className="flex gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search transactions..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 w-64"
              />
            </div>

            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {filteredPayouts.length} of {payouts.length} transaction{payouts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Enhanced Payouts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredPayouts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-50 to-emerald-50 rounded-full mb-4">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No transactions found
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || filter !== 'all' || dateRange !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'Complete shipments to start earning commissions'}
            </p>
            <Link href="/dashboard/broker/load-board">
              <Button className="bg-green-600 hover:bg-green-700">
                <ArrowRight className="h-4 w-4 mr-2" />
                Browse Load Board
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Shipment
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Carrier Payout
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Your Commission
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPayouts.map((payout) => {
                  const commission = (payout.payout_amount || 0) * (payout.commission_rate || 0) / 100;
                  return (
                    <tr key={payout.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                            <Receipt className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <span className="text-sm font-mono font-medium text-gray-900">
                              {payout.id.slice(0, 8)}
                            </span>
                            <p className="text-xs text-gray-500">
                              {payout.commission_rate}% commission
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/broker/assignments?shipment=${payout.shipment_id}`}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                        >
                          #{payout.shipment_id?.slice(0, 8) || 'N/A'}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-semibold">
                              {payout.shipment?.carrier?.full_name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <span className="text-sm text-gray-900">
                            {payout.shipment?.carrier?.full_name || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-gray-900">
                          ${(payout.payout_amount || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 rounded-lg">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-bold text-green-600">
                            {commission.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(payout.payout_status)}`}
                        >
                          {payout.payout_status === 'completed' && <CheckCircle className="h-3 w-3" />}
                          {payout.payout_status === 'processing' && <RefreshCw className="h-3 w-3" />}
                          {payout.payout_status === 'pending' && <Clock className="h-3 w-3" />}
                          {getStatusLabel(payout.payout_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 text-sm text-gray-900">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {new Date(payout.created_at).toLocaleDateString()}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(payout.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(payout)}
                            className="hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-green-50"
                          >
                            <Download className="h-4 w-4 text-green-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Method Modal */}
      {showPaymentMethodModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Payment Methods</h2>
              <button
                onClick={() => setShowPaymentMethodModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Add payment method UI would go here */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Payment Methods</h3>
                <p className="text-gray-600 mb-4">Add a bank account or debit card to receive payouts</p>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Request Payout Modal */}
      {showRequestPayoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Request Payout</h2>
              <button
                onClick={() => setShowRequestPayoutModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 mb-6 border border-green-200">
              <p className="text-sm text-gray-600 mb-2">Available Balance</p>
              <p className="text-4xl font-bold text-green-600 mb-1">${availableBalance.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Ready to withdraw</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount to Withdraw
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    placeholder="0.00"
                    max={availableBalance}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option>Select payment method</option>
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Payouts typically arrive within 2-3 business days.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowRequestPayoutModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700">
                  <Send className="h-4 w-4 mr-2" />
                  Request Payout
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
