'use client'

import Link from 'next/link'
import { Package, Truck, Users, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const userTypes = [
  {
    icon: Package,
    label: 'I am a Shipper',
    description: 'Move vehicles with trusted carriers across Texas. Real-time tracking and instant quotes.',
    features: ['Instant pricing', 'Live tracking', 'Broker network', 'Insurance included'],
    cta: 'Ship a Vehicle',
    href: '/signup?role=client',
    gradient: 'from-blue-500 to-blue-600',
    bgGradient: 'from-blue-50 to-blue-100',
  },
  {
    icon: Truck,
    label: 'I am a Carrier',
    description: 'Find high-value loads, optimize routes with AI, and get paid fast with our carrier platform.',
    features: ['AI route optimization', 'Smart load matching', 'Quick payments', 'Fuel cost tracking'],
    cta: 'Find Loads',
    href: '/drivers/register',
    gradient: 'from-amber-500 to-amber-600',
    bgGradient: 'from-amber-50 to-amber-100',
  },
  {
    icon: Users,
    label: 'I am a Broker',
    description: 'Connect to our broker network with Central Dispatch, Montway, and uShip integrations.',
    features: ['Multi-broker sync', 'Automated dispatch', 'Commission tracking', 'Client portal'],
    cta: 'Connect Network',
    href: '/signup?role=broker',
    gradient: 'from-teal-500 to-teal-600',
    bgGradient: 'from-teal-50 to-teal-100',
  },
]

export default function UserPathways() {
  return (
    <section className="py-12 bg-white">
      <div className="container">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Choose Your Platform Experience
          </h2>
          <p className="text-sm text-gray-600">
            Tailored solutions for shippers, carriers, and brokers
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {userTypes.map((type) => (
            <div
              key={type.label}
              className="group relative bg-white border-2 rounded-lg overflow-hidden hover:shadow-xl transition-all"
            >
              {/* Gradient Header */}
              <div className={`bg-gradient-to-br ${type.bgGradient} p-6 border-b-2`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 bg-gradient-to-br ${type.gradient} rounded-lg flex items-center justify-center`}>
                    <type.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{type.label}</h3>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {type.description}
                </p>
              </div>

              {/* Features */}
              <div className="p-6">
                <ul className="space-y-2 mb-6">
                  {type.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                      <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${type.gradient}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href={type.href}>
                  <Button 
                    className={`w-full bg-gradient-to-r ${type.gradient} hover:opacity-90 text-white`}
                    size="lg"
                  >
                    {type.cta}
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
