'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { brokerProfileService, brokerAssignmentService } from '@/services/brokerService';
import type { BrokerProfile, BrokerAssignmentWithDetails } from '@/types/broker';
import { 
  Package, 
  Truck, 
  MapPin, 
  Calendar,
  DollarSign,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertCircle,
  User
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default function AssignmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [assignments, setAssignments] = useState<BrokerAssignmentWithDetails[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

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

      const assignmentData = await brokerAssignmentService.getByBrokerId(brokerProfile.id);
      setAssignments(assignmentData);
    } catch (err: any) {
      console.error('Error loading assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'in_transit':
      case 'picked_up':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'accepted':
      case 'assigned':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const filteredAssignments = assignments.filter(assignment => {
    if (filter === 'all') return true;
    if (filter === 'active') return ['assigned', 'accepted', 'in_transit', 'picked_up'].includes(assignment.assignment_status || '');
    if (filter === 'completed') return ['completed', 'delivered'].includes(assignment.assignment_status || '');
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">My Assignments</h1>
        <p className="text-blue-100">
          Track all your active load assignments and carrier performance
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-600">Total Assignments</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{assignments.length}</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Truck className="h-5 w-5 text-orange-600" />
            </div>
            <span className="text-sm text-gray-600">Active</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {assignments.filter(a => ['assigned', 'accepted', 'in_transit', 'picked_up'].includes(a.assignment_status || '')).length}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-600">Completed</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {assignments.filter(a => ['completed', 'delivered'].includes(a.assignment_status || '')).length}
          </p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 rounded-lg">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-600">Total Revenue</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ${assignments.reduce((sum, a) => sum + (a.carrier_payout || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-2">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Assignments
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === 'active'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === 'completed'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Assignments List */}
      <div className="bg-white rounded-xl border border-gray-200">
        {filteredAssignments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Package className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No assignments found
            </h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all' 
                ? 'Start assigning loads to carriers to see them here'
                : `No ${filter} assignments at the moment`}
            </p>
            <Link href="/dashboard/broker/load-board">
              <Button>
                <Package className="h-4 w-4 mr-2" />
                Go to Load Board
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAssignments.map((assignment) => (
              <div key={assignment.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-mono text-gray-500">
                        #{assignment.shipment_id?.slice(0, 8)}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(assignment.assignment_status || 'pending')}`}
                      >
                        {getStatusLabel(assignment.assignment_status || 'pending')}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {assignment.shipment?.title || `Shipment #${assignment.shipment_id.slice(0, 8)}`}
                    </h3>
                  </div>
                  <Link href={`/dashboard/broker/assignments/${assignment.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Pickup */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-50 rounded-lg mt-1">
                      <MapPin className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Pickup</p>
                      <p className="text-sm text-gray-600 truncate">
                        {assignment.shipment?.pickup_city}, {assignment.shipment?.pickup_state}
                      </p>
                    </div>
                  </div>

                  {/* Delivery */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-50 rounded-lg mt-1">
                      <MapPin className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Delivery</p>
                      <p className="text-sm text-gray-600 truncate">
                        {assignment.shipment?.delivery_city}, {assignment.shipment?.delivery_state}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {assignment.carrier?.full_name || 'Carrier TBD'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-900">
                        ${(assignment.carrier_payout || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="h-4 w-4" />
                    {new Date(assignment.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
