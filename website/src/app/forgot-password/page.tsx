'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, ArrowLeft, ArrowRight, AlertCircle, CheckCircle, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
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
                <h1 className="text-3xl font-bold">Check Your Email</h1>
                <p className="text-muted-foreground">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-sm text-muted-foreground pt-4">
                  Click the link in the email to reset your password. The link will expire in 1 hour.
                </p>
              </div>
              <div className="pt-6 space-y-3">
                <Button asChild className="w-full gradient-primary hover-lift">
                  <Link href="/login">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Login
                  </Link>
                </Button>
                <Button
                  onClick={() => {
                    setSuccess(false)
                    setEmail('')
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Send Another Link
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
            {/* Back Button */}
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to login
            </Link>

            {/* Header */}
            <div className="text-center space-y-4 mb-8 animate-slide-up">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-xl">
                <Mail className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">Forgot Password?</h1>
                <p className="text-muted-foreground mt-2">
                  No worries! Enter your email and we'll send you a reset link
                </p>
              </div>
            </div>

            {/* Reset Card */}
            <div className="glass rounded-3xl p-8 shadow-2xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
              {error && (
                <div className="flex items-center gap-2 p-4 mb-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive animate-slide-down">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
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
                      className="pl-10 h-12 rounded-xl"
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
                  className="w-full h-12 rounded-xl font-semibold gradient-primary hover-lift group"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending reset link...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Send Reset Link
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
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
            <div className="mt-8 text-center space-y-2 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <p className="text-sm text-muted-foreground">
                Still having trouble? Contact our support team at{' '}
                <a href="mailto:support@drivedrop.us.com" className="text-primary hover:underline">
                  support@drivedrop.us.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
