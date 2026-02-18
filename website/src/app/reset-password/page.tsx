'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, ArrowRight, AlertCircle, CheckCircle, Loader2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)

  useEffect(() => {
    const initializePasswordReset = async () => {
      // Check for code or token parameter (from password reset email)
      const code = searchParams?.get('code')
      const token = searchParams?.get('token')
      const resetCode = code || token
      
      // Also check for access_token in hash (Supabase implicit flow)
      const hash = window.location.hash
      const hashParams = new URLSearchParams(hash.substring(1))
      const accessToken = hashParams.get('access_token')
      
      if (resetCode) {
        try {
          // Exchange code for session
          const { data, error } = await supabase.auth.exchangeCodeForSession(resetCode)
          
          if (error) {
            console.error('Error exchanging code:', error)
            setError('Invalid or expired reset link. Please request a new one.')
            setIsValidToken(false)
          } else if (data.session) {
            console.log('Successfully exchanged code for session')
            setIsValidToken(true)
          }
        } catch (err) {
          console.error('Error in code exchange:', err)
          setError('Failed to validate reset link. Please try again.')
          setIsValidToken(false)
        }
      } else if (accessToken) {
        // If we have access token in hash, the session should already be set by Supabase
        console.log('Found access token in hash, checking session')
        try {
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session) {
            console.log('Session found from hash token')
            setIsValidToken(true)
          } else {
            setError('Invalid or expired reset link. Please request a new one.')
            setIsValidToken(false)
          }
        } catch (err) {
          console.error('Error getting session:', err)
          setError('Failed to validate session. Please try again.')
          setIsValidToken(false)
        }
      } else {
        // Check if we have an existing session from the reset link
        try {
          const { data: { session } } = await supabase.auth.getSession()
          
          if (session) {
            console.log('Found existing session')
            setIsValidToken(true)
          } else {
            setError('Invalid or expired reset link. Please request a new one.')
            setIsValidToken(false)
          }
        } catch (err) {
          console.error('Error getting session:', err)
          setError('Failed to validate session. Please try again.')
          setIsValidToken(false)
        }
      }
    }

    initializePasswordReset()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) throw updateError

      setSuccess(true)
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (err: any) {
      console.error('Password reset error:', err)
      setError(err.message || 'Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-20 pb-16 bg-[hsl(var(--surface-field))] flex items-center justify-center">
          <div className="container">
            <div className="max-w-md mx-auto text-center space-y-6 bg-white border border-border rounded-md p-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-emerald-500">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Password Reset!</h1>
                <p className="text-muted-foreground">
                  Your password has been successfully reset.
                </p>
                <p className="text-sm text-muted-foreground pt-4">
                  You can now sign in with your new password.
                </p>
              </div>
              <div className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Redirecting to login page...
                </p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  if (!isValidToken) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-20 pb-16 bg-[hsl(var(--surface-field))] flex items-center justify-center">
          <div className="container">
            <div className="max-w-md mx-auto text-center space-y-6 bg-white border border-border rounded-md p-10">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-7 h-7 text-destructive" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Invalid Reset Link</h1>
                <p className="text-muted-foreground">
                  This password reset link is invalid or has expired.
                </p>
              </div>
              <div className="pt-6 space-y-3">
                <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white">
                  <Link href="/forgot-password">
                    Request New Reset Link
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login">
                    Back to Login
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-16 bg-[hsl(var(--surface-field))]">
        <div className="container">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center space-y-3 mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-blue-500">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Reset Your Password</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a strong password for your account
                </p>
              </div>
            </div>

            {/* Reset Form Card */}
            <div className="bg-white border border-border rounded-md p-6 shadow-sm">
              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="pl-10 pr-10 h-10 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters long
                  </p>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pl-10 pr-10 h-10 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 rounded-md font-semibold bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Resetting password...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Reset Password
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>
              </form>
            </div>

            {/* Password Requirements */}
            <div className="mt-6 bg-white border border-border rounded-md p-5 space-y-3">
              <h3 className="font-semibold text-sm">Password Requirements:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  At least 8 characters long
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Mix of uppercase and lowercase letters (recommended)
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Include numbers and special characters (recommended)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <>
        <Header />
        <main className="min-h-screen pt-20 pb-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </main>
        <Footer />
      </>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
