'use client'

import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

const marketData = [
  { route: 'Austin → Houston', loads: 247, avgRate: '$385', trend: 'up', change: '+12%' },
  { route: 'Dallas → San Antonio', loads: 183, avgRate: '$420', trend: 'up', change: '+8%' },
  { route: 'Houston → Dallas', loads: 312, avgRate: '$405', trend: 'down', change: '-3%' },
  { route: 'San Antonio → Austin', loads: 156, avgRate: '$295', trend: 'up', change: '+5%' },
]

export default function LiveMarketData() {
  return (
    <section className="py-12 bg-white border-y-2">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Texas Market Activity
            </h2>
            <p className="text-sm text-gray-600">
              Live load availability and average rates updated every 5 minutes
            </p>
          </div>
          <div className="flex items-center gap-2 bg-green-100 border-2 border-green-300 rounded-lg px-4 py-2">
            <Activity className="h-4 w-4 text-green-600 animate-pulse" />
            <span className="text-sm font-semibold text-green-800">LIVE DATA</span>
          </div>
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 border-2 border-teal-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-teal-900 mb-1">898</div>
            <div className="text-sm font-medium text-teal-700">Available Loads Now</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-900 mb-1">$372</div>
            <div className="text-sm font-medium text-blue-700">Average Rate/Load</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-amber-900 mb-1">24min</div>
            <div className="text-sm font-medium text-amber-700">Average Match Time</div>
          </div>
        </div>

        {/* Market Table */}
        <div className="bg-white border-2 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b-2">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Popular Route
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Available Loads
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  Avg Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                  24h Change
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {marketData.map((market) => (
                <tr key={market.route} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {market.route}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full">
                      {market.loads} loads
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    {market.avgRate}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {market.trend === 'up' ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-bold text-green-700">{market.change}</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-bold text-red-700">{market.change}</span>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          * Market data represents current DriveDrop platform activity and connected broker networks
        </p>
      </div>
    </section>
  )
}
