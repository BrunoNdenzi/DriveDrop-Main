'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, Loader2 } from '@/components/icons/streamline-lucide'
import { supabase } from '@/lib/supabase'
import { AccessPageShell } from '@/components/auth/AccessPageShell'

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
    <AccessPageShell eyebrow="Identity verification" title="Confirming your account." description="DriveDrop is securely validating your email and preparing your workspace.">
          <div className="border border-[#c7d4d2] bg-white p-8 text-center sm:p-12">
            {status === 'loading' && (
              <>
                <div className="mx-auto grid h-16 w-16 place-items-center bg-[#e7f3f1] text-[#008c82]">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-[#193638]">Verifying your email</h1>
                  <p className="text-muted-foreground">
                    Please wait while we verify your email address
                  </p>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mx-auto grid h-16 w-16 place-items-center bg-[#eaf7f3] text-[#176c59]">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-[#193638]">Email verified</h1>
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
                <div className="mx-auto grid h-16 w-16 place-items-center border border-[#e5b8b4] bg-[#fff4f3] text-[#9f2f27]">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-[#193638]">Verification failed</h1>
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
    </AccessPageShell>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#f2f6f5]"><Loader2 className="h-8 w-8 animate-spin text-[#008c82]" /></div>
    }>
      <AuthConfirmContent />
    </Suspense>
  )
}
