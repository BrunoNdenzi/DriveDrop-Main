'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { 
  Plus, 
  Search, 
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Upload,
  Download,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type ShipmentStatus = 'pending_quote' | 'quoted' | 'booked' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';

interface BrokerShipment {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_zip: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip: string;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_type: string;
  vehicle_condition: string;
  distance_miles: number;
  estimated_price: number;
  status: ShipmentStatus;
  pickup_date: string | null;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function BrokerShipmentsPage() {
  const router = useRouter();
  const [shipments, setShipments] = useState<BrokerShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'all'>('all');
  const [selectedShipments, setSelectedShipments] = useState<string[]>([]);

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch broker shipments
      const { data, error } = await supabase
        .from('broker_shipments')
        .select('*')
        .eq('broker_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setShipments(data || []);
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ShipmentStatus) => {
    const statusConfig = {
      pending_quote: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: 'Pending Quote' },
      quoted: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Package, label: 'Quoted' },
      booked: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: CheckCircle, label: 'Booked' },
      assigned: { color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: TrendingUp, label: 'Assigned' },
      in_transit: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: TrendingUp, label: 'In Transit' },
      delivered: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, label: 'Delivered' },
      cancelled: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, label: 'Cancelled' },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </span>
    );
  };

  const getFilteredShipments = () => {
    return shipments.filter(shipment => {
      const matchesSearch = searchTerm === '' || 
        shipment.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.vehicle_make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.vehicle_model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.pickup_city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.delivery_city.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  };

  const filteredShipments = getFilteredShipments();

  const stats = {
    total: shipments.length,
    pending: shipments.filter(s => s.status === 'pending_quote' || s.status === 'quoted').length,
    active: shipments.filter(s => s.status === 'booked' || s.status === 'assigned' || s.status === 'in_transit').length,
    completed: shipments.filter(s => s.status === 'delivered').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">My Shipments</h1>
          <p className="text-gray-600 mt-1">Manage shipments you've created for your clients</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/broker/shipments/bulk-upload')}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Bulk Upload
          </Button>
          <Button
            onClick={() => router.push('/dashboard/broker/shipments/create')}
            className="bg-teal-500 hover:bg-teal-600 gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Shipment
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Shipments</p>
              <p className="text-xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Pending</p>
              <p className="text-xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Active</p>
              <p className="text-xl font-bold text-orange-600 mt-2">{stats.active}</p>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Completed</p>
              <p className="text-xl font-bold text-green-600 mt-2">{stats.completed}</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-md border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by client, vehicle, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ShipmentStatus | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending_quote">Pending Quote</option>
              <option value="quoted">Quoted</option>
              <option value="booked">Booked</option>
              <option value="assigned">Assigned</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
        {filteredShipments.length === 0 ? (
          <div className="text-center p-8">
            <Package className="h-8 w-8 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm || statusFilter !== 'all' ? 'No shipments found' : 'No shipments yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Create your first shipment to get started'}
            </p>
            <Button
              onClick={() => router.push('/dashboard/broker/shipments/create')}
              className="bg-teal-500 hover:bg-teal-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Shipment
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredShipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{shipment.client_name}</div>
                      <div className="text-sm text-gray-500">{shipment.client_email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
                      </div>
                      <div className="text-sm text-gray-500">{shipment.vehicle_type}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{shipment.pickup_city}, {shipment.pickup_state}</div>
                      <div className="text-sm text-gray-500">→ {shipment.delivery_city}, {shipment.delivery_state}</div>
                      <div className="text-xs text-gray-400">{shipment.distance_miles} miles</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(shipment.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        ${shipment.estimated_price.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(shipment.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/broker/shipments/${shipment.id}`)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/broker/shipments/${shipment.id}/edit`)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
