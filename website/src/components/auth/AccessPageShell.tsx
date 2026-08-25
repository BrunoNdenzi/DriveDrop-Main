import Image from 'next/image'
import Link from 'next/link'
import { type ReactNode } from 'react'
import { ShieldCheck } from '@/components/icons/streamline-lucide'

type AccessPageShellProps = {
  children: ReactNode
  eyebrow: string
  title: string
  description: string
}

export function AccessPageShell({ children, eyebrow, title, description }: AccessPageShellProps) {
  return (
    <main className="min-h-screen bg-[#f2f6f5] text-[#132c2d]">
      <header className="border-b border-[#ccd9d7] bg-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="DriveDrop home"><Image src="/logo-primary.png" alt="DriveDrop" width={132} height={36} className="h-8 w-auto" priority /></Link>
          <Link href="/login" className="text-sm font-semibold text-[#526c6b] hover:text-[#007b72]">Sign in</Link>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1440px] lg:grid-cols-[minmax(0,.82fr)_minmax(420px,1.18fr)]">
        <div className="relative hidden overflow-hidden bg-[#123638] px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#c7f3ed]"><ShieldCheck className="h-4 w-4" />Secure account access</div>
            <h1 className="mt-8 max-w-md text-4xl font-semibold leading-tight">{title}</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[#c8d9d8]">{description}</p>
          </div>
          <p className="relative border-t border-white/20 pt-5 text-xs leading-5 text-[#9fbcba]">Encrypted sessions, verified identities, and accountable transport operations.</p>
        </div>

        <div className="flex items-center bg-white px-5 py-10 sm:px-10 lg:px-14 lg:py-16">
          <div className="mx-auto w-full max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#008c82]">{eyebrow}</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#132c2d] lg:hidden">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#667b79] lg:hidden">{description}</p>
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </section>
    </main>
  )
}