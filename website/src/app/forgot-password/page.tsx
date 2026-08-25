'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, ArrowLeft, ArrowRight, AlertCircle, CheckCircle } from '@/components/icons/streamline-lucide'
import { supabase } from '@/lib/supabase'
import { AccessPageShell } from '@/components/auth/AccessPageShell'

function ForgotPasswordContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Show a helpful message if the user was redirected here because a link expired
  useEffect(() => {
    if (searchParams?.get('error') === 'link-expired') {
      setError('Your reset link has expired or is invalid. Please request a new one below.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        // Always use the canonical www domain so the redirect is in Supabase's allowed list
        // regardless of whether the user started from the root or www domain
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.drivedrop.us.com'}/auth/callback?type=recovery`,
      })

      if (resetError) throw resetError

      setSuccess(true)
    } catch (err: any) {
      console.error('Password reset error:', err)
      setError(err.message || 'Failed to send reset email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <AccessPageShell eyebrow="Recovery email sent" title="Check your inbox." description="Use the secure link in your email to choose a new DriveDrop password.">
        <div className="border border-[#c7d4d2] bg-white p-6 text-center sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center bg-[#eaf7f3] text-[#176c59]"><CheckCircle className="h-7 w-7" /></div>
          <h3 className="mt-5 text-xl font-semibold text-[#193638]">Reset link sent</h3>
          <p className="mt-2 text-sm leading-6 text-[#667b79]">We sent a password reset link to <strong className="text-[#304b4c]">{email}</strong>. It expires in one hour.</p>
          <Link href="/login" className="mt-7 flex h-11 w-full items-center justify-center gap-2 bg-[#008c82] text-sm font-bold text-white hover:bg-[#00756d]"><ArrowLeft className="h-4 w-4" />Back to login</Link>
          <button type="button" onClick={() => { setSuccess(false); setEmail('') }} className="mt-4 text-sm font-semibold text-[#007b72] hover:underline">Send another link</button>
        </div>
      </AccessPageShell>
    )
  }

  return (
    <AccessPageShell eyebrow="Account recovery" title="Reset your password." description="We will send a time-limited recovery link to the email address on your account.">
          <div className="max-w-md">
            {/* Back Button */}
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to login
            </Link>

            {/* Header */}
            <div className="text-center space-y-3 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-blue-500">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Forgot Password?</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your email and we'll send you a reset link
                </p>
              </div>
            </div>

            {/* Reset Card */}
            <div className="border border-[#c7d4d2] bg-white p-6">
              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 h-10 rounded-md"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter the email address associated with your account
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full rounded-none bg-[#008c82] font-semibold text-white hover:bg-[#00756d]"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending reset link...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Send Reset Link
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </form>

              {/* Sign Up Link */}
              <div className="text-center pt-6 mt-6 border-t border-white/10">
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <Link href="/signup" className="font-semibold text-primary hover:underline">
                    Sign up
                  </Link>
                </p>
              </div>
            </div>

            {/* Help Text */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Still having trouble? Contact our support team at{' '}
                <a href="mailto:support@drivedrop.us.com" className="text-primary hover:underline">
                  support@drivedrop.us.com
                </a>
              </p>
            </div>
          </div>
    </AccessPageShell>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordContent />
    </Suspense>
  )
}
