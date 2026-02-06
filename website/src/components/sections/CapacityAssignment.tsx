'use client'

import { Truck, Users, Package, TrendingUp } from 'lucide-react'

interface CapacityMetric {
  label: string
  current: number
  total: number
  unit: string
  icon: React.ReactNode
}

const capacityMetrics: CapacityMetric[] = [
  {
    label: 'Active Drivers',
    current: 47,
    total: 65,
    unit: 'drivers',
    icon: <Users className="h-5 w-5" />,
  },
  {
    label: 'Fleet Vehicles',
    current: 52,
    total: 65,
    unit: 'vehicles',
    icon: <Truck className="h-5 w-5" />,
  },
  {
    label: 'Assigned Shipments',
    current: 128,
    total: 150,
    unit: 'loads',
    icon: <Package className="h-5 w-5" />,
  },
  {
    label: 'Route Utilization',
    current: 87,
    total: 100,
    unit: '%',
    icon: <TrendingUp className="h-5 w-5" />,
  },
]

interface Assignment {
  id: string
  shipmentId: string
  driver: string
  route: string
  status: 'assigned' | 'in-transit' | 'pending'
  distance: number
  eta: string
}

const recentAssignments: Assignment[] = [
  {
    id: 'A-1024',
    shipmentId: 'SH-2847',
    driver: 'John Martinez',
    route: 'Austin → Houston',
    status: 'in-transit',
    distance: 186,
    eta: '14:00',
  },
  {
    id: 'A-1023',
    shipmentId: 'SH-2846',
    driver: 'Sarah Chen',
    route: 'Dallas → San Antonio',
    status: 'in-transit',
    distance: 274,
    eta: '16:30',
  },
  {
    id: 'A-1022',
    shipmentId: 'SH-2845',
    driver: 'Mike Rodriguez',
    route: 'Houston → Austin',
    status: 'assigned',
    distance: 165,
    eta: '09:00 +1',
  },
  {
    id: 'A-1021',
    shipmentId: 'SH-2844',
    driver: 'Lisa Wong',
    route: 'San Antonio → Dallas',
    status: 'assigned',
    distance: 283,
    eta: '11:30 +1',
  },
]

export default function CapacityAssignment() {
  const getStatusColor = (status: Assignment['status']) => {
    switch (status) {
      case 'in-transit':
        return 'text-amber-700 bg-amber-100'
      case 'assigned':
        return 'text-teal-700 bg-teal-100'
      default:
        return 'text-gray-700 bg-gray-100'
    }
  }

  const getStatusLabel = (status: Assignment['status']) => {
    switch (status) {
      case 'in-transit':
        return 'IN TRANSIT'
      case 'assigned':
        return 'ASSIGNED'
      default:
        return 'PENDING'
    }
  }

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-amber-500'
    return 'bg-green-500'
  }

  return (
    <section className="py-12 bg-white">
      <div className="container">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Capacity & Assignment
          </h2>
          <p className="text-sm text-gray-600">
            Fleet utilization and load assignment overview
          </p>
        </div>

        {/* Capacity Metrics */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {capacityMetrics.map((metric) => {
            const percentage = (metric.current / metric.total) * 100
            return (
              <div key={metric.label} className="bg-white border-2 rounded-lg p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      percentage >= 90 ? 'bg-red-50 text-red-600' :
                      percentage >= 75 ? 'bg-amber-50 text-amber-600' :
                      'bg-green-50 text-green-600'
                    }`}>
                      {metric.icon}
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    percentage >= 90 ? 'bg-red-100 text-red-700' :
                    percentage >= 75 ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {percentage.toFixed(0)}%
                  </span>
                </div>
                
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-600 mb-1">{metric.label}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {metric.current}
                    </span>
                    <span className="text-lg text-gray-500">
                      / {metric.total}
                    </span>
                  </div>
                </div>
                
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${getUtilizationColor(percentage)}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Assignment Table */}
        <div className="bg-white rounded-lg border-2 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b px-6 py-4">
            <h3 className="font-semibold text-gray-900 text-lg">Recent Assignments</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Assignment ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Shipment
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Distance
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    ETA
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {recentAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {assignment.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                      {assignment.shipmentId}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {assignment.driver}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                      {assignment.route}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {assignment.distance} mi
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">
                      {assignment.eta}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-bold px-3 py-1.5 rounded-full ${getStatusColor(
                          assignment.status
                        )}`}
                      >
                        {getStatusLabel(assignment.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
