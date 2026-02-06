'use client'

import { MapPin, Navigation, Truck } from 'lucide-react'

interface RoutePoint {
  id: string
  label: string
  type: 'origin' | 'destination' | 'waypoint'
  address: string
  status: 'completed' | 'active' | 'pending'
  eta?: string
  distance?: number
}

const sampleRoute: RoutePoint[] = [
  {
    id: 'origin',
    label: 'Pickup Location',
    type: 'origin',
    address: '1234 Oak Street, Austin, TX 78701',
    status: 'completed',
  },
  {
    id: 'waypoint-1',
    label: 'Route Checkpoint',
    type: 'waypoint',
    address: 'I-10 E @ San Antonio, TX',
    status: 'completed',
    distance: 80,
  },
  {
    id: 'current',
    label: 'Current Position',
    type: 'waypoint',
    address: 'I-10 E @ Columbus, TX (Mile 742)',
    status: 'active',
    distance: 168,
  },
  {
    id: 'destination',
    label: 'Delivery Location',
    type: 'destination',
    address: '5678 Commerce Blvd, Houston, TX 77001',
    status: 'pending',
    eta: '2026-02-03 14:00',
    distance: 186,
  },
]

export default function RouteExecution() {
  const getStatusColor = (status: RoutePoint['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'active':
        return 'bg-amber-500'
      default:
        return 'bg-gray-300'
    }
  }

  const getPointStyle = (type: RoutePoint['type'], status: RoutePoint['status']) => {
    const baseStyle = 'w-4 h-4 rounded-full border-2 bg-white'
    if (status === 'active') {
      return `${baseStyle} border-amber-500 ring-4 ring-amber-200`
    }
    if (status === 'completed') {
      return `${baseStyle} border-green-500`
    }
    return `${baseStyle} border-gray-300`
  }

  return (
    <section className="py-12 bg-gray-50">
      <div className="container">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Route Execution
          </h2>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="font-semibold">186 miles</span>
            <span>•</span>
            <span>ETA 14:00</span>
            <span>•</span>
            <span className="text-amber-600 font-medium">2h 30m remaining</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Route Timeline */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border shadow-sm p-6 h-full">
              <div className="space-y-6">
                {sampleRoute.map((point, index) => (
                  <div key={point.id} className="flex gap-4">
                    {/* Route Line */}
                    <div className="flex flex-col items-center">
                      <div className={`relative ${getPointStyle(point.type, point.status)}`}>
                        {point.status === 'active' && (
                          <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping" />
                        )}
                      </div>
                      {index < sampleRoute.length - 1 && (
                        <div
                          className={`w-1 h-full min-h-[80px] ${getStatusColor(
                            point.status
                          )}`}
                        />
                      )}
                    </div>

                    {/* Point Details */}
                    <div className="flex-1 pb-2">
                      <div className="flex items-start gap-3 mb-2">
                        {point.type === 'origin' && (
                          <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-5 w-5 text-green-600" />
                          </div>
                        )}
                        {point.type === 'destination' && (
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-5 w-5 text-gray-600" />
                          </div>
                        )}
                        {point.type === 'waypoint' && point.status === 'active' && (
                          <div className="w-8 h-8 bg-amber-100 rounded flex items-center justify-center flex-shrink-0">
                            <Truck className="h-5 w-5 text-amber-600" />
                          </div>
                        )}
                        {point.type === 'waypoint' && point.status !== 'active' && (
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                            <Navigation className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{point.label}</h3>
                            {point.status === 'active' && (
                              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                CURRENT
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 leading-relaxed">{point.address}</p>
                          <div className="flex gap-4 mt-2">
                            {point.distance !== undefined && (
                              <span className="text-xs text-gray-500">
                                {point.distance} mi from origin
                              </span>
                            )}
                            {point.eta && (
                              <span className="text-xs font-semibold text-gray-700">
                                ETA: {point.eta}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Map Placeholder */}
          <div className="lg:col-span-3">
            <div className="h-full min-h-[400px] bg-white rounded-lg border shadow-sm relative overflow-hidden">
              {/* Map Overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-50">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8 max-w-md">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <MapPin className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Route Map Visualization</h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Real-time GPS tracking and route overlay
                    </p>
                    
                    <div className="space-y-3 bg-white rounded-lg border p-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700 font-medium">Origin: Austin, TX</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0 relative">
                          <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping" />
                        </div>
                        <span className="text-sm text-gray-700 font-medium">Current: Mile 742, I-10 E</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-700 font-medium">Destination: Houston, TX</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
