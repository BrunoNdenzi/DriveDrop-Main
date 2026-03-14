'use client'

import { useState } from 'react'
import { exportReport } from '@/lib/api/analytics'
import { toast } from '@/components/ui/toast'
import { Download, Loader2 } from 'lucide-react'

interface ExportButtonProps {
  campaignId?: string
  className?: string
}

export default function ExportButton({ campaignId, className }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const blob = await exportReport(campaignId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = campaignId ? `campaign-${campaignId}-report.csv` : `analytics-report-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast('Report downloaded', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className ?? ''}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Export CSV
    </button>
  )
}
