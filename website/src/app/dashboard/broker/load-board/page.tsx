'use client';

import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { loadBoardService, brokerProfileService } from '@/services/brokerService';
import type { LoadBoard, LoadBoardFilters, BrokerProfile } from '@/types/broker';

export default function LoadBoardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [loads, setLoads] = useState<any[]>([]);
  const [filteredLoads, setFilteredLoads] = useState<any[]>([]);
  const [error, setError] = useState('');

  // Filters
  const [filters, setFilters] = useState<LoadBoardFilters>({
    pickup_state: '',
    delivery_state: '',
    vehicle_type: '',
    min_price: undefined,
    max_price: undefined,
    pickup_date_from: '',
    pickup_date_to: '',
  });

  // Search & Sort
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'distance'>('date');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [loads, filters, searchTerm, sortBy]);

  const loadData = async () => {
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

      // Get available loads
      const availableLoads = await loadBoardService.getAvailableLoads();
      setLoads(availableLoads);
    } catch (err: any) {
      console.error('Error loading load board:', err);
      setError(err.message || 'Failed to load available shipments');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...loads];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(load => 
        load.shipment?.pickup_city?.toLowerCase().includes(term) ||
        load.shipment?.delivery_city?.toLowerCase().includes(term) ||
        load.shipment?.vehicle_make?.toLowerCase().includes(term) ||
        load.shipment?.vehicle_model?.toLowerCase().includes(term)
      );
    }

    // State filters
    if (filters.pickup_state) {
      filtered = filtered.filter(load => 
        load.shipment?.pickup_state === filters.pickup_state
      );
    }
    if (filters.delivery_state) {
      filtered = filtered.filter(load => 
        load.shipment?.delivery_state === filters.delivery_state
      );
    }

    // Vehicle type filter
    if (filters.vehicle_type) {
      filtered = filtered.filter(load => 
        load.shipment?.vehicle_type === filters.vehicle_type
      );
    }

    // Price filters
    if (filters.min_price) {
      filtered = filtered.filter(load => 
        load.suggested_carrier_payout >= filters.min_price!
      );
    }
    if (filters.max_price) {
      filtered = filtered.filter(load => 
        load.suggested_carrier_payout <= filters.max_price!
      );
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'price') {
        return (b.suggested_carrier_payout || 0) - (a.suggested_carrier_payout || 0);
      } else if (sortBy === 'distance') {
        return (b.shipment?.distance || 0) - (a.shipment?.distance || 0);
      }
      return 0;
    });

    setFilteredLoads(filtered);
  };

  const handlePlaceBid = (loadId: string) => {
    router.push(`/dashboard/broker/load-board/${loadId}/bid`);
  };

  const handleViewDetails = (loadId: string) => {
    router.push(`/dashboard/broker/load-board/${loadId}`);
  };

  const clearFilters = () => {
    setFilters({
      pickup_state: '',
      delivery_state: '',
      vehicle_type: '',
      min_price: undefined,
      max_price: undefined,
      pickup_date_from: '',
      pickup_date_to: '',
    });
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading available loads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">Load Board</h1>
              <p className="mt-1 text-sm text-gray-500">
                {filteredLoads.length} available shipment{filteredLoads.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <button
                onClick={() => router.push('/dashboard/broker')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Clear All
                </button>
              </div>

              {/* Search */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="City, vehicle..."
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Sort By */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="date">Newest First</option>
                  <option value="price">Highest Price</option>
                  <option value="distance">Longest Distance</option>
                </select>
              </div>

              <hr className="my-4" />

              {/* Pickup State */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup State
                </label>
                <input
                  type="text"
                  value={filters.pickup_state}
                  onChange={(e) => setFilters(prev => ({ ...prev, pickup_state: e.target.value }))}
                  placeholder="CA"
                  maxLength={2}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Delivery State */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery State
                </label>
                <input
                  type="text"
                  value={filters.delivery_state}
                  onChange={(e) => setFilters(prev => ({ ...prev, delivery_state: e.target.value }))}
                  placeholder="NY"
                  maxLength={2}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Vehicle Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type
                </label>
                <select
                  value={filters.vehicle_type}
                  onChange={(e) => setFilters(prev => ({ ...prev, vehicle_type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="truck">Truck</option>
                  <option value="van">Van</option>
                  <option value="motorcycle">Motorcycle</option>
                </select>
              </div>

              {/* Price Range */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={filters.min_price || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, min_price: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    placeholder="Min"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="number"
                    value={filters.max_price || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, max_price: e.target.value ? parseFloat(e.target.value) : undefined }))}
                    placeholder="Max"
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Loads List */}
          <div className="lg:col-span-3">
            {filteredLoads.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No loads available</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || filters.pickup_state || filters.delivery_state
                    ? 'Try adjusting your filters'
                    : 'Check back later for new shipments'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLoads.map((load) => (
                  <div
                    key={load.id}
                    className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Route */}
                        <div className="flex items-center space-x-4 mb-4">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                              <div className="ml-3">
                                <p className="text-sm font-medium text-gray-900">
                                  {load.shipment?.pickup_city}, {load.shipment?.pickup_state}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {load.shipment?.pickup_zip}
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex-shrink-0">
                            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center">
                              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                              <div className="ml-3">
                                <p className="text-sm font-medium text-gray-900">
                                  {load.shipment?.delivery_city}, {load.shipment?.delivery_state}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {load.shipment?.delivery_zip}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Vehicle Info */}
                        <div className="flex items-center space-x-6 text-sm text-gray-600 mb-4">
                          <div className="flex items-center">
                            <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="capitalize">{load.shipment?.vehicle_type || 'N/A'}</span>
                          </div>
                          <div className="flex items-center">
                            <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span>
                              {load.shipment?.vehicle_year} {load.shipment?.vehicle_make} {load.shipment?.vehicle_model}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{load.shipment?.distance?.toFixed(0)} miles</span>
                          </div>
                        </div>

                        {/* Dates */}
                        <div className="flex items-center space-x-6 text-sm text-gray-500">
                          <div>
                            <span className="font-medium">Pickup:</span>{' '}
                            {new Date(load.shipment?.pickup_date).toLocaleDateString()}
                          </div>
                          {load.shipment?.delivery_date && (
                            <div>
                              <span className="font-medium">Delivery:</span>{' '}
                              {new Date(load.shipment?.delivery_date).toLocaleDateString()}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Posted:</span>{' '}
                            {new Date(load.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Price & Actions */}
                      <div className="ml-6 flex flex-col items-end space-y-3">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">
                            ${load.suggested_carrier_payout?.toLocaleString() || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">Suggested Carrier Payout</p>
                          {load.max_broker_commission && (
                            <p className="text-xs text-gray-500 mt-1">
                              Max Commission: ${load.max_broker_commission.toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col space-y-2">
                          <button
                            onClick={() => handlePlaceBid(load.id)}
                            disabled={broker?.verification_status !== 'verified'}
                            className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Place Bid
                          </button>
                          <button
                            onClick={() => handleViewDetails(load.id)}
                            className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            View Details
                          </button>
                        </div>

                        {load.total_bids > 0 && (
                          <div className="text-xs text-gray-500">
                            {load.total_bids} bid{load.total_bids !== 1 ? 's' : ''} placed
                          </div>
                        )}
                      </div>
                    </div>

                    {broker?.verification_status !== 'verified' && (
                      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
                        <p className="text-sm text-yellow-800">
                          <strong>Account verification required</strong> - Complete verification to place bids
                        </p>
                      </div>
                    )}
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
