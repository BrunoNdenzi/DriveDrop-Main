'use client'

import { useState } from 'react'
import { enrichCarrier } from '@/lib/api/carriers'
import { CarrierContact } from '@/types/campaigns'
import { toast } from '@/components/ui/toast'
import { Loader2, Search } from 'lucide-react'

interface EnrichmentFormProps {
  onSuccess?: (carrier: CarrierContact) => void
}

export default function EnrichmentForm({ onSuccess }: EnrichmentFormProps) {
  const [dotNumber, setDotNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CarrierContact | null>(null)

  async function handleEnrich() {
    const dot = dotNumber.trim().replace(/\D/g, '')
    if (!dot) return
    setLoading(true)
    setResult(null)
    try {
      const carrier = await enrichCarrier({
        dotNumber: dot,
        companyName: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        operatingStatus: '',
      })
      setResult(carrier)
      toast(`Enriched ${carrier.company_name || dot}`, 'success')
      onSuccess?.(carrier)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Enrichment failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-base font-semibold text-gray-900">Enrich Single Carrier by DOT#</h3>
      <div className="flex gap-3">
        <input
          type="text"
          value={dotNumber}
          onChange={e => setDotNumber(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleEnrich() }}
          placeholder="e.g. 3876543"
          className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9]"
        />
        <button
          onClick={handleEnrich}
          disabled={!dotNumber.trim() || loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#00B8A9] text-white rounded-lg text-sm font-medium hover:bg-[#009e92] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Enriching...</>
          ) : (
            <><Search className="h-4 w-4" /> Enrich</>
          )}
        </button>
      </div>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
          <p className="font-semibold text-green-800 mb-2">✅ {result.company_name}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-green-700">
            {result.email && <p>Email: <span className="font-medium">{result.email}</span></p>}
            {result.phone && <p>Phone: <span className="font-medium">{result.phone}</span></p>}
            {result.state && <p>State: <span className="font-medium">{result.state}</span></p>}
            {result.power_units && <p>Power Units: <span className="font-medium">{result.power_units}</span></p>}
          </div>
        </div>
      )}
    </div>
  )
}
