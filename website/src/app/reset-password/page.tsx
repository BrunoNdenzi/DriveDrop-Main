'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, ArrowRight, AlertCircle, CheckCircle, Sparkles, Loader2, Eye, EyeOff } from 'lucide-react'
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
        <main className="min-h-screen pt-20 pb-16 relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 gradient-mesh opacity-40" />
          <div className="container relative z-10">
            <div className="max-w-md mx-auto text-center space-y-6 glass rounded-3xl p-12 animate-slide-up">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent shadow-xl">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">Password Reset!</h1>
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
        <main className="min-h-screen pt-20 pb-16 relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 gradient-mesh opacity-40" />
          <div className="container relative z-10">
            <div className="max-w-md mx-auto text-center space-y-6 glass rounded-3xl p-12 animate-slide-up">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">Invalid Reset Link</h1>
                <p className="text-muted-foreground">
                  This password reset link is invalid or has expired.
                </p>
              </div>
              <div className="pt-6 space-y-3">
                <Button asChild className="w-full gradient-primary hover-lift">
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
      <main className="min-h-screen pt-20 pb-16 relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 gradient-mesh opacity-40" />
        <div className="absolute top-20 left-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        <div className="container relative z-10">
          <div className="max-w-md mx-auto">
            {/* Header */}
            <div className="text-center space-y-4 mb-8 animate-slide-up">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-xl">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">Reset Your Password</h1>
                <p className="text-muted-foreground mt-2">
                  Choose a strong password for your account
                </p>
              </div>
            </div>

            {/* Reset Form Card */}
            <div className="glass rounded-3xl p-8 shadow-2xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
              {error && (
                <div className="flex items-center gap-2 p-4 mb-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive animate-slide-down">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
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
                      className="pl-10 pr-10 h-12 rounded-xl"
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
                      className="pl-10 pr-10 h-12 rounded-xl"
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
                  className="w-full h-12 rounded-xl font-semibold gradient-primary hover-lift group"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Resetting password...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Reset Password
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </Button>
              </form>
            </div>

            {/* Password Requirements */}
            <div className="mt-8 glass rounded-2xl p-6 space-y-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
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
