'use client'

import CampaignForm from '@/components/admin/campaigns/CampaignForm'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default function NewCampaignPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/admin/campaigns" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Campaign</h1>
          <p className="text-sm text-gray-500 mt-0.5">Set up a new email outreach campaign</p>
        </div>
      </div>
      <CampaignForm />
    </div>
  )
}
