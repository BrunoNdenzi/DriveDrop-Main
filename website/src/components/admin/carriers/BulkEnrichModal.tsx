'use client'

import { useRef, useState } from 'react'
import { bulkEnrichCarriers } from '@/lib/api/carriers'
import { toast } from '@/components/ui/toast'
import { Loader2, Upload, X, FileText, CheckCircle } from 'lucide-react'

interface BulkEnrichModalProps {
  onClose: () => void
  onComplete: () => void
}

interface BulkResult {
  enriched: number
  failed: number
  total: number
}

export default function BulkEnrichModal({ onClose, onComplete }: BulkEnrichModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BulkResult | null>(null)

  function parseCSV(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map(line => line.trim().replace(/^"|"|$/g, ''))
      .filter(line => /^\d{6,8}$/.test(line))
      .slice(0, 500)
  }

  function handleFile(f: File) {
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const dots = parseCSV(text)
      setPreview(dots)
    }
    reader.readAsText(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.type === 'text/csv' || f?.name.endsWith('.csv')) handleFile(f)
  }

  async function handleEnrich() {
    if (!preview.length) return
    setLoading(true)
    try {
      const carriers = preview.map(dot => ({
        dotNumber: dot,
        companyName: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        operatingStatus: '',
      }))
      const res = await bulkEnrichCarriers(carriers)
      setResult({ enriched: res.accepted, failed: preview.length - res.accepted, total: preview.length })
      toast(`Enriched ${res.accepted} carriers`, 'success')
      onComplete()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bulk enrichment failed', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Bulk Carrier Enrichment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Upload a CSV file with one DOT number per line (max 500). We'll fetch FMCSA data and find contact emails.
        </p>

        {!result ? (
          <>
            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                file ? 'border-[#00B8A9] bg-teal-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              }`}
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              {file ? (
                <div className="space-y-2">
                  <FileText className="h-8 w-8 text-[#00B8A9] mx-auto" />
                  <p className="font-medium text-gray-700">{file.name}</p>
                  <p className="text-sm text-[#00B8A9]">{preview.length} valid DOT numbers found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                  <p className="font-medium text-gray-600">Drop CSV file here or click to browse</p>
                  <p className="text-xs text-gray-400">One DOT number per line</p>
                </div>
              )}
            </div>

            {preview.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 font-medium mb-1">Preview (first 5):</p>
                <div className="flex flex-wrap gap-1">
                  {preview.slice(0, 5).map(d => (
                    <span key={d} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded font-mono">{d}</span>
                  ))}
                  {preview.length > 5 && (
                    <span className="text-xs text-gray-400">+{preview.length - 5} more</span>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleEnrich}
                disabled={!preview.length || loading}
                className="flex-1 px-4 py-2 bg-[#00B8A9] text-white rounded-lg text-sm font-medium hover:bg-[#009e92] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Enriching {preview.length}...</>
                ) : (
                  <><Upload className="h-4 w-4" /> Enrich {preview.length} Carriers</>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-gray-900">Enrichment Complete</p>
              <p className="text-sm text-gray-500 mt-1">
                {result.enriched} enriched · {result.failed} failed · {result.total} total
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#00B8A9] text-white rounded-lg text-sm font-medium hover:bg-[#009e92]"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
