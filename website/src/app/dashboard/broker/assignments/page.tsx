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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-gray-900">My Assignments</h1>
        <p className="text-xs text-gray-500">
          Track all your active load assignments and carrier performance
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-teal-50 rounded-md">
              <Package className="h-4 w-4 text-teal-500" />
            </div>
            <span className="text-xs text-gray-600">Total Assignments</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{assignments.length}</p>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-orange-50 rounded-md">
              <Truck className="h-4 w-4 text-orange-600" />
            </div>
            <span className="text-xs text-gray-600">Active</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {assignments.filter(a => ['assigned', 'accepted', 'in_transit', 'picked_up'].includes(a.assignment_status || '')).length}
          </p>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-green-50 rounded-md">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <span className="text-xs text-gray-600">Completed</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {assignments.filter(a => ['completed', 'delivered'].includes(a.assignment_status || '')).length}
          </p>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-purple-50 rounded-md">
              <DollarSign className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-xs text-gray-600">Total Revenue</span>
          </div>
          <p className="text-xl font-bold text-gray-900">
            ${assignments.reduce((sum, a) => sum + (a.carrier_payout || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-md border border-gray-200 p-1.5">
        <div className="flex gap-1">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === 'all'
                ? 'bg-teal-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Assignments
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === 'active'
                ? 'bg-teal-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
              filter === 'completed'
                ? 'bg-teal-500 text-white'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Assignments List */}
      <div className="bg-white rounded-md border border-gray-200">
        {filteredAssignments.length === 0 ? (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 rounded-md mb-3">
              <Package className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              No assignments found
            </h3>
            <p className="text-xs text-gray-500 mb-4">
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
              <div key={assignment.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
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
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Pickup */}
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 bg-green-50 rounded-md mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Pickup</p>
                      <p className="text-sm text-gray-600 truncate">
                        {assignment.shipment?.pickup_city}, {assignment.shipment?.pickup_state}
                      </p>
                    </div>
                  </div>

                  {/* Delivery */}
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 bg-red-50 rounded-md mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-red-600" />
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
