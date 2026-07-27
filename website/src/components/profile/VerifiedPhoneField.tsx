'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Phone } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { toast } from '@/components/ui/toast'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

interface VerifiedPhoneFieldProps {
  value: string
  onVerified: (phone: string) => void | Promise<void>
}

export default function VerifiedPhoneField({ value, onVerified }: VerifiedPhoneFieldProps) {
  const [phone, setPhone] = useState(value)
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => setPhone(value), [value])

  const request = async (path: string, body: Record<string, string>) => {
    const supabase = getSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) throw new Error('Please sign in again')

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const result = await response.json().catch(() => ({})) as { error?: string; phone?: string }
    if (!response.ok) throw new Error(result.error || 'Phone verification failed')
    return result
  }

  const sendCode = async () => {
    setLoading(true)
    try {
      const result = await request('/users/me/phone/send-otp', { phone })
      if (result.phone) setPhone(result.phone)
      setCodeSent(true)
      toast('Verification code sent', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not send verification code', 'error')
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async () => {
    setLoading(true)
    try {
      const result = await request('/users/me/phone/verify', { phone, code })
      const verifiedPhone = result.phone || phone
      await onVerified(verifiedPhone)
      setPhone(verifiedPhone)
      setCode('')
      setCodeSent(false)
      toast('Phone number verified and saved', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Invalid verification code', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="tel"
            value={phone}
            onChange={event => {
              setPhone(event.target.value)
              setCodeSent(false)
              setCode('')
            }}
            className="w-full rounded-md border px-3 py-2 pl-10 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="+1 555 123 4567"
          />
        </div>
        <button
          type="button"
          onClick={sendCode}
          disabled={loading || !phone.trim()}
          className="rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          {loading && !codeSent ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
        </button>
      </div>

      {codeSent && (
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 10))}
            className="min-w-0 flex-1 rounded-md border px-3 py-2"
            placeholder="Verification code"
          />
          <button
            type="button"
            onClick={verifyCode}
            disabled={loading || code.length < 4}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Confirm
          </button>
        </div>
      )}
      <p className="text-xs text-gray-500">Changes are saved only after SMS verification.</p>
    </div>
  )
}