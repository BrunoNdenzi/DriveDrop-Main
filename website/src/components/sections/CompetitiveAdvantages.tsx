'use client'

import { Sparkles, Brain, Network, Zap, Shield, TrendingUp } from 'lucide-react'

const advantages = [
  {
    icon: Brain,
    title: 'Benji AI Platform',
    description: 'AI-powered dispatcher, load recommendations, and intelligent route optimization that learns from your operations',
    badge: 'Exclusive',
    color: 'teal',
  },
  {
    icon: Network,
    title: 'Multi-Broker Integration',
    description: 'Synced with Central Dispatch, Montway, and uShip - manage all loads from one dashboard',
    badge: 'Connected',
    color: 'blue',
  },
  {
    icon: Zap,
    title: 'Smart Route Optimization',
    description: 'AI calculates fuel-efficient routes considering traffic, tolls, and delivery windows',
    badge: 'AI-Powered',
    color: 'amber',
  },
  {
    icon: Shield,
    title: 'Real-Time GPS Tracking',
    description: 'Live position updates every 30 seconds with ETA predictions and geofence alerts',
    badge: 'Live',
    color: 'green',
  },
  {
    icon: Sparkles,
    title: 'Document AI Scanner',
    description: 'Instant BOL and POD processing with OCR - no manual data entry required',
    badge: 'Automated',
    color: 'purple',
  },
  {
    icon: TrendingUp,
    title: 'Predictive Analytics',
    description: 'Forecast demand, optimize pricing, and predict maintenance needs before issues occur',
    badge: 'Smart',
    color: 'indigo',
  },
]

export default function CompetitiveAdvantages() {
  const getColorClasses = (color: string) => {
    const colors = {
      teal: 'bg-teal-100 text-teal-800 border-teal-300',
      blue: 'bg-blue-100 text-blue-800 border-blue-300',
      amber: 'bg-amber-100 text-amber-800 border-amber-300',
      green: 'bg-green-100 text-green-800 border-green-300',
      purple: 'bg-purple-100 text-purple-800 border-purple-300',
      indigo: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    }
    return colors[color as keyof typeof colors]
  }

  const getIconBg = (color: string) => {
    const colors = {
      teal: 'bg-teal-500',
      blue: 'bg-blue-500',
      amber: 'bg-amber-500',
      green: 'bg-green-500',
      purple: 'bg-purple-500',
      indigo: 'bg-indigo-500',
    }
    return colors[color as keyof typeof colors]
  }

  return (
    <section className="py-12 bg-gradient-to-b from-gray-50 to-white">
      <div className="container">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-teal-100 border border-teal-300 rounded-full px-4 py-1.5 mb-4">
            <Sparkles className="h-4 w-4 text-teal-600" />
            <span className="text-sm font-semibold text-teal-800">Why DriveDrop Leads</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Enterprise Features That Set Us Apart
          </h2>
          <p className="text-sm text-gray-600 max-w-2xl mx-auto">
            Advanced technology and integrations that traditional load boards can't match
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {advantages.map((advantage) => (
            <div
              key={advantage.title}
              className="bg-white border-2 rounded-lg p-6 hover:shadow-lg transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${getIconBg(advantage.color)} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <advantage.icon className="h-6 w-6 text-white" />
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getColorClasses(advantage.color)}`}>
                  {advantage.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {advantage.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {advantage.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
