'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Campaign } from '@/types/campaigns'
import { getCampaign } from '@/lib/api/campaigns'
import CampaignForm from '@/components/admin/campaigns/CampaignForm'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'

export default function EditCampaignPage() {
  const params = useParams()
  const id = params?.id as string
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const c = await getCampaign(id)
      setCampaign(c)
    } catch {
      // no-op
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-[#00B8A9]" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="text-center py-32 text-gray-400">
        <p className="mb-2">Campaign not found</p>
        <Link href="/dashboard/admin/campaigns" className="text-[#00B8A9] hover:underline text-sm">Back to campaigns</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/admin/campaigns/${id}`} className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Campaign</h1>
          <p className="text-sm text-gray-500 mt-0.5">{campaign.name}</p>
        </div>
      </div>
      <CampaignForm existing={campaign} />
    </div>
  )
}
