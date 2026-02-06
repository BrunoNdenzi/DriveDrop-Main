'use client'

import { Monitor, Smartphone } from 'lucide-react'

export default function PlatformPreview() {
  return (
    <section className="py-12 bg-gradient-to-b from-gray-50 to-white">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Enterprise Logistics Platform
          </h2>
          <p className="text-sm text-gray-600">
            Complete visibility and control across your entire fleet operation
          </p>
        </div>

        {/* Platform Screenshots */}
        <div className="relative max-w-6xl mx-auto">
          {/* Desktop View */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-3 shadow-2xl">
            <div className="bg-white rounded overflow-hidden">
              {/* Browser Chrome */}
              <div className="bg-gray-100 px-3 py-2 flex items-center gap-2 border-b">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 bg-white rounded px-3 py-1 text-xs text-gray-500 flex items-center gap-2">
                  <Monitor className="h-3 w-3" />
                  <span>drivedrop.com/dashboard</span>
                </div>
              </div>

              {/* Platform UI Mockup */}
              <div className="bg-white p-6">
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {/* Stats Cards */}
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100 border-2 border-teal-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-teal-700 mb-1">Active Routes</div>
                    <div className="text-2xl font-bold text-teal-900">47</div>
                    <div className="text-xs text-teal-600 mt-1">↑ 12% today</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-blue-700 mb-1">In Transit</div>
                    <div className="text-2xl font-bold text-blue-900">128</div>
                    <div className="text-xs text-blue-600 mt-1">85% capacity</div>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-amber-700 mb-1">Deliveries</div>
                    <div className="text-2xl font-bold text-amber-900">1,247</div>
                    <div className="text-xs text-amber-600 mt-1">This month</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-4">
                    <div className="text-xs font-medium text-green-700 mb-1">On-Time Rate</div>
                    <div className="text-2xl font-bold text-green-900">98.2%</div>
                    <div className="text-xs text-green-600 mt-1">↑ 2.1% vs last</div>
                  </div>
                </div>

                {/* Live Shipments Table */}
                <div className="bg-gray-50 rounded-lg border-2">
                  <div className="bg-gray-100 px-4 py-2 border-b flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">LIVE SHIPMENTS</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-gray-600">Real-time updates</span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {[
                      { id: 'SH-8421', route: 'Austin → Dallas', driver: 'M. Rodriguez', status: 'In Transit', progress: 68 },
                      { id: 'SH-8420', route: 'Houston → Austin', driver: 'S. Chen', status: 'Pickup', progress: 100 },
                      { id: 'SH-8419', route: 'San Antonio → Dallas', driver: 'J. Martinez', status: 'In Transit', progress: 42 },
                    ].map((shipment) => (
                      <div key={shipment.id} className="px-4 py-3 grid grid-cols-5 gap-4 items-center text-xs">
                        <span className="font-mono font-semibold text-gray-900">{shipment.id}</span>
                        <span className="text-gray-700">{shipment.route}</span>
                        <span className="text-gray-600">{shipment.driver}</span>
                        <span className="text-amber-700 font-medium">{shipment.status}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-teal-500 h-1.5 rounded-full" 
                              style={{ width: `${shipment.progress}%` }}
                            />
                          </div>
                          <span className="text-gray-500 text-xs">{shipment.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Preview Badge */}
          <div className="absolute -bottom-6 -right-6 bg-white rounded-lg shadow-xl border-2 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Smartphone className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-900">Mobile App Available</div>
              <div className="text-xs text-gray-600">iOS & Android</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
