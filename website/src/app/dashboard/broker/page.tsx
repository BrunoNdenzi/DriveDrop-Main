'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { brokerProfileService } from '@/services/brokerService';
import type { BrokerProfile, BrokerStatsResponse } from '@/types/broker';
import { 
  formatVerificationStatus, 
  getVerificationStatusColor,
  calculateVerificationProgress 
} from '@/utils/brokerVerification';
import {
  Package,
  DollarSign,
  Users,
  Star,
  TrendingUp,
  Briefcase,
  FileText,
  ArrowRight,
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';
import { HelpButton } from '@/components/onboarding/HelpButton';
import { brokerDashboardTour } from '@/lib/tour-steps';

function BrokerDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showWelcome = searchParams?.get('welcome') === 'true';

  const [loading, setLoading] = useState(true);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [stats, setStats] = useState<BrokerStatsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBrokerData();
  }, []);

  const loadBrokerData = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/auth/signin');
        return;
      }

      // Get broker profile
      const brokerProfile = await brokerProfileService.getByProfileId(user.id);
      setBroker(brokerProfile);

      // Get broker stats
      const brokerStats = await brokerProfileService.getStats(brokerProfile.id);
      setStats(brokerStats);
    } catch (err: any) {
      console.error('Error loading broker data:', err);
      setError(err.message || 'Failed to load broker data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !broker) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Broker profile not found'}</p>
          <Button
            onClick={() => router.push('/auth/broker-signup')}
          >
            Complete Registration
          </Button>
        </div>
      </div>
    );
  }

  const verificationProgress = calculateVerificationProgress(broker);
  const statusColors = getVerificationStatusColor(broker.verification_status);

  return (
    <div className="space-y-6" id="broker-dashboard">
      {/* Onboarding Tour */}
      <OnboardingTour 
        tourConfig={brokerDashboardTour} 
        storageKey="broker_tour"
      />

      {/* Help Button */}
      <HelpButton userRole="broker" currentPage="broker" />

      {/* Welcome Banner */}
      {showWelcome && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-lg">
                  Welcome to DriveDrop Broker Network!
                </p>
                <p className="text-blue-100 text-sm">
                  Your account is pending verification. Upload documents to get started.
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/broker')}
              className="text-white hover:text-blue-100 transition-colors"
            >
              <span className="text-xl">✕</span>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">
                  {broker.company_name}
                </h1>
                {broker.dba_name && (
                  <p className="text-blue-100 text-sm mt-1">
                    DBA: {broker.dba_name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/90 ${statusColors.text} border ${statusColors.border}`}>
                {formatVerificationStatus(broker.verification_status)}
              </span>
              {broker.mc_number && (
                <span className="text-blue-100 text-sm">
                  MC#{broker.mc_number}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/broker/profile')}
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <FileText className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
            <Button
              onClick={() => router.push('/dashboard/broker/load-board')}
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              <Package className="h-4 w-4 mr-2" />
              Load Board
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Verification Progress */}
        {broker.verification_status !== 'verified' && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Account Verification: {verificationProgress}% Complete
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard/broker/documents')}
                    className="border-yellow-600 text-yellow-600 hover:bg-yellow-600 hover:text-white"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Upload Documents
                  </Button>
                </div>
                <div className="w-full bg-yellow-200 rounded-full h-3 mb-3">
                  <div
                    className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${verificationProgress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-700">
                  {broker.verification_status === 'pending' && (
                    <>Upload required documents to complete verification and start accepting loads.</>
                  )}
                  {broker.verification_status === 'documents_submitted' && (
                    <>Your documents are under review. We'll notify you once verified.</>
                  )}
                  {broker.verification_status === 'under_review' && (
                    <>Your account is being reviewed by our team. This usually takes 1-2 business days.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Shipments */}
          <div className="bg-white rounded-xl p-6 border border-gray-200" data-tour="client-management">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Shipments</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.total_shipments || 0}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-blue-600"></div>
              <span className="font-medium text-blue-600">{stats?.active_shipments || 0}</span>
              <span className="text-gray-500">active</span>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white rounded-xl p-6 border border-gray-200" data-tour="commission-earnings">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${stats?.total_revenue?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-600"></div>
              <span className="font-medium text-green-600">
                ${stats?.pending_payouts?.toLocaleString() || '0'}
              </span>
              <span className="text-gray-500">pending</span>
            </div>
          </div>

          {/* Carrier Network */}
          <div className="bg-white rounded-xl p-6 border border-gray-200" data-tour="carrier-network">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Carrier Network</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.total_carriers || 0}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-purple-600"></div>
              <span className="font-medium text-purple-600">{stats?.active_carriers || 0}</span>
              <span className="text-gray-500">active</span>
            </div>
          </div>

          {/* Performance */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Rating</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.average_rating?.toFixed(1) || '0.0'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-yellow-600"></div>
              <span className="font-medium text-yellow-600">{stats?.on_time_rate?.toFixed(0) || 0}%</span>
              <span className="text-gray-500">on-time</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200" data-tour="assignments">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            <p className="text-sm text-gray-600 mt-1">Manage your brokerage operations</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/dashboard/broker/load-board">
                <div className="group p-5 border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                      <Package className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Load Board</p>
                      <p className="text-xs text-gray-500">Browse shipments</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </div>
              </Link>

              <Link href="/dashboard/broker/carriers">
                <div className="group p-5 border border-gray-200 rounded-xl hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Carriers</p>
                      <p className="text-xs text-gray-500">Manage network</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                  </div>
                </div>
              </Link>

              <Link href="/dashboard/broker/assignments">
                <div className="group p-5 border border-gray-200 rounded-xl hover:border-green-500 hover:shadow-lg transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                      <Briefcase className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Assignments</p>
                      <p className="text-xs text-gray-500">Active & completed</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-green-600 transition-colors" />
                  </div>
                </div>
              </Link>

              <Link href="/dashboard/broker/payouts">
                <div className="group p-5 border border-gray-200 rounded-xl hover:border-yellow-500 hover:shadow-lg transition-all cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-50 rounded-lg group-hover:bg-yellow-100 transition-colors">
                      <DollarSign className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Payouts</p>
                      <p className="text-xs text-gray-500">Commissions</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-yellow-600 transition-colors" />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Company Information</h3>
                <p className="text-sm text-gray-600">Your broker profile details</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Mail className="h-4 w-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500">Company Email</p>
                  <p className="text-sm text-gray-900 mt-1">{broker.company_email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Phone className="h-4 w-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500">Company Phone</p>
                  <p className="text-sm text-gray-900 mt-1">{broker.company_phone}</p>
                </div>
              </div>

              {broker.dot_number && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-500">DOT Number</p>
                    <p className="text-sm text-gray-900 mt-1">{broker.dot_number}</p>
                  </div>
                </div>
              )}

              {broker.mc_number && (
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <FileText className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-500">MC Number</p>
                    <p className="text-sm text-gray-900 mt-1">{broker.mc_number}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <MapPin className="h-4 w-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500">Business Address</p>
                  <p className="text-sm text-gray-900 mt-1">
                    {broker.business_address}<br />
                    {broker.business_city}, {broker.business_state} {broker.business_zip}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-500">Commission Rate</p>
                  <p className="text-sm text-gray-900 mt-1">{broker.default_commission_rate}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BrokerDashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    }>
      <BrokerDashboardContent />
    </Suspense>
  );
}
