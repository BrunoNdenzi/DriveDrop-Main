'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/button'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'

export default function AccountDeletionPage() {
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleDeleteRequest = async () => {
    if (confirmText !== 'DELETE MY ACCOUNT') {
      alert('Please type "DELETE MY ACCOUNT" to confirm')
      return
    }

    if (!reason.trim()) {
      alert('Please provide a reason for account deletion')
      return
    }

    setLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('Not authenticated')
      }

      // Send deletion request email
      const response = await fetch('/api/account-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: profile?.id,
          email: profile?.email,
          reason: reason,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setShowConfirmation(true)
      } else {
        throw new Error(data.error?.message || 'Failed to submit deletion request')
      }
    } catch (error: any) {
      console.error('Account deletion request failed:', error)
      alert(error.message || 'Failed to submit account deletion request. Please try again or contact support.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!profile) {
    router.push('/login?redirect=/account-deletion')
    return null
  }

  if (showConfirmation) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="container py-12 max-w-2xl">
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <h1 className="text-2xl font-bold text-green-900 mb-4">Request Submitted</h1>
            <p className="text-green-800 mb-6">
              Your account deletion request has been submitted successfully. Our team will review your request and process it within 7 business days.
            </p>
            <p className="text-sm text-green-700 mb-6">
              You will receive a confirmation email at <strong>{profile.email}</strong> once your account has been deleted.
            </p>
            <Button onClick={() => router.push('/dashboard')} className="mt-4">
              Return to Dashboard
            </Button>
          </div>
        </div>
        <Footer />
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <Header />
      <div className="container py-12 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
            <Trash2 className="h-10 w-10 text-red-600" />
            Delete Account
          </h1>
          <p className="text-muted-foreground">
            Request permanent deletion of your DriveDrop account and associated data.
          </p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <div className="flex gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-red-900 mb-2">Warning: This Action Cannot Be Undone</h3>
              <p className="text-red-800 text-sm mb-3">
                Deleting your account will permanently remove:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-red-800 text-sm">
                <li>Your profile and contact information</li>
                <li>All shipment history and tracking data</li>
                <li>Saved vehicle profiles</li>
                <li>Payment methods and billing information</li>
                <li>All messages and communications</li>
              </ul>
              <p className="text-red-800 text-sm mt-3">
                <strong>Note:</strong> Some data may be retained for legal and compliance purposes (transaction records, background checks) as outlined in our Privacy Policy.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block font-semibold mb-2">
              Reason for Deletion <span className="text-red-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please tell us why you're deleting your account (this helps us improve our service)"
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">
              Confirmation <span className="text-red-600">*</span>
            </label>
            <p className="text-sm text-gray-600 mb-2">
              Type <strong>DELETE MY ACCOUNT</strong> to confirm
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleDeleteRequest}
              disabled={loading || confirmText !== 'DELETE MY ACCOUNT' || !reason.trim()}
              variant="destructive"
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting Request...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete My Account
                </>
              )}
            </Button>
            <Button
              onClick={() => router.back()}
              variant="outline"
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>

        <div className="mt-12 p-6 bg-muted rounded-lg">
          <h3 className="font-bold mb-2">Need Help Instead?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            If you're experiencing issues, our support team is here to help. You don't need to delete your account.
          </p>
          <div className="space-y-2 text-sm">
            <p><strong>Email:</strong> <a href="mailto:support@drivedrop.us.com" className="text-primary underline">support@drivedrop.us.com</a></p>
            <p><strong>Phone:</strong> <a href="tel:+17042662317" className="text-primary underline">+1-704-266-2317</a></p>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  )
}
