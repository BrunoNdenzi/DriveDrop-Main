'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createCampaign, updateCampaign } from '@/lib/api/campaigns'
import { toast } from '@/components/ui/toast'
import type { Campaign, TargetAudience } from '@/types/campaigns'
import EmailTemplateEditor from './EmailTemplateEditor'
import TargetAudienceBuilder from './TargetAudienceBuilder'

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

interface CampaignFormProps {
  existing?: Campaign
}

export default function CampaignForm({ existing }: CampaignFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState(existing?.name ?? '')
  const [subject, setSubject] = useState(existing?.subject ?? '')
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [htmlContent, setHtmlContent] = useState(existing?.htmlContent ?? '')
  const [dailyLimit, setDailyLimit] = useState(existing?.dailyLimit ?? 10)
  const [warmupMode, setWarmupMode] = useState(existing?.warmupMode ?? true)
  const [targetAudience, setTargetAudience] = useState<TargetAudience>(existing?.targetAudience ?? {})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !subject.trim()) {
      toast('Name and subject are required', 'error')
      return
    }
    if (!htmlContent.trim()) {
      toast('Email content is required — select a template or write HTML', 'error')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        subject: subject.trim(),
        htmlContent,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        notes: notes.trim() || undefined,
        dailyLimit: Number(dailyLimit),
        warmupMode,
        targetAudience: Object.keys(targetAudience).length ? targetAudience : undefined,
      }
      if (existing) {
        await updateCampaign(existing.id, payload)
        toast('Campaign updated', 'success')
        router.push(`/dashboard/admin/campaigns/${existing.id}`)
      } else {
        const campaign = await createCampaign(payload)
        toast('Campaign created', 'success')
        router.push(`/dashboard/admin/campaigns/${campaign.id}`)
      }
    } catch (e: any) {
      toast(e.message || 'Failed to save campaign', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Q1 Carrier Outreach"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Subject *</label>
            <input
              required
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="New shipment opportunities for {{companyName}}"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="q1, carriers, southeast"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Internal notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Email Content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Email Content</h2>
        <EmailTemplateEditor value={htmlContent} onChange={setHtmlContent} />
      </div>

      {/* Target Audience */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Target Audience</h2>
        <TargetAudienceBuilder value={targetAudience} onChange={setTargetAudience} />
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Sending Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Daily Send Limit</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={dailyLimit}
              onChange={e => setDailyLimit(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9] focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Increase gradually to protect sender reputation</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Warmup Mode</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setWarmupMode(!warmupMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${warmupMode ? 'bg-[#00B8A9]' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${warmupMode ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm text-gray-600">{warmupMode ? 'ON — emails logged but not sent' : 'OFF — real emails will be sent'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 text-sm font-medium text-white bg-[#00B8A9] rounded-lg hover:bg-teal-600 disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Saving...' : existing ? 'Save Changes' : 'Create Campaign'}
        </button>
      </div>
    </form>
  )
}
