'use client'

import { useEffect, useState } from 'react'
import CarriersList from '@/components/admin/carriers/CarriersList'
import EnrichmentForm from '@/components/admin/carriers/EnrichmentForm'
import BulkEnrichModal from '@/components/admin/carriers/BulkEnrichModal'
import ContactsTab from '@/components/admin/carriers/ContactsTab'
import EnrichmentStats from '@/components/admin/carriers/EnrichmentStats'
import { Upload, Truck, Building2, Store, Package } from 'lucide-react'

type Tab = 'carriers' | 'brokers' | 'dealerships' | 'shippers'

const TABS: { id: Tab; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'carriers',    label: 'Carriers',     icon: Truck,      description: 'FMCSA-registered truck carriers' },
  { id: 'brokers',     label: 'Brokers',      icon: Building2,  description: 'Freight and vehicle transport brokers' },
  { id: 'dealerships', label: 'Dealerships',  icon: Store,      description: 'Auto dealers and auction houses' },
  { id: 'shippers',    label: 'Shippers',     icon: Package,    description: 'Companies shipping vehicles regularly' },
]

export default function ContactsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('carriers')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showBulkModal, setShowBulkModal] = useState(false)

  function refresh() { setRefreshKey(k => k + 1) }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage carrier, broker, dealership, and shipper contacts for outreach campaigns
          </p>
        </div>
        {activeTab === 'carriers' && (
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00B8A9] text-white rounded-lg text-sm font-medium hover:bg-[#009e92] transition-colors"
          >
            <Upload className="h-4 w-4" /> Bulk Enrich CSV
          </button>
        )}
      </div>

      {/* Enrichment stats (carriers tab only) */}
      {activeTab === 'carriers' && <EnrichmentStats key={refreshKey} />}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1" aria-label="Contact type tabs">
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  active
                    ? 'border-[#00B8A9] text-[#00B8A9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'carriers' && (
        <div className="space-y-6">
          <div id="enrich-form">
            <EnrichmentForm onSuccess={refresh} />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Enriched Carriers</h2>
            <CarriersList key={refreshKey} onEnrich={() => {
              document.getElementById('enrich-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }} />
          </div>
        </div>
      )}

      {activeTab === 'brokers' && (
        <ContactsTab key={`brokers-${refreshKey}`} contactType="broker" onAdd={refresh} />
      )}

      {activeTab === 'dealerships' && (
        <ContactsTab key={`dealerships-${refreshKey}`} contactType="dealership" onAdd={refresh} />
      )}

      {activeTab === 'shippers' && (
        <ContactsTab key={`shippers-${refreshKey}`} contactType="shipper" onAdd={refresh} />
      )}

      {/* Bulk modal */}
      {showBulkModal && (
        <BulkEnrichModal
          onClose={() => setShowBulkModal(false)}
          onComplete={() => { refresh(); setShowBulkModal(false) }}
        />
      )}
    </div>
  )
}
