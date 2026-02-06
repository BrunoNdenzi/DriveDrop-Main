'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Package, Truck, Users, ArrowRight, Sparkles } from 'lucide-react'

interface SignUpRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const userRoles = [
  {
    role: 'client',
    icon: Package,
    title: 'Shipper / Client',
    description: 'Ship vehicles with instant quotes, real-time tracking, and trusted carriers',
    features: ['Instant pricing calculator', 'Live GPS tracking', 'Insurance included', '24/7 support'],
    href: '/signup?role=client',
    gradient: 'from-blue-500 to-blue-600',
    bgGradient: 'from-blue-50 to-blue-100',
    borderColor: 'border-blue-200',
  },
  {
    role: 'driver',
    icon: Truck,
    title: 'Carrier / Driver',
    description: 'Find high-paying loads, optimize routes with AI, and grow your business',
    features: ['AI route optimization', 'Smart load matching', 'Weekly payments', 'Fuel tracking'],
    href: '/drivers/register',
    gradient: 'from-amber-500 to-amber-600',
    bgGradient: 'from-amber-50 to-amber-100',
    borderColor: 'border-amber-200',
  },
  {
    role: 'broker',
    icon: Users,
    title: 'Broker / Partner',
    description: 'Connect your network with multi-broker integrations and automated dispatch',
    features: ['Multi-broker sync', 'Commission tracking', 'Carrier management', 'Client portal'],
    href: '/signup?role=broker',
    gradient: 'from-teal-500 to-teal-600',
    bgGradient: 'from-teal-50 to-teal-100',
    borderColor: 'border-teal-200',
  },
]

export default function SignUpRoleModal({ open, onOpenChange }: SignUpRoleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle className="text-2xl">Choose Your Account Type</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Select the role that best describes how you'll use DriveDrop
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-6 py-6">
          {userRoles.map((roleOption) => (
            <Link
              key={roleOption.role}
              href={roleOption.href}
              onClick={() => onOpenChange(false)}
              className="group block"
            >
              <div className={`h-full bg-gradient-to-br ${roleOption.bgGradient} border-2 ${roleOption.borderColor} rounded-xl p-6 hover:shadow-xl transition-all transform hover:scale-105`}>
                {/* Icon */}
                <div className={`w-14 h-14 bg-gradient-to-br ${roleOption.gradient} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <roleOption.icon className="h-7 w-7 text-white" />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {roleOption.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                  {roleOption.description}
                </p>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {roleOption.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                      <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${roleOption.gradient} flex-shrink-0`} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button 
                  className={`w-full bg-gradient-to-r ${roleOption.gradient} hover:opacity-90 text-white group-hover:translate-x-1 transition-transform`}
                  size="lg"
                >
                  Sign Up as {roleOption.title.split('/')[0].trim()}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </Link>
          ))}
        </div>

        <div className="text-center text-sm text-muted-foreground pt-4 border-t">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline" onClick={() => onOpenChange(false)}>
            Log in here
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
