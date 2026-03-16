'use client'

import { useCallback, useEffect, useState } from 'react'
import { listCarriers, createContact, updateCarrier } from '@/lib/api/carriers'
import type { CarrierContact } from '@/types/campaigns'
import { toast } from '@/components/ui/toast'
import { Loader2, Plus, Search, RefreshCw, ExternalLink } from 'lucide-react'

type ContactType = 'broker' | 'dealership' | 'shipper'

const TYPE_LABELS: Record<ContactType, string> = {
  broker:     'Broker',
  dealership: 'Dealership',
  shipper:    'Shipper',
}

const TYPE_EMPTY: Record<ContactType, string> = {
  broker:     'No broker contacts yet. Add your first broker above.',
  dealership: 'No dealership contacts yet. Add your first dealership above.',
  shipper:    'No shipper contacts yet. Add your first shipper above.',
}

interface ContactsTabProps {
  contactType: ContactType
  onAdd?: () => void
}

interface NewContactForm {
  company_name: string
  email: string
  phone: string
  state: string
  city: string
  address: string
  zip: string
  website: string
}

const EMPTY_FORM: NewContactForm = {
  company_name: '',
  email: '',
  phone: '',
  state: '',
  city: '',
  address: '',
  zip: '',
  website: '',
}

export default function ContactsTab({ contactType, onAdd }: ContactsTabProps) {
  const [contacts, setContacts] = useState<CarrierContact[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewContactForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const limit = 30

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listCarriers({
        contactType,
        search: search || undefined,
        page,
        limit,
      })
      setContacts(res.carriers)
      setTotal(res.total)
    } catch {
      // no-op
    } finally {
      setLoading(false)
    }
  }, [contactType, search, page])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim()) return
    setSaving(true)
    try {
      await createContact({
        contact_type: contactType,
        company_name: form.company_name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        state: form.state.trim() || undefined,
        city: form.city.trim() || undefined,
        address: form.address.trim() || undefined,
        zip: form.zip.trim() || undefined,
        website: form.website.trim() || undefined,
      })
      toast(`${TYPE_LABELS[contactType]} contact added`, 'success')
      setForm(EMPTY_FORM)
      setShowForm(false)
      onAdd?.()
      load()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create contact', 'error')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / limit)
  const label = TYPE_LABELS[contactType]

  return (
    <div className="space-y-4">
      {/* Add contact form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Add {label} Contact</h3>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00B8A9] text-white rounded-lg text-sm font-medium hover:bg-[#009e92] transition-colors"
          >
            <Plus className="h-4 w-4" />
            {showForm ? 'Cancel' : `New ${label}`}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Company Name *</label>
              <input
                required
                type="text"
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                placeholder={`${label} company name`}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9]"
              />
            </div>
            <Field label="Email" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="contact@company.com" />
            <Field label="Phone" type="tel" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="(555) 000-0000" />
            <Field label="State" value={form.state} onChange={v => setForm(f => ({ ...f, state: v }))} placeholder="NC" maxLength={2} />
            <Field label="City" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} placeholder="Charlotte" />
            <Field label="Address" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} placeholder="123 Main St" />
            <Field label="ZIP" value={form.zip} onChange={v => setForm(f => ({ ...f, zip: v }))} placeholder="28202" />
            <div className="col-span-2">
              <Field label="Website" type="url" value={form.website} onChange={v => setForm(f => ({ ...f, website: v }))} placeholder="https://company.com" />
            </div>
            <div className="col-span-2 flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !form.company_name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-[#00B8A9] text-white rounded-lg text-sm font-medium hover:bg-[#009e92] disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save {label}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            {label} Contacts
            {total > 0 && <span className="ml-2 text-sm font-normal text-gray-400">({total.toLocaleString()})</span>}
          </h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${label.toLowerCase()}s...`}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-[#00B8A9]"
              />
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="px-2.5 py-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#00B8A9]" /></div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">{search ? `No ${label.toLowerCase()}s match "${search}"` : TYPE_EMPTY[contactType]}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">State</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Website</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {contacts.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-xs truncate">{c.company_name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {c.email ? (
                          <a href={`mailto:${c.email}`} className="hover:text-[#00B8A9]">{c.email}</a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.phone || <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-3 text-gray-500">{c.state || <span className="text-gray-400">—</span>}</td>
                      <td className="px-4 py-3">
                        {c.website ? (
                          <a
                            href={c.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#00B8A9] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Visit
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                <span>Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', maxLength }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  maxLength?: number
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9]"
      />
    </div>
  )
}
