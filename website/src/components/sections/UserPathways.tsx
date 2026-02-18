'use client'

import Link from 'next/link'
import { Package, Truck, Users, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const roles = [
  {
    icon: Package,
    label: 'Shipper',
    summary: 'Create shipments, receive quotes, track vehicles.',
    capabilities: ['Request quotes', 'Track shipments', 'Manage pickups', 'View invoices'],
    cta: 'Ship a Vehicle',
    href: '/signup?role=client',
    iconBg: 'bg-blue-500',
    dotColor: 'bg-blue-500',
    borderAccent: 'border-l-blue-500',
    ctaBg: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
  {
    icon: Truck,
    label: 'Carrier',
    summary: 'Accept loads, manage routes, confirm deliveries.',
    capabilities: ['Browse loads', 'AI route planning', 'Confirm pickup/delivery', 'Earnings dashboard'],
    cta: 'Find Loads',
    href: '/drivers/register',
    iconBg: 'bg-amber-500',
    dotColor: 'bg-amber-500',
    borderAccent: 'border-l-amber-500',
    ctaBg: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  {
    icon: Users,
    label: 'Broker',
    summary: 'Dispatch across networks, manage carrier assignments.',
    capabilities: ['Multi-board sync', 'Assign carriers', 'Track commissions', 'Client management'],
    cta: 'Connect Network',
    href: '/signup?role=broker',
    iconBg: 'bg-teal-500',
    dotColor: 'bg-teal-500',
    borderAccent: 'border-l-teal-500',
    ctaBg: 'bg-teal-500 hover:bg-teal-600 text-white',
  },
]

export default function UserPathways() {
  return (
    <section className="border-b border-border bg-[#f8fafc]">
      {/* Section Header */}
      <div className="px-6 py-3 border-b border-border">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          Platform Access
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select a role to access the system
        </p>
      </div>

      <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
        {roles.map((role) => (
          <div key={role.label} className={`px-6 py-5 border-l-4 ${role.borderAccent}`}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-8 h-8 ${role.iconBg} rounded flex items-center justify-center`}>
                <role.icon className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{role.label}</h3>
            </div>

            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              {role.summary}
            </p>

            <ul className="space-y-1.5 mb-4">
              {role.capabilities.map((cap) => (
                <li key={cap} className="flex items-center gap-2 text-xs text-foreground">
                  <span className={`w-1.5 h-1.5 rounded-full ${role.dotColor} flex-shrink-0`} />
                  {cap}
                </li>
              ))}
            </ul>

            <Link href={role.href}>
              <Button size="sm" className={`w-full gap-2 ${role.ctaBg}`}>
                {role.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}
