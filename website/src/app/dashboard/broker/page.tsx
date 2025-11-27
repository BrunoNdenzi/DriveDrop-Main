'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { brokerProfileService } from '@/services/brokerService';
import type { BrokerProfile, BrokerStatsResponse } from '@/types/broker';
import { 
  formatVerificationStatus, 
  getVerificationStatusColor,
  calculateVerificationProgress 
} from '@/utils/brokerVerification';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function BrokerDashboard() {
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !broker) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error || 'Broker profile not found'}</p>
          <button
            onClick={() => router.push('/auth/broker-signup')}
            className="mt-4 text-blue-600 hover:text-blue-500"
          >
            Complete Registration
          </button>
        </div>
      </div>
    );
  }

  const verificationProgress = calculateVerificationProgress(broker);
  const statusColors = getVerificationStatusColor(broker.verification_status);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Welcome Banner */}
      {showWelcome && (
        <div className="bg-blue-600 text-white">
          <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between flex-wrap">
              <div className="flex items-center">
                <span className="text-lg">🎉</span>
                <p className="ml-3 font-medium">
                  Welcome to DriveDrop Broker Network! Your account is pending verification.
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard/broker')}
                className="flex-shrink-0 text-white hover:text-gray-200"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">
                {broker.company_name}
              </h1>
              <div className="mt-2 flex items-center space-x-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors.bg} ${statusColors.text} border ${statusColors.border}`}>
                  {formatVerificationStatus(broker.verification_status)}
                </span>
                <span className="text-sm text-gray-500">
                  {broker.dba_name && `DBA: ${broker.dba_name}`}
                </span>
              </div>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4 space-x-3">
              <button
                onClick={() => router.push('/dashboard/broker/profile')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Edit Profile
              </button>
              <button
                onClick={() => router.push('/dashboard/broker/load-board')}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                View Load Board
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Verification Progress */}
        {broker.verification_status !== 'verified' && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-800">
                  Account Verification: {verificationProgress}% Complete
                </h3>
                <div className="mt-2 w-full bg-yellow-200 rounded-full h-2">
                  <div
                    className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${verificationProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-yellow-700">
                  {broker.verification_status === 'pending' && (
                    <>Upload required documents to complete verification.</>
                  )}
                  {broker.verification_status === 'documents_submitted' && (
                    <>Your documents are under review. We'll notify you once verified.</>
                  )}
                  {broker.verification_status === 'under_review' && (
                    <>Your account is being reviewed by our team.</>
                  )}
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard/broker/documents')}
                className="ml-4 text-sm font-medium text-yellow-800 hover:text-yellow-600"
              >
                Upload Documents →
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Total Shipments */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-blue-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Shipments
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {stats?.total_shipments || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="font-medium text-blue-600">{stats?.active_shipments || 0}</span>
                <span className="text-gray-500"> active</span>
              </div>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-green-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Revenue
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      ${stats?.total_revenue?.toLocaleString() || '0'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="font-medium text-green-600">
                  ${stats?.pending_payouts?.toLocaleString() || '0'}
                </span>
                <span className="text-gray-500"> pending</span>
              </div>
            </div>
          </div>

          {/* Carrier Network */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-purple-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Carrier Network
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {stats?.total_carriers || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="font-medium text-purple-600">{stats?.active_carriers || 0}</span>
                <span className="text-gray-500"> active</span>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-yellow-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Rating
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {stats?.average_rating?.toFixed(1) || '0.0'}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="font-medium text-yellow-600">{stats?.on_time_rate?.toFixed(0) || 0}%</span>
                <span className="text-gray-500"> on-time</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                onClick={() => router.push('/dashboard/broker/load-board')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">View Load Board</p>
                  <p className="text-xs text-gray-500">Browse available shipments</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/dashboard/broker/carriers')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-purple-500 hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Manage Carriers</p>
                  <p className="text-xs text-gray-500">Your driver network</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/dashboard/broker/assignments')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">My Assignments</p>
                  <p className="text-xs text-gray-500">Active & completed</p>
                </div>
              </button>

              <button
                onClick={() => router.push('/dashboard/broker/payouts')}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-yellow-500 hover:shadow-md transition-all"
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Payouts</p>
                  <p className="text-xs text-gray-500">Commission payments</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Company Information</h3>
          </div>
          <div className="px-6 py-5">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Company Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{broker.company_email}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Company Phone</dt>
                <dd className="mt-1 text-sm text-gray-900">{broker.company_phone}</dd>
              </div>
              {broker.dot_number && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">DOT Number</dt>
                  <dd className="mt-1 text-sm text-gray-900">{broker.dot_number}</dd>
                </div>
              )}
              {broker.mc_number && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">MC Number</dt>
                  <dd className="mt-1 text-sm text-gray-900">{broker.mc_number}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-gray-500">Business Address</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {broker.business_address}<br />
                  {broker.business_city}, {broker.business_state} {broker.business_zip}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Commission Rate</dt>
                <dd className="mt-1 text-sm text-gray-900">{broker.default_commission_rate}%</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
