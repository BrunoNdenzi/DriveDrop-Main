'use client'

import { useState } from 'react'
import CarriersList from '@/components/admin/carriers/CarriersList'
import EnrichmentForm from '@/components/admin/carriers/EnrichmentForm'
import BulkEnrichModal from '@/components/admin/carriers/BulkEnrichModal'
import { Upload, Search } from 'lucide-react'

export default function CarriersPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [enrichDot, setEnrichDot] = useState('')

  function handleEnrich(dot: string) {
    setEnrichDot(dot)
    // Scroll to enrich form
    document.getElementById('enrich-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleComplete() {
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carrier Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Enrich FMCSA carrier data with contact emails</p>
        </div>
        <button
          onClick={() => setShowBulkModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00B8A9] text-white rounded-lg text-sm font-medium hover:bg-[#009e92] transition-colors"
        >
          <Upload className="h-4 w-4" /> Bulk Enrich CSV
        </button>
      </div>

      {/* Single enrich form */}
      <div id="enrich-form">
        <EnrichmentForm
          onSuccess={() => setRefreshKey(k => k + 1)}
        />
      </div>

      {/* Carriers List */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Enriched Carriers</h2>
        <CarriersList key={refreshKey} onEnrich={handleEnrich} />
      </div>

      {/* Bulk modal */}
      {showBulkModal && (
        <BulkEnrichModal
          onClose={() => setShowBulkModal(false)}
          onComplete={() => {
            handleComplete()
            setShowBulkModal(false)
          }}
        />
      )}
    </div>
  )
}
