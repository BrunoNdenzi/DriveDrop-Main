'use client'

import { Package, MapPin, Truck, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface LifecycleStage {
  id: string
  label: string
  status: 'completed' | 'active' | 'pending' | 'exception'
  timestamp?: string
  location?: string
  notes?: string
}

const sampleStages: LifecycleStage[] = [
  {
    id: 'created',
    label: 'Shipment Created',
    status: 'completed',
    timestamp: '2026-02-01 08:30',
    location: 'Austin, TX',
  },
  {
    id: 'assigned',
    label: 'Driver Assigned',
    status: 'completed',
    timestamp: '2026-02-01 09:15',
    notes: 'John D. - CDL Verified',
  },
  {
    id: 'pickup',
    label: 'Vehicle Pickup',
    status: 'completed',
    timestamp: '2026-02-02 07:00',
    location: 'Austin, TX 78701',
  },
  {
    id: 'transit',
    label: 'In Transit',
    status: 'active',
    timestamp: '2026-02-02 08:30',
    location: 'I-10 E, Mile Marker 742',
  },
  {
    id: 'delivery',
    label: 'Delivery',
    status: 'pending',
    location: 'Houston, TX 77001',
  },
  {
    id: 'completed',
    label: 'Shipment Completed',
    status: 'pending',
  },
]

export default function ShipmentLifecycle() {
  const getStatusColor = (status: LifecycleStage['status']) => {
    switch (status) {
      case 'completed':
        return 'border-green-600 bg-green-50'
      case 'active':
        return 'border-amber-600 bg-amber-50'
      case 'exception':
        return 'border-red-600 bg-red-50'
      default:
        return 'border-gray-300 bg-white'
    }
  }

  const getStatusIcon = (status: LifecycleStage['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-600" />
      case 'active':
        return <Clock className="h-6 w-6 text-amber-600" />
      case 'exception':
        return <AlertCircle className="h-6 w-6 text-red-600" />
      default:
        return <Clock className="h-6 w-6 text-gray-400" />
    }
  }

  const getIcon = (id: string) => {
    switch (id) {
      case 'created':
        return <Package className="h-5 w-5" />
      case 'assigned':
      case 'transit':
        return <Truck className="h-5 w-5" />
      case 'pickup':
      case 'delivery':
        return <MapPin className="h-5 w-5" />
      case 'completed':
        return <CheckCircle className="h-5 w-5" />
      default:
        return null
    }
  }

  return (
    <section className="py-12 bg-white">
      <div className="container">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Shipment Lifecycle
          </h2>
          <p className="text-sm text-gray-600">
            Real-time state tracking from creation to delivery completion
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {sampleStages.map((stage, index) => (
            <div
              key={stage.id}
              className={`relative border-2 rounded-lg p-4 transition-all ${
                stage.status === 'active' 
                  ? 'shadow-lg scale-105' 
                  : stage.status === 'completed'
                  ? 'shadow'
                  : 'opacity-60'
              } ${getStatusColor(stage.status)}`}
            >
              {/* Connector Line */}
              {index < sampleStages.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gray-300" />
              )}

              {/* Status Icon */}
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                  {getStatusIcon(stage.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-gray-600">{getIcon(stage.id)}</div>
                    <h3 className="font-semibold text-gray-900 text-lg">{stage.label}</h3>
                  </div>
                  {stage.status === 'active' && (
                    <span className="inline-block text-xs font-bold text-amber-800 bg-amber-200 px-2.5 py-1 rounded-full mb-2">
                      ACTIVE
                    </span>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 ml-10">
                {stage.timestamp && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="font-medium text-gray-700">{stage.timestamp}</span>
                  </div>
                )}

                {stage.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-700">{stage.location}</span>
                  </div>
                )}

                {stage.notes && (
                  <p className="text-sm text-gray-600 pt-2 border-t border-gray-200 mt-2">
                    {stage.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
