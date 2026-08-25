'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, CheckCircle, MapPin, ShieldCheck, Truck } from '@/components/icons/streamline-lucide'

import SignUpRoleModal from '@/components/auth/SignUpRoleModal'

const serviceSignals = [
  { icon: ShieldCheck, label: 'Verified drivers' },
  { icon: MapPin, label: 'Live tracking' },
  { icon: CheckCircle, label: 'Accountable delivery' },
]

export default function OperationalHero() {
  const [showSignUpModal, setShowSignUpModal] = useState(false)

  return (
    <section className="border-b border-[#cbd8d6] bg-white">
      <div className="relative flex min-h-[calc(100svh-12rem)] items-end overflow-hidden bg-[#173436]">
        <Image
          src="/images/vehicle-carrier-highway.jpg"
          alt="Vehicles secured on a carrier traveling along a highway"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-[62%_center] sm:object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,32,34,.94)_0%,rgba(10,32,34,.76)_43%,rgba(10,32,34,.16)_82%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(10,32,34,.45)_0%,transparent_45%)] sm:hidden" />

        <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-10 pt-24 sm:px-10 sm:pb-14 lg:px-16">
          <div className="max-w-2xl text-white">
            <div className="mb-5 inline-flex items-center gap-2 border border-white/30 bg-[#173436]/75 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em]">
              <Truck className="h-4 w-4 text-[#5cd6ca]" />
              Nationwide vehicle transport
            </div>
            <h1 className="text-5xl font-semibold leading-none sm:text-6xl lg:text-7xl">DriveDrop</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[#e0ecea] sm:text-xl">
              Ship vehicles with verified drivers, live tracking, and one accountable team from pickup to delivery.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/#quote" className="flex h-11 items-center justify-center gap-2 bg-[#00a99d] px-5 text-sm font-bold text-white transition-colors hover:bg-[#008c82] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#173436]">
                Get a shipping quote
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login?redirect=/dashboard/client/track" className="flex h-11 items-center justify-center border border-white/55 bg-[#173436]/60 px-5 text-sm font-bold text-white transition-colors hover:bg-[#173436]/80 focus:outline-none focus:ring-2 focus:ring-white">
                Track a shipment
              </Link>
            </div>

            <button type="button" onClick={() => setShowSignUpModal(true)} className="mt-5 text-sm font-semibold text-[#d5e6e3] underline decoration-white/40 underline-offset-4 hover:text-white">
              Create a DriveDrop account
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1440px] grid-cols-3 gap-px border-x border-[#cbd8d6] bg-[#cbd8d6]">
        {serviceSignals.map(({ icon: Icon, label }) => (
          <div key={label} className="flex min-h-14 items-center justify-center gap-2 bg-white px-2 py-3 text-center sm:justify-start sm:px-6 sm:text-left">
            <Icon className="hidden h-4 w-4 shrink-0 text-[#008c82] sm:block" />
            <span className="text-xs font-semibold leading-4 text-[#304b4c] sm:text-sm">{label}</span>
          </div>
        ))}
      </div>

      <SignUpRoleModal open={showSignUpModal} onOpenChange={setShowSignUpModal} />
    </section>
  )
}