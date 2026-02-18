'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase-client'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

function ChangePasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const required = searchParams?.get('required') === 'true'
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = getSupabaseBrowserClient()

  // Password validation
  const passwordRequirements = {
    minLength: newPassword.length >= 8,
    hasUpperCase: /[A-Z]/.test(newPassword),
    hasLowerCase: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
  }

  const allRequirementsMet = Object.values(passwordRequirements).every(Boolean)
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!allRequirementsMet) {
      setError('Please meet all password requirements')
      return
    }

    if (!passwordsMatch) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Not authenticated')
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) throw updateError

      // Remove force_password_change flag from user metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          force_password_change: false
        }
      })

      if (metadataError) console.error('Failed to update metadata:', metadataError)

      setSuccess(true)

      // Redirect after 2 seconds
      setTimeout(async () => {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        router.push(`/dashboard/${currentUser?.user_metadata?.role || 'client'}`)
      }, 2000)
    } catch (err: any) {
      console.error('Password change error:', err)
      setError(err.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-16 bg-[hsl(var(--surface-field))]">
        <div className="max-w-md mx-auto px-4 py-10">
          <div className="bg-white border border-border rounded-md shadow-sm p-6">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 rounded-md mb-3">
                <Lock className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                {required ? 'Password Change Required' : 'Change Password'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {required
                  ? 'For security reasons, please create a new password'
                  : 'Create a strong password to protect your account'}
              </p>
            </div>

            {success ? (
              <div className="text-center py-6">
                <CheckCircle className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                <h2 className="text-lg font-semibold mb-1">
                  Password Changed Successfully!
                </h2>
                <p className="text-sm text-muted-foreground">
                  Redirecting to your dashboard...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {/* Password Requirements */}
                {newPassword && (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-sm text-muted-foreground">Password must contain:</p>
                    <div className="space-y-1">
                      <RequirementItem met={passwordRequirements.minLength} text="At least 8 characters" />
                      <RequirementItem met={passwordRequirements.hasUpperCase} text="One uppercase letter" />
                      <RequirementItem met={passwordRequirements.hasLowerCase} text="One lowercase letter" />
                      <RequirementItem met={passwordRequirements.hasNumber} text="One number" />
                      <RequirementItem met={passwordRequirements.hasSpecial} text="One special character" />
                    </div>
                  </div>
                )}

                {/* Confirm Password */}
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {confirmPassword && (
                    <p className={`text-sm mt-1 ${passwordsMatch ? 'text-emerald-600' : 'text-destructive'}`}>
                      {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </p>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-destructive text-sm">
                    {error}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !allRequirementsMet || !passwordsMatch}
                >
                  {loading ? 'Changing Password...' : 'Change Password'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <CheckCircle className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={met ? 'text-emerald-700' : 'text-muted-foreground'}>{text}</span>
    </div>
  )
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <ChangePasswordForm />
    </Suspense>
  )
}
