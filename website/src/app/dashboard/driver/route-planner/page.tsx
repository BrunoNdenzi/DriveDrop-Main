'use client'

import { useAuth } from '@/hooks/useAuth'
import RouteOptimizer from '@/components/driver/RouteOptimizer'
import { BenjiChat } from '@/components/benji/BenjiChat'

export default function RoutePlannerPage() {
  const { user, profile } = useAuth()

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Route Planner</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI-powered route optimization with Carolina corridor intelligence and Benji assistance
        </p>
      </div>

      {/* Route Optimizer Component */}
      <RouteOptimizer driverId={user?.id || ''} />

      {/* Benji Chat Widget */}
      <BenjiChat userType="driver" />
    </div>
  )
}
