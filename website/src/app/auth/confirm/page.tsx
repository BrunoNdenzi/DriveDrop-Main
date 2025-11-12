'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

function AuthConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const code = searchParams?.get('code')
    const next = searchParams?.get('next') || '/login'

    if (code) {
      // Exchange the code for a session
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setStatus('error')
          setTimeout(() => router.push('/login'), 3000)
        } else {
          setStatus('success')
          setTimeout(() => router.push(next), 2000)
        }
      })
    } else {
      setStatus('error')
      setTimeout(() => router.push('/login'), 3000)
    }
  }, [searchParams, router])

  return (
    <>
      <Header />
      <main className="min-h-screen pt-20 pb-16 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 gradient-mesh opacity-40" />
        <div className="container relative z-10">
          <div className="max-w-md mx-auto text-center space-y-6 glass rounded-3xl p-12 animate-slide-up">
            {status === 'loading' && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent shadow-xl">
                  <Loader2 className="w-10 h-10 text-white animate-spin" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold">Verifying...</h1>
                  <p className="text-muted-foreground">
                    Please wait while we verify your email address
                  </p>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent shadow-xl">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold">Email Verified!</h1>
                  <p className="text-muted-foreground">
                    Your email has been successfully verified
                  </p>
                  <p className="text-sm text-muted-foreground pt-4">
                    Redirecting you now...
                  </p>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20">
                  <CheckCircle className="w-10 h-10 text-destructive" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold">Verification Failed</h1>
                  <p className="text-muted-foreground">
                    There was an error verifying your email
                  </p>
                  <p className="text-sm text-muted-foreground pt-4">
                    Redirecting to login...
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default function AuthConfirmPage() {
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
      <AuthConfirmContent />
    </Suspense>
  )
}
