'use client'

import { useState } from 'react'
import { sendTestEmail } from '@/lib/api/campaigns'
import { toast } from '@/components/ui/toast'
import { Loader2, Send, X } from 'lucide-react'

interface TestEmailModalProps {
  campaignId: string
  onClose: () => void
}

export default function TestEmailModal({ campaignId, onClose }: TestEmailModalProps) {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!email.trim()) return
    setSending(true)
    try {
      await sendTestEmail(campaignId, email.trim())
      toast('Test email sent successfully!', 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send test email', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Send Test Email</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Send a test version of this campaign to an email address. Variables will use sample data.
        </p>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
            placeholder="you@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00B8A9]"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!email.trim() || sending}
            className="flex-1 px-4 py-2 bg-[#00B8A9] text-white rounded-lg text-sm font-medium hover:bg-[#009e92] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
            ) : (
              <><Send className="h-4 w-4" /> Send Test</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
