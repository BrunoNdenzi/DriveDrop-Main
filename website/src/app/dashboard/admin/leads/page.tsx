'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { toast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import {
  Search, Upload, Download, Filter, RefreshCw, Plus, Trash2, Mail, Phone,
  Building2, MapPin, Users, TrendingUp, Target, FileText, Globe, ChevronDown,
  CheckCircle, Clock, AlertTriangle, XCircle, ExternalLink, Database
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

interface Lead {
  id: string
  source: string
  lead_type: string
  company_name: string
  dba_name?: string
  contact_first_name?: string
  contact_last_name?: string
  contact_email?: string
  contact_phone?: string
  contact_title?: string
  address_city?: string
  address_state?: string
  address_zip?: string
  usdot_number?: string
  mc_number?: string
  operating_status?: string
  total_drivers?: number
  total_power_units?: number
  fleet_size?: number
  score: number
  status: string
  priority: string
  contact_attempts: number
  last_contacted_at?: string
  tags?: string[]
  notes?: string
  created_at: string
}

interface LeadStats {
  total: number
  new: number
  contacted: number
  qualified: number
  converted: number
  byType: Record<string, number>
  bySource: Record<string, number>
  recentImports: any[]
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  responding: 'bg-purple-100 text-purple-800',
  qualified: 'bg-emerald-100 text-emerald-800',
  negotiating: 'bg-orange-100 text-orange-800',
  converted: 'bg-green-100 text-green-800',
  lost: 'bg-gray-100 text-gray-500',
  unsubscribed: 'bg-red-100 text-red-600',
  invalid: 'bg-red-50 text-red-400',
}

const LEAD_TYPE_LABELS: Record<string, string> = {
  carrier: 'Carrier',
  broker: 'Broker',
  dealer: 'Dealer',
  shipper: 'Shipper',
  fleet_owner: 'Fleet Owner',
  auction_house: 'Auction House',
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY'
]

export default function LeadAcquisitionPage() {
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterState, setFilterState] = useState('')

  // Selected leads for bulk actions
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // Modals
  const [showImportModal, setShowImportModal] = useState(false)
  const [showFMCSAModal, setShowFMCSAModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCSVModal, setShowCSVModal] = useState(false)

  // FMCSA import state
  const [fmcsaState, setFmcsaState] = useState('TX')
  const [fmcsaCity, setFmcsaCity] = useState('')
  const [fmcsaEntityType, setFmcsaEntityType] = useState('CARRIER')
  const [fmcsaMaxRecords, setFmcsaMaxRecords] = useState(100)
  const [importing, setImporting] = useState(false)

  // CSV import state
  const [csvData, setCsvData] = useState('')
  const [csvLeadType, setCsvLeadType] = useState('carrier')
  const [csvMapping, setCsvMapping] = useState<Record<string, string>>({})
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])

  // Add lead state
  const [newLead, setNewLead] = useState({
    company_name: '', lead_type: 'carrier', contact_first_name: '', contact_last_name: '',
    contact_email: '', contact_phone: '', address_city: '', address_state: '',
    usdot_number: '', mc_number: '', notes: '',
  })

  const [activeTab, setActiveTab] = useState<'leads' | 'stats'>('leads')

  const getAuthHeaders = useCallback(async () => {
    const { getSupabaseBrowserClient } = await import('@/lib/supabase-client')
    const supabase = getSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    }
  }, [])

  const fetchLeads = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const params = new URLSearchParams({ page: page.toString(), limit: '25' })
      if (search) params.set('search', search)
      if (filterStatus) params.set('status', filterStatus)
      if (filterType) params.set('lead_type', filterType)
      if (filterSource) params.set('source', filterSource)
      if (filterState) params.set('state', filterState)

      const res = await fetch(`${API_URL}/leads?${params}`, { headers })
      const json = await res.json()
      if (json.success) {
        setLeads(json.data || [])
        setTotal(json.meta?.total || 0)
        setTotalPages(json.meta?.totalPages || 1)
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err)
    } finally {
      setLoading(false)
    }
  }, [page, search, filterStatus, filterType, filterSource, filterState, getAuthHeaders])

  const fetchStats = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_URL}/leads/stats`, { headers })
      const json = await res.json()
      if (json.success) setStats(json.data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }, [getAuthHeaders])

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchLeads()
      fetchStats()
    }
  }, [profile, fetchLeads, fetchStats])

  const handleFMCSAImport = async () => {
    setImporting(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_URL}/leads/fmcsa/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          state: fmcsaState,
          city: fmcsaCity || undefined,
          entity_type: fmcsaEntityType,
          max_records: fmcsaMaxRecords,
        }),
      })
      const json = await res.json()
      if (json.success) {
        const d = json.data
        toast(`Imported ${d.imported} leads (${d.duplicates} duplicates, ${d.skipped} skipped)`, 'success')
        setShowFMCSAModal(false)
        fetchLeads()
        fetchStats()
      } else {
        toast(json.error?.message || 'Import failed', 'error')
      }
    } catch (err) {
      toast('Import failed', 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleCSVImport = async () => {
    if (!csvData || Object.keys(csvMapping).length === 0) {
      toast('Please provide CSV data and column mapping', 'error')
      return
    }
    setImporting(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_URL}/leads/csv/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          csv_data: csvData,
          lead_type: csvLeadType,
          column_mapping: csvMapping,
        }),
      })
      const json = await res.json()
      if (json.success) {
        const d = json.data
        toast(`Imported ${d.imported} leads (${d.duplicates} duplicates, ${d.errors} errors)`, 'success')
        setShowCSVModal(false)
        setCsvData('')
        setCsvHeaders([])
        setCsvMapping({})
        fetchLeads()
        fetchStats()
      } else {
        toast(json.error?.message || 'Import failed', 'error')
      }
    } catch (err) {
      toast('CSV import failed', 'error')
    } finally {
      setImporting(false)
    }
  }

  const handleAddLead = async () => {
    if (!newLead.company_name) {
      toast('Company name is required', 'error')
      return
    }
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`${API_URL}/leads`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...newLead, source: 'manual' }),
      })
      const json = await res.json()
      if (json.success) {
        toast('Lead added', 'success')
        setShowAddModal(false)
        setNewLead({ company_name: '', lead_type: 'carrier', contact_first_name: '', contact_last_name: '', contact_email: '', contact_phone: '', address_city: '', address_state: '', usdot_number: '', mc_number: '', notes: '' })
        fetchLeads()
        fetchStats()
      } else {
        toast(json.error?.message || 'Failed to add lead', 'error')
      }
    } catch (err) {
      toast('Failed to add lead', 'error')
    }
  }

  const handleStatusUpdate = async (leadId: string, status: string) => {
    try {
      const headers = await getAuthHeaders()
      await fetch(`${API_URL}/leads/${leadId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      })
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l))
      fetchStats()
    } catch (err) {
      toast('Failed to update status', 'error')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return
    if (!confirm(`Delete ${selectedLeads.size} lead(s)?`)) return
    try {
      const headers = await getAuthHeaders()
      await fetch(`${API_URL}/leads/bulk`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ lead_ids: Array.from(selectedLeads) }),
      })
      toast(`Deleted ${selectedLeads.size} lead(s)`, 'success')
      setSelectedLeads(new Set())
      fetchLeads()
      fetchStats()
    } catch (err) {
      toast('Failed to delete', 'error')
    }
  }

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedLeads.size === 0) return
    try {
      const headers = await getAuthHeaders()
      await fetch(`${API_URL}/leads/bulk/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ lead_ids: Array.from(selectedLeads), status }),
      })
      toast(`Updated ${selectedLeads.size} lead(s)`, 'success')
      setSelectedLeads(new Set())
      fetchLeads()
      fetchStats()
    } catch (err) {
      toast('Failed to update', 'error')
    }
  }

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)))
    }
    setSelectAll(!selectAll)
  }

  const toggleSelectLead = (id: string) => {
    const next = new Set(selectedLeads)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedLeads(next)
  }

  const handleCSVFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvData(text)
      // Extract headers from first line
      const firstLine = text.split('\n')[0]
      if (firstLine) {
        const headers = firstLine.split(',').map(h => h.trim().replace(/"/g, ''))
        setCsvHeaders(headers)
        // Auto-map common columns
        const autoMap: Record<string, string> = {}
        headers.forEach(h => {
          const lower = h.toLowerCase()
          if (lower.includes('company') || lower.includes('legal_name') || lower === 'name') autoMap[h] = 'company_name'
          else if (lower.includes('email')) autoMap[h] = 'contact_email'
          else if (lower.includes('phone') || lower.includes('telephone')) autoMap[h] = 'contact_phone'
          else if (lower.includes('city') || lower === 'phy_city') autoMap[h] = 'address_city'
          else if (lower.includes('state') || lower === 'phy_state') autoMap[h] = 'address_state'
          else if (lower.includes('zip')) autoMap[h] = 'address_zip'
          else if (lower.includes('dot') || lower === 'dot_number') autoMap[h] = 'usdot_number'
          else if (lower.includes('mc_number') || lower === 'mc') autoMap[h] = 'mc_number'
          else if (lower.includes('dba')) autoMap[h] = 'dba_name'
          else if (lower.includes('first')) autoMap[h] = 'contact_first_name'
          else if (lower.includes('last')) autoMap[h] = 'contact_last_name'
          else if (lower.includes('street') || lower.includes('address')) autoMap[h] = 'address_street'
          else if (lower.includes('website') || lower.includes('url')) autoMap[h] = 'website_url'
        })
        setCsvMapping(autoMap)
      }
    }
    reader.readAsText(file)
  }

  const exportLeadsCSV = async () => {
    try {
      const headers = await getAuthHeaders()
      const params = new URLSearchParams({ limit: '10000' })
      if (filterStatus) params.set('status', filterStatus)
      if (filterType) params.set('lead_type', filterType)
      if (filterState) params.set('state', filterState)
      
      const res = await fetch(`${API_URL}/leads?${params}`, { headers })
      const json = await res.json()
      if (!json.success) return

      const data = json.data as Lead[]
      const csvCols = ['company_name','contact_email','contact_phone','lead_type','address_city','address_state','usdot_number','mc_number','score','status','fleet_size','created_at']
      const csv = [csvCols.join(','), ...data.map(l => csvCols.map(c => `"${(l as any)[c] || ''}"` ).join(','))].join('\n')
      
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `drivedrop_leads_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast('Export failed', 'error')
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 bg-green-50'
    if (score >= 40) return 'text-yellow-600 bg-yellow-50'
    return 'text-gray-500 bg-gray-50'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lead Acquisition</h1>
          <p className="text-sm text-gray-500">Manage carriers, brokers, dealers & shipper leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCSVModal(true)}>
            <Upload className="h-4 w-4 mr-1" /> CSV Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFMCSAModal(true)}>
            <Database className="h-4 w-4 mr-1" /> FMCSA Import
          </Button>
          <Button variant="outline" size="sm" onClick={exportLeadsCSV}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button size="sm" onClick={() => setShowAddModal(true)} className="bg-amber-500 hover:bg-amber-600">
            <Plus className="h-4 w-4 mr-1" /> Add Lead
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-lg border p-3">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500">Total Leads</div>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
            <div className="text-xs text-gray-500">New</div>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <div className="text-2xl font-bold text-yellow-600">{stats.contacted}</div>
            <div className="text-xs text-gray-500">Contacted</div>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <div className="text-2xl font-bold text-emerald-600">{stats.qualified}</div>
            <div className="text-xs text-gray-500">Qualified</div>
          </div>
          <div className="bg-white rounded-lg border p-3">
            <div className="text-2xl font-bold text-green-600">{stats.converted}</div>
            <div className="text-xs text-gray-500">Converted</div>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search company, email, DOT#, MC#..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
            />
          </div>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} className="border rounded-md px-2 py-2 text-sm">
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="responding">Responding</option>
            <option value="qualified">Qualified</option>
            <option value="negotiating">Negotiating</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }} className="border rounded-md px-2 py-2 text-sm">
            <option value="">All Types</option>
            <option value="carrier">Carrier</option>
            <option value="broker">Broker</option>
            <option value="dealer">Dealer</option>
            <option value="shipper">Shipper</option>
            <option value="fleet_owner">Fleet Owner</option>
            <option value="auction_house">Auction House</option>
          </select>
          <select value={filterState} onChange={e => { setFilterState(e.target.value); setPage(1) }} className="border rounded-md px-2 py-2 text-sm">
            <option value="">All States</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(1) }} className="border rounded-md px-2 py-2 text-sm">
            <option value="">All Sources</option>
            <option value="fmcsa">FMCSA</option>
            <option value="csv_import">CSV Import</option>
            <option value="manual">Manual</option>
            <option value="website">Website</option>
            <option value="referral">Referral</option>
          </select>
          <Button variant="ghost" size="sm" onClick={() => { fetchLeads(); fetchStats() }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedLeads.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-medium text-amber-800">{selectedLeads.size} lead(s) selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => handleBulkStatusUpdate('contacted')}>Mark Contacted</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkStatusUpdate('qualified')}>Mark Qualified</Button>
            <Button size="sm" variant="outline" className="text-red-600" onClick={handleBulkDelete}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left">
                  <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} className="rounded" />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Company</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Contact</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Location</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">DOT / MC</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">Score</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Source</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">
                  No leads found. Import from FMCSA, upload a CSV, or add manually.
                </td></tr>
              ) : leads.map(lead => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selectedLeads.has(lead.id)} onChange={() => toggleSelectLead(lead.id)} className="rounded" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900 truncate max-w-[180px]">{lead.company_name}</div>
                    {lead.dba_name && <div className="text-xs text-gray-400">DBA: {lead.dba_name}</div>}
                    {lead.fleet_size && <div className="text-xs text-gray-400">{lead.fleet_size} units</div>}
                  </td>
                  <td className="px-3 py-2">
                    {lead.contact_first_name && (
                      <div className="text-gray-900 text-xs">{lead.contact_first_name} {lead.contact_last_name}</div>
                    )}
                    {lead.contact_email && (
                      <a href={`mailto:${lead.contact_email}`} className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                        <Mail className="h-3 w-3" />{lead.contact_email}
                      </a>
                    )}
                    {lead.contact_phone && (
                      <a href={`tel:${lead.contact_phone}`} className="text-gray-500 text-xs flex items-center gap-1">
                        <Phone className="h-3 w-3" />{lead.contact_phone}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {lead.lead_type === 'carrier' && <Building2 className="h-3 w-3" />}
                      {LEAD_TYPE_LABELS[lead.lead_type] || lead.lead_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {lead.address_city && `${lead.address_city}, `}{lead.address_state}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-gray-600">
                    {lead.usdot_number && <div>DOT: {lead.usdot_number}</div>}
                    {lead.mc_number && <div>MC: {lead.mc_number}</div>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getScoreColor(lead.score)}`}>
                      {lead.score}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={lead.status}
                      onChange={e => handleStatusUpdate(lead.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full border-0 font-medium ${STATUS_COLORS[lead.status] || 'bg-gray-100'}`}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="responding">Responding</option>
                      <option value="qualified">Qualified</option>
                      <option value="negotiating">Negotiating</option>
                      <option value="converted">Converted</option>
                      <option value="lost">Lost</option>
                      <option value="invalid">Invalid</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs text-gray-500 capitalize">{lead.source.replace('_', ' ')}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {lead.usdot_number && (
                      <a
                        href={`https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${lead.usdot_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 inline-flex items-center text-xs"
                        title="View on FMCSA SAFER"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t px-4 py-2 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of {total}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* FMCSA Import Modal */}
      {showFMCSAModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-amber-500" /> Import from FMCSA
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Import carriers and brokers from the FMCSA public database (SAFER system).
              Requires an FMCSA API key set in environment variables.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">State</label>
                <select value={fmcsaState} onChange={e => setFmcsaState(e.target.value)} className="w-full border rounded-md px-3 py-2 mt-1 text-sm">
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">City (optional)</label>
                <input type="text" value={fmcsaCity} onChange={e => setFmcsaCity(e.target.value)} placeholder="e.g. Dallas" className="w-full border rounded-md px-3 py-2 mt-1 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Entity Type</label>
                <select value={fmcsaEntityType} onChange={e => setFmcsaEntityType(e.target.value)} className="w-full border rounded-md px-3 py-2 mt-1 text-sm">
                  <option value="CARRIER">Carrier</option>
                  <option value="BROKER">Broker</option>
                  <option value="FREIGHT FORWARDER">Freight Forwarder</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Max Records</label>
                <input type="number" value={fmcsaMaxRecords} onChange={e => setFmcsaMaxRecords(parseInt(e.target.value) || 50)} min={10} max={1000} className="w-full border rounded-md px-3 py-2 mt-1 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowFMCSAModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-amber-500 hover:bg-amber-600" onClick={handleFMCSAImport} disabled={importing}>
                {importing ? 'Importing...' : 'Start Import'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5 text-amber-500" /> CSV Import
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Lead Type</label>
                <select value={csvLeadType} onChange={e => setCsvLeadType(e.target.value)} className="w-full border rounded-md px-3 py-2 mt-1 text-sm">
                  <option value="carrier">Carrier</option>
                  <option value="broker">Broker</option>
                  <option value="dealer">Dealer</option>
                  <option value="shipper">Shipper</option>
                  <option value="fleet_owner">Fleet Owner</option>
                  <option value="auction_house">Auction House</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">CSV File</label>
                <input type="file" accept=".csv,.txt" onChange={handleCSVFileRead} className="w-full border rounded-md px-3 py-2 mt-1 text-sm" />
              </div>
              {csvHeaders.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Column Mapping</label>
                  <p className="text-xs text-gray-400 mb-2">Map CSV columns to lead fields. Auto-detected mappings shown below.</p>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {csvHeaders.map(header => (
                      <div key={header} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-32 truncate font-mono">{header}</span>
                        <span className="text-gray-300">→</span>
                        <select
                          value={csvMapping[header] || ''}
                          onChange={e => setCsvMapping(prev => {
                            const next = { ...prev }
                            if (e.target.value) next[header] = e.target.value
                            else delete next[header]
                            return next
                          })}
                          className="flex-1 border rounded px-2 py-1 text-xs"
                        >
                          <option value="">-- skip --</option>
                          <option value="company_name">Company Name</option>
                          <option value="dba_name">DBA Name</option>
                          <option value="contact_first_name">First Name</option>
                          <option value="contact_last_name">Last Name</option>
                          <option value="contact_email">Email</option>
                          <option value="contact_phone">Phone</option>
                          <option value="contact_title">Title</option>
                          <option value="address_street">Street</option>
                          <option value="address_city">City</option>
                          <option value="address_state">State</option>
                          <option value="address_zip">Zip</option>
                          <option value="usdot_number">USDOT #</option>
                          <option value="mc_number">MC #</option>
                          <option value="website_url">Website</option>
                          <option value="notes">Notes</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => { setShowCSVModal(false); setCsvData(''); setCsvHeaders([]); setCsvMapping({}) }}>Cancel</Button>
              <Button className="flex-1 bg-amber-500 hover:bg-amber-600" onClick={handleCSVImport} disabled={importing || !csvData}>
                {importing ? 'Importing...' : `Import ${csvHeaders.length > 0 ? '' : '(upload file first)'}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-500" /> Add Lead
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Company Name *</label>
                <input type="text" value={newLead.company_name} onChange={e => setNewLead(p => ({ ...p, company_name: e.target.value }))} className="w-full border rounded-md px-3 py-2 mt-1 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Lead Type</label>
                <select value={newLead.lead_type} onChange={e => setNewLead(p => ({ ...p, lead_type: e.target.value }))} className="w-full border rounded-md px-3 py-2 mt-1 text-sm">
                  <option value="carrier">Carrier</option>
                  <option value="broker">Broker</option>
                  <option value="dealer">Dealer</option>
                  <option value="shipper">Shipper</option>
                  <option value="fleet_owner">Fleet Owner</option>
                  <option value="auction_house">Auction House</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <input type="text" value={newLead.contact_first_name} onChange={e => setNewLead(p => ({ ...p, contact_first_name: e.target.value }))} className="w-full border rounded-md px-3 py-2 mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <input type="text" value={newLead.contact_last_name} onChange={e => setNewLead(p => ({ ...p, contact_last_name: e.target.value }))} className="w-full border rounded-md px-3 py-2 mt-1 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <input type="email" value={newLead.contact_email} onChange={e => setNewLead(p => ({ ...p, contact_email: e.target.value }))} className="w-full border rounded-md px-3 py-2 mt-1 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <input type="tel" value={newLead.contact_phone} onChange={e => setNewLead(p => ({ ...p, contact_phone: e.target.value }))} className="w-full border rounded-md px-3 py-2 mt-1 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">City</label>
                  <input type="text" value={newLead.address_city} onChange={e => setNewLead(p => ({ ...p, address_city: e.target.value }))} className="w-full border rounded-md px-3 py-2 mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">State</label>
                  <select value={newLead.address_state} onChange={e => setNewLead(p => ({ ...p, address_state: e.target.value }))} className="w-full border rounded-md px-3 py-2 mt-1 text-sm">
                    <option value="">--</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium">USDOT #</label>
                  <input type="text" value={newLead.usdot_number} onChange={e => setNewLead(p => ({ ...p, usdot_number: e.target.value }))} className="w-full border rounded-md px-3 py-2 mt-1 text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium">MC #</label>
                  <input type="text" value={newLead.mc_number} onChange={e => setNewLead(p => ({ ...p, mc_number: e.target.value }))} className="w-full border rounded-md px-3 py-2 mt-1 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea value={newLead.notes} onChange={e => setNewLead(p => ({ ...p, notes: e.target.value }))} className="w-full border rounded-md px-3 py-2 mt-1 text-sm" rows={2} />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button className="flex-1 bg-amber-500 hover:bg-amber-600" onClick={handleAddLead}>Add Lead</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
